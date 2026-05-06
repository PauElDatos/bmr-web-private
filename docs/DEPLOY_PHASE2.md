# Despliegue Fase 2

## Opción recomendada durante desarrollo

1. Generar JSON desde la VM BMR.
2. Validar `web/data`.
3. Hacer commit y push.
4. GitHub Actions publica `web/` en GitHub Pages.

```bash
bash automation/publish_to_github.sh exporter/.env.local
```

## Workflow Pages

El workflow incluido en `.github/workflows/deploy-pages.yml` publica la carpeta `web/`. No ejecuta SQL ni Python contra MariaDB: solo despliega los archivos estáticos ya generados.

## Programación diaria con systemd

Copiar proyecto a `/opt/bmr-web-private` y ajustar `.env.local`:

```bash
sudo cp automation/systemd/bmr-web-export.service /etc/systemd/system/
sudo cp automation/systemd/bmr-web-export.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bmr-web-export.timer
systemctl list-timers | grep bmr-web
```

Ver logs:

```bash
journalctl -u bmr-web-export.service -n 100 --no-pager
```

## Nota de seguridad

Los JSON reales no deben publicarse en GitHub Pages si contienen datos de pago o información que quieras reservar a Patreon. En producción, la Fase 6 moverá el acceso real a un gateway con OAuth Patreon.
