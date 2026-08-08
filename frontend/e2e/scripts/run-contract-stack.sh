#!/usr/bin/env bash
# Boots fixture MLB/Savant → Go API → Vite preview for contract Playwright.
# Playwright webServer runs this script and waits for the preview URL.
# Chaos suites use alternate ports (see playwright.chaos.config.ts) and PUT /_chaos
# on the fixture upstream to inject 429/5xx/slow without live MLB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
UP_ADDR="${E2E_UPSTREAM_ADDR:-:18081}"
API_ADDR="${E2E_API_ADDR:-:18080}"
PREVIEW_HOST="${E2E_PREVIEW_HOST:-127.0.0.1}"
PREVIEW_PORT="${E2E_PREVIEW_PORT:-4174}"

UP_PORT="${UP_ADDR#:}"
API_PORT="${API_ADDR#:}"
UP_URL="http://127.0.0.1:${UP_PORT}"
API_URL="http://127.0.0.1:${API_PORT}"

wait_http() {
  local url="$1"
  local name="$2"
  local i
  for i in $(seq 1 90); do
    if curl -sf "$url" >/dev/null; then
      echo "contract-stack: ${name} ready (${url})"
      return 0
    fi
    sleep 0.5
  done
  echo "contract-stack: timed out waiting for ${name} at ${url}" >&2
  return 1
}

UP_PID=""
API_PID=""
cleanup() {
  if [[ -n "${API_PID}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  if [[ -n "${UP_PID}" ]]; then kill "${UP_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

cd "${ROOT}/backend"
go run ./cmd/e2e-upstream -addr "${UP_ADDR}" &
UP_PID=$!
wait_http "${UP_URL}/health" "e2e-upstream"

MLB_BASE_URL="${UP_URL}" \
SAVANT_BASE_URL="${UP_URL}" \
HTTP_ADDR="${API_ADDR}" \
ALLOWED_ORIGINS="http://${PREVIEW_HOST}:${PREVIEW_PORT},http://127.0.0.1:${PREVIEW_PORT},http://localhost:${PREVIEW_PORT}" \
RATE_LIMIT_REQUESTS=0 \
MLB_MAX_QPS=0 \
SAVANT_MAX_QPS=0 \
go run . &
API_PID=$!
wait_http "${API_URL}/health" "api"

cd "${ROOT}/frontend"
VITE_API_BASE="${API_URL}" npm run build
npm run preview -- --host "${PREVIEW_HOST}" --port "${PREVIEW_PORT}"
