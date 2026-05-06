# Fase 6 — Acceso Patreon con Cloudflare Worker

## Objetivo

Esta fase añade un **Auth Gateway** delante de la web BMR. El frontend sigue siendo estático, pero el acceso se valida en un Worker antes de entregar la web y, sobre todo, antes de entregar los JSON reales.

El diseño recomendado en producción es:

```text
Usuario → bmr.tudominio.com → Cloudflare Worker → Patreon OAuth → sesión firmada → web + JSON privados
```

## Por qué no basta GitHub Pages

GitHub Pages es adecuado para HTML, CSS y JavaScript estáticos. Para acceso privado real por Patreon, no conviene publicar datos sensibles directamente en `web/data` del Pages público. La opción segura es que los JSON reales estén en Cloudflare R2 privado y que el Worker los sirva solo con sesión válida.

## Archivos añadidos

```text
auth/worker/
  src/index.js
  src/patreon.js
  src/session.js
  src/r2.js
  wrangler.toml.example
  .dev.vars.example
  package.json

web/auth-config.js
web/auth-config.example.js
web/src/api/authClient.js
web/src/pages/AuthPage.js

automation/cloudflare/publish_data_to_r2.sh
automation/cloudflare/publish_data_to_r2.ps1
```

## Variables y secretos del Worker

Variables normales en `wrangler.toml`:

```text
STATIC_ORIGIN=https://TU_USUARIO.github.io/TU_REPO
PATREON_ALLOWED_TIER_IDS=123456,789101
PATREON_ALLOWED_CAMPAIGN_IDS=
PATREON_REQUIRE_ACTIVE_STATUS=true
GATE_STATIC_SITE=true
DATA_PREFIX=data/
```

Secretos con Wrangler:

```bash
cd auth/worker
npx wrangler secret put PATREON_CLIENT_ID
npx wrangler secret put PATREON_CLIENT_SECRET
npx wrangler secret put PATREON_REDIRECT_URI
npx wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` debe ser largo y aleatorio.

## Aplicación Patreon

En Patreon crea una aplicación OAuth y configura una callback como:

```text
https://bmr.tudominio.com/auth/callback
```

Scopes necesarios:

```text
identity identity[email] identity.memberships
```

El Worker llama a `/api/oauth2/v2/identity` incluyendo `memberships` y `memberships.currently_entitled_tiers`. Después compara los `tier_id` recibidos contra `PATREON_ALLOWED_TIER_IDS`.

## Flujo OAuth

1. Usuario entra en `https://bmr.tudominio.com`.
2. Si no hay sesión, el Worker muestra la pantalla de login.
3. `/auth/login` redirige a Patreon con `state` aleatorio.
4. Patreon vuelve a `/auth/callback` con `code` y `state`.
5. El Worker intercambia el `code` por token.
6. El Worker consulta identidad y membresías.
7. Si hay un tier permitido, crea una cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
8. `/data/*` queda accesible solo con sesión válida.

## Modelo de seguridad

La cookie de sesión está firmada con HMAC SHA-256 usando `SESSION_SECRET`. El cliente no puede modificar tiers, email ni fecha de expiración sin invalidar la firma.

La protección fuerte la aplica el Worker. La lógica añadida en `web/src/api/authClient.js` solo mejora la experiencia de usuario mostrando login antes de cargar la app.

## Producción recomendada

Para datos reales:

```text
GitHub Pages: HTML/CSS/JS y, como mucho, mock data no sensible.
Cloudflare R2 privado: JSON reales.
Cloudflare Worker: acceso Patreon + entrega de /data/*.
```

Publicar JSON en R2:

```bash
BMR_R2_BUCKET=bmr-private-data \
BMR_R2_PREFIX=data \
automation/cloudflare/publish_data_to_r2.sh
```

O integrado en el pipeline:

```bash
automation/run_daily_pipeline.sh --publish-r2 --r2-bucket bmr-private-data
```

## Desarrollo local

```bash
cd auth/worker
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

Si `STATIC_ORIGIN=http://localhost:8080`, levanta también la web:

```bash
cd web
python3 -m http.server 8080
```
