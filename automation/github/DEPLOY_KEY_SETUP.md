# Configurar push automático desde la VM BMR a GitHub

El pipeline diario necesita permisos para hacer `git push` al repositorio de la web. Hay dos opciones:

## Opción A — Deploy key SSH con escritura

En la VM BMR:

```bash
ssh-keygen -t ed25519 -C "bmr-web-publisher" -f ~/.ssh/bmr_web_publisher
cat ~/.ssh/bmr_web_publisher.pub
```

En GitHub:

```text
Repository → Settings → Deploy keys → Add deploy key
```

Marca **Allow write access**.

En la VM, configura `~/.ssh/config`:

```text
Host github-bmr-web
  HostName github.com
  User git
  IdentityFile ~/.ssh/bmr_web_publisher
  IdentitiesOnly yes
```

Configura el remote:

```bash
git remote set-url origin git@github-bmr-web:TU_USUARIO/TU_REPO.git
ssh -T git@github-bmr-web
```

## Opción B — Token HTTPS

Usa un token con permisos mínimos sobre el repositorio y configura el remote HTTPS. Esta opción es más sencilla, pero exige proteger muy bien el token en la VM.

## Prueba

```bash
automation/run_daily_pipeline.sh --no-push
```

Después:

```bash
automation/run_daily_pipeline.sh
```
