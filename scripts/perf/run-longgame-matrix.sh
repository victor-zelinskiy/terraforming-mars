#!/usr/bin/env bash
# Long-game probe MATRIX runner (perf iteration 3). Each labeled run gets a
# FRESH seed and a FRESH server process, so no run inherits another's game
# history, GameLoader cache or server-side memory — the comparability rule
# the methodology section of docs/STEAM_DECK_PERF_ITERATION_3.md demands.
#
# Usage: bash scripts/perf/run-longgame-matrix.sh <label-prefix> [port]
set -e
PREFIX=${1:-iter3}
PORT=${2:-8127}
cd "$(dirname "$0")/../.."

run_one() {
  local label=$1
  local fx=$2
  local rm=$3
  echo "== $label (fx=$fx rm=$rm)"
  npx tsx tests/perf/seed-longgame.ts >/dev/null 2>&1
  LOCAL_FS_DB=1 PORT=$PORT node build/src/server/server.js >"server-$PORT.log" 2>&1 &
  local pid=$!
  sleep 4
  LONGGAME_PERF=1 LONGGAME_PERF_LABEL="$label" LONGGAME_PERF_PROFILE=deck-docked-tv \
    LONGGAME_SET_FX="$fx" LONGGAME_SET_RM="$rm" BASE_URL="http://localhost:$PORT" \
    npx playwright test tests/e2e/console-longgame-perf-probe.spec.ts --workers=1 2>&1 | tail -3
  kill "$pid" 2>/dev/null || true
  sleep 2
}

run_one "$PREFIX-a" 0 0
run_one "$PREFIX-b" 0 0
run_one "$PREFIX-fx" 1 0
run_one "$PREFIX-rm" 0 1
run_one "$PREFIX-both" 1 1
echo "matrix done"
