#!/usr/bin/env bash
# Prove in-process TTLCache + singleflight under concurrency against fixture upstream,
# and report cold-vs-warm p50/p95 request latency (from the http_request_duration_seconds
# histogram on /metrics) at a sweep of concurrency levels.
# No hey/k6/Locust — bash + python3 + curl only. See docs/slo.md and README cost table.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# LOAD_SMOKE_N (single level, back-compat) takes priority over LOAD_SMOKE_LEVELS (sweep).
LEVELS="${LOAD_SMOKE_N:-${LOAD_SMOKE_LEVELS:-10 40 100 500}}"
UP_ADDR="${LOAD_SMOKE_UPSTREAM_ADDR:-:18181}"
API_ADDR="${LOAD_SMOKE_API_ADDR:-:18180}"
SLOW_MS="${LOAD_SMOKE_SLOW_MS:-400}"
PATH_Q="${LOAD_SMOKE_PATH:-/standings}"
ROUTE_LABEL="${PATH_Q%%\?*}"

UP_PORT="${UP_ADDR#:}"
API_PORT="${API_ADDR#:}"
UP_URL="http://127.0.0.1:${UP_PORT}"
API_URL="http://127.0.0.1:${API_PORT}"

wait_http() {
  local url="$1"
  local name="$2"
  local i
  # Match e2e/scripts/run-contract-stack.sh: cold `go run` often needs ~45s to compile+listen.
  for i in $(seq 1 90); do
    if curl -sf "$url" >/dev/null; then
      echo "load-smoke: ${name} ready (${url})"
      return 0
    fi
    sleep 0.5
  done
  echo "load-smoke: timed out waiting for ${name} at ${url}" >&2
  return 1
}

metric_value() {
  # Args: metrics text file, metric name, optional label matcher substring (e.g. result="miss")
  local file="$1"
  local name="$2"
  local label="${3:-}"
  python3 - "$file" "$name" "$label" <<'PY'
import re, sys
path, name, label = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path, encoding="utf-8").read()
if label:
    pat = re.compile(rf'^{re.escape(name)}\{{[^}}]*{re.escape(label)}[^}}]*\}}\s+([0-9.eE+-]+)\s*$', re.M)
else:
    pat = re.compile(rf'^{re.escape(name)}\s+([0-9.eE+-]+)\s*$', re.M)
m = pat.search(text)
if not m:
    print("0")
else:
    print(m.group(1))
PY
}

# Interpolated quantile (ms) of caught_looking_http_request_duration_seconds{route,code="2xx"}
# over the window between two /metrics snapshots. Prints "n/a" if the window has no samples.
histogram_quantile_ms() {
  local before="$1" after="$2" route="$3" quantile="$4"
  python3 - "$before" "$after" "$route" "$quantile" <<'PY'
import re, sys
before_path, after_path, route, q = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
name = "caught_looking_http_request_duration_seconds"

def parse_buckets(path):
    text = open(path, encoding="utf-8").read()
    pat = re.compile(rf'^{re.escape(name)}_bucket\{{([^}}]*)\}}\s+([0-9.eE+-]+)\s*$', re.M)
    out = []
    for m in pat.finditer(text):
        labels, val = m.group(1), float(m.group(2))
        if f'route="{route}"' not in labels or 'code="2xx"' not in labels:
            continue
        le_raw = re.search(r'le="([^"]+)"', labels).group(1)
        le = float("inf") if le_raw == "+Inf" else float(le_raw)
        out.append((le, val))
    out.sort(key=lambda x: x[0])
    return out

before = parse_buckets(before_path)
after = parse_buckets(after_path)
if not before or not after or len(before) != len(after):
    print("n/a")
    sys.exit(0)

deltas = [(le, ca - cb) for (le, ca), (_, cb) in zip(after, before)]
total = deltas[-1][1]
if total <= 0:
    print("n/a")
    sys.exit(0)

target = q * total
prev_le, prev_cum = 0.0, 0.0
for le, cum in deltas:
    if cum >= target:
        if le == float("inf"):
            print(f"{prev_le * 1000:.1f}")
        else:
            span = cum - prev_cum
            frac = 0.0 if span <= 0 else (target - prev_cum) / span
            print(f"{(prev_le + frac * (le - prev_le)) * 1000:.1f}")
        sys.exit(0)
    prev_le, prev_cum = le, cum
print(f"{deltas[-1][0] * 1000:.1f}")
PY
}

scrape_metrics() {
  curl -sf "${API_URL}/metrics" >"$1"
}

burst() {
  local path="$1"
  local n="$2"
  python3 - "$API_URL" "$path" "$n" <<'PY'
import sys, urllib.request, concurrent.futures
base, path, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
url = base.rstrip("/") + path
ok = 0
errors = []

def one(_):
    try:
        with urllib.request.urlopen(url, timeout=30) as res:
            if 200 <= res.status < 300:
                return True
            return False
    except Exception as e:
        errors.append(str(e))
        return False

with concurrent.futures.ThreadPoolExecutor(max_workers=n) as ex:
    for r in ex.map(one, range(n)):
        if r:
            ok += 1
if ok != n:
    print(f"load-smoke: burst got {ok}/{n} OK responses; sample errors: {errors[:3]}", file=sys.stderr)
    sys.exit(1)
print(f"load-smoke: burst {n} OK -> {url}")
PY
}

UP_PID=""
API_PID=""
BEFORE=""
AFTER_COLD=""
AFTER_WARM=""
cleanup() {
  if [[ -n "${API_PID}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  if [[ -n "${UP_PID}" ]]; then kill "${UP_PID}" 2>/dev/null || true; fi
  rm -f "${BEFORE:-}" "${AFTER_COLD:-}" "${AFTER_WARM:-}"
}
trap cleanup EXIT INT TERM

TMPDIR="${TMPDIR:-/tmp}"
BEFORE="$(mktemp "${TMPDIR}/load-smoke-before.XXXXXX")"
AFTER_COLD="$(mktemp "${TMPDIR}/load-smoke-after-cold.XXXXXX")"
AFTER_WARM="$(mktemp "${TMPDIR}/load-smoke-after-warm.XXXXXX")"

echo "load-smoke: booting fixture upstream (slow ${SLOW_MS}ms on /standings) + API"
cd "${ROOT}/backend"
# Slow the standings fixture so concurrent cold misses overlap in singleflight.
E2E_CHAOS_MODE=slow \
E2E_CHAOS_PATHS=/standings \
E2E_CHAOS_SLOW_MS="${SLOW_MS}" \
go run ./cmd/e2e-upstream -addr "${UP_ADDR}" &
UP_PID=$!
wait_http "${UP_URL}/health" "e2e-upstream"

MLB_BASE_URL="${UP_URL}" \
SAVANT_BASE_URL="${UP_URL}" \
HTTP_ADDR="${API_ADDR}" \
ALLOWED_ORIGINS="http://127.0.0.1:5173" \
RATE_LIMIT_REQUESTS=0 \
MLB_MAX_QPS=0 \
SAVANT_MAX_QPS=0 \
go run . &
API_PID=$!
wait_http "${API_URL}/health" "api"

# One throwaway request so the http_request_duration_seconds{route,code="2xx"} series exists
# with all buckets before the first snapshot — otherwise the first level's "before" scrape has
# no samples for this route at all (Prometheus only exposes observed label combos), the bucket
# arrays don't line up, and the quantile calc reports n/a instead of a real percentile.
curl -sf "${API_URL}${PATH_Q}" >/dev/null || true

# Each concurrency level gets its own cache key (distinct ?season=) so every level's cold
# burst is a genuine cache miss, even though the API process stays up across the sweep.
declare -a SUMMARY=()
level_idx=0
for n in ${LEVELS}; do
  if [[ "${ROUTE_LABEL}" == "/standings" ]]; then
    level_path="/standings?season=$((2001 + level_idx))"
  else
    level_path="${PATH_Q}"
  fi
  level_idx=$((level_idx + 1))

  scrape_metrics "$BEFORE"
  miss0="$(metric_value "$BEFORE" caught_looking_cache_requests_total 'result="miss"')"
  hit0="$(metric_value "$BEFORE" caught_looking_cache_requests_total 'result="hit"')"
  coal0="$(metric_value "$BEFORE" caught_looking_cache_coalesce_total)"

  echo "load-smoke: N=${n} cold burst (expect ~1 miss, coalesce >= N/2)"
  burst "$level_path" "$n"
  scrape_metrics "$AFTER_COLD"

  miss1="$(metric_value "$AFTER_COLD" caught_looking_cache_requests_total 'result="miss"')"
  hit1="$(metric_value "$AFTER_COLD" caught_looking_cache_requests_total 'result="hit"')"
  coal1="$(metric_value "$AFTER_COLD" caught_looking_cache_coalesce_total)"

  miss_d="$(python3 -c "print(float('${miss1}')-float('${miss0}'))")"
  hit_d="$(python3 -c "print(float('${hit1}')-float('${hit0}'))")"
  coal_d="$(python3 -c "print(float('${coal1}')-float('${coal0}'))")"
  cold_p50="$(histogram_quantile_ms "$BEFORE" "$AFTER_COLD" "$ROUTE_LABEL" 0.50)"
  cold_p95="$(histogram_quantile_ms "$BEFORE" "$AFTER_COLD" "$ROUTE_LABEL" 0.95)"

  echo "load-smoke: N=${n} cold deltas  miss=${miss_d}  coalesce=${coal_d}  hit=${hit_d}  p50=${cold_p50}ms  p95=${cold_p95}ms"

  python3 - "$miss_d" "$coal_d" "$n" <<'PY'
import sys
miss_d, coal_d, n = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3])
# Allow a couple of races if the leader finishes before late joiners arrive.
if miss_d < 1 or miss_d > 3:
    raise SystemExit(f"cold miss delta {miss_d}: want 1-3 (singleflight leader + rare late misses)")
if coal_d < n / 2:
    raise SystemExit(f"cold coalesce delta {coal_d}: want >= {n/2} (most of {n} clients shared one load)")
PY
  echo "load-smoke: N=${n} cold OK (miss=${miss_d}, coalesce=${coal_d})"

  echo "load-smoke: N=${n} warm burst (expect hits >= N, miss ~= 0)"
  burst "$level_path" "$n"
  scrape_metrics "$AFTER_WARM"

  miss2="$(metric_value "$AFTER_WARM" caught_looking_cache_requests_total 'result="miss"')"
  hit2="$(metric_value "$AFTER_WARM" caught_looking_cache_requests_total 'result="hit"')"

  miss_w="$(python3 -c "print(float('${miss2}')-float('${miss1}'))")"
  hit_w="$(python3 -c "print(float('${hit2}')-float('${hit1}'))")"
  warm_p50="$(histogram_quantile_ms "$AFTER_COLD" "$AFTER_WARM" "$ROUTE_LABEL" 0.50)"
  warm_p95="$(histogram_quantile_ms "$AFTER_COLD" "$AFTER_WARM" "$ROUTE_LABEL" 0.95)"

  echo "load-smoke: N=${n} warm deltas  miss=${miss_w}  hit=${hit_w}  p50=${warm_p50}ms  p95=${warm_p95}ms"

  python3 - "$miss_w" "$hit_w" "$n" <<'PY'
import sys
miss_w, hit_w, n = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3])
if miss_w > 0:
    raise SystemExit(f"warm miss delta {miss_w}: want 0 (served from in-process cache)")
if hit_w < n:
    raise SystemExit(f"warm hit delta {hit_w}: want >= {n}")
PY
  echo "load-smoke: N=${n} warm OK (miss=${miss_w}, hit=${hit_w})"

  SUMMARY+=("${n}|${cold_p50}|${cold_p95}|${warm_p50}|${warm_p95}")
done

echo ""
echo "load-smoke: PASS -- latency summary (route=${ROUTE_LABEL}, ms, singleflight leader included in cold)"
printf "%-8s %-10s %-10s %-10s %-10s\n" "N" "cold-p50" "cold-p95" "warm-p50" "warm-p95"
for row in "${SUMMARY[@]}"; do
  IFS='|' read -r n cp50 cp95 wp50 wp95 <<<"$row"
  printf "%-8s %-10s %-10s %-10s %-10s\n" "$n" "$cp50" "$cp95" "$wp50" "$wp95"
done
echo "load-smoke: metrics at ${API_URL}/metrics (caught_looking_cache_*, caught_looking_http_request_duration_seconds)."
