#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pymysql
from pymysql.cursors import DictCursor

OUT_DIR = Path("out")
BASE_SQL = OUT_DIR / "bmr_schema_workbench.sql"
INFERRED_SQL = OUT_DIR / "bmr_schema_workbench_with_inferred_fks.sql"

REQUIRED_TABLES = [
    "assets",
    "listings",
    "markets",
    "sectors",
    "prices",
    "indicators",
    "indicator_values",
    "series",
    "series_prices",
    "series_sources",
    "ml_runs",
    "ml_run_inputs",
    "ml_run_metrics",
    "ml_feature_values",
    "ml_signal_values",
    "ml_backtest_positions",
]

PROBABLE_RELATIONS = [
    ("listings", "asset_id", "assets", "asset_id"),
    ("listings", "market_id", "markets", "market_id"),
    ("listings", "sector_id", "sectors", "sector_id"),
    ("prices", "asset_id", "assets", "asset_id"),
    ("indicator_values", "indicator_id", "indicators", "id"),
    ("series_prices", "series_id", "series", "series_id"),
    ("series_sources", "series_id", "series", "series_id"),
    ("ml_run_inputs", "run_id", "ml_runs", "run_id"),
    ("ml_run_metrics", "run_id", "ml_runs", "run_id"),
    ("ml_feature_values", "run_id", "ml_runs", "run_id"),
    ("ml_signal_values", "run_id", "ml_runs", "run_id"),
    ("ml_backtest_positions", "run_id", "ml_runs", "run_id"),
]

DUBIOUS_NOT_AUTO = [
    "ml_signal_scores.run_id (int) vs ml_runs.run_id (bigint unsigned)",
    "ml_signal_events.run_id (int) vs ml_runs.run_id (bigint unsigned)",
    "ml_module_contributions.run_id (bigint signed) vs ml_runs.run_id (bigint unsigned)",
    "series_prices.source_kind/source_id y series_sources.source_kind/source_id: relacion polimorfica (assets/indicators)",
]


def get_env(name: str, default: Optional[str] = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise ValueError(f"Falta variable de entorno obligatoria: {name}")
    return value or ""


def db_config() -> Dict[str, Any]:
    return {
        "host": get_env("BMR_MYSQL_HOST", "127.0.0.1"),
        "port": int(get_env("BMR_MYSQL_PORT", "3307")),
        "user": get_env("BMR_MYSQL_USER", required=True),
        "password": get_env("BMR_MYSQL_PASSWORD", required=True),
        "database": get_env("BMR_MYSQL_DATABASE", "bmr"),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": True,
        "connect_timeout": 10,
        "read_timeout": 120,
        "write_timeout": 120,
    }


def normalize_create_table(sql: str) -> str:
    sql = re.sub(r"\s+DEFINER=`[^`]+`@`[^`]+`", "", sql, flags=re.IGNORECASE)
    sql = re.sub(
        r"\s+CHECK\s*\(\s*json_valid\s*\(\s*`[^`]+`\s*\)\s*\)",
        "",
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(r"(DEFAULT\s+NULL|NOT\s+NULL)\)\s*,", r"\1,", sql, flags=re.IGNORECASE)
    sql = re.sub(r",\s*\)", "\n)", sql)
    sql = re.sub(r"COLLATE\s*=\s*utf8mb4_uca1400_ai_ci", "COLLATE=utf8mb4_general_ci", sql, flags=re.IGNORECASE)
    sql = re.sub(r"COLLATE\s+utf8mb4_uca1400_ai_ci", "COLLATE utf8mb4_general_ci", sql, flags=re.IGNORECASE)
    return sql.rstrip("; \n") + ";"


def execute(conn, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def get_table_columns(conn, db: str) -> Dict[Tuple[str, str], Dict[str, Any]]:
    rows = execute(
        conn,
        """
        SELECT table_name, column_name, column_type, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = %s
        """,
        (db,),
    )
    out: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in rows:
        out[(row["table_name"], row["column_name"])] = row
    return out


def types_compatible(src: Dict[str, Any], ref: Dict[str, Any]) -> bool:
    if not src or not ref:
        return False
    if (src["data_type"] or "").lower() != (ref["data_type"] or "").lower():
        return False
    src_type = (src["column_type"] or "").lower()
    ref_type = (ref["column_type"] or "").lower()
    return ("unsigned" in src_type) == ("unsigned" in ref_type)


def generate_schema_files() -> int:
    cfg = db_config()
    db = cfg["database"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        conn = pymysql.connect(**cfg)
    except Exception as exc:
        print(
            f"ERROR: no se pudo conectar a MySQL en {cfg['host']}:{cfg['port']} "
            f"para DB '{db}'. Detalle: {exc}",
            file=sys.stderr,
        )
        return 2

    with conn:
        tables = execute(
            conn,
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
            (db,),
        )
        views = execute(
            conn,
            """
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = %s
            ORDER BY table_name
            """,
            (db,),
        )

        table_names = [r["table_name"] for r in tables]
        view_names = [r["table_name"] for r in views]
        columns = get_table_columns(conn, db)

        base_lines = [
            "-- bmr_schema_workbench.sql",
            "-- Estructura exportada para modelado visual en MySQL Workbench.",
            "-- Solo incluye tablas base, sin datos, sin triggers/routines/events.",
            f"CREATE DATABASE IF NOT EXISTS `{db}`;",
            f"USE `{db}`;",
            "",
        ]

        for table in table_names:
            create_row = execute(conn, f"SHOW CREATE TABLE `{db}`.`{table}`")
            if not create_row:
                continue
            create_sql = normalize_create_table(create_row[0]["Create Table"])
            base_lines.append(f"-- TABLE `{table}`")
            base_lines.append("DROP TABLE IF EXISTS `{}`;".format(table))
            base_lines.append(create_sql)
            base_lines.append("")

        if view_names:
            base_lines.append("-- Vistas detectadas (excluidas por defecto para robustez de importacion):")
            for view_name in view_names:
                base_lines.append(f"-- - `{view_name}`")
            base_lines.append("-- Si quieres incluir vistas, exportalas en un script aparte.")
            base_lines.append("")

        base_content = "\n".join(base_lines).strip() + "\n"
        base_content = base_content.replace("utf8mb4_uca1400_ai_ci", "utf8mb4_general_ci")
        BASE_SQL.write_text(base_content, encoding="utf-8")

        inferred_lines = list(base_lines)
        inferred_lines.append("-- Relaciones inferidas para EER (solo modelo visual, no ejecutar en produccion).")
        inferred_lines.append("SET FOREIGN_KEY_CHECKS = 0;")
        inferred_lines.append("")

        for src_table, src_col, ref_table, ref_col in PROBABLE_RELATIONS:
            src = columns.get((src_table, src_col))
            ref = columns.get((ref_table, ref_col))
            if src_table not in table_names or ref_table not in table_names:
                inferred_lines.append(
                    f"-- TODO revisar {src_table}.{src_col} -> {ref_table}.{ref_col}: tabla faltante en esta exportacion."
                )
                continue
            if types_compatible(src, ref):
                fk_name = f"fk_inf_{src_table}_{src_col}_{ref_table}_{ref_col}"[:62]
                inferred_lines.append(
                    f"-- RELATION: `{src_table}`.`{src_col}` -> `{ref_table}`.`{ref_col}` (tipos compatibles)"
                )
                inferred_lines.append(
                    f"ALTER TABLE `{src_table}` ADD CONSTRAINT `{fk_name}` FOREIGN KEY (`{src_col}`) "
                    f"REFERENCES `{ref_table}` (`{ref_col}`);"
                )
            else:
                src_t = src["column_type"] if src else "N/A"
                ref_t = ref["column_type"] if ref else "N/A"
                inferred_lines.append(
                    f"-- TODO revisar {src_table}.{src_col} ({src_t}) -> {ref_table}.{ref_col} ({ref_t}): tipos incompatibles."
                )
            inferred_lines.append("")

        inferred_lines.append("-- Relaciones dudosas/incompatibles que NO se convierten automaticamente:")
        for item in DUBIOUS_NOT_AUTO:
            inferred_lines.append(f"-- TODO {item}")
        inferred_lines.append("")
        inferred_lines.append("SET FOREIGN_KEY_CHECKS = 1;")
        inferred_lines.append("")

        inferred_content = "\n".join(inferred_lines).strip() + "\n"
        inferred_content = inferred_content.replace("utf8mb4_uca1400_ai_ci", "utf8mb4_general_ci")
        INFERRED_SQL.write_text(inferred_content, encoding="utf-8")

    base_text = BASE_SQL.read_text(encoding="utf-8")
    bad_tokens = ["insert into", "create trigger", "create procedure", "create function", "create event"]
    found = [token for token in bad_tokens if token in base_text.lower()]
    if found:
        print(f"ERROR: el SQL generado contiene sentencias prohibidas: {', '.join(found)}", file=sys.stderr)
        return 3

    missing_required = [t for t in REQUIRED_TABLES if f"CREATE TABLE `{t}`" not in base_text]
    if missing_required:
        print(
            "ADVERTENCIA: faltan tablas esperadas en el export: " + ", ".join(missing_required),
            file=sys.stderr,
        )

    print(f"OK: export creado en {BASE_SQL}")
    print(f"OK: export con FKs inferidas en {INFERRED_SQL}")
    print("Abrir en MySQL Workbench:")
    print("1) File -> Import -> Reverse Engineer MySQL Create Script")
    print("2) Seleccionar out/bmr_schema_workbench_with_inferred_fks.sql")
    print("3) Crear EER Diagram y aplicar Arrange -> Auto Layout")
    print("Nota: este flujo no modifica la DB real.")
    return 0


if __name__ == "__main__":
    sys.exit(generate_schema_files())
