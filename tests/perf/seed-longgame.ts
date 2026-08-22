/*
 * LONG-GAME PERF SEED — builds LocalFilesystem saves approximating a real
 * MID/LATE game (the progressive-degradation scenario the Steam Deck iteration
 * measures): 2 players, generation 11, a densely tiled board WITH Ares hazard
 * tiles, big tableaus, ~8 cards in hand, 9 oceans, high global parameters and
 * a game log / event stream about ten generations long.
 *
 * TWO variants are written (iteration 3):
 *   A (`-perflong`)  — the VIEWER is to act (the established wheel / workspace
 *                      / idle scenario of iterations 1-2, unchanged).
 *   B (`-perflongb`) — the RIVAL is to act and holds 8 hand cards, with
 *                      `undoOption` on. The probe drives REAL rival actions
 *                      (sell a patent → undo → …) over HTTP, so the viewer's
 *                      client receives genuine poll-driven model updates — the
 *                      «opponent acted, my screen updates» ingest scenario.
 *
 * The e2e probe (tests/e2e/console-longgame-perf-probe.spec.ts) opens these
 * saves and drives the REAL console shell. This script never fakes client
 * state — every tile goes through the real engine helpers, so the log, the
 * event stream and the placement bonuses are all honest.
 *
 * Run:            npx tsx tests/perf/seed-longgame.ts
 * Serve it:       LOCAL_FS_DB=1 PORT=8123 node build/src/server/server.js
 * Open it:        http://localhost:8123/player?id=<playerId>&console=1
 *
 * Traps inherited from seed-played-tableau.ts:
 *  - `PlayedCards.push` THROWS on a duplicate name — slices are disjoint;
 *  - corporations live INSIDE playedCards (playedCards.corporations());
 *  - a game with no corporation re-enters research on deserialize — both
 *    players get a corp AND the generation is late;
 *  - blue cards run `canAct()` per /api/player — pool restricted to enabled
 *    modules (base / corpEra / promo / venus);
 *  - ACTION phase on deserialize re-arms `activePlayer.takeAction()`, so the
 *    save is LIVE for the seeded active player.
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
import {TileType} from '../../src/common/TileType';
import {GameId, PlayerId} from '../../src/common/Types';
import {addCity, addGreenery, addOcean, runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {SpaceType} from '../../src/common/boards/SpaceType';

type ManifestEntry = {name: string, module: string, type: string, resourceType?: string};

const allCards: Array<ManifestEntry> = require('../../src/genfiles/cards.json');

/** Modules the seeded game enables — cards outside them never enter the pool. */
const SAFE_MODULES = new Set(['base', 'corpera', 'promo', 'venus']);

/** Special serialized state / self-referential behaviors excluded (see
 *  seed-played-tableau.ts). */
const EXCLUDED = new Set<string>([
  'Self-Replicating Robots',
  'Pharmacy Union',
  'Mons Insurance',
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

const DB_DIR = path.resolve(process.cwd(), 'db', 'files');
const HISTORY_DIR = path.join(DB_DIR, 'history');
mkdirSync(HISTORY_DIR, {recursive: true});

type SeededIds = {gameId: GameId, playerId: PlayerId, rivalId: PlayerId, log: number, tiles: number};

function buildLongGame(suffix: string, opts: {rivalToAct: boolean}): SeededIds {
  const [game, viewer, rival] = testGame(2, {
    corporateEra: true,
    preludeExtension: true,
    venusNextExtension: true,
    promoCardsOption: true,
    coloniesExtension: true,
    aresExtension: true,
    aresHazards: true, // initial dust storms — the special-tile axis of the probe
    // Variant B replays rival actions via undo — the probe needs the option.
    undoOption: opts.rivalToAct,
    skipInitialCardSelection: true,
    skipInitialShuffling: true,
  }, suffix);

  // ── tableaus (corp + preludes + a late-game split of the pools) ──────────
  function fillTableau(playerIdx: 0 | 1, corp: string, counts: {active: number, automated: number, events: number}): void {
    const player = playerIdx === 0 ? viewer : rival;
    const half = (pool: Array<string>) => playerIdx === 0 ?
      pool.slice(0, Math.floor(pool.length / 2)) :
      pool.slice(Math.floor(pool.length / 2));
    const names: Array<string> = [
      corp,
      ...half(PRELUDE_POOL).slice(0, 3),
      ...half(ACTIVE_POOL).slice(0, counts.active),
      ...half(AUTOMATED_POOL).slice(0, counts.automated),
      ...half(EVENT_POOL).slice(0, counts.events),
    ];
    if (new Set(names).size !== names.length) {
      throw new Error(`duplicate names in tableau ${playerIdx}`);
    }
    for (const name of names) {
      const card = newCard(name as CardName) as IProjectCard;
      if (card.resourceType !== undefined && card.type === CardType.ACTIVE) {
        card.resourceCount = 5;
      }
      player.playedCards.push(card);
    }
  }
  fillTableau(0, 'CrediCor', {active: 13, automated: 28, events: 12}); // viewer: 57 incl. corp
  fillTableau(1, 'Thorgate', {active: 10, automated: 24, events: 10}); // rival: 48 incl. corp

  // ── hands ────────────────────────────────────────────────────────────────
  // Viewer (the hand-album / wheel-count axis): 8 automated cards from the
  // viewer half, past the 28 already in the tableau.
  const viewerHalfLen = Math.floor(AUTOMATED_POOL.length / 2);
  const handPool = AUTOMATED_POOL.slice(viewerHalfLen - 30, viewerHalfLen - 22);
  for (const name of handPool) {
    viewer.cardsInHand.push(newCard(name as CardName) as IProjectCard);
  }
  // Variant B: the RIVAL needs sellable patents — 8 automated cards from the
  // rival half, past the 24 already in their tableau (disjoint by construction).
  if (opts.rivalToAct) {
    const rivalHand = AUTOMATED_POOL.slice(viewerHalfLen + 30, viewerHalfLen + 38);
    for (const name of rivalHand) {
      rival.cardsInHand.push(newCard(name as CardName) as IProjectCard);
    }
  }

  // ── globals first (placements below read them), then the dense board ─────
  setTemperature(game, 0);
  setOxygenLevel(game, 10);
  setVenusScaleLevel(game, 20);

  // 9 oceans + ~24 city/greenery tiles through the REAL engine (log + events +
  // placement bonuses all real). Alternating owners like a real race.
  for (let i = 0; i < 9; i++) {
    addOcean(i % 2 === 0 ? viewer : rival);
    runAllActions(game);
  }
  for (let i = 0; i < 10; i++) {
    addCity(i % 2 === 0 ? viewer : rival);
    runAllActions(game);
  }
  for (let i = 0; i < 14; i++) {
    addGreenery(i % 2 === 0 ? viewer : rival);
    runAllActions(game);
  }

  // A few EROSION hazards beside the initial dust storms — the reported
  // «hazard tiles jump on workspace close» repro needs hazard tiles standing.
  const emptyLand = game.board.spaces.filter((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined);
  for (let i = 0; i < 3 && i * 7 + 3 < emptyLand.length; i++) {
    AresHazards.putHazardAt(game, emptyLand[i * 7 + 3], TileType.EROSION_MILD);
  }

  // ── ~10 generations of log/event chatter (the journal / notification axis) ─
  // Real templates + typed tokens through the real game.log — each entry bumps
  // gameAge exactly like live play.
  const chatterCards = [...ACTIVE_POOL.slice(0, 20), ...AUTOMATED_POOL.slice(0, 40)];
  for (let gen = 2; gen <= 11; gen++) {
    game.log('Generation ${0}', (b) => b.number(gen));
    for (let i = 0; i < 55; i++) {
      const p = i % 2 === 0 ? viewer : rival;
      const card = chatterCards[(gen * 55 + i) % chatterCards.length];
      switch (i % 5) {
      case 0:
        game.log('${0} played ${1}', (b) => b.player(p).card(newCard(card as CardName)));
        break;
      case 1:
        game.log('${0} used ${1} action', (b) => b.player(p).card(newCard(card as CardName)));
        break;
      case 2:
        game.log('${0} bought ${1} card(s)', (b) => b.player(p).number(2));
        break;
      case 3:
        game.log('${0} gained ${1} M€', (b) => b.player(p).number(7));
        break;
      default:
        game.log('${0} passed', (b) => b.player(p));
        break;
      }
    }
  }

  // ── a playable late-game state ───────────────────────────────────────────
  game.generation = 11;
  game.phase = Phase.ACTION;
  const actor = opts.rivalToAct ? rival : viewer;
  game.activePlayer = actor; // the IPlayer object — serialize() writes .id
  actor.actionsTakenThisRound = 0;
  viewer.megaCredits = 120;
  viewer.steel = 12;
  viewer.titanium = 8;
  viewer.plants = 11;
  viewer.energy = 6;
  viewer.heat = 19;
  viewer.production.override({megacredits: 14, steel: 3, titanium: 2, plants: 3, energy: 4, heat: 5});
  rival.megaCredits = 90;
  rival.plants = 7;
  rival.production.override({megacredits: 11, steel: 2, titanium: 2, plants: 2, energy: 3, heat: 3});

  const serialized = game.serialize();
  serialized.lastSaveId = 1;
  const text = JSON.stringify(serialized);
  writeFileSync(path.join(DB_DIR, `${game.id}.json`), text);
  writeFileSync(path.join(HISTORY_DIR, `${game.id}-00000.json`), text);

  return {
    gameId: game.id,
    playerId: viewer.id,
    rivalId: rival.id,
    log: game.gameLog.length,
    tiles: game.board.spaces.filter((s) => s.tile !== undefined).length,
  };
}

const a = buildLongGame('-perflong', {rivalToAct: false});
const b = buildLongGame('-perflongb', {rivalToAct: true});

const manifest = {...a, b};
const manifestPath = path.resolve(process.cwd(), 'tests', 'perf', 'longgame-perf-game.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`seeded long game A: game=${a.gameId} viewer=${a.playerId} log=${a.log} tiles=${a.tiles}`);
console.log(`seeded long game B: game=${b.gameId} viewer=${b.playerId} rivalToAct log=${b.log} tiles=${b.tiles}`);
