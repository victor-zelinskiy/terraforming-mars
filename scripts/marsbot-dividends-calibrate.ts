/**
 * MarsBot «portfolio & dividends» calibration bench (docs/claude/prompts/marsbot-portfolio-dividends.md §8).
 *
 * Loads FINISHED games (LocalFilesystem `<gameId>.json` files exported from the owner's box),
 * rebuilds each through the real `Game.deserialize`, and evaluates every candidate dividend clause
 * as if that corporation were a HOLDING of the bot — pure reads of the end state, no mutation.
 *
 *   npx tsx scripts/marsbot-dividends-calibrate.ts <dir-with-game-jsons> [--csv out.csv]
 *
 * Prints: the bot-vs-humans margin by mission slot, every clause's p10/p50/p90 on the target
 * scenario (Hard, missions 3–4), and a Monte-Carlo of random two-holding portfolios against the
 * measured margin. Numbers here are the ONLY source of truth for the rates in the catalogue.
 */
import '../tests/testing/setup';
import * as fs from 'fs';
import * as path from 'path';
import {Game} from '../src/server/Game';
import {IGame} from '../src/server/IGame';
import {IPlayer} from '../src/server/IPlayer';
import {newProjectCard} from '../src/server/createCard';
import {IProjectCard} from '../src/server/cards/IProjectCard';
import {isIActionCard} from '../src/server/cards/ICard';
import {CardType} from '../src/common/cards/CardType';
import {Tag} from '../src/common/cards/Tag';
import {TileType} from '../src/common/TileType';
import {SpaceBonus} from '../src/common/boards/SpaceBonus';
import {Board} from '../src/server/boards/Board';
import {Space} from '../src/server/boards/Space';
import {AwardScorer} from '../src/server/awards/AwardScorer';
import {MarsBotTrackRole} from '../src/common/automa/AutomaTypes';
import {MARS_BOT_CORP_IDS, MarsBotCorpId, marsBotCorpInfo} from '../src/common/automa/MarsBotCorpData';
import {GlobalParameter} from '../src/common/GlobalParameter';

type Ctx = {
  game: IGame;
  bot: IPlayer;
  humans: ReadonlyArray<IPlayer>;
  pile: ReadonlyArray<IProjectCard>;
  botSpaces: ReadonlyArray<Space>;
};

function pos(ctx: Ctx, role: MarsBotTrackRole): number {
  const t = ctx.game.automa?.board.tracks.find((x) => x.definition.role === role);
  return t?.position ?? 0;
}
function tracksOf(ctx: Ctx) {
  return (ctx.game.automa?.board.tracks ?? []).filter((t) => t.definition.role !== 'venus');
}
/** Positions re-advanced after a human regression (the marker is now at or past a regressed cell). */
function reAdvanced(ctx: Ctx, role?: MarsBotTrackRole): number {
  let n = 0;
  for (const t of ctx.game.automa?.board.tracks ?? []) {
    if (role !== undefined && t.definition.role !== role) continue;
    for (const p of t.regressedPositions) if (p <= t.position) n++;
  }
  return n;
}
function botTags(ctx: Ctx, tags: ReadonlyArray<Tag>): number {
  let n = 0;
  for (const c of ctx.pile) for (const t of c.tags) if (tags.includes(t)) n++;
  // Starting tags of the primary are resolved too, but they are not in the pile — ignored (≤4).
  return n;
}
function humanTagCards(ctx: Ctx, tag: Tag): number {
  let n = 0;
  for (const h of ctx.humans) for (const c of h.playedCards.asArray()) if (c.tags.includes(tag)) n++;
  return n;
}
function botParamSteps(ctx: Ctx, parameter: GlobalParameter): number {
  let n = 0;
  for (const e of ctx.game.events.events) {
    if (e.type === 'global-parameter-changed' && e.player === ctx.bot.color && e.impact.globalParameter?.parameter === parameter) {
      n += Math.max(0, e.impact.globalParameter.steps);
    }
  }
  return n;
}
function botOceans(ctx: Ctx): number {
  return ctx.game.events.events.filter((e) => e.type === 'tile-placed' && e.player === ctx.bot.color && e.tile === TileType.OCEAN).length;
}
function failedActions(ctx: Ctx): number {
  return ctx.game.gameLog.filter((m) => typeof m.message === 'string' && m.message.startsWith('${0} took a Failed Action')).length;
}
function botLogLines(ctx: Ctx, needle: RegExp): number {
  return ctx.game.gameLog.filter((m) => typeof m.message === 'string' && needle.test(m.message) &&
    m.data.some((d) => d.value === ctx.bot.id || d.value === ctx.bot.name)).length;
}
function adjacentPairs(ctx: Ctx, a: (s: Space) => boolean, b: (s: Space) => boolean): number {
  const board = ctx.game.board;
  let n = 0;
  for (const s of board.spaces) {
    if (!a(s)) continue;
    for (const adj of board.getAdjacentSpaces(s)) if (b(adj)) n++;
  }
  return n;
}
const isBot = (ctx: Ctx) => (s: Space) => s.tile !== undefined && s.player?.id === ctx.bot.id;
const isHuman = (ctx: Ctx) => (s: Space) => s.tile !== undefined && s.player !== undefined && s.player.id !== ctx.bot.id && !Board.isOceanSpace(s);
const botCities = (ctx: Ctx) => ctx.botSpaces.filter((s) => Board.isCitySpace(s)).length;
const botGreeneries = (ctx: Ctx) => ctx.botSpaces.filter((s) => Board.isGreenerySpace(s)).length;
function awardRanks(ctx: Ctx): {first: number; second: number} {
  let first = 0; let second = 0;
  for (const award of ctx.game.awards) {
    const scorer = new AwardScorer(ctx.game, award);
    const botScore = scorer.get(ctx.bot);
    const better = ctx.humans.filter((h) => scorer.get(h) > botScore).length;
    if (better === 0 && botScore > 0) first++;
    else if (better === 1) second++;
  }
  return {first, second};
}
function coloniesOf(ctx: Ctx): {bot: number; all: number} {
  let bot = 0; let all = 0;
  for (const c of ctx.game.colonies) {
    if (!c.isActive) continue;
    all += c.colonies.length;
    bot += c.colonies.filter((id) => id === ctx.bot.id).length;
  }
  return {bot, all};
}
const cardVp = (c: IProjectCard): number => typeof c.victoryPoints === 'number' ? c.victoryPoints : 0;
const ladder = (count: number, steps: ReadonlyArray<[number, number]>): number => {
  let vp = 0;
  for (const [at, value] of steps) if (count >= at) vp = value;
  return vp;
};

/** The catalogue (§5) — clause id → evaluator. Rates are the STARTING ones from the prompt. */
const CLAUSES: Record<MarsBotCorpId, (ctx: Ctx) => number> = {
  [MarsBotCorpId.C01_CREDICOR]: (c) => Math.floor(c.pile.reduce((n, x) => n + (x.cost ?? 0), 0) / 35),
  [MarsBotCorpId.C02_ECOLINE]: (c) => 2 * botGreeneries(c),
  [MarsBotCorpId.C03_HELION]: (c) => 2 * botParamSteps(c, GlobalParameter.TEMPERATURE),
  [MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS]: (c) => pos(c, 'event') + reAdvanced(c, 'event'),
  [MarsBotCorpId.C05_INVENTRIX]: (c) => c.pile.filter((x) => x.requirements.length > 0).length,
  [MarsBotCorpId.C06_MINING_GUILD]: (c) => 4 * c.botSpaces.filter((s) => s.bonus.includes(SpaceBonus.STEEL) || s.bonus.includes(SpaceBonus.TITANIUM)).length,
  [MarsBotCorpId.C07_PHOBOLOG]: (c) => { const n = c.pile.filter((x) => x.tags.includes(Tag.SPACE)).length; return n + Math.floor(n / 2); },
  [MarsBotCorpId.C08_SATURN_SYSTEMS]: (c) => 2 * botTags(c, [Tag.JOVIAN]) + humanTagCards(c, Tag.JOVIAN),
  [MarsBotCorpId.C09_TERACTOR]: (c) => 3 * botTags(c, [Tag.EARTH]),
  [MarsBotCorpId.C10_THARSIS_REPUBLIC]: (c) => 2 * botCities(c),
  [MarsBotCorpId.C11_THORGATE]: (c) => { const p = pos(c, 'power'); return 2 * Math.min(p, 9) + 3 * Math.max(0, p - 9); },
  [MarsBotCorpId.C12_UNMI]: (c) => 2 * ((c.game.automa?.bonusDiscard.length ?? 0) + (c.game.automa?.destroyedBonusCards.length ?? 0)),
  [MarsBotCorpId.C13_CHEUNG_SHING_MARS]: (c) => 2 * Math.max(0, pos(c, 'building') - 3),
  [MarsBotCorpId.C14_POINT_LUNA]: (c) => 3 * Math.min(...tracksOf(c).map((t) => t.position)),
  [MarsBotCorpId.C15_ROBINSON_INDUSTRIES]: (c) => 4 * tracksOf(c).filter((t) => t.position >= 9).length,
  [MarsBotCorpId.C16_VALLEY_TRUST]: (c) => 3 * c.pile.filter((x) => x.tags.includes(Tag.SCIENCE)).length,
  [MarsBotCorpId.C17_VITOR]: (c) => 2 * c.pile.filter((x) => cardVp(x) >= 1).length + 2 * c.pile.filter((x) => cardVp(x) >= 2).length,
  [MarsBotCorpId.C18_ARCADIAN_COMMUNITIES]: (c) => adjacentPairs(c, isBot(c), isBot(c)) / 2,
  [MarsBotCorpId.C19_ASTRO_DRILL]: (c) => { const n = tracksOf(c).reduce((n, t) => n + t.definition.layout.slice(0, t.position + 1).filter((a) => a === 'advance').length, 0); return n + (n >= 8 ? 4 : 0); },
  [MarsBotCorpId.C20_FACTORUM]: (c) => Math.floor(c.bot.megaCredits / 6),
  [MarsBotCorpId.C21_PHARMACY_UNION]: (c) => 2 * botTags(c, [Tag.MICROBE]) + 3 * (c.game.automa?.board.tracks ?? []).reduce((n, t) => n + t.regressedPositions.size, 0),
  [MarsBotCorpId.C22_PHILARES]: (c) => Math.floor(adjacentPairs(c, isBot(c), isHuman(c)) * 2 / 3),
  [MarsBotCorpId.C23_RECYCLON]: (c) => 2 * Math.min(pos(c, 'building'), pos(c, 'bio')),
  [MarsBotCorpId.C24_SPLICE]: (c) => 2 * botTags(c, [Tag.MICROBE]) + humanTagCards(c, Tag.MICROBE),
  [MarsBotCorpId.C25_VIRON]: (c) => { const n = c.pile.filter((x) => x.type === CardType.ACTIVE && isIActionCard(x)).length; return n + Math.floor(n / 2); },
  [MarsBotCorpId.C26_CELESTIC]: (c) => 2 * botTags(c, [Tag.VENUS, Tag.JOVIAN]) + 2 * botParamSteps(c, GlobalParameter.VENUS),
  [MarsBotCorpId.C27_MORNING_STAR]: (c) => { const p = pos(c, 'venus'); return 3 * p + (p >= 8 ? 5 : 0); },
  [MarsBotCorpId.C28_APHRODITE]: (c) => 4 * botParamSteps(c, GlobalParameter.VENUS),
  [MarsBotCorpId.C29_MANUTECH]: (c) => tracksOf(c).filter((t) => t.position >= 5).length + 2 * tracksOf(c).filter((t) => t.position >= 10).length + 3 * tracksOf(c).filter((t) => t.position >= 15).length,
  [MarsBotCorpId.C30_ARIDOR]: (c) => { const col = coloniesOf(c); const ship = Object.values(c.game.automa?.shippingStorage ?? {}).reduce((a, b) => a + (b ?? 0), 0); return 4 * col.bot + Math.floor(ship / 2); },
  [MarsBotCorpId.C31_ARKLIGHT]: (c) => 3 * botTags(c, [Tag.PLANT, Tag.ANIMAL]),
  [MarsBotCorpId.C32_POLYPHEMOS]: (c) => Math.max(0, c.pile.length - 20),
  [MarsBotCorpId.C33_POSEIDON]: (c) => { const col = coloniesOf(c); return col.all + 3 * col.bot; },
  [MarsBotCorpId.C34_STORMCRAFT]: (c) => Math.floor(pos(c, 'power') / 2) + 2 * botTags(c, [Tag.JOVIAN]),
  [MarsBotCorpId.C35_LAKEFRONT_RESORTS]: (c) => 2 * c.botSpaces.filter((s) => c.game.board.getAdjacentSpaces(s).some((a) => Board.isOceanSpace(a))).length,
  [MarsBotCorpId.C36_PRISTAR]: (c) => { const n = failedActions(c); return n + Math.floor(n / 2); },
  [MarsBotCorpId.C38_TERRALABS]: (c) => c.pile.filter((x) => (x.cost ?? 0) <= 8).length,
  [MarsBotCorpId.C39_UTOPIA_INVEST]: (c) => 2 * tracksOf(c).filter((t) => t.position >= 12).length + 3 * tracksOf(c).filter((t) => t.position >= t.maxPosition).length,
  [MarsBotCorpId.C40_ECOTEC]: (c) => 2 * c.botSpaces.filter((s) => Board.isGreenerySpace(s) && c.game.board.getAdjacentSpaces(s).some((a) => Board.isCitySpace(a) && a.player?.id === c.bot.id)).length,
  [MarsBotCorpId.C41_KUIPER_COOPERATIVE]: (c) => Math.floor(pos(c, 'space') / 2) + 2 * botOceans(c),
  [MarsBotCorpId.C42_NIRGAL_ENTERPRISES]: (c) => { const r = awardRanks(c); return 4 * r.first + 2 * r.second; },
  [MarsBotCorpId.C43_PALLADIN_SHIPPING]: (c) => 2 * Math.min(pos(c, 'space'), pos(c, 'event')),
  [MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES]: (c) => 3 * c.pile.filter((x) => x.tags.length === 0).length + Math.floor(c.pile.filter((x) => x.tags.length === 1).length / 3),
  [MarsBotCorpId.C45_SPIRE]: (c) => c.pile.filter((x) => x.tags.length >= 2).length + 2 * c.pile.filter((x) => x.tags.length >= 3).length,
  [MarsBotCorpId.C46_TYCHO_MAGNETICS]: (c) => 2 * Math.min(pos(c, 'power'), pos(c, 'science')),
};

type Row = {
  id: string; slot: number | undefined; difficulty: string; generation: number; board: string; redux: boolean;
  primary: string | undefined; humanCorps: number; bot: number; bestHuman: number; margin: number;
  botBreakdown: Record<string, number>; humanBreakdown: Record<string, number>; clauses: Record<string, number>; eligible: Array<MarsBotCorpId>;
};

function breakdownOf(p: IPlayer): Record<string, number> {
  const v = p.getVictoryPoints() as any;
  return {tr: v.terraformRating, ma: v.milestones + v.awards, tiles: v.greenery + v.city, cards: v.victoryPoints ?? 0, mc: v.automa?.mcToVp ?? 0,
    botCards: v.automa?.cardVp ?? 0, corp: v.automa?.corpVp ?? 0, titles: v.titles ?? 0, delta: v.delta ?? 0, turmoil: v.turmoil ?? 0, total: v.total};
}

function eligibleHoldings(game: IGame, primary: string | undefined): Array<MarsBotCorpId> {
  const o = game.gameOptions;
  return MARS_BOT_CORP_IDS.filter((id) => {
    if (id === primary) return false;
    const info = marsBotCorpInfo(id);
    const has = (m: string) => (m === 'venus' && o.venusNextExtension) || (m === 'colonies' && o.coloniesExtension) || (m === 'prelude' && o.preludeExtension) || (m === 'turmoil' && o.turmoilExtension);
    if (info.requiresModules !== undefined && !info.requiresModules.every(has)) return false;
    if (info.requiresAnyModule !== undefined && !info.requiresAnyModule.some(has)) return false;
    return true;
  });
}

function evaluate(file: string): Row | undefined {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.phase !== 'end' || d.gameOptions?.automa === undefined) return undefined;
  const game = Game.deserialize(d);
  const bot = game.players.find((p) => p.isMarsBot);
  if (bot === undefined) return undefined;
  const humans = game.players.filter((p) => !p.isMarsBot);
  const pile = (game.automa?.playedPile ?? []).map((n) => newProjectCard(n)).filter((c): c is IProjectCard => c !== undefined);
  const ctx: Ctx = {game, bot, humans, pile, botSpaces: game.board.spaces.filter((s) => s.tile !== undefined && s.player?.id === bot.id)};
  const botVp = bot.getVictoryPoints();
  const clauses: Record<string, number> = {};
  for (const id of MARS_BOT_CORP_IDS) clauses[id] = CLAUSES[id](ctx);
  const humanCorps = Math.max(...humans.map((h) => h.playedCards.asArray().filter((c) => c.type === CardType.CORPORATION).length));
  const best = humans.reduce((a, b) => a.getVictoryPoints().total >= b.getVictoryPoints().total ? a : b);
  return {
    id: d.id, slot: d.gameOptions.campaign?.missionSlot, difficulty: d.gameOptions.automa.difficulty, generation: game.generation,
    board: d.gameOptions.boardName, redux: d.gameOptions.turmoilReduxExpansion === true, primary: game.automa?.corporation, humanCorps,
    bot: botVp.total, bestHuman: best.getVictoryPoints().total, margin: 0,
    botBreakdown: breakdownOf(bot), humanBreakdown: breakdownOf(best),
    clauses, eligible: eligibleHoldings(game, game.automa?.corporation),
  };
}

function quantile(xs: ReadonlyArray<number>, q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const mean = (xs: ReadonlyArray<number>) => xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
const f1 = (x: number) => x.toFixed(1).padStart(6);

function main() {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error('usage: tsx scripts/marsbot-dividends-calibrate.ts <dir>');
  const rows: Array<Row> = [];
  let failed = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /^g[0-9a-f]+\.json$/.test(x))) {
    try {
      const r = evaluate(path.join(dir, f));
      if (r !== undefined) { r.margin = r.bot - r.bestHuman; rows.push(r); }
    } catch (e) {
      failed++;
      console.error(`SKIP ${f}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  console.log(`\nloaded ${rows.length} finished bot games (${failed} failed to deserialize)\n`);

  console.log('== margin (bot − best human) by slot × difficulty');
  for (const diff of ['normal', 'hard', 'brutal']) {
    for (const slot of [undefined, 0, 1, 2, 3]) {
      const g = rows.filter((r) => r.slot === slot && r.difficulty === diff);
      if (g.length === 0) continue;
      const m = g.map((r) => r.margin);
      console.log(`${diff.padEnd(7)} slot ${String(slot).padEnd(9)} n=${String(g.length).padStart(3)} margin mean=${f1(mean(m))} p10=${f1(quantile(m, 0.1))} p50=${f1(quantile(m, 0.5))} p90=${f1(quantile(m, 0.9))}  bot=${f1(mean(g.map((r) => r.bot)))} best=${f1(mean(g.map((r) => r.bestHuman)))} gens=${f1(mean(g.map((r) => r.generation)))}`);
    }
  }

  console.log('\n== margin by slot — REDUX only (hard)');
  for (const slot of [undefined, 0, 1, 2, 3]) {
    const g = rows.filter((r) => r.redux && r.slot === slot && r.difficulty === 'hard');
    if (g.length === 0) continue;
    const m = g.map((r) => r.margin);
    console.log(`redux   slot ${String(slot).padEnd(9)} n=${String(g.length).padStart(3)} margin mean=${f1(mean(m))} p50=${f1(quantile(m, 0.5))} bot=${f1(mean(g.map((r) => r.bot)))} best=${f1(mean(g.map((r) => r.bestHuman)))} gens=${f1(mean(g.map((r) => r.generation)))}`);
  }

  const targetMode = process.argv.includes('--target=redux') ? 'redux' : 'hard23';
  const target = targetMode === 'redux' ?
    rows.filter((r) => r.redux && r.difficulty === 'hard' && r.slot !== undefined && r.slot >= 1) :
    rows.filter((r) => r.difficulty === 'hard' && (r.slot === 2 || r.slot === 3));
  const targetLabel = targetMode === 'redux' ? 'REDUX hard slots 1–3' : 'hard slots 2–3';
  console.log(`\n== breakdown on the target (${targetLabel}, n=${target.length}): mean per category — bot | best human`);
  for (const k of ['tr', 'ma', 'tiles', 'cards', 'mc', 'botCards', 'corp', 'titles', 'delta', 'turmoil', 'total']) {
    console.log(`  ${k.padEnd(9)} ${f1(mean(target.map((r) => r.botBreakdown[k])))} | ${f1(mean(target.map((r) => r.humanBreakdown[k])))}`);
  }
  console.log(`  pile      ${f1(mean(target.map((r) => r.clauses[MarsBotCorpId.C32_POLYPHEMOS] + 20)))} (cards in the played pile, approx)`);
  console.log('\n== target games');
  for (const r of target) {
    const vals = r.eligible.map((id) => r.clauses[id]).sort((a, b) => a - b);
    console.log(`  ${r.id} slot ${r.slot} gen ${String(r.generation).padStart(2)} ${r.board.padEnd(20)} primary ${r.primary} bot ${String(r.bot).padStart(3)} best ${String(r.bestHuman).padStart(3)} margin ${String(r.margin).padStart(4)}  holdings: median ${vals[Math.floor(vals.length / 2)]} best-pair ${vals[vals.length - 1] + vals[vals.length - 2]} worst-pair ${vals[0] + vals[1]}`);
  }

  const scenarios: Array<[string, Array<Row>]> = [[`TARGET ${targetLabel}`, target], ['ALL games', rows]];
  for (const [label, set] of scenarios) {
    console.log(`\n== clause distribution — ${label} (n=${set.length})   [band: p50 10–14, p10 ≥ 3, p90 ≤ 22]`);
    console.log('corp  ' + 'name'.padEnd(30) + '   p10   p50   p90  mean  zero%  verdict');
    for (const id of MARS_BOT_CORP_IDS) {
      const xs = set.filter((r) => r.eligible.includes(id) || r.primary === id).map((r) => r.clauses[id]);
      if (xs.length === 0) continue;
      const p10 = quantile(xs, 0.1); const p50 = quantile(xs, 0.5); const p90 = quantile(xs, 0.9);
      const zero = xs.filter((x) => x === 0).length / xs.length;
      const verdict = p50 < 10 ? (p50 < 6 ? 'LOW!!' : 'low') : p50 > 14 ? (p50 > 20 ? 'HIGH!!' : 'high') : (p90 > 22 ? 'wide' : 'ok');
      console.log(`${id}   ${marsBotCorpInfo(id).original.padEnd(30)} ${f1(p10)}${f1(p50)}${f1(p90)}${f1(mean(xs))}  ${(zero * 100).toFixed(0).padStart(4)}%  ${verdict}`);
    }
  }

  // Monte-Carlo: two random eligible holdings per target game.
  console.log('\n== portfolio Monte-Carlo on the target: two random holdings per game (2000 draws per game)');
  const sums: Array<number> = []; const margins: Array<number> = [];
  let seed = 1;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (const r of target) {
    const pool = r.eligible;
    for (let i = 0; i < 2000; i++) {
      const a = pool[Math.floor(rnd() * pool.length)];
      let b = pool[Math.floor(rnd() * pool.length)];
      while (b === a) b = pool[Math.floor(rnd() * pool.length)];
      const s = r.clauses[a] + r.clauses[b];
      sums.push(s); margins.push(r.margin + s);
    }
  }
  console.log(`  dividend sum: mean=${f1(mean(sums))} p10=${f1(quantile(sums, 0.1))} p50=${f1(quantile(sums, 0.5))} p90=${f1(quantile(sums, 0.9))} p99=${f1(quantile(sums, 0.99))} max=${f1(Math.max(...sums))}`);
  console.log(`  resulting margin bot−best: mean=${f1(mean(margins))} p10=${f1(quantile(margins, 0.1))} p50=${f1(quantile(margins, 0.5))} p90=${f1(quantile(margins, 0.9))}  botWins=${(100 * margins.filter((m) => m > 0).length / margins.length).toFixed(0)}%`);

  const csv = process.argv.indexOf('--csv');
  if (csv >= 0) {
    const out = process.argv[csv + 1];
    const head = ['id', 'slot', 'difficulty', 'generation', 'board', 'primary', 'humanCorps', 'bot', 'bestHuman', 'margin', ...MARS_BOT_CORP_IDS];
    const lines = rows.map((r) => [r.id, r.slot, r.difficulty, r.generation, r.board, r.primary, r.humanCorps, r.bot, r.bestHuman, r.margin, ...MARS_BOT_CORP_IDS.map((id) => r.clauses[id])].join(','));
    fs.writeFileSync(out, [head.join(','), ...lines].join('\n'));
    console.log(`\nwrote ${out}`);
  }
}

main();
