#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validador de snapshot JSON BMR Web — Fase 5.

Comprueba que web/data contiene el contrato mínimo necesario para la web:
- manifest.json
- catálogos principales
- módulos M1-M5
- detalle de mercado: weights, inputs, metrics y events
- status/health.json y status operativo de automatización
- series temporales referenciadas por los primeros elementos de catálogo
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def safe_code(code: Any) -> str:
    text = str(code or "").strip()
    text = SAFE_NAME_RE.sub("_", text)
    return text[:180] if text else "UNKNOWN"


def load_json(path: Path) -> Any:
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def exists(path: Path, errors: List[str], label: str) -> bool:
    if not path.exists():
        errors.append(f"Falta {label}: {path}")
        return False
    return True


def validate(data_dir: Path, strict: bool = False, sample: int = 25) -> int:
    errors: List[str] = []
    warnings: List[str] = []
    manifest_path = data_dir / 'manifest.json'
    if not exists(manifest_path, errors, 'manifest'):
        return 1
    try:
        manifest = load_json(manifest_path)
    except Exception as exc:
        print(f"ERROR: manifest inválido: {exc}", file=sys.stderr)
        return 1

    required = [
        data_dir / 'catalog' / 'indicators.json',
        data_dir / 'catalog' / 'assets.json',
        data_dir / 'catalog' / 'series.json',
        data_dir / 'catalog' / 'crypto.json',
        data_dir / 'market' / 'latest.json',
        data_dir / 'market' / 'runs.json',
        data_dir / 'status' / 'health.json',
        data_dir / 'status' / 'last_export.json',
        data_dir / 'analysis' / 'overlays.json',
        data_dir / 'analysis' / 'calculations.json',
        data_dir / 'analysis' / 'presets.json',
        data_dir / 'analysis' / 'recession_bands.json',
        data_dir / 'analysis' / 'catalog_index.json',
    ]
    for path in required:
        exists(path, errors, path.name)

    for m in ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm10']:
        exists(data_dir / 'market' / f'{m}.json', errors, f'market/{m}.json')
        exists(data_dir / 'market' / 'weights' / f'{m}.json', errors, f'market/weights/{m}.json')
        exists(data_dir / 'market' / 'inputs' / f'{m}.json', errors, f'market/inputs/{m}.json')
        exists(data_dir / 'market' / 'metrics' / f'{m}.json', errors, f'market/metrics/{m}.json')
        exists(data_dir / 'market' / 'events' / f'{m}.json', errors, f'market/events/{m}.json')
        exists(data_dir / 'market' / 'inputs' / f'{m}.json', errors, f'market/inputs/{m}.json')
        exists(data_dir / 'market' / 'metrics' / f'{m}.json', errors, f'market/metrics/{m}.json')
        exists(data_dir / 'market' / 'events' / f'{m}.json', errors, f'market/events/{m}.json')

    if errors:
        print('\n'.join(f'ERROR: {e}' for e in errors), file=sys.stderr)
        return 1

    # JSON parse básico
    for path in required:
        try:
            load_json(path)
        except Exception as exc:
            errors.append(f"JSON inválido {path}: {exc}")
    for m in ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm10']:
        for path in [
            data_dir / 'market' / f'{m}.json',
            data_dir / 'market' / 'weights' / f'{m}.json',
            data_dir / 'market' / 'inputs' / f'{m}.json',
            data_dir / 'market' / 'metrics' / f'{m}.json',
            data_dir / 'market' / 'events' / f'{m}.json',
        ]:
            try:
                load_json(path)
            except Exception as exc:
                errors.append(f"JSON inválido {path}: {exc}")

    # Comprobación de muestras de timeseries.
    checks = [
        ('indicators', 'code', data_dir / 'catalog' / 'indicators.json'),
        ('assets', 'symbol', data_dir / 'catalog' / 'assets.json'),
        ('series', 'code', data_dir / 'catalog' / 'series.json'),
        ('crypto', 'symbol', data_dir / 'catalog' / 'crypto.json'),
    ]
    for kind, key, cat_path in checks:
        if not cat_path.exists():
            continue
        catalog = load_json(cat_path)
        items = catalog.get('items', [])[:sample]
        for item in items:
            code = safe_code(item.get(key) or item.get('code') or '')
            if not code:
                continue
            path = data_dir / 'timeseries' / kind / f'{code}.json'
            if not path.exists():
                msg = f"No existe timeseries para {kind}:{code}"
                if strict:
                    errors.append(msg)
                else:
                    warnings.append(msg)
                continue
            try:
                ts = load_json(path)
                if 'points' not in ts:
                    errors.append(f"Timeseries sin points: {path}")
            except Exception as exc:
                errors.append(f"Timeseries inválida {path}: {exc}")

    # Status operativos de Fase 5: opcionales en repositorios antiguos, requeridos tras ejecutar pipeline.
    for optional_path in [data_dir / 'status' / 'automation.json', data_dir / 'status' / 'publish.json', data_dir / 'status' / 'file_index.json']:
        if optional_path.exists():
            try:
                load_json(optional_path)
            except Exception as exc:
                errors.append(f'Status operativo inválido {optional_path}: {exc}')

    health = load_json(data_dir / 'status' / 'health.json')
    status = health.get('status', 'unknown')
    result = {
        'manifest_version': manifest.get('version'),
        'mode': manifest.get('mode'),
        'snapshot_date': manifest.get('snapshot_date'),
        'status': status,
        'warnings': len(warnings) + int(manifest.get('warnings_count') or 0),
        'errors': len(errors),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if warnings:
        print('\n'.join(f'WARN: {w}' for w in warnings[:50]), file=sys.stderr)
    if errors:
        print('\n'.join(f'ERROR: {e}' for e in errors), file=sys.stderr)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description='Valida web/data para BMR Web.')
    ap.add_argument('--data-dir', default='web/data')
    ap.add_argument('--strict', action='store_true', help='Falla si faltan timeseries para elementos de catálogo muestreados.')
    ap.add_argument('--sample', type=int, default=25, help='Nº de elementos de cada catálogo a verificar.')
    args = ap.parse_args()
    return validate(Path(args.data_dir), strict=args.strict, sample=args.sample)


if __name__ == '__main__':
    raise SystemExit(main())
