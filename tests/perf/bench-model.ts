/*
 * SERVER MODEL BENCH — how much CPU one `/api/player` response costs the
 * server at the long-game seed vs a fresh game. On the Steam Deck the embedded
 * server shares the APU with the renderer, so this cost lands inside every
 * interaction round trip (POST response + poll refetch).
 *
 * Measures, per variant (early gen-1 / late gen-11 seed):
 *   - Server.getPlayerModel(player)  — model construction
 *   - JSON.stringify(model)          — serialization
 *   - payload bytes
 * N iterations, reports median / p95 (hot: the same live game object, like a
 * real server process).
 *
 * Run: npx tsx tests/perf/bench-model.ts
 */
import '../testing/setup';
import {readFileSync} from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {Game} from '../../src/server/Game';
import {Server} from '../../src/server/models/ServerModel';
import {IGame} from '../../src/server/IGame';

function pct(sorted: Array<number>, p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[i] * 100) / 100;
}

function bench(label: string, game: IGame, playerIdx: number, iterations: number): void {
  const player = game.playersInGenerationOrder[playerIdx];
  // Warm-up (JIT + lazily-built caches).
  for (let i = 0; i < 5; i++) {
    JSON.stringify(Server.getPlayerModel(player));
  }
  const build: Array<number> = [];
  const serialize: Array<number> = [];
  let bytes = 0;
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const model = Server.getPlayerModel(player);
    const t1 = performance.now();
    const text = JSON.stringify(model);
    const t2 = performance.now();
    build.push(t1 - t0);
    serialize.push(t2 - t1);
    bytes = text.length;
  }
  build.sort((x, y) => x - y);
  serialize.sort((x, y) => x - y);
  console.log(
    `${label}: build p50=${pct(build, 50)}ms p95=${pct(build, 95)}ms | ` +
    `stringify p50=${pct(serialize, 50)}ms p95=${pct(serialize, 95)}ms | ${(bytes / 1024).toFixed(1)}KB ` +
    `(n=${iterations})`);
}

// ── late game: the seeded save, deserialized like the real server does ──────
const manifest = JSON.parse(readFileSync(path.resolve(process.cwd(), 'tests', 'perf', 'longgame-perf-game.json'), 'utf8'));
const seedText = readFileSync(path.resolve(process.cwd(), 'db', 'files', `${manifest.gameId}.json`), 'utf8');
const lateGame = Game.deserialize(JSON.parse(seedText));

// ── early game: a fresh 2-player game with the same modules ─────────────────
const [earlyGame] = testGame(2, {
  corporateEra: true,
  preludeExtension: true,
  venusNextExtension: true,
  promoCardsOption: true,
  coloniesExtension: true,
  aresExtension: true,
  skipInitialCardSelection: true,
  skipInitialShuffling: true,
}, '-benchearly');

bench('early gen-1 ', earlyGame, 0, 60);
bench('late  gen-11', lateGame, 0, 60);
