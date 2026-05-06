# Contrato JSON — Fase 2

La Fase 2 mantiene la forma del contrato de Fase 1, pero cambia `manifest.mode` de `mock` a `real_export` cuando se ejecuta `export_web_json.py`.

## `manifest.json`

```json
{
  "version": "0.2.0-phase2",
  "mode": "real_export",
  "snapshot_date": "YYYY-MM-DD",
  "generated_at": "YYYY-MM-DDTHH:MM:SS+00:00",
  "counts": {
    "catalog": {
      "indicators": 0,
      "assets": 0,
      "series": 0,
      "crypto": 0
    },
    "timeseries_files_with_points": {
      "indicators": 0,
      "assets": 0,
      "series": 0,
      "crypto": 0
    }
  }
}
```

## Catálogos

```text
catalog/indicators.json
catalog/assets.json
catalog/series.json
catalog/crypto.json
catalog/sources.json
```

Cada catálogo tiene:

```json
{
  "kind": "indicators",
  "count": 123,
  "items": []
}
```

## Series temporales

```text
timeseries/indicators/<CODE>.json
timeseries/assets/<SYMBOL>.json
timeseries/series/<CODE>.json
timeseries/crypto/<SYMBOL>.json
```

Cada archivo tiene:

```json
{
  "kind": "series",
  "code": "SPX",
  "points": [
    {"dt": "2025-01-01", "value": 100.0}
  ]
}
```

## Mercado / sentimiento

```text
market/latest.json
market/runs.json
market/m1.json ... market/m5.json
market/weights/m1.json ... market/weights/m5.json
```

`market/weights/*.json` puede venir de dos fuentes:

```text
ml_signal_scores                  → pesos aproximados disponibles
ml_run_inputs_sin_peso_explicito  → inputs disponibles, peso pendiente de modelar
```

Cuando no exista peso explícito, la web mostrará la estructura y el aviso correspondiente.
