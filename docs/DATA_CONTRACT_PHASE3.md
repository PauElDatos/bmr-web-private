# Contrato de datos — Fase 3

## `market/mX.json`

```json
{
  "module_code": "M5",
  "title": "M5_RULES_M2M3M4",
  "run_id": 1105,
  "signal_code": "M5_RISK_OFF",
  "latest_value": 0,
  "latest_level": "HOLD",
  "chart": {
    "spx": [{"dt":"2026-01-31","value":100}],
    "signal": [{"dt":"2026-01-31","value":0}],
    "bands": []
  },
  "signals": [
    {
      "signal_code": "M5_RISK_OFF",
      "points": [{"dt":"2026-01-31","value":0}],
      "n_points": 1,
      "latest_dt": "2026-01-31",
      "latest_value": 0,
      "latest_level": "HOLD"
    }
  ],
  "detail_files": {
    "weights": "market/weights/m5.json",
    "inputs": "market/inputs/m5.json",
    "metrics": "market/metrics/m5.json",
    "events": "market/events/m5.json"
  }
}
```

## `market/weights/mX.json`

```json
{
  "module_code": "M5",
  "run_id": 1105,
  "weights_available": true,
  "weights_source": "ml_signal_scores.run_id",
  "items": [
    {
      "hypothesis_code": "H8",
      "signal_code": "H8_S_SELL",
      "direction": "SELL",
      "weight": 0.25,
      "score": 0.73,
      "n_events": 20,
      "avg_end_ret_12m_pct": -4.2
    }
  ]
}
```

## `market/inputs/mX.json`

Origen: `ml_run_inputs`.

## `market/metrics/mX.json`

Origen: `ml_run_metrics`.

## `market/events/mX.json`

Origen: `ml_signal_events`.
