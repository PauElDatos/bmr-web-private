# Despliegue de la Fase 1 en GitHub Pages

## Opción simple: publicar carpeta `web/`

1. Crear un repositorio en GitHub.
2. Subir el contenido de este ZIP.
3. En el repositorio, ir a **Settings → Pages**.
4. Seleccionar GitHub Actions como fuente de despliegue.
5. Mantener el workflow `.github/workflows/deploy-pages.yml`.
6. Hacer `push` a `main`.

El workflow sube `web/` como artefacto estático de Pages.

## Dominio propio

La Fase 1 incluye `web/CNAME.example`. Cuando tengas dominio, renómbralo a `CNAME` y escribe dentro el dominio real, por ejemplo:

```text
bmr.tudominio.com
```

## Seguridad

No subas JSON sensibles a GitHub Pages. Esta fase usa mock data. En producción, los JSON reales deberán quedar detrás del gateway de autenticación Patreon o en un almacenamiento protegido.
