#!/usr/bin/env bash
set -Eeuo pipefail

# BMR Web — pipeline diario de exportación, validación y publicación.
# Ejecutar desde cualquier ubicación. El script resuelve la raíz del repositorio.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Configuración por defecto. Puede sobrescribirse con automation/env/daily-export.env,
# variables de entorno o argumentos CLI.
ENV_FILE="${ENV_FILE:-exporter/.env.local}"
OUT_DIR="${OUT_DIR:-web/data}"
MAX_POINTS="${MAX_POINTS:-8000}"
MAX_MARKET_POINTS="${MAX_MARKET_POINTS:-0}"
MAX_INDICATORS="${MAX_INDICATORS:-0}"
MAX_ASSETS="${MAX_ASSETS:-500}"
MAX_SERIES="${MAX_SERIES:-0}"
MAX_CRYPTO="${MAX_CRYPTO:-100}"
MAX_RUNS="${MAX_RUNS:-150}"
BRANCH="${BRANCH:-main}"
LOG_DIR="${LOG_DIR:-automation/logs}"
LOCK_FILE="${LOCK_FILE:-/tmp/bmr-web-export.lock}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-.venv-exporter}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
COMMIT_PREFIX="${COMMIT_PREFIX:-data: update BMR web snapshot}"
PRE_EXPORT_COMMAND="${BMR_PRE_EXPORT_COMMAND:-}"
POST_EXPORT_COMMAND="${BMR_POST_EXPORT_COMMAND:-}"
SKIP_GIT=0
NO_PUSH=0
DRY_RUN=0
NO_VENV_UPDATE=0
STRICT_VALIDATION=0
FAIL_ON_WARNING=0
CLEAN=1
PUBLISH_R2=${BMR_PUBLISH_R2:-0}
R2_BUCKET=${BMR_R2_BUCKET:-bmr-private-data}
R2_PREFIX=${BMR_R2_PREFIX:-data}

CONFIG_FILE="automation/env/daily-export.env"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

usage() {
  cat <<'EOF'
Uso:
  automation/run_daily_pipeline.sh [opciones]

Opciones principales:
  --env-file PATH          .env con credenciales MariaDB (por defecto exporter/.env.local)
  --out-dir PATH           destino JSON (por defecto web/data)
  --branch NAME            rama Git a publicar (por defecto main)
  --max-points N           puntos máximos por serie (0 = todos)
  --max-market-points N    puntos máximos para SPX/señales/USREC en market (0 = todos)
  --max-assets N           activos máximos (0 = todos)
  --max-indicators N       indicadores máximos (0 = todos)
  --max-series N           series canónicas máximas (0 = todas)
  --max-crypto N           símbolos cripto máximos (0 = todos)
  --max-runs N             runs ML máximos
  --no-push                crea commit local, pero no hace git push
  --skip-git               no hace git add/commit/push
  --dry-run                exporta y valida, pero no hace commit/push
  --no-clean               no limpia web/data antes de exportar
  --no-venv-update         no instala/actualiza requirements.txt
  --strict-validation      validación estricta de timeseries de catálogo
  --fail-on-warning        exportador devuelve error si hay warnings
  --pre-command CMD        comando opcional antes de exportar (ETL/ML)
  --post-command CMD       comando opcional después de validar
  --publish-r2             sube web/data/*.json a Cloudflare R2 mediante Wrangler
  --r2-bucket NAME         bucket R2 destino
  --r2-prefix PREFIX       prefijo R2, por defecto data
  --help                   muestra esta ayuda

Ejemplo:
  automation/run_daily_pipeline.sh --env-file exporter/.env.local --branch main
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --max-points) MAX_POINTS="$2"; shift 2 ;;
    --max-market-points) MAX_MARKET_POINTS="$2"; shift 2 ;;
    --max-indicators) MAX_INDICATORS="$2"; shift 2 ;;
    --max-assets) MAX_ASSETS="$2"; shift 2 ;;
    --max-series) MAX_SERIES="$2"; shift 2 ;;
    --max-crypto) MAX_CRYPTO="$2"; shift 2 ;;
    --max-runs) MAX_RUNS="$2"; shift 2 ;;
    --log-dir) LOG_DIR="$2"; shift 2 ;;
    --no-push) NO_PUSH=1; shift ;;
    --skip-git) SKIP_GIT=1; shift ;;
    --dry-run) DRY_RUN=1; NO_PUSH=1; shift ;;
    --no-clean) CLEAN=0; shift ;;
    --no-venv-update) NO_VENV_UPDATE=1; shift ;;
    --strict-validation) STRICT_VALIDATION=1; shift ;;
    --fail-on-warning) FAIL_ON_WARNING=1; shift ;;
    --pre-command) PRE_EXPORT_COMMAND="$2"; shift 2 ;;
    --post-command) POST_EXPORT_COMMAND="$2"; shift 2 ;;
    --publish-r2) PUBLISH_R2=1; shift ;;
    --r2-bucket) R2_BUCKET="$2"; shift 2 ;;
    --r2-prefix) R2_PREFIX="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "ERROR: opción desconocida: $1" >&2; usage; exit 2 ;;
  esac
done

mkdir -p "$LOG_DIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/bmr-web-export-${RUN_ID}.log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "ERROR: ya hay una exportación en curso. Lock: $LOCK_FILE" >&2
  exit 75
fi

exec > >(tee -a "$LOG_FILE") 2>&1

fail_status() {
  local exit_code=$?
  set +e
  "$PYTHON_BIN" automation/make_snapshot_status.py \
    --repo-root "$REPO_ROOT" \
    --data-dir "$OUT_DIR" \
    --stage failed \
    --validation-status error \
    --message "pipeline falló con código ${exit_code}" \
    --log-file "$LOG_FILE" \
    --branch "$BRANCH" \
    --no-file-index >/dev/null 2>&1 || true
  echo "ERROR: pipeline falló. Log: $LOG_FILE" >&2
  exit "$exit_code"
}
trap fail_status ERR

echo "== BMR Web daily pipeline =="
echo "run_id=$RUN_ID"
echo "repo=$REPO_ROOT"
echo "out_dir=$OUT_DIR"
echo "env_file=$ENV_FILE"
echo "branch=$BRANCH"
echo "log_file=$LOG_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe ENV_FILE=$ENV_FILE" >&2
  echo "Crea uno desde exporter/.env.example o automation/env/daily-export.env.example." >&2
  exit 2
fi

if [[ -n "$PRE_EXPORT_COMMAND" ]]; then
  echo "== PRE_EXPORT_COMMAND =="
  bash -lc "$PRE_EXPORT_COMMAND"
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "== creando virtualenv $VENV_DIR =="
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

if [[ "$NO_VENV_UPDATE" -eq 0 ]]; then
  echo "== instalando dependencias exporter =="
  python -m pip install --upgrade pip
  python -m pip install -r exporter/requirements.txt
fi

EXPORT_ARGS=(
  exporter/export_web_json.py
  --env-file "$ENV_FILE"
  --out-dir "$OUT_DIR"
  --max-points "$MAX_POINTS"
  --max-market-points "$MAX_MARKET_POINTS"
  --max-indicators "$MAX_INDICATORS"
  --max-assets "$MAX_ASSETS"
  --max-series "$MAX_SERIES"
  --max-crypto "$MAX_CRYPTO"
  --max-runs "$MAX_RUNS"
)
if [[ "$CLEAN" -eq 1 ]]; then EXPORT_ARGS+=(--clean); fi
if [[ "$FAIL_ON_WARNING" -eq 1 ]]; then EXPORT_ARGS+=(--fail-on-warning); fi

echo "== exportando JSON desde MariaDB =="
python "${EXPORT_ARGS[@]}"

VALIDATE_ARGS=(exporter/validate_web_json.py --data-dir "$OUT_DIR")
if [[ "$STRICT_VALIDATION" -eq 1 ]]; then VALIDATE_ARGS+=(--strict); fi

echo "== validando snapshot =="
python "${VALIDATE_ARGS[@]}"

if [[ -n "$POST_EXPORT_COMMAND" ]]; then
  echo "== POST_EXPORT_COMMAND =="
  bash -lc "$POST_EXPORT_COMMAND"
fi

echo "== escribiendo status operativo =="
python automation/make_snapshot_status.py \
  --repo-root "$REPO_ROOT" \
  --data-dir "$OUT_DIR" \
  --stage validated \
  --validation-status ok \
  --message "snapshot validado correctamente" \
  --log-file "$LOG_FILE" \
  --branch "$BRANCH"

if [[ "$PUBLISH_R2" -eq 1 ]]; then
  echo "== publicando JSON privados a Cloudflare R2 =="
  BMR_R2_BUCKET="$R2_BUCKET" BMR_R2_PREFIX="$R2_PREFIX" DATA_DIR="$OUT_DIR" \
    automation/cloudflare/publish_data_to_r2.sh
fi

if [[ "$SKIP_GIT" -eq 1 || "$DRY_RUN" -eq 1 ]]; then
  echo "== git omitido =="
  python automation/make_snapshot_status.py \
    --repo-root "$REPO_ROOT" --data-dir "$OUT_DIR" --stage dry-run --validation-status ok \
    --message "exportación validada sin publicación" --log-file "$LOG_FILE" --branch "$BRANCH" >/dev/null
  echo "OK: exportación validada. Sin commit/push por configuración."
  exit 0
fi

echo "== preparando commit =="
git add "$OUT_DIR"
if git diff --cached --quiet; then
  echo "No hay cambios en JSON; no se crea commit."
  python automation/make_snapshot_status.py \
    --repo-root "$REPO_ROOT" --data-dir "$OUT_DIR" --stage committed --validation-status ok \
    --message "sin cambios respecto al último snapshot" --log-file "$LOG_FILE" --branch "$BRANCH" >/dev/null
else
  git commit -m "$COMMIT_PREFIX $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  python automation/make_snapshot_status.py \
    --repo-root "$REPO_ROOT" --data-dir "$OUT_DIR" --stage committed --validation-status ok \
    --message "commit creado" --log-file "$LOG_FILE" --branch "$BRANCH" >/dev/null

  # Commit secundario para incluir el status actualizado con el hash nuevo.
  git add "$OUT_DIR/status/publish.json" "$OUT_DIR/status/automation.json" "$OUT_DIR/status/file_index.json" || true
  if ! git diff --cached --quiet; then
    git commit -m "data: update snapshot status $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  fi
fi

if [[ "$NO_PUSH" -eq 1 ]]; then
  echo "NO_PUSH=1: no se hace git push."
else
  echo "== publicando a $GIT_REMOTE/$BRANCH =="
  git push "$GIT_REMOTE" "$BRANCH"
  python automation/make_snapshot_status.py \
    --repo-root "$REPO_ROOT" --data-dir "$OUT_DIR" --stage pushed --validation-status ok \
    --message "push completado; GitHub Actions desplegará Pages" --log-file "$LOG_FILE" --branch "$BRANCH" >/dev/null
fi

echo "OK: pipeline finalizado. Log: $LOG_FILE"
