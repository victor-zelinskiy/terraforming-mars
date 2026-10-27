/**
 * MarsBot «portfolio & dividends» calibration bench (docs/claude/prompts/marsbot-portfolio-dividends.md §8,
 * report: docs/claude/marsbot-dividends-calibration.md).
 *
 * Loads FINISHED games (LocalFilesystem `<gameId>.json` files exported from the owner's Steam Machine —
 * never the laptop's test DB), rebuilds each through the real `Game.deserialize`, and evaluates every
 * corporation's PRODUCTION dividend clause (`AutomaCorporations.dividendOf` — the very function the
 * scoring pass calls) as if that corporation were a HOLDING of the bot. Pure reads, no mutation.
 *
 *   npx tsx scripts/marsbot-dividends-calibrate.ts <dir-with-game-jsons> [--target=redux] [--csv out.csv]
 *
 * Prints: the bot-vs-humans margin by mission slot, every clause's p10/p50/p90 on the target scenario
 * (default: Turmoil Redux · Hard · missions 2–4), and a Monte-Carlo of the portfolio by mission slot —
 * ONE random holding on mission 2, TWO on missions 3–4 (the owner's D1) — against the measured margin.
 * The rates live in `src/common/automa/MarsBotDividendData.ts`; change them there and re-run.
 */
// Load order matters (the server's own module cycle): the database layer first, then the
// card registries — the same preamble the unit-test setup uses, without importing tests/.
import '../src/server/database/Database';
import '../src/server/database/GameLoader';
import {globalInitialize} from '../src/server/globalInitialize';
import * as fs from 'fs';
import * as path from 'path';
import {Game} from '../src/server/Game';
import {IGame} from '../src/server/IGame';
import {IPlayer} from '../src/server/IPlayer';
import {MARS_BOT_CORP_IDS, MarsBotCorpId, marsBotCorpInfo} from '../src/common/automa/MarsBotCorpData';
import {AutomaCorporations} from '../src/server/automa/corps/AutomaCorporations';

/** Acceptance band on the target (per holding) — the owner's D8. */
const BAND = {p50Low: 14, p50High: 18, p10Min: 3, p90Max: 26};

type Row = {
  id: string; slot: number | undefined; difficulty: string; generation: number; board: string; redux: boolean;
  primary: string | undefined; bot: number; bestHuman: number; margin: number;
  botBreakdown: Record<string, number>; humanBreakdown: Record<string, number>;
  clauses: Record<string, number>; eligible: Array<MarsBotCorpId>; pile: number;
  /** Every clause's formula as the server computed it — the operands the GOALS are set on (`--terms`). */
  terms: Record<string, ReadonlyArray<{label: string, count: number, vp: number}>>;
};

function breakdownOf(p: IPlayer): Record<string, number> {
  const v = p.getVictoryPoints();
  return {tr: v.terraformRating, ma: v.milestones + v.awards, tiles: v.greenery + v.city, cards: v.victoryPoints ?? 0, mc: v.automa?.mcToVp ?? 0,
    botCards: v.automa?.cardVp ?? 0, corp: v.automa?.corpVp ?? 0, titles: v.titles ?? 0, delta: v.deltaProject ?? 0, total: v.total};
}

/** Saves written before the durable counter: recount the Failed Actions from the journal once. */
function backfillFailedActions(game: IGame): void {
  const automa = game.automa;
  if (automa === undefined || automa.failedActions > 0) {
    return;
  }
  automa.failedActions = game.gameLog.filter((m) => typeof m.message === 'string' && m.message.startsWith('${0} took a Failed Action')).length;
}

function evaluate(file: string): Row | undefined {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.phase !== 'end' || d.gameOptions?.automa === undefined) return undefined;
  const game = Game.deserialize(d);
  const bot = game.players.find((p) => p.isMarsBot);
  if (bot === undefined || game.automa === undefined) return undefined;
  backfillFailedActions(game);
  const humans = game.players.filter((p) => !p.isMarsBot);
  const botVp = bot.getVictoryPoints();
  const clauses: Record<string, number> = {};
  const terms: Record<string, ReadonlyArray<{label: string, count: number, vp: number}>> = {};
  for (const id of MARS_BOT_CORP_IDS) {
    const result = AutomaCorporations.dividendOf(game, id);
    clauses[id] = result.vp;
    terms[id] = result.terms.map((t) => ({label: t.label, count: t.count, vp: t.vp}));
  }
  const best = humans.reduce((a, b) => a.getVictoryPoints().total >= b.getVictoryPoints().total ? a : b);
  const primary = game.automa.corporation;
  // The holdings this game could have seated: eligible by module and collision, never the primary.
  const eligible = AutomaCorporations.eligibleCorpIds(game).filter((id) => id !== primary);
  return {
    id: d.id, slot: d.gameOptions.campaign?.missionSlot, difficulty: d.gameOptions.automa.difficulty, generation: game.generation,
    board: d.gameOptions.boardName, redux: d.gameOptions.turmoilReduxExpansion === true, primary,
    bot: botVp.total, bestHuman: best.getVictoryPoints().total, margin: botVp.total - best.getVictoryPoints().total,
    botBreakdown: breakdownOf(bot), humanBreakdown: breakdownOf(best), clauses, eligible, pile: game.automa.playedPile.length, terms,
  };
}

function quantile(xs: ReadonlyArray<number>, q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const mean = (xs: ReadonlyArray<number>) => xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
const f1 = (x: number) => x.toFixed(1).padStart(6);

/** Deterministic Park–Miller, so two runs on the same export print the same numbers. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

function portfolio(rows: ReadonlyArray<Row>, label: string): void {
  const rnd = seededRandom(1);
  console.log(`\n== portfolio Monte-Carlo — ${label}: one holding on mission 2, two on missions 3–4 (2000 draws per game)`);
  for (const slot of [1, 2, 3]) {
    const games = rows.filter((r) => r.slot === slot);
    if (games.length === 0) continue;
    const sums: Array<number> = [];
    const margins: Array<number> = [];
    for (const r of games) {
      const pool = r.eligible;
      for (let i = 0; i < 2000; i++) {
        const a = pool[Math.floor(rnd() * pool.length)];
        let b = pool[Math.floor(rnd() * pool.length)];
        while (b === a) b = pool[Math.floor(rnd() * pool.length)];
        const sum = r.clauses[a] + (slot === 1 ? 0 : r.clauses[b]);
        sums.push(sum);
        margins.push(r.margin + sum);
      }
    }
    console.log(`  mission ${slot + 1} (n=${games.length}): dividends p10=${f1(quantile(sums, 0.1))} p50=${f1(quantile(sums, 0.5))} p90=${f1(quantile(sums, 0.9))} max=${f1(Math.max(...sums))}` +
      `  margin before=${f1(mean(games.map((r) => r.margin)))} after mean=${f1(mean(margins))} p50=${f1(quantile(margins, 0.5))}  bot wins ${(100 * margins.filter((m) => m > 0).length / margins.length).toFixed(0)}%`);
  }
}

function distribution(set: ReadonlyArray<Row>, label: string): void {
  console.log(`\n== clause distribution — ${label} (n=${set.length})   [band: p50 ${BAND.p50Low}–${BAND.p50High}, p10 ≥ ${BAND.p10Min}, p90 ≤ ${BAND.p90Max}]`);
  console.log('corp  ' + 'name'.padEnd(30) + '   p10   p50   p90  mean  zero%  verdict');
  for (const id of MARS_BOT_CORP_IDS) {
    const xs = set.filter((r) => r.eligible.includes(id) || r.primary === id).map((r) => r.clauses[id]);
    if (xs.length === 0) continue;
    const p10 = quantile(xs, 0.1); const p50 = quantile(xs, 0.5); const p90 = quantile(xs, 0.9);
    const zero = xs.filter((x) => x === 0).length / xs.length;
    const verdict = p50 < BAND.p50Low ? 'low' : p50 > BAND.p50High ? 'high' : (p90 > BAND.p90Max ? 'wide' : 'ok');
    console.log(`${id}   ${marsBotCorpInfo(id).original.padEnd(30)} ${f1(p10)}${f1(p50)}${f1(p90)}${f1(mean(xs))}  ${(zero * 100).toFixed(0).padStart(4)}%  ${verdict}`);
  }
}

function main() {
  globalInitialize();
  const dir = process.argv[2];
  if (dir === undefined) throw new Error('usage: tsx scripts/marsbot-dividends-calibrate.ts <dir> [--target=redux|hard] [--csv out.csv] [--terms out.json]');
  const rows: Array<Row> = [];
  let failed = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /^g[0-9a-f]+\.json$/.test(x))) {
    try {
      const r = evaluate(path.join(dir, f));
      if (r !== undefined) rows.push(r);
    } catch (e) {
      failed++;
      console.error(`SKIP ${f}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  console.log(`\nloaded ${rows.length} finished bot games (${failed} failed to deserialize)\n`);

  console.log('== margin (bot − best human) by mission slot × difficulty');
  for (const diff of ['normal', 'hard', 'brutal']) {
    for (const slot of [undefined, 0, 1, 2, 3]) {
      const g = rows.filter((r) => r.slot === slot && r.difficulty === diff);
      if (g.length === 0) continue;
      const m = g.map((r) => r.margin);
      console.log(`${diff.padEnd(7)} slot ${String(slot).padEnd(9)} n=${String(g.length).padStart(3)} margin mean=${f1(mean(m))} p50=${f1(quantile(m, 0.5))}  bot=${f1(mean(g.map((r) => r.bot)))} best=${f1(mean(g.map((r) => r.bestHuman)))} gens=${f1(mean(g.map((r) => r.generation)))}`);
    }
  }
  console.log('\n== margin by slot — REDUX only (hard)');
  for (const slot of [undefined, 0, 1, 2, 3]) {
    const g = rows.filter((r) => r.redux && r.slot === slot && r.difficulty === 'hard');
    if (g.length === 0) continue;
    console.log(`redux   slot ${String(slot).padEnd(9)} n=${String(g.length).padStart(3)} margin mean=${f1(mean(g.map((r) => r.margin)))} gens=${f1(mean(g.map((r) => r.generation)))} pile=${f1(mean(g.map((r) => r.pile)))}`);
  }

  const hardTarget = process.argv.includes('--target=hard');
  const target = hardTarget ?
    rows.filter((r) => r.difficulty === 'hard' && r.slot !== undefined && r.slot >= 1) :
    rows.filter((r) => r.redux && r.difficulty === 'hard' && r.slot !== undefined && r.slot >= 1);
  const targetLabel = hardTarget ? 'HARD missions 2–4 (all expansions)' : 'REDUX · HARD · missions 2–4';

  console.log(`\n== breakdown on the target (${targetLabel}, n=${target.length}): mean per category — bot | best human`);
  for (const k of ['tr', 'ma', 'tiles', 'cards', 'mc', 'botCards', 'corp', 'titles', 'delta', 'total']) {
    console.log(`  ${k.padEnd(9)} ${f1(mean(target.map((r) => r.botBreakdown[k])))} | ${f1(mean(target.map((r) => r.humanBreakdown[k])))}`);
  }

  distribution(target, `TARGET ${targetLabel}`);
  distribution(rows.filter((r) => r.difficulty === 'hard' && r.slot !== undefined && r.slot >= 1), 'HARD missions 2–4, every expansion set');
  portfolio(target, `TARGET ${targetLabel}`);
  portfolio(rows.filter((r) => r.difficulty === 'hard'), 'HARD, every expansion set');

  const csv = process.argv.indexOf('--csv');
  if (csv >= 0) {
    const out = process.argv[csv + 1];
    const head = ['id', 'slot', 'difficulty', 'generation', 'board', 'redux', 'primary', 'bot', 'bestHuman', 'margin', ...MARS_BOT_CORP_IDS];
    const lines = rows.map((r) => [r.id, r.slot, r.difficulty, r.generation, r.board, r.redux, r.primary, r.bot, r.bestHuman, r.margin, ...MARS_BOT_CORP_IDS.map((id) => r.clauses[id])].join(','));
    fs.writeFileSync(out, [head.join(','), ...lines].join('\n'));
    console.log(`\nwrote ${out}`);
  }
  const termsOut = process.argv.indexOf('--terms');
  if (termsOut >= 0) {
    const out = process.argv[termsOut + 1];
    fs.writeFileSync(out, JSON.stringify(rows.map((r) => ({
      id: r.id, slot: r.slot, difficulty: r.difficulty, redux: r.redux, primary: r.primary, eligible: r.eligible, margin: r.margin, terms: r.terms,
    }))));
    console.log(`wrote ${out}`);
  }
}

main();
