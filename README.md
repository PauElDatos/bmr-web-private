# BMR Web Private — Fase 6

Web estática del proyecto BMR con exportador MariaDB → JSON, página **Sentimiento del mercado**, página **Macro datos**, página **Análisis** tipo `comparador_graf.py`, automatización diaria y **Auth Gateway Patreon**.

La Fase 6 añade la capa de acceso privado:

- Cloudflare Worker para login OAuth con Patreon;
- validación de tiers autorizados mediante `currently_entitled_tiers`;
- cookie de sesión firmada, `HttpOnly`, `Secure`, `SameSite=Lax`;
- endpoint `/api/me`;
- protección de `/data/*`;
- soporte recomendado para JSON reales en Cloudflare R2 privado;
- scripts para subir `web/data/*.json` a R2;
- configuración frontend opcional en `web/auth-config.js`.

## Estructura

```text
web/                         Frontend estático
web/data/                    JSON mock o exportados desde MariaDB
web/auth-config.js           UX de autenticación en frontend
exporter/                    Exportador MariaDB -> JSON
exporter/queries/            SQL de referencia
automation/                  Pipeline diario, systemd y publicación
automation/cloudflare/       Subida de JSON a R2 privado
auth/worker/                 Cloudflare Worker: Patreon OAuth + gateway
docs/                        Guías de despliegue y contratos de datos
.github/workflows/           Deploy Pages + validación + ejemplo Worker
```

## Probar web en local sin auth

```bash
cd web
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080
```

## Exportar datos reales manualmente

```bash
python3 -m venv .venv-exporter
source .venv-exporter/bin/activate
pip install -r exporter/requirements.txt
cp exporter/.env.example exporter/.env.local
nano exporter/.env.local
python exporter/export_web_json.py --env-file exporter/.env.local --out-dir web/data --clean
python exporter/validate_web_json.py --data-dir web/data
```

## Pipeline diario con R2 privado

```bash
cp automation/env/daily-export.env.example automation/env/daily-export.env
nano automation/env/daily-export.env
automation/run_daily_pipeline.sh --dry-run
```

Publicar JSON reales a Cloudflare R2:

```bash
automation/run_daily_pipeline.sh --publish-r2 --r2-bucket bmr-private-data
```

## Auth Gateway Patreon

```bash
cd auth/worker
cp wrangler.toml.example wrangler.toml
cp .dev.vars.example .dev.vars
npm install
npm run check
npm run dev
```

Desplegar:

```bash
npx wrangler secret put PATREON_CLIENT_ID
npx wrangler secret put PATREON_CLIENT_SECRET
npx wrangler secret put PATREON_REDIRECT_URI
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

## Documentación clave

```text
docs/PATREON_ACCESS_PHASE6.md
docs/DEPLOY_PHASE6.md
docs/DATA_CONTRACT_PHASE6.md
docs/PHASE5_AUTOMATION_DAILY.md
```

## Advertencia de seguridad

GitHub Pages es buen origen para HTML/CSS/JS, pero no debe ser la única barrera de acceso para datos valiosos. En producción, usa el dominio del Worker como entrada pública y sirve los JSON reales desde R2 privado o desde otro origen protegido.
