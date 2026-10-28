/**
 * MarsBot LATE-GAME PACE bench — what EXTRA action cards would give the bot at the moment its deck runs
 * out while the humans are still acting (the owner, 2026-10-28: «в поздних поколениях бот слишком быстро
 * пасует … должен дольше оставаться в игре в Redux-партиях»).
 *
 * Input: history SNAPSHOTS from the owner's Steam Machine (`history/<gameId>-NNNNN.json`), each taken right
 * after the bot resolved the LAST card of its action deck in a generation (deck empty, the pass not yet
 * taken). For every snapshot the bench rebuilds the game through the real `Game.deserialize`, then draws
 * and resolves up to K extra project cards for the bot exactly as the controller's project branch does
 * (the corporation's resolving hook, the human reactors, the tags left to right, the deferred drain), and
 * measures after each card: the tracks' total advance, the bot's TR, the global parameters, its tiles,
 * its Failed Actions / M€, and the dividend clauses that read the tracks (C29 Manutech first).
 *
 *   npx tsx scripts/marsbot-pace-bench.ts <dir-with-snapshots> [--cards=3]
 *
 * Then three POLICIES are costed per game from the same yields:
 *   · «+1 от 6-го»      — one extra card in every generation ≥ 6, humans or no humans;
 *   · «вторая смена ×2» — up to 2 extra cards, only while a human is still in the generation;
 *   · «вторая смена ×3» — the same, up to 3.
 * A sandbox, never a replay: the humans' answers to the extra cards are not simulated.
 */
// Load order matters (the server's own module cycle): the database layer first, then the card registries.
import {Database} from '../src/server/database/Database';
import {IDatabase} from '../src/server/database/IDatabase';
import '../src/server/database/GameLoader';
import {globalInitialize} from '../src/server/globalInitialize';
import {SerializedGame} from '../src/server/SerializedGame';

// A mid-game deserialize re-primes the active player's prompt and SAVES the game — the sandbox writes nowhere
// (the unit-test setup's fake database, inlined: scripts/ never import tests/).
const NO_DATABASE: IDatabase = {
  markFinished: () => Promise.resolve(),
  deleteGameNbrSaves: () => Promise.resolve(),
  deleteGame: () => Promise.resolve(),
  getPlayerCount: () => Promise.resolve(0),
  getGame: () => Promise.resolve({} as SerializedGame),
  getGameId: () => Promise.resolve('g'),
  getGameVersion: () => Promise.resolve({} as SerializedGame),
  getGameIds: () => Promise.resolve([]),
  getSaveIds: () => Promise.resolve([]),
  initialize: () => Promise.resolve(),
  saveGameResults: () => {},
  saveGame: () => Promise.resolve(),
  purgeUnfinishedGames: () => Promise.resolve([]),
  compressCompletedGames: () => Promise.resolve(),
  stats: () => Promise.resolve({}),
  storeParticipants: () => Promise.resolve(),
  getParticipants: () => Promise.resolve([]),
  createSession: () => Promise.resolve(),
  deleteSession: () => Promise.resolve(),
  getSessions: () => Promise.resolve([]),
  deleteExpiredSessions: () => Promise.resolve(0),
  saveCampaign: () => Promise.resolve(),
  getCampaign: () => Promise.resolve(undefined),
  getCampaignIds: () => Promise.resolve([]),
  deleteCampaign: () => Promise.resolve(),
};
Database.getInstance = () => NO_DATABASE;
import * as fs from 'fs';
import * as path from 'path';
import {Game} from '../src/server/Game';
import {IGame} from '../src/server/IGame';
import {MarsBotCorpId} from '../src/common/automa/MarsBotCorpData';
import {AutomaCorporations} from '../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../src/server/automa/AutomaResolver';
import {AutomaHumanTagReactions} from '../src/server/automa/AutomaHumanTagReactions';
import {AutomaTurnLog} from '../src/server/automa/AutomaTurnLog';
import {marsBotOf} from '../src/server/automa/AutomaUtil';

type Snapshot = {
  /** Per-track positions (the projection adds the deltas onto the game's real final tracks). */
  positions: Array<number>;
  tracks: number;
  tr: number;
  params: number;
  tiles: number;
  failed: number;
  mc: number;
  c29: number;
  c15: number;
  c14: number;
  c39: number;
};

function snapshot(game: IGame): Snapshot {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('not an automa game');
  }
  const bot = marsBotOf(game);
  return {
    positions: automa.board.tracks.map((t) => t.position),
    tracks: automa.board.tracks.reduce((s, t) => s + t.position, 0),
    tr: bot.terraformRating,
    params: (game.getTemperature() + 30) / 2 + game.getOxygenLevel() + game.board.getOceanSpaces().length,
    tiles: game.board.spaces.filter((sp) => sp.player?.id === bot.id && sp.tile !== undefined).length,
    failed: automa.failedActions,
    mc: bot.megaCredits,
    c29: AutomaCorporations.dividendOf(game, MarsBotCorpId.C29_MANUTECH).vp,
    c15: AutomaCorporations.dividendOf(game, MarsBotCorpId.C15_ROBINSON_INDUSTRIES).vp,
    c14: AutomaCorporations.dividendOf(game, MarsBotCorpId.C14_POINT_LUNA).vp,
    c39: AutomaCorporations.dividendOf(game, MarsBotCorpId.C39_UTOPIA_INVEST).vp,
  };
}

function diff(a: Snapshot, b: Snapshot): Snapshot {
  const out: Record<string, number | Array<number>> = {positions: b.positions.map((x, i) => x - a.positions[i])};
  for (const k of Object.keys(a) as Array<keyof Snapshot>) {
    if (k !== 'positions') {
      out[k] = (b[k] as number) - (a[k] as number);
    }
  }
  return out as Snapshot;
}

/** One extra project card, resolved as the controller's project branch resolves a revealed card. */
function resolveExtraCard(game: IGame): string | undefined {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('not an automa game');
  }
  const bot = marsBotOf(game);
  const card = game.projectDeck.draw(game);
  if (card === undefined) {
    return undefined;
  }
  AutomaTurnLog.begin(game);
  game.events.beginAction(bot, undefined, {category: 'automa-turn'});
  try {
    automa.revealedCard = {kind: 'project', name: card.name};
    game.log('${0} played ${1}', (b) => b.player(bot).card(card, {tags: true}));
    AutomaTurnLog.note(game, {kind: 'reveal', card: {kind: 'project', name: card.name}}, {consumeLog: true});
    AutomaCorporations.onProjectCardResolving(game, card);
    AutomaHumanTagReactions.onBotCardResolved(game, card);
    AutomaResolver.resolveProjectCard(game, card);
    automa.playedPile.push(card.name);
    automa.revealedCard = undefined;
  } finally {
    game.events.endScope();
  }
  game.deferredActions.runAll(() => {});
  AutomaTurnLog.finish(game);
  return card.name;
}

type Row = {
  id: string;
  file: string;
  generation: number;
  humansActive: number;
  /** Cumulative yield after 1..K extra cards. */
  after: Array<Snapshot>;
  cards: Array<string>;
};

function evaluate(file: string, cards: number): Row | undefined {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.phase !== 'action' || d.gameOptions?.automa === undefined) {
    return undefined;
  }
  const game = Game.deserialize(d);
  const automa = game.automa;
  if (automa === undefined || automa.actionDeck.length !== 0) {
    return undefined;
  }
  const humansActive = game.players.filter((p) => !p.isMarsBot && !game.hasPassedThisActionPhase(p)).length;
  const base = snapshot(game);
  const after: Array<Snapshot> = [];
  const names: Array<string> = [];
  for (let i = 0; i < cards; i++) {
    const name = resolveExtraCard(game);
    if (name === undefined) {
      break;
    }
    names.push(name);
    after.push(diff(base, snapshot(game)));
  }
  return {id: d.id, file: path.basename(file), generation: game.generation, humansActive, after, cards: names};
}

const dir = process.argv[2];
const cardsArg = process.argv.find((a) => a.startsWith('--cards='));
const K = cardsArg === undefined ? 3 : Number(cardsArg.slice('--cards='.length));
if (dir === undefined) {
  console.error('usage: npx tsx scripts/marsbot-pace-bench.ts <dir-with-snapshots> [--cards=3]');
  process.exit(2);
}
globalInitialize();
const rows: Array<Row> = [];
let failed = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  try {
    const row = evaluate(path.join(dir, f), K);
    if (row !== undefined) {
      rows.push(row);
    }
  } catch (e) {
    failed++;
    console.error(`${f}: ${(e as Error).message}`);
  }
}
console.log(`\nsnapshots=${rows.length} (${failed} failed)  K=${K}`);
const f1 = (x: number) => x.toFixed(1).padStart(5);
console.log('\n== per snapshot: cumulative yield of 1 / 2 / 3 extra cards (Δtracks · ΔTR · Δparams · Δtiles · Δfailed · ΔM€ · ΔC29)');
for (const r of rows) {
  const cells = r.after.map((a) => `${a.tracks}·${a.tr}·${a.params}·${a.tiles}·${a.failed}·${a.mc}·${a.c29}`);
  console.log(`${r.id.padEnd(14)} gen ${String(r.generation).padStart(2)} humans ${r.humansActive}  ${cells.join('  |  ')}   [${r.cards.join(', ')}]`);
}

const mean = (xs: ReadonlyArray<number>) => xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
console.log('\n== mean yield PER EXTRA CARD by generation (late game), over the snapshots with a human still acting');
console.log('gen    n   Δtracks   ΔTR  Δparams  Δtiles  Δfailed   ΔM€   ΔC29');
const byGen = new Map<number, Array<Snapshot>>();
for (const r of rows) {
  if (r.humansActive === 0 || r.after.length === 0) continue;
  const last = r.after[r.after.length - 1];
  const per: Record<string, number> = {};
  for (const k of Object.keys(last) as Array<keyof Snapshot>) {
    if (k !== 'positions') per[k] = (last[k] as number) / r.after.length;
  }
  const list = byGen.get(r.generation) ?? [];
  list.push(per as unknown as Snapshot);
  byGen.set(r.generation, list);
}
for (const g of [...byGen.keys()].sort((a, b) => a - b)) {
  const xs = byGen.get(g)!;
  console.log(`${String(g).padStart(3)}  ${String(xs.length).padStart(3)}   ${f1(mean(xs.map((x) => x.tracks)))}   ${f1(mean(xs.map((x) => x.tr)))}  ${f1(mean(xs.map((x) => x.params)))}   ${f1(mean(xs.map((x) => x.tiles)))}   ${f1(mean(xs.map((x) => x.failed)))}  ${f1(mean(xs.map((x) => x.mc)))}  ${f1(mean(xs.map((x) => x.c29)))}`);
}

console.log('\n== three policies, per game (sum over the sampled generations; C29 = Manutech, final-state clause after the last sampled generation is NOT chained — each generation is sampled from its own real snapshot)');
const policies: Array<{name: string, extra: (r: Row) => number}> = [
  {name: '+1 от 6-го (без условия)', extra: (r) => r.generation >= 6 ? 1 : 0},
  {name: 'вторая смена ×2 (люди в игре)', extra: (r) => r.humansActive > 0 ? 2 : 0},
  {name: 'вторая смена ×3 (люди в игре)', extra: (r) => r.humansActive > 0 ? 3 : 0},
];
const games = [...new Set(rows.map((r) => r.id))];
for (const p of policies) {
  console.log(`\n-- ${p.name}`);
  console.log('game            gens   +cards  Δtracks   ΔTR  Δparams  Δtiles  Δfailed   ΔM€');
  const totals: Array<Snapshot & {cards: number}> = [];
  for (const id of games) {
    const sum: Record<string, number> = {tracks: 0, tr: 0, params: 0, tiles: 0, failed: 0, mc: 0, c29: 0, c15: 0, c14: 0, c39: 0};
    let cards = 0;
    let gens = 0;
    for (const r of rows.filter((x) => x.id === id)) {
      const k = Math.min(p.extra(r), r.after.length);
      if (k === 0) continue;
      gens++;
      cards += k;
      const a = r.after[k - 1];
      for (const key of Object.keys(sum)) sum[key] += a[key as keyof Snapshot] as number;
    }
    totals.push({...(sum as unknown as Snapshot), cards});
    console.log(`${id.padEnd(14)}   ${String(gens).padStart(3)}    ${String(cards).padStart(4)}    ${String(sum.tracks).padStart(4)}   ${String(sum.tr).padStart(3)}    ${String(sum.params).padStart(3)}     ${String(sum.tiles).padStart(3)}     ${String(sum.failed).padStart(3)}   ${String(sum.mc).padStart(4)}`);
  }
  console.log(`MEAN             ${''.padStart(3)}    ${f1(mean(totals.map((t) => t.cards)))}   ${f1(mean(totals.map((t) => t.tracks)))}  ${f1(mean(totals.map((t) => t.tr)))}   ${f1(mean(totals.map((t) => t.params)))}    ${f1(mean(totals.map((t) => t.tiles)))}    ${f1(mean(totals.map((t) => t.failed)))}  ${f1(mean(totals.map((t) => t.mc)))}`);
}

// ── PROJECTED FINAL TRACKS under each policy: the game's real final tracks + the measured per-track deltas of the
//    sampled generations (the finished games are read from --finals=<dir>). Then Manutech as printed and re-marked.
const finalsArg = process.argv.find((a) => a.startsWith('--finals='));
if (finalsArg !== undefined) {
  const finalsDir = finalsArg.slice('--finals='.length);
  const finals = new Map<string, Array<number>>();
  for (const f of fs.readdirSync(finalsDir).filter((f) => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(finalsDir, f), 'utf8'));
    if (d.phase === 'end' && d.automa !== undefined) {
      finals.set(d.id, d.automa.tracks.map((t: {position: number}) => t.position));
    }
  }
  const count = (tracks: ReadonlyArray<number>, t: number) => tracks.filter((p) => p >= t).length;
  const clause = (tracks: ReadonlyArray<number>, marks: ReadonlyArray<number>, rates: ReadonlyArray<number>) =>
    marks.reduce((sum, m, i) => sum + rates[i] * count(tracks, m), 0);
  const variants = [
    {name: 'Manutech as printed 5/10/15 · goals ≥10: 4/5', marks: [5, 10, 15], rates: [2, 2, 3], goalTerm: 10, goals: [4, 5]},
    {name: 'Manutech E 5/10/13 · goals ≥10: 4/5', marks: [5, 10, 13], rates: [2, 2, 3], goalTerm: 10, goals: [4, 5]},
    {name: 'Manutech A 5/9/13 · goals ≥9: 4/5', marks: [5, 9, 13], rates: [2, 2, 3], goalTerm: 9, goals: [4, 5]},
  ];
  for (const p of [{name: 'as played (no extra cards)', extra: () => 0}, ...policies]) {
    console.log(`
== projected finals — ${p.name}`);
    const projected: Array<{id: string, tracks: Array<number>}> = [];
    for (const id of games) {
      const base = finals.get(id);
      if (base === undefined) continue;
      const tracks = [...base];
      for (const r of rows.filter((x) => x.id === id)) {
        const k = Math.min(p.extra(r), r.after.length);
        if (k === 0) continue;
        r.after[k - 1].positions.forEach((d, i) => {
          tracks[i] = Math.min(18, tracks[i] + d);
        });
      }
      projected.push({id, tracks});
      console.log(`  ${id.padEnd(14)} ${JSON.stringify(tracks)}`);
    }
    for (const v of variants) {
      const vals = projected.map((g) => clause(g.tracks, v.marks, v.rates)).sort((a, b) => a - b);
      const g1 = projected.filter((g) => count(g.tracks, v.goalTerm) >= v.goals[0]).length;
      const g2 = projected.filter((g) => count(g.tracks, v.goalTerm) >= v.goals[1]).length;
      const q = (x: number) => vals[Math.min(vals.length - 1, Math.floor(x * vals.length))];
      console.log(`  ${v.name.padEnd(48)} p10 ${q(0.1)}  p50 ${q(0.5)}  p90 ${q(0.9)}  mean ${mean(vals).toFixed(1)}  goal1 ${(100 * g1 / projected.length).toFixed(0)}%  goal2 ${(100 * g2 / projected.length).toFixed(0)}%`);
    }
  }
}
