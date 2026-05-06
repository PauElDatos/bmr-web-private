# Contrato JSON — Fase 1

La web consume exclusivamente JSON estáticos desde `web/data/`. La Fase 2 debe generar estos mismos nombres de archivo desde MariaDB.

## Manifest

`data/manifest.json`

```json
{
  "version": "0.1.0-phase1",
  "mode": "mock",
  "snapshot_date": "YYYY-MM-DD",
  "generated_at": "ISO-8601"
}
```

## Sentimiento de mercado

- `data/market/latest.json`: régimen actual, confianza, driver principal.
- `data/market/runs.json`: lista de runs mock equivalente a `ml_runs`.
- `data/market/m1.json` ... `m5.json`: serie del módulo y benchmark SPX.
- `data/market/weights/m1.json` ... `m5.json`: contribuciones H→M preparadas para `ml_signal_scores`, `ml_run_inputs` y futuras tablas de pesos explícitas.

## Catálogos

- `data/catalog/indicators.json`: equivalente parcial de `indicators`.
- `data/catalog/assets.json`: equivalente parcial de `assets`.
- `data/catalog/series.json`: equivalente parcial de `series`.
- `data/catalog/crypto.json`: catálogo simplificado de cripto.

## Series temporales

Formato común:

```json
{
  "code": "SPX",
  "points": [
    { "dt": "YYYY-MM-DD", "value": 100.0 }
  ]
}
```

Rutas:

- `data/timeseries/indicators/<CODE>.json`
- `data/timeseries/assets/<SYMBOL>.json`
- `data/timeseries/series/<CODE>.json`
- `data/timeseries/crypto/<SYMBOL>.json`

## Análisis

- `data/analysis/overlays.json`: series disponibles como overlays rápidos.
- `data/analysis/presets.json`: combinaciones predefinidas futuras.
- `data/analysis/calculations.json`: operaciones permitidas.

## Estado

- `data/status/health.json`: validación básica del snapshot.
