#!/usr/bin/env bash
# Final verification batch (perf iteration 3): one default + one fx probe run
# on the final build, then the idle/wheel traces and the allocation sampling —
# each stage on a fresh seed + fresh server, host otherwise untouched.
set -e
PORT=${1:-8127}
cd "$(dirname "$0")/../.."

run_probe() {
  local label=$1
  local fx=$2
  echo "== $label"
  npx tsx tests/perf/seed-longgame.ts >/dev/null 2>&1
  LOCAL_FS_DB=1 PORT=$PORT node build/src/server/server.js >"server-$PORT.log" 2>&1 &
  local pid=$!
  sleep 4
  LONGGAME_PERF=1 LONGGAME_PERF_LABEL="$label" LONGGAME_PERF_PROFILE=deck-docked-tv \
    LONGGAME_SET_FX="$fx" BASE_URL="http://localhost:$PORT" \
    npx playwright test tests/e2e/console-longgame-perf-probe.spec.ts --workers=1 2>&1 | tail -3
  kill "$pid" 2>/dev/null || true
  sleep 2
}

run_probe iter3-final-a 0
run_probe iter3-final-fx 1

echo "== traces + alloc"
npx tsx tests/perf/seed-longgame.ts >/dev/null 2>&1
LOCAL_FS_DB=1 PORT=$PORT node build/src/server/server.js >"server-$PORT.log" 2>&1 &
SPID=$!
sleep 4
TRACE_THROTTLE=4 node scripts/perf/trace-wheel.mjs p-player1-id-perflong "http://localhost:$PORT"
node scripts/perf/alloc-wheel.mjs p-player1-id-perflong "http://localhost:$PORT"
kill "$SPID" 2>/dev/null || true
echo "final batch done"
