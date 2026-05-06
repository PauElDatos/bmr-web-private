# Fase 5 — Automatización diaria del snapshot BMR Web

## Objetivo

La web es estática: GitHub Pages solo sirve HTML, CSS, JavaScript y JSON. Por eso la extracción desde MariaDB debe ejecutarse dentro de la VM BMR, donde sí existen red privada, credenciales y acceso a la base de datos.

La Fase 5 automatiza este ciclo:

```text
MariaDB BMR
  ↓
exporter/export_web_json.py
  ↓
exporter/validate_web_json.py
  ↓
status/*.json
  ↓
git commit + git push
  ↓
GitHub Actions
  ↓
GitHub Pages
```

## Archivos nuevos

```text
automation/run_daily_pipeline.sh       pipeline Linux principal
automation/run_daily_pipeline.ps1      pipeline Windows equivalente
automation/make_snapshot_status.py     genera status operativo
automation/env/daily-export.env.example configuración de producción
automation/systemd/*.service|timer      ejecución diaria en VM BMR
automation/install_systemd_timer.sh     instalador del timer
.github/workflows/deploy-pages.yml      despliegue Pages
automation/logs/                        logs locales no versionados
```

## Configuración

Copia y edita:

```bash
cp exporter/.env.example exporter/.env.local
cp automation/env/daily-export.env.example automation/env/daily-export.env
nano exporter/.env.local
nano automation/env/daily-export.env
```

`exporter/.env.local` contiene las credenciales MariaDB. `automation/env/daily-export.env` contiene límites de exportación, rama Git, comandos opcionales y rutas.

## Prueba segura

Antes de publicar:

```bash
automation/run_daily_pipeline.sh --dry-run
```

El `dry-run` exporta, valida y actualiza estado local, pero no hace commit/push.

## Publicación manual

```bash
automation/run_daily_pipeline.sh
```

El script hace:

1. bloqueo con `flock` para evitar ejecuciones simultáneas;
2. virtualenv e instalación de dependencias;
3. ejecución opcional de `BMR_PRE_EXPORT_COMMAND`;
4. exportación MariaDB → JSON;
5. validación del contrato;
6. generación de `status/automation.json`, `status/publish.json` y `status/file_index.json`;
7. commit y push hacia la rama configurada.

## Timer systemd

Instalación:

```bash
sudo automation/install_systemd_timer.sh
```

Ver próximas ejecuciones:

```bash
systemctl list-timers bmr-web-export.timer --no-pager
```

Ejecución manual:

```bash
sudo systemctl start bmr-web-export.service
```

Logs:

```bash
journalctl -u bmr-web-export.service -n 200 --no-pager
ls -lh automation/logs/
```

## Precomandos ETL/ML

Si quieres que el timer actualice ETL y ML antes de exportar:

```bash
BMR_PRE_EXPORT_COMMAND="cd /opt/bmr-docker && ./scripts/run_etl.sh && ./scripts/run_ml.sh"
```

Guárdalo en `automation/env/daily-export.env`.

## Recomendación operativa

Primero ejecuta una semana en modo manual o `--no-push`. Cuando el snapshot sea estable, activa el timer. Para datos restringidos por Patreon, no publiques los JSON reales directamente en Pages; la Fase 6 añadirá un gateway de autenticación.
