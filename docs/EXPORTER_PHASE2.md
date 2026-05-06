# Fase 2 — Exportador real desde MariaDB

Esta fase añade la capa que faltaba entre BMR y la web estática: un exportador Python que lee MariaDB y genera los JSON que consume `web/`.

## Componentes añadidos

```text
exporter/
  export_web_json.py
  validate_web_json.py
  requirements.txt
  .env.example
  config/web_export_config.example.json
  queries/*.sql

automation/
  publish_to_github.sh
  publish_to_github.ps1
  systemd/bmr-web-export.service
  systemd/bmr-web-export.timer
```

## Flujo operativo

```text
MariaDB BMR privada
  ↓
exporter/export_web_json.py
  ↓
web/data/*.json
  ↓
validate_web_json.py
  ↓
git commit + push
  ↓
GitHub Pages despliega web estática
```

## Instalación local

Desde la raíz del proyecto:

```bash
python3 -m venv .venv-exporter
source .venv-exporter/bin/activate
pip install -r exporter/requirements.txt
cp exporter/.env.example exporter/.env.local
nano exporter/.env.local
```

En Windows PowerShell:

```powershell
py -m venv .venv-exporter
. .\.venv-exporter\Scripts\Activate.ps1
pip install -r exporter/requirements.txt
Copy-Item exporter\.env.example exporter\.env.local
notepad exporter\.env.local
```

## Ejecutar exportación

```bash
python exporter/export_web_json.py \
  --env-file exporter/.env.local \
  --out-dir web/data \
  --max-points 8000 \
  --max-assets 500 \
  --clean
```

Validar:

```bash
python exporter/validate_web_json.py --data-dir web/data
```

Probar web:

```bash
cd web
python3 -m http.server 8080
```

Abrir `http://localhost:8080`.

## Tablas exportadas

Catálogos:

```text
indicators
assets
series
crypto_ohlcv_cp
```

Series temporales:

```text
indicator_values
prices
series_prices
crypto_ohlcv_cp
```

Sentimiento/ML:

```text
ml_runs
ml_run_inputs
ml_signal_values
ml_signal_scores
```

Tablas opcionales si existen:

```text
ml_signal_events
ml_run_metrics
signals
indicator_values_available
indicator_release_lags
```

## Limitaciones de Fase 2

La web ya puede leer JSON reales, pero el modelado exacto de pesos H→M puede ser incompleto si la base no contiene una tabla explícita de pesos. El exportador intenta primero `ml_signal_scores` y, si no hay datos suficientes, deja la estructura preparada usando `ml_run_inputs` sin peso numérico explícito.

La Fase 3 debe afinar la semántica de sentimiento de mercado, pesos H→M, eventos y explicabilidad.
