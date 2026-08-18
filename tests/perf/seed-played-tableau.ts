/*
 * PLAYED-TABLEAU PERF SEEDS — builds LocalFilesystem saves where one solo
 * player already has N cards on the table (20 / 50 / 100 / 200), so the
 * «Разыграно» performance probe (tests/e2e/console-played-perf-probe.spec.ts)
 * can open a REAL running game without playing N cards through the UI.
 *
 * Run:            npx tsx tests/perf/seed-played-tableau.ts
 * Serve them:     LOCAL_FS_DB=1 PORT=8123 node build/src/server/server.js
 *                 (the GameLoader cache is built once at startup — restart the
 *                 server after re-seeding, or PUT /load_game for an existing id)
 * Open one:       http://localhost:8123/player?id=p-blue-id-perf200&console=1
 *
 * Design notes (the traps that make this non-obvious):
 *  - `PlayedCards.push` THROWS on a duplicate name — every name is unique;
 *  - a generation-1 game with no corporation re-enters the research phase on
 *    deserialize (Game.ts) — we set generation 3 AND push a corporation;
 *  - blue (active) cards run `canAct()` on every /api/player — the pool is
 *    restricted to modules the seeded game actually enables (base / corpEra /
 *    promo / venus + prelude), so no card touches a missing expansion;
 *  - `newCard(name)` must resolve every name at deserialize time — names come
 *    from src/genfiles/cards.json, never invented.
 */
import '../testing/setup'; // fake DB + globalInitialize — Game.save is a no-op here
import {mkdirSync, writeFileSync} from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {newCard} from '../../src/server/createCard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {GameId, PlayerId} from '../../src/common/Types';

type ManifestEntry = {name: string, module: string, type: string, resourceType?: string};

const allCards: Array<ManifestEntry> = require('../../src/genfiles/cards.json');

/** Modules the seeded game enables — cards outside them never enter the pool. */
const SAFE_MODULES = new Set(['base', 'corpera', 'promo', 'venus']);

/** Cards excluded from the pool: special serialized state / self-referential
 *  behaviors that make an artificially-injected tableau lie. */
const EXCLUDED = new Set<string>([
  'Self-Replicating Robots', // serializes targetCards
  'Pharmacy Union', // isDisabled state
  'Mons Insurance', // per-game global hooks
]);

function poolOf(type: string): Array<string> {
  return allCards
    .filter((c) => SAFE_MODULES.has(c.module) && c.type === type && !EXCLUDED.has(c.name))
    .map((c) => c.name)
    .sort(); // deterministic order
}

const ACTIVE_POOL = poolOf('active');
const AUTOMATED_POOL = poolOf('automated');
const EVENT_POOL = poolOf('event');
const PRELUDE_POOL = allCards
  .filter((c) => c.module === 'prelude' && c.type === 'prelude' && !EXCLUDED.has(c.name))
  .map((c) => c.name)
  .sort();

/** Tableau composition for N cards: 1 corp + preludes + ~24% active +
 *  ~25% events + the rest automated (a realistic late-game shape). */
function composition(n: number): {preludes: number, active: number, events: number, automated: number} {
  const preludes = n >= 50 ? 3 : (n >= 20 ? 2 : 1);
  const rest = n - 1 - preludes;
  const active = Math.min(ACTIVE_POOL.length, Math.round(rest * 0.24));
  const events = Math.min(EVENT_POOL.length, Math.round(rest * 0.25));
  const automated = rest - active - events;
  if (automated > AUTOMATED_POOL.length) {
    throw new Error(`Not enough automated cards for n=${n}: need ${automated}, have ${AUTOMATED_POOL.length}`);
  }
  return {preludes, active, events, automated};
}

const DB_DIR = path.resolve(process.cwd(), 'db', 'files');
const HISTORY_DIR = path.join(DB_DIR, 'history');
mkdirSync(HISTORY_DIR, {recursive: true});

type SeededGame = {n: number, gameId: GameId, playerId: PlayerId};
const manifest: Array<SeededGame> = [];

for (const n of [20, 50, 100, 200]) {
  const suffix = `-perf${n}`;
  const [game, player] = testGame(1, {
    corporateEra: true,
    preludeExtension: true,
    venusNextExtension: true,
    promoCardsOption: true,
    skipInitialCardSelection: true,
    skipInitialShuffling: true,
  }, suffix);

  const comp = composition(n);
  const names: Array<string> = [
    'CrediCor',
    ...PRELUDE_POOL.slice(0, comp.preludes),
    ...ACTIVE_POOL.slice(0, comp.active),
    ...AUTOMATED_POOL.slice(0, comp.automated),
    ...EVENT_POOL.slice(0, comp.events),
  ];
  if (new Set(names).size !== names.length) {
    throw new Error(`duplicate names in n=${n} composition`);
  }
  for (const name of names) {
    const card = newCard(name as CardName) as IProjectCard;
    // Visible stored resources on the resource-holding actives — the probe's
    // «many resources on visible cards» axis (5 per holder, honest amounts).
    if (card.resourceType !== undefined && card.type === CardType.ACTIVE) {
      card.resourceCount = 5;
    }
    player.playedCards.push(card);
  }

  // A playable mid-game state: action phase, generation 3, funded player.
  game.generation = 3;
  game.phase = Phase.ACTION;
  player.megaCredits = 500;
  player.steel = 20;
  player.titanium = 20;
  player.plants = 6;
  player.energy = 8;
  player.heat = 12;
  player.production.override({megacredits: 10, steel: 2, titanium: 2, plants: 2, energy: 3, heat: 3});

  const serialized = game.serialize();
  serialized.lastSaveId = 1; // history/…-00000 is the initial save below
  const text = JSON.stringify(serialized);
  writeFileSync(path.join(DB_DIR, `${game.id}.json`), text);
  writeFileSync(path.join(HISTORY_DIR, `${game.id}-00000.json`), text);
  manifest.push({n, gameId: game.id, playerId: player.id});
  console.log(`seeded n=${n}: game=${game.id} player=${player.id} tableau=${player.playedCards.asArray().length}`);
}

const manifestPath = path.resolve(process.cwd(), 'tests', 'perf', 'played-perf-games.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`manifest → ${manifestPath}`);
