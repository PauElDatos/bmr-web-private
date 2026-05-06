# Despliegue Fase 6

## 1. Mantener GitHub Pages para la web estática

La web de `web/` puede seguir desplegándose con `.github/workflows/deploy-pages.yml`. En producción con datos privados, no uses `web/data` de GitHub Pages como única fuente de datos reales.

## 2. Crear bucket R2 privado

Ejemplo:

```bash
npx wrangler r2 bucket create bmr-private-data
```

Subir los JSON:

```bash
BMR_R2_BUCKET=bmr-private-data automation/cloudflare/publish_data_to_r2.sh
```

## 3. Configurar Worker

```bash
cd auth/worker
cp wrangler.toml.example wrangler.toml
npm install
```

Edita:

```toml
STATIC_ORIGIN = "https://TU_USUARIO.github.io/TU_REPO"
PATREON_ALLOWED_TIER_IDS = "ID_TIER_1,ID_TIER_2"

[[r2_buckets]]
binding = "PRIVATE_DATA_BUCKET"
bucket_name = "bmr-private-data"
```

Cargar secretos:

```bash
npx wrangler secret put PATREON_CLIENT_ID
npx wrangler secret put PATREON_CLIENT_SECRET
npx wrangler secret put PATREON_REDIRECT_URI
npx wrangler secret put SESSION_SECRET
```

Desplegar:

```bash
npx wrangler deploy
```

## 4. Dominio

En Cloudflare configura un Custom Domain o Route para el Worker, por ejemplo:

```text
bmr.tudominio.com/*
```

Usa ese dominio como URL pública real. El dominio de GitHub Pages debe considerarse origen técnico, no punto de entrada público.

## 5. Activar UX de auth en la web

En `web/auth-config.js`:

```js
window.BMR_AUTH = {
  enabled: true,
  authBase: '',
  loginPath: '/auth/login',
  logoutPath: '/auth/logout',
  mePath: '/api/me',
  protectedData: true
};
```

Si sirves la web a través del Worker, `authBase` puede quedar vacío.

## 6. Pipeline diario recomendado

```bash
automation/run_daily_pipeline.sh --publish-r2 --skip-git
```

O, si quieres seguir actualizando GitHub Pages además de R2:

```bash
automation/run_daily_pipeline.sh --publish-r2
```

## 7. Checklist

```text
[ ] Patreon OAuth app creada
[ ] Callback apunta a /auth/callback
[ ] Tier IDs correctos en PATREON_ALLOWED_TIER_IDS
[ ] Worker secrets cargados
[ ] R2 bucket creado y vinculado
[ ] JSON subidos a R2
[ ] Dominio del Worker configurado
[ ] web/auth-config.js activado
[ ] /api/me devuelve authenticated=true tras login
[ ] /data/manifest.json devuelve 401 sin sesión
[ ] /data/manifest.json devuelve JSON con sesión
```
