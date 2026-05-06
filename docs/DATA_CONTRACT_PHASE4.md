# Contrato JSON — Fase 4

## Nuevos archivos de análisis

```text
analysis/overlays.json
analysis/calculations.json
analysis/presets.json
analysis/recession_bands.json
analysis/catalog_index.json
```

## `analysis/recession_bands.json`

```json
{
  "items": [
    {
      "from": "2007-12-01",
      "to": "2009-06-01",
      "color": "rgba(148, 163, 184, .16)",
      "source": "USREC"
    }
  ]
}
```

Este archivo se genera desde `USREC` si el indicador existe en `indicators` y `indicator_values`. Si no existe, la web usa un fallback visual.

## `analysis/catalog_index.json`

```json
{
  "count": 123,
  "items": [
    {
      "kind": "indicators",
      "code": "FEDFUNDS",
      "name": "Federal Funds Effective Rate",
      "source": "FRED",
      "frequency": "M",
      "path": "timeseries/indicators/FEDFUNDS.json"
    }
  ]
}
```

El índice sirve para auditoría y futuras búsquedas rápidas. La página Análisis actualmente construye el catálogo a partir de los cuatro catálogos principales, pero este índice queda preparado para crecimiento.

## Timeseries

Cada archivo de serie mantiene la forma:

```json
{
  "kind": "series",
  "code": "SPX",
  "points": [
    { "dt": "2025-01-01", "value": 100.0 }
  ]
}
```

Los puntos pueden incluir campos extra como `open_p`, `high_p`, `low_p`, `volume`, `source_kind` o `source_id`.
