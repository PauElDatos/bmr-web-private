# Runbook Fase 5

## Comprobar estado rápido

```bash
python exporter/validate_web_json.py --data-dir web/data
cat web/data/status/automation.json
cat web/data/status/publish.json
```

## Forzar nueva publicación

```bash
automation/run_daily_pipeline.sh --no-venv-update
```

## Ejecutar sin publicar

```bash
automation/run_daily_pipeline.sh --dry-run
```

## Ver logs systemd

```bash
journalctl -u bmr-web-export.service -n 300 --no-pager
```

## Ver timer

```bash
systemctl list-timers bmr-web-export.timer --no-pager
```

## Problema: no hay cambios y no se publica

Es normal si los JSON generados son idénticos al último commit. Para forzar un cambio puedes borrar `web/data/status/*.json` y ejecutar de nuevo, pero no debería ser necesario en operación normal.

## Problema: falla la validación

Ejecuta:

```bash
python exporter/validate_web_json.py --data-dir web/data --sample 5
```

Corrige el exportador o reduce temporalmente límites de exportación para aislar el fallo.

## Problema: GitHub rechaza el push

Comprueba:

```bash
git remote -v
git branch --show-current
git status
ssh -T git@github.com
```

Usa una deploy key con permisos de escritura o un token de acceso configurado en el remote HTTPS.
