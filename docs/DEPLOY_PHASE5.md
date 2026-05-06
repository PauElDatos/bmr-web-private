# Despliegue Fase 5 en GitHub Pages

## 1. Repositorio

Sube el contenido de este ZIP a un repositorio GitHub. El workflow `.github/workflows/deploy-pages.yml` publica el directorio `web/` como artefacto de GitHub Pages.

## 2. Activar Pages

En GitHub:

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

## 3. Primer despliegue

Haz push a `main` o ejecuta manualmente el workflow **Deploy BMR Web to GitHub Pages**.

## 4. Ciclo diario recomendado

El ciclo diario no debe intentar conectarse a MariaDB desde GitHub Actions. La VM BMR ejecuta:

```bash
automation/run_daily_pipeline.sh
```

Ese script actualiza `web/data`, hace commit/push y GitHub Actions despliega la web estática.

## 5. Validación programada

El workflow `.github/workflows/validate-snapshot.yml` valida diariamente el snapshot ya versionado. No accede a MariaDB ni contiene secretos.

## 6. Producción con Patreon

GitHub Pages no debe ser la barrera de acceso final para datos de pago. En producción, usa GitHub Pages solo para frontend público o semipúblico, y mueve los JSON privados detrás de un gateway OAuth Patreon en la Fase 6.
