#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT_DIR/web/data}"
BUCKET="${BMR_R2_BUCKET:-bmr-private-data}"
PREFIX="${BMR_R2_PREFIX:-data}"
DRY_RUN="${DRY_RUN:-0}"

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx no está disponible. Instala Node.js/npm." >&2
  exit 1
fi

if [ ! -d "$DATA_DIR" ]; then
  echo "ERROR: DATA_DIR no existe: $DATA_DIR" >&2
  exit 1
fi

count=0
while IFS= read -r -d '' file; do
  rel="${file#$DATA_DIR/}"
  key="$PREFIX/$rel"
  count=$((count + 1))
  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY_RUN wrangler r2 object put $BUCKET/$key --file $file"
  else
    npx wrangler r2 object put "$BUCKET/$key" --file "$file"
  fi
done < <(find "$DATA_DIR" -type f -name '*.json' -print0 | sort -z)

echo "R2 publish terminado. Archivos procesados: $count"
