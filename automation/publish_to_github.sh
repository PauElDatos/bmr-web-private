#!/usr/bin/env bash
set -euo pipefail

# Wrapper retrocompatible. En Fase 5 la lógica principal vive en run_daily_pipeline.sh.
ENV_FILE="${1:-${ENV_FILE:-exporter/.env.local}}"
shift || true
exec "$(dirname "$0")/run_daily_pipeline.sh" --env-file "$ENV_FILE" "$@"
