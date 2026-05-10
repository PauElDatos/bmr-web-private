#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BMR Web JSON Exporter — Fase 5

Extrae datos reales de MariaDB/MySQL BMR y genera el contrato JSON consumido por
la web estática creada en las fases 1–5.

Objetivos:
- No expone MariaDB al navegador ni a GitHub Pages.
- Genera JSON en web/data/ con la misma forma que los mocks de Fase 1.
- Permite exportación incremental por límites de catálogo/puntos.
- Tolera tablas opcionales ausentes y deja status/health.json con advertencias.

Uso básico:
  python exporter/export_web_json.py --env-file .env --out-dir web/data

Variables soportadas en .env o entorno:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
  BMR_DB_HOST, BMR_DB_PORT, BMR_DB_NAME, BMR_DB_USER, BMR_DB_PASS
"""
from __future__ import annotations

import argparse
import datetime as dt
import decimal
import json
import math
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError as exc:  # pragma: no cover
    print("ERROR: falta pymysql. Instala dependencias con: pip install -r exporter/requirements.txt", file=sys.stderr)
    raise

SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")

MODULES = {
    "M1": {
        "title": "M1_MARKET_INDICATOR",
        "description": "Scoring/agregación de señales H y postura diaria de mercado.",
        "where": "(hypothesis_code = 'MARKET_INDICATOR_SPX' OR hypothesis_code LIKE 'M1%')",
        "preferred_signals": ["MI_POSITION", "MI_SELL_PULSE", "MI_BUY_PULSE"],
    },
    "M2": {
        "title": "M2_BREADTH_DUAL_ML",
        "description": "Score mensual de debilidad/estrés basado en breadth.",
        "where": "hypothesis_code LIKE 'M2%'",
        "preferred_signals": ["M2_ALERT_SCORE", "M1_ALERT_SCORE"],
    },
    "M3": {
        "title": "M3_MACRO_FACTOR_KALMAN",
        "description": "Factor macro latente mensual / DFM-Kalman.",
        "where": "hypothesis_code LIKE 'M3%'",
        "preferred_signals": ["M3_MACRO_FACTOR", "M2_MACRO_FACTOR"],
    },
    "M4": {
        "title": "M4_SUPERVISED_PROBA_SPX",
        "description": "Probabilidades OOS de riesgo bajista a 6/12 meses.",
        "where": "hypothesis_code LIKE 'M4%'",
        "preferred_signals": ["M4_BEAR_RISK_12M_PROBA", "M4_BEAR_RISK_6M_PROBA"],
    },
    "M5": {
        "title": "M5_RULES_M2M3M4",
        "description": "Reglas finales que combinan M2, M3 y M4.",
        "where": "hypothesis_code LIKE 'M5%'",
        "preferred_signals": ["M5_RISK_OFF", "M2_S_WEAK", "M3_S_HEALTHY", "M4_S_SIDEWAYS_OR_DOWN"],
    },
    "M6": {
        "title": "M6_RULES_M2M3M4_COMPOSITE",
        "description": "Composite M2/M3/M4 con seÃ±ales de rÃ©gimen agregadas.",
        "where": "hypothesis_code LIKE 'M6%'",
        "preferred_signals": ["M6_RISK_OFF", "M2_S_WEAK", "M3_S_HEALTHY", "M4_S_SIDEWAYS_OR_DOWN"],
    },
    "M7": {
        "title": "M7_DEEP_SP500_DRAWDOWN",
        "description": "Probabilidades profundas de drawdown futuro del S&P 500.",
        "where": "hypothesis_code LIKE 'M7%'",
        "preferred_signals": ["M7_SP500_DD40_PROBA", "M7_SP500_DD25_PROBA", "M7_SP500_DD10_PROBA"],
    },
}

WEIGHT_HISTORY_FIELDS = [
    "hypothesis_code",
    "run_id",
    "signal_code",
    "direction",
    "weight",
    "contribution",
    "raw_value",
    "output_signal_code",
    "signed_value",
    "model_weight",
]

DEFAULT_OVERLAYS = [
    {"code": "BTC", "kind": "series", "target_code": "BTC", "label": "Bitcoin", "color": "#f59e0b"},
    {"code": "SPX", "kind": "series", "target_code": "SPX", "label": "S&P 500", "color": "#60a5fa"},
    {"code": "NDX", "kind": "series", "target_code": "NDX", "label": "Nasdaq 100", "color": "#a78bfa"},
    {"code": "DJI", "kind": "assets", "target_code": "DJI", "label": "Dow Jones", "color": "#34d399"},
    {"code": "RUT", "kind": "assets", "target_code": "RUT", "label": "Russell 2000", "color": "#fb7185"},
    {"code": "MSCI", "kind": "series", "target_code": "MSCI", "label": "MSCI World", "color": "#e879f9"},
]


def parse_env_file(path: Optional[str]) -> Dict[str, str]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"No existe el archivo .env: {path}")
    out: Dict[str, str] = {}
    for raw in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def env_get(env_file: Dict[str, str], *names: str, default: Optional[str] = None) -> Optional[str]:
    for name in names:
        if os.environ.get(name):
            return os.environ[name]
        if env_file.get(name):
            return env_file[name]
    return default


def db_config(env_file: Dict[str, str]) -> Dict[str, Any]:
    cfg = {
        "host": env_get(env_file, "BMR_DB_HOST", "DB_HOST", default="127.0.0.1"),
        "port": int(env_get(env_file, "BMR_DB_PORT", "DB_PORT", default="3306") or 3306),
        "database": env_get(env_file, "BMR_DB_NAME", "DB_NAME", default="bmr"),
        "user": env_get(env_file, "BMR_DB_USER", "DB_USER", default="api"),
        "password": env_get(env_file, "BMR_DB_PASS", "DB_PASS", default=""),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": True,
        "connect_timeout": 10,
        "read_timeout": 120,
        "write_timeout": 120,
    }
    return cfg


def connect(cfg: Dict[str, Any]):
    return pymysql.connect(**cfg)


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def json_default(obj: Any) -> Any:
    if isinstance(obj, (dt.date, dt.datetime)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        if obj.is_nan():
            return None
        return float(obj)
    return str(obj)


def safe_code(code: Any) -> str:
    text = str(code or "").strip()
    text = SAFE_NAME_RE.sub("_", text)
    return text[:180] if text else "UNKNOWN"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=json_default), encoding="utf-8")


def write_json_compact(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=json_default), encoding="utf-8")


def fetch_all(conn, sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params) if params else cur.execute(sql)
        return list(cur.fetchall())


def fetch_one(conn, sql: str, params: Sequence[Any] = ()) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params) if params else cur.execute(sql)
        return cur.fetchone()


def table_exists(conn, table: str) -> bool:
    row = fetch_one(conn, """
        SELECT 1 AS ok
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = %s
        LIMIT 1
    """, (table,))
    return bool(row)


def get_columns(conn, table: str) -> set[str]:
    rows = fetch_all(conn, """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = %s
    """, (table,))
    return {str(r["column_name"]) for r in rows}


def limit_clause(max_rows: int) -> str:
    return "" if max_rows <= 0 else " LIMIT %s"


def select_limited(conn, sql_no_limit: str, params: Sequence[Any], max_rows: int) -> List[Dict[str, Any]]:
    if max_rows and max_rows > 0:
        return fetch_all(conn, sql_no_limit + " LIMIT %s", tuple(params) + (int(max_rows),))
    return fetch_all(conn, sql_no_limit, params)


def points_from_rows(rows: Iterable[Dict[str, Any]], dt_key: str = "dt", value_key: str = "value", extra_keys: Sequence[str] = ()) -> List[Dict[str, Any]]:
    points: List[Dict[str, Any]] = []
    for r in rows:
        raw_dt = r.get(dt_key)
        raw_value = r.get(value_key)
        if raw_dt is None or raw_value is None:
            continue
        try:
            value = float(raw_value)
            if not math.isfinite(value):
                continue
        except Exception:
            continue
        if isinstance(raw_dt, dt.datetime):
            out_dt = raw_dt.date().isoformat() if raw_dt.time() == dt.time() else raw_dt.isoformat()
        elif isinstance(raw_dt, dt.date):
            out_dt = raw_dt.isoformat()
        else:
            out_dt = str(raw_dt)[:19]
        p = {"dt": out_dt, "value": value}
        for k in extra_keys:
            if k in r and r[k] is not None:
                v = r[k]
                if isinstance(v, decimal.Decimal):
                    v = float(v)
                elif isinstance(v, (dt.date, dt.datetime)):
                    v = v.isoformat()
                p[k] = v
        points.append(p)
    return points


def add_default_fields_to_indicator(row: Dict[str, Any]) -> Dict[str, Any]:
    code = str(row.get("code") or "")
    source = str(row.get("source") or "")
    notes = row.get("notes") or ""
    return {
        "id": row.get("id"),
        "code": code,
        "name": row.get("name") or code,
        "source": source,
        "frequency": row.get("frequency") or "",
        "unit": row.get("unit") or "",
        "notes": notes,
        "explanation": notes or f"Indicador {code} importado desde {source} y utilizado como input macro/financiero en BMR.",
        "signal_notes": [
            "Serie exportada desde MariaDB BMR.",
            "La lectura operativa final depende de las hipótesis H/M que consuman este indicador."
        ],
    }


def normalize_to_100(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    base = None
    for p in points:
        v = p.get("value")
        if v not in (None, 0):
            base = float(v)
            break
    if not base:
        return points
    return [{**p, "value": float(p["value"]) / base * 100.0} for p in points]


def load_catalogs(conn, args, warnings: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    catalogs: Dict[str, List[Dict[str, Any]]] = {"indicators": [], "assets": [], "series": [], "crypto": []}
    if table_exists(conn, "indicators"):
        rows = select_limited(conn, """
            SELECT id, code, name, source, frequency, unit, notes
            FROM indicators
            ORDER BY source, code
        """, (), args.max_indicators)
        catalogs["indicators"] = [add_default_fields_to_indicator(r) for r in rows]
    else:
        warnings.append("Falta tabla indicators")

    if table_exists(conn, "assets"):
        rows = select_limited(conn, """
            SELECT asset_id, symbol, name, asset_type
            FROM assets
            ORDER BY symbol
        """, (), args.max_assets)
        catalogs["assets"] = [{
            "asset_id": r.get("asset_id"),
            "symbol": r.get("symbol"),
            "code": r.get("symbol"),
            "name": r.get("name") or r.get("symbol"),
            "asset_type": r.get("asset_type") or "asset",
            "source": "prices",
        } for r in rows]
    else:
        warnings.append("Falta tabla assets")

    if table_exists(conn, "series"):
        rows = select_limited(conn, """
            SELECT series_id, code, name, series_type, notes
            FROM series
            ORDER BY code
        """, (), args.max_series)
        catalogs["series"] = [{
            "series_id": r.get("series_id"),
            "code": r.get("code"),
            "name": r.get("name") or r.get("code"),
            "series_type": r.get("series_type") or "series",
            "notes": r.get("notes") or "",
            "source": "series_prices",
        } for r in rows]
    else:
        warnings.append("Falta tabla series")

    if table_exists(conn, "crypto_ohlcv_cp"):
        rows = select_limited(conn, """
            SELECT symbol,
                   MIN(coin_id) AS coin_id,
                   MIN(date) AS first_dt,
                   MAX(date) AS last_dt,
                   COUNT(*) AS n_points,
                   MAX(quote) AS quote
            FROM crypto_ohlcv_cp
            GROUP BY symbol
            ORDER BY symbol
        """, (), args.max_crypto)
        catalogs["crypto"] = [{
            "symbol": r.get("symbol"),
            "code": r.get("symbol"),
            "name": r.get("symbol"),
            "asset_type": "crypto",
            "coin_id": r.get("coin_id"),
            "first_dt": r.get("first_dt"),
            "last_dt": r.get("last_dt"),
            "n_points": int(r.get("n_points") or 0),
            "quote": r.get("quote") or "usd",
            "source": "coinpaprika",
        } for r in rows]
    else:
        warnings.append("Falta tabla crypto_ohlcv_cp")

    return catalogs


def export_catalog_files(out_dir: Path, catalogs: Dict[str, List[Dict[str, Any]]]) -> None:
    for kind, items in catalogs.items():
        write_json(out_dir / "catalog" / f"{kind}.json", {"kind": kind, "count": len(items), "items": items})
    sources = sorted({i.get("source") for i in catalogs.get("indicators", []) if i.get("source")})
    write_json(out_dir / "catalog" / "sources.json", {"items": [{"source": s} for s in sources]})


def query_last_points(conn, inner_sql: str, params: Sequence[Any], max_points: int) -> List[Dict[str, Any]]:
    if max_points and max_points > 0:
        sql = f"SELECT * FROM ({inner_sql} ORDER BY dt DESC LIMIT %s) AS q ORDER BY dt ASC"
        return fetch_all(conn, sql, tuple(params) + (int(max_points),))
    return fetch_all(conn, inner_sql + " ORDER BY dt ASC", params)


def build_recession_bands(conn, max_points: int) -> List[Dict[str, Any]]:
    if not table_exists(conn, "indicators") or not table_exists(conn, "indicator_values"):
        return []
    row = fetch_one(conn, "SELECT id FROM indicators WHERE code='USREC' LIMIT 1")
    if not row:
        return []
    rows = query_last_points(conn, """
        SELECT dt, value
        FROM indicator_values
        WHERE indicator_id = %s
    """, (row["id"],), max_points)
    pts = points_from_rows(rows)
    bands = []
    start = None
    prev = None
    for p in pts:
        active = float(p["value"]) >= 0.5
        if active and start is None:
            start = p["dt"]
        if not active and start is not None:
            bands.append({"from": start, "to": prev or p["dt"], "color": "rgba(148, 163, 184, .16)"})
            start = None
        prev = p["dt"]
    if start is not None and prev:
        bands.append({"from": start, "to": prev, "color": "rgba(148, 163, 184, .16)"})
    return bands


def export_indicator_timeseries(conn, out_dir: Path, item: Dict[str, Any], bands: List[Dict[str, Any]], max_points: int) -> bool:
    if not table_exists(conn, "indicator_values"):
        return False
    rows = query_last_points(conn, """
        SELECT dt, value
        FROM indicator_values
        WHERE indicator_id = %s
    """, (item["id"],), max_points)
    points = points_from_rows(rows)
    payload = {"kind": "indicators", "code": item["code"], "id": item["id"], "points": points, "bands": bands}
    write_json(out_dir / "timeseries" / "indicators" / f"{safe_code(item['code'])}.json", payload)
    return bool(points)


def export_asset_timeseries(conn, out_dir: Path, item: Dict[str, Any], max_points: int) -> bool:
    if not table_exists(conn, "prices"):
        return False
    rows = query_last_points(conn, """
        SELECT time AS dt, close_p AS value, open_p, high_p, low_p, volume
        FROM prices
        WHERE asset_id = %s
    """, (item["asset_id"],), max_points)
    points = points_from_rows(rows, extra_keys=("open_p", "high_p", "low_p", "volume"))
    payload = {"kind": "assets", "code": item["symbol"], "asset_id": item["asset_id"], "points": points}
    write_json(out_dir / "timeseries" / "assets" / f"{safe_code(item['symbol'])}.json", payload)
    return bool(points)


def export_series_timeseries(conn, out_dir: Path, item: Dict[str, Any], max_points: int) -> bool:
    if not table_exists(conn, "series_prices"):
        return False
    rows = query_last_points(conn, """
        SELECT time AS dt, close_p AS value, open_p, high_p, low_p, volume, source_kind, source_id
        FROM series_prices
        WHERE series_id = %s
    """, (item["series_id"],), max_points)
    points = points_from_rows(rows, extra_keys=("open_p", "high_p", "low_p", "volume", "source_kind", "source_id"))
    payload = {"kind": "series", "code": item["code"], "series_id": item["series_id"], "points": points}
    write_json(out_dir / "timeseries" / "series" / f"{safe_code(item['code'])}.json", payload)
    return bool(points)


def export_crypto_timeseries(conn, out_dir: Path, item: Dict[str, Any], max_points: int) -> bool:
    if not table_exists(conn, "crypto_ohlcv_cp"):
        return False
    rows = query_last_points(conn, """
        SELECT date AS dt, close_p AS value, open_p, high_p, low_p, volume, market_cap, quote
        FROM crypto_ohlcv_cp
        WHERE symbol = %s AND quote = %s
    """, (item["symbol"], item.get("quote") or "usd"), max_points)
    points = points_from_rows(rows, extra_keys=("open_p", "high_p", "low_p", "volume", "market_cap", "quote"))
    payload = {"kind": "crypto", "code": item["symbol"], "symbol": item["symbol"], "points": points}
    write_json(out_dir / "timeseries" / "crypto" / f"{safe_code(item['symbol'])}.json", payload)
    return bool(points)


def export_timeseries(conn, out_dir: Path, catalogs: Dict[str, List[Dict[str, Any]]], args, warnings: List[str]) -> Dict[str, int]:
    bands = build_recession_bands(conn, args.max_points)
    counts = {"indicators": 0, "assets": 0, "series": 0, "crypto": 0}
    for item in catalogs.get("indicators", []):
        try:
            counts["indicators"] += int(export_indicator_timeseries(conn, out_dir, item, bands, args.max_points))
        except Exception as exc:
            warnings.append(f"No se pudo exportar indicador {item.get('code')}: {exc}")
    for item in catalogs.get("assets", []):
        try:
            counts["assets"] += int(export_asset_timeseries(conn, out_dir, item, args.max_points))
        except Exception as exc:
            warnings.append(f"No se pudo exportar activo {item.get('symbol')}: {exc}")
    for item in catalogs.get("series", []):
        try:
            counts["series"] += int(export_series_timeseries(conn, out_dir, item, args.max_points))
        except Exception as exc:
            warnings.append(f"No se pudo exportar serie {item.get('code')}: {exc}")
    for item in catalogs.get("crypto", []):
        try:
            counts["crypto"] += int(export_crypto_timeseries(conn, out_dir, item, args.max_points))
        except Exception as exc:
            warnings.append(f"No se pudo exportar cripto {item.get('symbol')}: {exc}")
    return counts


def load_reference_spx(conn, max_points: int) -> List[Dict[str, Any]]:
    # Preferencia: series SPX -> indicator SP500 -> asset SPX
    if table_exists(conn, "series") and table_exists(conn, "series_prices"):
        row = fetch_one(conn, "SELECT series_id FROM series WHERE code IN ('SPX','SP500') ORDER BY FIELD(code,'SPX','SP500') LIMIT 1")
        if row:
            rows = query_last_points(conn, "SELECT time AS dt, close_p AS value FROM series_prices WHERE series_id=%s", (row["series_id"],), max_points)
            pts = points_from_rows(rows)
            if pts:
                return pts
    if table_exists(conn, "indicators") and table_exists(conn, "indicator_values"):
        row = fetch_one(conn, "SELECT id FROM indicators WHERE code IN ('SP500','SPX') ORDER BY FIELD(code,'SP500','SPX') LIMIT 1")
        if row:
            rows = query_last_points(conn, "SELECT dt, value FROM indicator_values WHERE indicator_id=%s", (row["id"],), max_points)
            pts = points_from_rows(rows)
            if pts:
                return pts
    if table_exists(conn, "assets") and table_exists(conn, "prices"):
        row = fetch_one(conn, "SELECT asset_id FROM assets WHERE symbol IN ('SPX','SP500','^GSPC') ORDER BY FIELD(symbol,'SPX','SP500','^GSPC') LIMIT 1")
        if row:
            rows = query_last_points(conn, "SELECT time AS dt, close_p AS value FROM prices WHERE asset_id=%s", (row["asset_id"],), max_points)
            pts = points_from_rows(rows)
            if pts:
                return pts
    return []


def latest_run_for_module(conn, module_code: str) -> Optional[Dict[str, Any]]:
    cfg = MODULES[module_code]
    if not table_exists(conn, "ml_runs"):
        return None
    sql = f"""
        SELECT run_id, hypothesis_code, params_json, data_from, data_to, notes, created_at
        FROM ml_runs
        WHERE {cfg['where']}
        ORDER BY created_at DESC, run_id DESC
        LIMIT 1
    """
    return fetch_one(conn, sql)


def load_signals_for_run(conn, run_id: int, max_points: int) -> Dict[str, List[Dict[str, Any]]]:
    if not table_exists(conn, "ml_signal_values"):
        return {}
    rows = query_last_points(conn, """
        SELECT dt, value, signal_code, score, level, explanation
        FROM ml_signal_values
        WHERE run_id = %s
    """, (run_id,), max_points)
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        grouped[str(r.get("signal_code"))].append(r)
    return grouped


def choose_signal(grouped: Dict[str, List[Dict[str, Any]]], preferred: Sequence[str]) -> Tuple[str, List[Dict[str, Any]]]:
    for code in preferred:
        if code in grouped and grouped[code]:
            return code, grouped[code]
    if grouped:
        code = max(grouped, key=lambda k: len(grouped[k]))
        return code, grouped[code]
    return "SIN_SEÑAL", []


def infer_level(module_code: str, signal_code: str, latest_value: Optional[float], latest_row: Optional[Dict[str, Any]] = None) -> str:
    if latest_row and latest_row.get("level"):
        return str(latest_row["level"])
    if latest_value is None:
        return "SIN_DATOS"
    code = signal_code.upper()
    if module_code == "M5":
        if latest_value >= 0.5 and any(k in code for k in ["WEAK", "DOWN", "SELL", "RISK_OFF"]):
            return "RISK_OFF"
        if latest_value >= 0.5 and any(k in code for k in ["HEALTHY", "BUY", "RISK_ON"]):
            return "RISK_ON"
        return "HOLD"
    if latest_value >= 0.75:
        return "ALTO"
    if latest_value >= 0.5:
        return "MEDIO"
    return "BAJO"


def latest_point(points: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return points[-1] if points else None


def signal_series_from_grouped(module_code: str, grouped: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for code in sorted(grouped.keys()):
        rows = grouped.get(code) or []
        points = points_from_rows(rows, extra_keys=("score", "level", "explanation"))
        last_p = latest_point(points)
        last_row = rows[-1] if rows else None
        latest_value = float(last_p["value"]) if last_p else None
        out.append({
            "signal_code": code,
            "points": points,
            "n_points": len(points),
            "latest_dt": last_p.get("dt") if last_p else None,
            "latest_value": latest_value,
            "latest_score": last_p.get("score") if last_p else None,
            "latest_level": infer_level(module_code, code, latest_value, last_row),
            "latest_explanation": (last_row or {}).get("explanation") or "",
        })
    return out


def export_module_inputs(conn, out_dir: Path, module_code: str, run: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    if run and table_exists(conn, "ml_run_inputs"):
        items = fetch_all(conn, """
            SELECT input_kind, input_code, role, notes
            FROM ml_run_inputs
            WHERE run_id = %s
            ORDER BY role, input_kind, input_code
            LIMIT 300
        """, (run["run_id"],))
    payload = {"module_code": module_code, "run_id": run.get("run_id") if run else None, "items": items}
    write_json(out_dir / "market" / "inputs" / f"{module_code.lower()}.json", payload)
    return payload


def export_module_metrics(conn, out_dir: Path, module_code: str, run: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    if run and table_exists(conn, "ml_run_metrics"):
        items = fetch_all(conn, """
            SELECT metric_code, metric_value, details_json, created_at
            FROM ml_run_metrics
            WHERE run_id = %s
            ORDER BY metric_code
            LIMIT 300
        """, (run["run_id"],))
    payload = {"module_code": module_code, "run_id": run.get("run_id") if run else None, "items": items}
    write_json(out_dir / "market" / "metrics" / f"{module_code.lower()}.json", payload)
    return payload


def export_module_events(conn, out_dir: Path, module_code: str, run: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    source = "none"
    if table_exists(conn, "ml_signal_events"):
        if run:
            items = fetch_all(conn, """
                SELECT hypothesis_code, run_id, signal_code, direction, event_dt_effective,
                       entry_close, exit_close_12m, end_ret_12m_pct, max_dd_12m_pct,
                       horizon_days, lag_days_used
                FROM ml_signal_events
                WHERE run_id = %s
                ORDER BY event_dt_effective DESC
                LIMIT 120
            """, (run["run_id"],))
            source = "ml_signal_events.run_id" if items else source
        if not items and module_code == "M1":
            items = fetch_all(conn, """
                SELECT hypothesis_code, run_id, signal_code, direction, event_dt_effective,
                       entry_close, exit_close_12m, end_ret_12m_pct, max_dd_12m_pct,
                       horizon_days, lag_days_used
                FROM ml_signal_events
                WHERE hypothesis_code LIKE 'H%'
                ORDER BY event_dt_effective DESC
                LIMIT 120
            """)
            source = "ml_signal_events.hypothesis_code_H" if items else source
    payload = {"module_code": module_code, "run_id": run.get("run_id") if run else None, "source": source, "items": items}
    write_json(out_dir / "market" / "events" / f"{module_code.lower()}.json", payload)
    return payload


def export_market_runs(conn, out_dir: Path, args, warnings: List[str]) -> List[Dict[str, Any]]:
    if not table_exists(conn, "ml_runs"):
        warnings.append("Falta tabla ml_runs; se exporta market/runs.json vacío")
        runs = []
    else:
        runs = fetch_all(conn, """
            SELECT run_id, hypothesis_code, data_from, data_to, notes, created_at
            FROM ml_runs
            WHERE hypothesis_code LIKE 'M%%' OR hypothesis_code LIKE 'MARKET%%'
            ORDER BY created_at DESC, run_id DESC
            LIMIT %s
        """, (args.max_runs,))
    write_json(out_dir / "market" / "runs.json", {"items": runs})
    return runs


def date_only(value: Any) -> str:
    if isinstance(value, dt.datetime):
        return value.date().isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    return str(value or "")[:10]


def compact_weight_row(row: Dict[str, Any]) -> List[Any]:
    return [
        row.get("source_hypothesis_code") or row.get("source_signal_code"),
        row.get("source_run_id"),
        row.get("source_signal_code"),
        row.get("direction") or "NEUTRAL",
        row.get("contribution_pct"),
        row.get("contribution"),
        row.get("raw_value"),
        row.get("output_signal_code"),
        row.get("signed_value"),
        row.get("model_weight"),
    ]


def export_module_weight_history(conn, out_dir: Path, module_code: str, run: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not run or not table_exists(conn, "ml_module_contributions"):
        return None

    rows = fetch_all(conn, """
        SELECT dt, output_signal_code,
               source_hypothesis_code, source_run_id, source_signal_code,
               raw_value, signed_value, model_weight, contribution,
               contribution_pct, direction
        FROM ml_module_contributions
        WHERE run_id = %s AND module_code = %s
        ORDER BY dt ASC, abs_contribution DESC, source_signal_code ASC
    """, (run["run_id"], module_code))
    if not rows:
        return None

    module_slug = module_code.lower()
    chunks_by_year: Dict[str, Dict[str, Any]] = {}
    all_dates: List[str] = []
    total_rows = 0

    for row in rows:
        d = date_only(row.get("dt"))
        if not d:
            continue
        year = d[:4]
        chunk = chunks_by_year.setdefault(year, {"dates": [], "rows_by_date": defaultdict(list), "count": 0})
        if d not in chunk["rows_by_date"]:
            chunk["dates"].append(d)
            all_dates.append(d)
        chunk["rows_by_date"][d].append(compact_weight_row(row))
        chunk["count"] += 1
        total_rows += 1

    chunks: List[Dict[str, Any]] = []
    for year in sorted(chunks_by_year):
        chunk = chunks_by_year[year]
        dates = chunk["dates"]
        if not dates:
            continue
        rel_path = f"market/weights/history/{module_slug}/{year}.json"
        payload = {
            "module_code": module_code,
            "run_id": run.get("run_id"),
            "source": "ml_module_contributions",
            "fields": WEIGHT_HISTORY_FIELDS,
            "dates": dates,
            "rows_by_date": {d: chunk["rows_by_date"][d] for d in dates},
        }
        write_json_compact(out_dir / rel_path, payload)
        chunks.append({
            "from": dates[0],
            "to": dates[-1],
            "path": rel_path,
            "count": chunk["count"],
        })

    return {
        "source": "ml_module_contributions",
        "fields": WEIGHT_HISTORY_FIELDS,
        "dates": all_dates,
        "chunks": chunks,
        "count": total_rows,
    }


def export_module_weights(conn, out_dir: Path, module_code: str, run: Optional[Dict[str, Any]], warnings: List[str]) -> Dict[str, Any]:
    """Exporta pesos/contribuciones.

    Orden de preferencia:
    1) ml_signal_scores del run del módulo.
    2) Para M1, fallback a scores H* si el scoring se guarda asociado al run H.
    3) ml_run_inputs del run, sin peso explícito.
    """
    items: List[Dict[str, Any]] = []
    source = "none"
    asof_dt = None
    history_index = None
    if run and table_exists(conn, "ml_module_contributions"):
        latest = fetch_all(conn, """
            SELECT MAX(dt) AS asof_dt
            FROM ml_module_contributions
            WHERE run_id = %s AND module_code = %s
        """, (run["run_id"], module_code))
        asof_dt = latest[0].get("asof_dt") if latest else None
        if asof_dt:
            rows = fetch_all(conn, """
                SELECT dt, module_code, output_signal_code,
                       source_hypothesis_code, source_run_id, source_signal_code,
                       raw_value, signed_value, model_weight, contribution,
                       abs_contribution, contribution_pct, direction, method,
                       explanation, meta_json, created_at
                FROM ml_module_contributions
                WHERE run_id = %s AND module_code = %s AND dt = %s
                ORDER BY abs_contribution DESC, source_signal_code ASC
                LIMIT 120
            """, (run["run_id"], module_code, asof_dt))
            if rows:
                source = "ml_module_contributions"
                for r in rows:
                    items.append({
                        "dt": r.get("dt"),
                        "asof_dt": asof_dt,
                        "module_code": r.get("module_code"),
                        "output_signal_code": r.get("output_signal_code"),
                        "hypothesis_code": r.get("source_hypothesis_code") or r.get("source_signal_code"),
                        "run_id": r.get("source_run_id"),
                        "signal_code": r.get("source_signal_code"),
                        "direction": r.get("direction") or "NEUTRAL",
                        "weight": r.get("contribution_pct"),
                        "score": r.get("contribution"),
                        "contribution": r.get("contribution"),
                        "abs_contribution": r.get("abs_contribution"),
                        "raw_value": r.get("raw_value"),
                        "signed_value": r.get("signed_value"),
                        "model_weight": r.get("model_weight"),
                        "method": r.get("method"),
                        "updated_at": r.get("created_at"),
                        "weight_source": source,
                        "explanation": r.get("explanation") or "Contribucion efectiva registrada por el modulo.",
                    })
        history_index = export_module_weight_history(conn, out_dir, module_code, run)
    if not items and run and table_exists(conn, "ml_signal_scores"):
        rows = fetch_all(conn, """
            SELECT hypothesis_code, run_id, signal_code, direction, score, rank_within_direction,
                   n_events, avg_end_ret_12m_pct, median_end_ret_12m_pct, avg_max_dd_12m_pct, updated_at
            FROM ml_signal_scores
            WHERE run_id = %s
            ORDER BY score DESC
            LIMIT 120
        """, (run["run_id"],))
        if rows:
            source = "ml_signal_scores.run_id"
        if not rows and module_code == "M1":
            rows = fetch_all(conn, """
                SELECT hypothesis_code, run_id, signal_code, direction, score, rank_within_direction,
                       n_events, avg_end_ret_12m_pct, median_end_ret_12m_pct, avg_max_dd_12m_pct, updated_at
                FROM ml_signal_scores
                WHERE hypothesis_code LIKE 'H%'
                ORDER BY score DESC
                LIMIT 120
            """)
            source = "ml_signal_scores.hypothesis_code_H" if rows else source
        if rows:
            positives = [max(0.0, float(r.get("score") or 0.0)) for r in rows]
            total = sum(positives) or 1.0
            for r, pos_score in zip(rows, positives):
                score = float(r.get("score") or 0.0)
                items.append({
                    "hypothesis_code": r.get("hypothesis_code"),
                    "run_id": r.get("run_id"),
                    "signal_code": r.get("signal_code"),
                    "direction": r.get("direction") or "—",
                    "weight": pos_score / total if total else None,
                    "score": score,
                    "rank_within_direction": r.get("rank_within_direction"),
                    "n_events": r.get("n_events"),
                    "avg_end_ret_12m_pct": r.get("avg_end_ret_12m_pct"),
                    "median_end_ret_12m_pct": r.get("median_end_ret_12m_pct"),
                    "avg_max_dd_12m_pct": r.get("avg_max_dd_12m_pct"),
                    "updated_at": r.get("updated_at"),
                    "weight_source": source,
                    "explanation": "Peso aproximado: score positivo normalizado dentro del conjunto exportado.",
                })
    if not items and run and table_exists(conn, "ml_run_inputs"):
        rows = fetch_all(conn, """
            SELECT input_kind, input_code, role, notes
            FROM ml_run_inputs
            WHERE run_id = %s
            ORDER BY role, input_kind, input_code
            LIMIT 120
        """, (run["run_id"],))
        if rows:
            source = "ml_run_inputs_sin_peso_explicito"
            for r in rows:
                items.append({
                    "hypothesis_code": r.get("input_code"),
                    "signal_code": r.get("role") or r.get("input_kind"),
                    "direction": "INPUT",
                    "weight": None,
                    "score": None,
                    "n_events": None,
                    "avg_end_ret_12m_pct": None,
                    "weight_source": source,
                    "explanation": "Input declarado en ml_run_inputs; falta peso H→M explícito en el esquema actual.",
                })
    payload = {
        "module_code": module_code,
        "run_id": run.get("run_id") if run else None,
        "asof_dt": asof_dt,
        "weights_available": bool((items or history_index) and (source == "ml_module_contributions" or source.startswith("ml_signal_scores"))),
        "weights_source": source,
        "items": items,
    }
    if history_index:
        payload["history_index"] = history_index
    write_json(out_dir / "market" / "weights" / f"{module_code.lower()}.json", payload)
    return payload


def export_market_modules(conn, out_dir: Path, args, warnings: List[str]) -> Dict[str, Any]:
    market_max_points = getattr(args, "max_market_points", 0)
    spx_points = load_reference_spx(conn, market_max_points)
    recession_bands = build_recession_bands(conn, market_max_points)
    latest_summary = {
        "regime": "SIN_DATOS",
        "asof_dt": None,
        "confidence": 0,
        "primary_driver": "Sin datos M",
        "primary_driver_reason": "No se pudo derivar régimen desde ml_signal_values.",
        "buy_pulse": None,
        "sell_pulse": None,
    }
    module_payloads: Dict[str, Any] = {}
    for module_code, cfg in MODULES.items():
        run = latest_run_for_module(conn, module_code)
        grouped = load_signals_for_run(conn, int(run["run_id"]), market_max_points) if run else {}
        signal_code, rows = choose_signal(grouped, cfg["preferred_signals"])
        points = points_from_rows(rows, extra_keys=("score", "level", "explanation"))
        signals = signal_series_from_grouped(module_code, grouped)
        latest_p = latest_point(points)
        latest_row = rows[-1] if rows else None
        latest_value = float(latest_p["value"]) if latest_p else None
        latest_level = infer_level(module_code, signal_code, latest_value, latest_row)

        weights_payload = export_module_weights(conn, out_dir, module_code, run, warnings)
        inputs_payload = export_module_inputs(conn, out_dir, module_code, run)
        metrics_payload = export_module_metrics(conn, out_dir, module_code, run)
        events_payload = export_module_events(conn, out_dir, module_code, run)

        payload = {
            "module_code": module_code,
            "title": run.get("hypothesis_code") if run else cfg["title"],
            "description": cfg["description"],
            "run_id": run.get("run_id") if run else None,
            "signal_code": signal_code,
            "latest_value": latest_value,
            "latest_level": latest_level,
            "chart": {
                "spx": spx_points,
                "signal": points,
                "bands": recession_bands,
            },
            "signals": signals,
            "available_signals": [s["signal_code"] for s in signals],
            "data_from": run.get("data_from") if run else None,
            "data_to": run.get("data_to") if run else None,
            "created_at": run.get("created_at") if run else None,
            "detail_files": {
                "weights": f"market/weights/{module_code.lower()}.json",
                "inputs": f"market/inputs/{module_code.lower()}.json",
                "metrics": f"market/metrics/{module_code.lower()}.json",
                "events": f"market/events/{module_code.lower()}.json",
            },
            "counts": {
                "signals": len(signals),
                "weights": len(weights_payload.get("items", [])),
                "inputs": len(inputs_payload.get("items", [])),
                "metrics": len(metrics_payload.get("items", [])),
                "events": len(events_payload.get("items", [])),
            },
        }
        write_json(out_dir / "market" / f"{module_code.lower()}.json", payload)
        module_payloads[module_code] = payload

        if module_code == "M5" and latest_p:
            # Intenta extraer pulsos si existen en señales del run M5/M1; si no, quedan null.
            buy_pulse = None
            sell_pulse = None
            for srow in signals:
                code = (srow.get("signal_code") or "").upper()
                if "BUY" in code and buy_pulse is None:
                    buy_pulse = srow.get("latest_value")
                if "SELL" in code and sell_pulse is None:
                    sell_pulse = srow.get("latest_value")
            confidence = abs(float(latest_value or 0.0)) * 100
            if buy_pulse is not None or sell_pulse is not None:
                confidence = max(float(buy_pulse or 0.0), float(sell_pulse or 0.0)) * 100
            latest_summary = {
                "regime": latest_level,
                "asof_dt": latest_p["dt"],
                "confidence": round(min(100, confidence), 2),
                "primary_driver": signal_code,
                "primary_driver_reason": "Derivado del último punto disponible del run M5 exportado desde MariaDB.",
                "buy_pulse": buy_pulse,
                "sell_pulse": sell_pulse,
            }
    write_json(out_dir / "market" / "latest.json", latest_summary)
    return {"latest": latest_summary, "modules": module_payloads}


def export_analysis_files(conn, out_dir: Path, catalogs: Dict[str, List[Dict[str, Any]]]) -> None:
    items = []
    available = {
        "series": {x.get("code") for x in catalogs.get("series", [])},
        "assets": {x.get("symbol") for x in catalogs.get("assets", [])},
        "crypto": {x.get("symbol") for x in catalogs.get("crypto", [])},
    }
    for ov in DEFAULT_OVERLAYS:
        kind = ov["kind"]
        target = ov["target_code"]
        if target in available.get(kind, set()):
            items.append({**ov, "code": ov["code"], "kind": kind, "target_code": target})
        elif ov["code"] == "BTC" and "BTC" in available.get("crypto", set()):
            items.append({**ov, "kind": "crypto", "target_code": "BTC"})

    catalog_index = []
    for item in catalogs.get("indicators", []):
        code = item.get("code")
        if code:
            catalog_index.append({
                "kind": "indicators", "code": code, "name": item.get("name") or code,
                "source": item.get("source") or "", "frequency": item.get("frequency") or "",
                "path": f"timeseries/indicators/{safe_code(code)}.json"
            })
    for item in catalogs.get("assets", []):
        code = item.get("symbol") or item.get("code")
        if code:
            catalog_index.append({
                "kind": "assets", "code": code, "name": item.get("name") or code,
                "source": item.get("asset_type") or "prices",
                "path": f"timeseries/assets/{safe_code(code)}.json"
            })
    for item in catalogs.get("series", []):
        code = item.get("code")
        if code:
            catalog_index.append({
                "kind": "series", "code": code, "name": item.get("name") or code,
                "source": item.get("series_type") or "series_prices",
                "path": f"timeseries/series/{safe_code(code)}.json"
            })
    for item in catalogs.get("crypto", []):
        code = item.get("symbol") or item.get("code")
        if code:
            catalog_index.append({
                "kind": "crypto", "code": code, "name": item.get("name") or code,
                "source": item.get("source") or "coinpaprika",
                "path": f"timeseries/crypto/{safe_code(code)}.json"
            })

    recession_bands = build_recession_bands(conn, 0)
    write_json(out_dir / "analysis" / "overlays.json", {"items": items})
    write_json(out_dir / "analysis" / "calculations.json", {"items": ["none", "sum", "subtract", "divide", "multiply", "spread_z", "correlation_rolling"]})
    write_json(out_dir / "analysis" / "recession_bands.json", {"items": recession_bands, "source": "USREC" if recession_bands else "none"})
    write_json(out_dir / "analysis" / "catalog_index.json", {"count": len(catalog_index), "items": catalog_index})
    write_json(out_dir / "analysis" / "presets.json", {"items": [
        {"name": "Liquidez vs SPX", "blue": "series:SPX", "red": "indicators:WSHOSHO", "green": "indicators:FEDFUNDS"},
        {"name": "Ciclo macro", "blue": "indicators:UNRATE", "red": "indicators:CPIAUCSL", "green": "indicators:T10Y3M"},
        {"name": "Riesgo recesión", "blue": "series:SPX", "red": "indicators:T10Y3M", "green": "indicators:USREC"},
        {"name": "Cripto vs riesgo", "blue": "series:SPX", "red": "series:BTC", "green": "indicators:VIXCLS"},
    ]})

def clean_output_data(out_dir: Path) -> None:
    # Borra solo subdirectorios gestionados por el exportador. Mantiene otros ficheros manuales si existen.
    for name in ["market", "catalog", "timeseries", "analysis", "status"]:
        p = out_dir / name
        if p.exists():
            for child in p.iterdir():
                if child.is_dir():
                    import shutil
                    shutil.rmtree(child)
                else:
                    child.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)


def build_manifest(out_dir: Path, catalogs: Dict[str, List[Dict[str, Any]]], ts_counts: Dict[str, int], warnings: List[str], started: dt.datetime) -> Dict[str, Any]:
    generated = now_utc()
    manifest = {
        "version": "0.5.0-phase5",
        "mode": "real_export",
        "snapshot_date": generated.date().isoformat(),
        "generated_at": generated.isoformat(),
        "description": "Contrato JSON Fase 5 generado desde MariaDB BMR, con automatización diaria, detalle ml_* y datos de análisis/comparador.",
        "entrypoints": {
            "market_latest": "market/latest.json",
            "catalog_indicators": "catalog/indicators.json",
            "catalog_assets": "catalog/assets.json",
            "catalog_series": "catalog/series.json",
            "catalog_crypto": "catalog/crypto.json",
            "analysis_overlays": "analysis/overlays.json",
            "analysis_recession_bands": "analysis/recession_bands.json",
            "analysis_catalog_index": "analysis/catalog_index.json",
            "status_health": "status/health.json",
            "status_last_export": "status/last_export.json",
        },
        "counts": {
            "catalog": {k: len(v) for k, v in catalogs.items()},
            "timeseries_files_with_points": ts_counts,
        },
        "warnings_count": len(warnings),
        "duration_seconds": round((generated - started).total_seconds(), 3),
    }
    write_json(out_dir / "manifest.json", manifest)
    health = {
        "status": "warning" if warnings else "ok",
        "generated_at": generated.isoformat(),
        "snapshot_date": generated.date().isoformat(),
        "checks": [
            {"name": "catalog_indicators", "status": "ok" if len(catalogs.get("indicators", [])) > 0 else "error", "ok": len(catalogs.get("indicators", [])) > 0, "detail": f"count={len(catalogs.get('indicators', []))}"},
            {"name": "catalog_assets", "status": "ok" if len(catalogs.get("assets", [])) > 0 else "error", "ok": len(catalogs.get("assets", [])) > 0, "detail": f"count={len(catalogs.get('assets', []))}"},
            {"name": "catalog_series", "status": "ok" if len(catalogs.get("series", [])) > 0 else "warning", "ok": len(catalogs.get("series", [])) > 0, "detail": f"count={len(catalogs.get('series', []))}"},
            {"name": "market_modules", "status": "ok" if all((out_dir / "market" / f"{m.lower()}.json").exists() for m in MODULES) else "error", "ok": all((out_dir / "market" / f"{m.lower()}.json").exists() for m in MODULES), "detail": "M1-M7 exportados"},
        ],
        "warnings": warnings[:200],
    }
    write_json(out_dir / "status" / "health.json", health)
    write_json(out_dir / "status" / "last_export.json", {"manifest": manifest, "warnings": warnings})
    return manifest


def export_all(args: argparse.Namespace) -> int:
    env_file = parse_env_file(args.env_file)
    cfg = db_config(env_file)
    started = now_utc()
    out_dir = Path(args.out_dir).resolve()
    warnings: List[str] = []
    if args.clean:
        clean_output_data(out_dir)
    conn = connect(cfg)
    try:
        catalogs = load_catalogs(conn, args, warnings)
        export_catalog_files(out_dir, catalogs)
        ts_counts = export_timeseries(conn, out_dir, catalogs, args, warnings)
        export_market_runs(conn, out_dir, args, warnings)
        export_market_modules(conn, out_dir, args, warnings)
        export_analysis_files(conn, out_dir, catalogs)
        manifest = build_manifest(out_dir, catalogs, ts_counts, warnings, started)
        print(f"OK: JSON exportado en {out_dir}")
        print(json.dumps({"version": manifest["version"], "counts": manifest["counts"], "warnings_count": len(warnings)}, ensure_ascii=False, indent=2))
        return 0 if not args.fail_on_warning or not warnings else 2
    finally:
        conn.close()


def build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Exporta JSON reales para BMR Web desde MariaDB.")
    p.add_argument("--env-file", default=None, help="Ruta a .env con credenciales DB.")
    p.add_argument("--out-dir", default="web/data", help="Directorio destino de JSON.")
    p.add_argument("--max-points", type=int, default=8000, help="Máximo de puntos por serie temporal. 0 = todos.")
    p.add_argument("--max-market-points", type=int, default=0, help="Máximo de puntos para SPX/señales/USREC en market. 0 = todos.")
    p.add_argument("--max-indicators", type=int, default=0, help="Máximo de indicadores a exportar. 0 = todos.")
    p.add_argument("--max-assets", type=int, default=500, help="Máximo de activos a exportar. 0 = todos.")
    p.add_argument("--max-series", type=int, default=0, help="Máximo de series canónicas a exportar. 0 = todas.")
    p.add_argument("--max-crypto", type=int, default=100, help="Máximo de símbolos cripto a exportar. 0 = todos.")
    p.add_argument("--max-runs", type=int, default=150, help="Máximo de runs M/MARKET en market/runs.json.")
    p.add_argument("--clean", action="store_true", help="Limpia web/data antes de exportar.")
    p.add_argument("--fail-on-warning", action="store_true", help="Devuelve código 2 si hubo advertencias.")
    return p


if __name__ == "__main__":
    raise SystemExit(export_all(build_argparser().parse_args()))
