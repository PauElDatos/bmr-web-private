# Roadmap posterior

## Fase 2 — Exportador real desde MariaDB

- Crear `exporter/export_web_json.py`.
- Leer `.env` con credenciales BMR.
- Exportar catálogos desde `indicators`, `assets`, `series`, `crypto_ohlcv_cp`.
- Exportar series temporales separadas por código.
- Validar tamaño, fechas, nulos y formato.

## Fase 3 — Sentimiento M1–M5 real

- Exportar `ml_runs`, `ml_run_inputs`, `ml_signal_values`, `ml_signal_scores`, `ml_signal_events`, `ml_run_metrics`.
- Resolver pesos H→M cuando existan datos suficientes.
- Mantener fallback si no hay pesos explícitos.

## Fase 4 — Comparador avanzado

- Añadir más cálculos, normalizaciones, transformación log/exp y sincronización de ejes.
- Exportar presets desde configuración BMR.
- Añadir detalle de inputs por serie.

## Fase 5 — Automatización diaria

- Timer systemd en VM BMR.
- Validación previa a publicación.
- Push automático de JSON.

## Fase 6 — Patreon Auth Gateway

- OAuth con Patreon.
- Verificación de tier.
- Cookie segura.
- Protección de JSON reales.
