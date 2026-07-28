#!/usr/bin/env bash
# afterFileEdit: format caught-looking frontend files with Prettier (fail open).
set -u

input="$(cat)"
raw_path="$(
  printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("file_path") or "")'
)"

[[ -n "$raw_path" ]] || exit 0

root="$(cd "$(dirname "$0")/../.." && pwd)"

# Cursor may send absolute paths or workspace-relative paths (e.g. frontend/src/...).
if [[ "$raw_path" = /* ]]; then
  file_path="$raw_path"
else
  file_path="$root/$raw_path"
fi

[[ -f "$file_path" ]] || exit 0

# Normalize to a path relative to the repo root when possible.
rel="${file_path#"$root"/}"
case "$rel" in
  frontend/*) ;;
  *) exit 0 ;;
esac

case "$rel" in
  *.ts|*.tsx|*.js|*.jsx|*.scss|*.css|*.json|*.html) ;;
  *) exit 0 ;;
esac

case "$rel" in
  frontend/src/types/api.generated.ts) exit 0 ;;
esac

frontend="$root/frontend"
prettier_bin="$frontend/node_modules/.bin/prettier"
config="$frontend/prettier.config.js"
ignore="$frontend/.prettierignore"

# Use the frontend-pinned Prettier (same as npm run format:check), not a floating npx download.
if [[ ! -x "$prettier_bin" ]]; then
  echo "prettier-frontend hook: frontend/node_modules/.bin/prettier missing; run npm install in frontend/" >&2
  exit 0
fi

# Fail open: formatting errors must not block the agent.
"$prettier_bin" --write --config "$config" --ignore-path "$ignore" -- "$file_path" >/dev/null 2>&1 || true
exit 0
