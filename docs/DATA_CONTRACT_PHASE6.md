# Contrato Fase 6 — Datos protegidos

La Fase 6 no cambia el contenido funcional de los JSON de fases anteriores. Cambia **dónde y cómo se sirven**.

## Rutas públicas del Worker

```text
/auth/login
/auth/callback
/auth/logout
/auth/denied
/api/me
```

## Rutas protegidas

```text
/data/manifest.json
/data/market/*.json
/data/catalog/*.json
/data/timeseries/**/*.json
/data/analysis/*.json
/data/status/*.json
```

Sin sesión válida, `/data/*` responde:

```json
{
  "ok": false,
  "error": "auth_required"
}
```

Con sesión válida, el Worker busca primero en R2:

```text
PRIVATE_DATA_BUCKET.get("data/...")
```

Si no existe bucket u objeto, usa fallback contra `STATIC_ORIGIN`.

## Sesión

`/api/me` responde:

```json
{
  "authenticated": true,
  "user": {
    "patreon_user_id": "...",
    "name": "...",
    "email": "...",
    "tiers": ["123456"],
    "entitlements": [],
    "expires_at": "2026-05-08T00:00:00.000Z"
  }
}
```

La cookie se llama por defecto `bmr_session` y es `HttpOnly`, `Secure`, `SameSite=Lax`.
