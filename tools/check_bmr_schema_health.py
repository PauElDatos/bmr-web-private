#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pymysql
from pymysql.cursors import DictCursor

OUT_DIR = Path("out")
REPORT_PATH = OUT_DIR / "bmr_schema_health_report.md"


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


def execute(conn, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def markdown_table(rows: List[Dict[str, Any]], columns: List[str]) -> List[str]:
    if not rows:
        return ["_Sin resultados._", ""]
    out = ["| " + " | ".join(columns) + " |", "| " + " | ".join(["---"] * len(columns)) + " |"]
    for row in rows:
        out.append("| " + " | ".join(str(row.get(col, "")).replace("\n", " ") for col in columns) + " |")
    out.append("")
    return out


def main() -> int:
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
        tables_without_pk = execute(
            conn,
            """
            SELECT t.table_name
            FROM information_schema.tables t
            LEFT JOIN (
                SELECT DISTINCT table_name
                FROM information_schema.table_constraints
                WHERE table_schema = %s AND constraint_type = 'PRIMARY KEY'
            ) pk ON pk.table_name = t.table_name
            WHERE t.table_schema = %s
              AND t.table_type = 'BASE TABLE'
              AND pk.table_name IS NULL
            ORDER BY t.table_name
            """,
            (db, db),
        )

        fk_like_mul_no_constraint = execute(
            conn,
            """
            SELECT s.table_name, s.column_name, c.column_type, s.index_name
            FROM information_schema.statistics s
            JOIN information_schema.columns c
              ON c.table_schema = s.table_schema
             AND c.table_name = s.table_name
             AND c.column_name = s.column_name
            LEFT JOIN information_schema.key_column_usage k
              ON k.table_schema = s.table_schema
             AND k.table_name = s.table_name
             AND k.column_name = s.column_name
             AND k.referenced_table_name IS NOT NULL
            WHERE s.table_schema = %s
              AND s.non_unique = 1
              AND (s.column_name REGEXP '_id$' OR s.column_name = 'run_id')
              AND k.column_name IS NULL
            GROUP BY s.table_name, s.column_name, c.column_type, s.index_name
            ORDER BY s.table_name, s.column_name
            """,
            (db,),
        )

        candidates = execute(
            conn,
            """
            SELECT c1.table_name AS src_table, c1.column_name AS src_column, c1.column_type AS src_type,
                   c2.table_name AS ref_table, c2.column_name AS ref_column, c2.column_type AS ref_type
            FROM information_schema.columns c1
            JOIN information_schema.columns c2
              ON c1.table_schema = c2.table_schema
             AND c2.column_name IN ('id', c1.column_name)
            WHERE c1.table_schema = %s
              AND c1.table_name <> c2.table_name
              AND (c1.column_name REGEXP '_id$' OR c1.column_name = 'run_id')
              AND c1.data_type <> c2.data_type
            ORDER BY c1.table_name, c1.column_name, c2.table_name
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

        non_innodb = execute(
            conn,
            """
            SELECT table_name, engine
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
              AND (engine IS NULL OR UPPER(engine) <> 'INNODB')
            ORDER BY table_name
            """,
            (db,),
        )

        large_tables = execute(
            conn,
            """
            SELECT table_name, engine, table_rows, data_length, index_length
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
            ORDER BY table_rows DESC
            LIMIT 30
            """,
            (db,),
        )

        real_fks = execute(
            conn,
            """
            SELECT k.table_name, k.column_name, k.referenced_table_name, k.referenced_column_name, k.constraint_name
            FROM information_schema.key_column_usage k
            WHERE k.table_schema = %s
              AND k.referenced_table_name IS NOT NULL
            ORDER BY k.table_name, k.constraint_name, k.ordinal_position
            """,
            (db,),
        )

    now = dt.datetime.now().isoformat(timespec="seconds")
    lines: List[str] = [
        "# BMR Schema Health Report",
        "",
        f"- Fecha: `{now}`",
        f"- Host: `{cfg['host']}:{cfg['port']}`",
        f"- Database: `{db}`",
        "- Nota: reporte solo lectura (information_schema).",
        "",
        "## Tablas sin primary key",
        "",
    ]
    lines.extend(markdown_table(tables_without_pk, ["table_name"]))

    lines.extend(["## Columnas indexadas tipo FK sin constraint real", ""])
    lines.extend(markdown_table(fk_like_mul_no_constraint, ["table_name", "column_name", "column_type", "index_name"]))

    lines.extend(["## Posibles incompatibilidades de tipos en relaciones candidatas", ""])
    lines.extend(markdown_table(candidates, ["src_table", "src_column", "src_type", "ref_table", "ref_column", "ref_type"]))

    lines.extend(["## Vistas existentes", ""])
    lines.extend(markdown_table(views, ["table_name"]))

    lines.extend(["## Tablas con engine distinto de InnoDB", ""])
    lines.extend(markdown_table(non_innodb, ["table_name", "engine"]))

    lines.extend(["## Tablas grandes (estimado por information_schema)", ""])
    lines.extend(markdown_table(large_tables, ["table_name", "engine", "table_rows", "data_length", "index_length"]))

    lines.extend(["## Foreign keys reales existentes", ""])
    lines.extend(markdown_table(real_fks, ["table_name", "column_name", "referenced_table_name", "referenced_column_name", "constraint_name"]))

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK: reporte generado en {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
