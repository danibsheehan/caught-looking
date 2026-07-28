#!/usr/bin/env bash
# afterFileEdit: format caught-looking frontend files with Prettier (fail open).
set -u

input="$(cat)"
file_path="$(
  printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("file_path") or "")'
)"

[[ -n "$file_path" && -f "$file_path" ]] || exit 0

case "$file_path" in
  */frontend/*) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.scss|*.css|*.json|*.html) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  */frontend/src/types/api.generated.ts) exit 0 ;;
esac

root="$(cd "$(dirname "$0")/../.." && pwd)"
config="$root/frontend/prettier.config.js"
ignore="$root/frontend/.prettierignore"

if ! command -v npx >/dev/null 2>&1; then
  echo "prettier-frontend hook: npx not found; skipping" >&2
  exit 0
fi

# Fail open: formatting errors must not block the agent.
npx --yes prettier --write --config "$config" --ignore-path "$ignore" -- "$file_path" >/dev/null 2>&1 || true
exit 0
