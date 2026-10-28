/**
 * MarsBot dividend GOAL TIERS bench (the owner, 2026-10-28 — «три уровня вместо двух, суммарно столько же, но без
 * резких рывков»; report: docs/claude/marsbot-dividends-calibration.md § ЦЕЛИ — три ступени).
 *
 * Reads the per-game operand counts the calibration bench exports
 * (`npx tsx scripts/marsbot-dividends-calibrate.ts <dir> --terms terms.json`) and, for every corporation, the goal
 * the data file declares NOW. Then it either PROPOSES three thresholds or REPORTS the declared ones:
 *
 *   npx tsx scripts/marsbot-dividend-tiers.ts terms.json [--propose] [--two=<old-goals.json>]
 *
 * The population is the one the goals were first set on: Hard games where the corporation could be a holding
 * (eligible) or is the primary. The proposal keeps, per corporation:
 *  · the EXPECTED goal VP of the old two-goal shape (+10 at a ~20 % threshold, +15 more at a ~5 % one) — the
 *    tiers re-shape the jump, they do not add points;
 *  · the FINAL tier as rare as the old second goal (never under 4 %), and reached in at least two real games;
 *  · the first tier about as often as the old first goal, the middle one between — three steps of +7 / +8 / +10.
 * Thresholds snap to round numbers on wide operands (M€, printed cost).
 */
import * as fs from 'fs';
import {MARS_BOT_CORP_IDS, MarsBotCorpId} from '../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../src/common/automa/MarsBotDividendData';

type TermsRow = {
  id: string, slot: number | undefined, difficulty: string, redux: boolean, primary: string | undefined,
  eligible: ReadonlyArray<string>, terms: Record<string, ReadonlyArray<{label: string, count: number, vp: number}>>,
};
type Two = {term: number, at: number, at2: number, vp: number, vp2: number};

const file = process.argv[2];
if (file === undefined) throw new Error('usage: tsx scripts/marsbot-dividend-tiers.ts terms.json [--propose] [--two=old.json]');
const rows: ReadonlyArray<TermsRow> = JSON.parse(fs.readFileSync(file, 'utf8'));
const propose = process.argv.includes('--propose');
const twoArg = process.argv.find((a) => a.startsWith('--two='));
/** The old two-goal shape, per corp: `[term, at, at2, vp?, vp2?]` (the earlier `goals-final.json`). */
const oldTwo: Record<string, ReadonlyArray<number>> | undefined = twoArg !== undefined ? JSON.parse(fs.readFileSync(twoArg.slice(6), 'utf8')) : undefined;

const share = (xs: ReadonlyArray<number>, t: number) => xs.filter((x) => x >= t).length / xs.length;
const games = (xs: ReadonlyArray<number>, t: number) => xs.filter((x) => x >= t).length;
const pct = (p: number) => `${(100 * p).toFixed(0)}%`.padStart(4);

function stepFor(max: number): number {
  return max >= 300 ? 10 : max >= 90 ? 5 : max >= 40 ? 2 : 1;
}

function tierVps(two: Two): readonly [number, number, number] {
  // The old shape's maximum, cut into three rising steps (+10/+15 = 25 → 7/8/10; C39's +5/+10 = 15 → 4/5/6).
  const max = two.vp + two.vp2;
  return max === 25 ? [7, 8, 10] : [Math.round(max * 7 / 25), Math.round(max * 8 / 25), max - Math.round(max * 7 / 25) - Math.round(max * 8 / 25)];
}

/** The first tier's ceiling: a goal is reached in at most two games of five. */
const P1_MAX = 0.40;
/**
 * Per-corporation overrides of the proposal: C30 Aridor's colonies take four values (1–4) — no room for three
 * tiers — so its goal measures its shipping storage (term 1, its own operand too); C39 Utopia Invest's operand
 * saturates at the track's end (the old goal paid +5/+10 for that reason) — its tiers stay small, 3/5/7, and so do
 * C19 AstroDrill's (the «advance» spaces run out: at 7/8/10 its expected goal VP nearly doubled). Two shapes are
 * set by hand: C16 (the fit's 6/9/11 left the middle tier as rare as the last) → 7/8/9; C17 (3/6/7 fell from 34 %
 * to 3 %) → 3/5/6.
 */
const OVERRIDES: Record<string, {term?: number, vp?: [number, number, number], at?: [number, number, number]}> = {
  C30: {term: 1}, C39: {vp: [3, 5, 7]}, C19: {vp: [3, 5, 7]}, C16: {at: [7, 8, 9]}, C17: {at: [3, 5, 6]},
};

let evOldSum = 0;
let evNewSum = 0;
const proposal: Record<string, {term: number, at: [number, number, number], vp: [number, number, number]}> = {};
console.log('corp  operand'.padEnd(52) + '  old two (hit)              → three tiers (hit · games · redux)                 EV old → new');
for (const id of MARS_BOT_CORP_IDS) {
  const info = marsBotDividendInfo(id as MarsBotCorpId);
  const goal = info.goal as unknown as {term: number, at?: number, at2?: number, vp?: number, vp2?: number, tiers?: ReadonlyArray<{at: number, vp: number}>};
  const set = rows.filter((r) => r.difficulty === 'hard' && (r.eligible.includes(id) || r.primary === id));
  if (set.length === 0) continue;
  const old = oldTwo?.[id];
  const two: Two | undefined = old !== undefined ?
    {term: old[0], at: old[1], at2: old[2], vp: old[3] ?? 10, vp2: old[4] ?? 15} :
    goal.at !== undefined && goal.at2 !== undefined ? {term: goal.term, at: goal.at, at2: goal.at2, vp: goal.vp ?? 10, vp2: goal.vp2 ?? 15} : undefined;
  const countsOf = (term: number) => set.map((r) => r.terms[id]?.[term]?.count ?? 0);
  // The tiers measure the declared term, or the override's when proposing; the OLD shape keeps its own term.
  const term = propose ? OVERRIDES[id]?.term ?? two?.term ?? goal.term : goal.term;
  const counts = countsOf(term);
  const oldCounts = two !== undefined ? countsOf(two.term) : counts;
  const redux = set.filter((r) => r.redux).map((r) => r.terms[id]?.[term]?.count ?? 0);
  const label = set[0].terms[id]?.[term]?.label ?? '?';
  const evOld = two !== undefined ? two.vp * share(oldCounts, two.at) + two.vp2 * share(oldCounts, two.at2) : NaN;
  const oldText = two !== undefined ? `${two.at}/${two.at2} (${pct(share(oldCounts, two.at))} ${pct(share(oldCounts, two.at2))})` : '—';

  let tiers: {at: [number, number, number], vp: [number, number, number]} | undefined;
  if (propose && two !== undefined) {
    const vp = OVERRIDES[id]?.vp ?? tierVps(two);
    const max = Math.max(...counts);
    const step = stepFor(max);
    const candidates: Array<number> = [];
    for (let t = step; t <= max; t += step) candidates.push(t);
    const p3Target = Math.max(0.04, Math.min(0.10, share(counts, two.at2)));
    const p1Target = Math.max(0.15, Math.min(0.32, share(counts, two.at)));
    let best: {score: number, at: [number, number, number]} | undefined;
    for (const t3 of candidates) {
      if (games(counts, t3) < 2) continue;
      const p3 = share(counts, t3);
      for (const t2 of candidates) {
        if (t2 >= t3) break;
        const p2 = share(counts, t2);
        for (const t1 of candidates) {
          if (t1 >= t2) break;
          const p1 = share(counts, t1);
          if (!(p1 > p2 && p2 > p3)) continue;
          // The first tier is never reached in more than two games of five — it is a goal, not a given.
          if (p1 > P1_MAX) continue;
          const ev = vp[0] * p1 + vp[1] * p2 + vp[2] * p3;
          // The EXPECTED goal VP decides (a few integers wide, the closest triple wins, the cheaper on a tie); the
          // shape only breaks near-ties.
          const score =
            100 * ((ev - evOld) / Math.max(1, evOld)) ** 2 + (ev > evOld ? 1e-6 : 0) +
            12 * (p3 - p3Target) ** 2 / p3Target +
            4 * (p1 - p1Target) ** 2 / p1Target +
            6 * (p2 - (p1 + p3) / 2) ** 2 / ((p1 + p3) / 2);
          if (best === undefined || score < best.score) best = {score, at: [t1, t2, t3]};
        }
      }
    }
    const fixed = OVERRIDES[id]?.at;
    if (fixed !== undefined) tiers = {at: fixed, vp: [...vp] as [number, number, number]};
    else if (best !== undefined) tiers = {at: best.at, vp: [...vp] as [number, number, number]};
  } else if (goal.tiers !== undefined) {
    tiers = {at: goal.tiers.map((t) => t.at) as [number, number, number], vp: goal.tiers.map((t) => t.vp) as [number, number, number]};
  }
  if (tiers === undefined) {
    console.log(`${id}  ${label.padEnd(46)}  ${oldText.padEnd(26)} → (no fit)`);
    continue;
  }
  const evNew = tiers.vp[0] * share(counts, tiers.at[0]) + tiers.vp[1] * share(counts, tiers.at[1]) + tiers.vp[2] * share(counts, tiers.at[2]);
  evOldSum += Number.isNaN(evOld) ? 0 : evOld;
  evNewSum += evNew;
  proposal[id] = {term, at: tiers.at, vp: tiers.vp};
  const hits = tiers.at.map((t) => pct(share(counts, t))).join(' ');
  const g = tiers.at.map((t) => String(games(counts, t))).join('/');
  const rx = redux.length > 0 ? tiers.at.map((t) => String(games(redux, t))).join('/') + ` of ${redux.length}` : '—';
  console.log(`${id}  ${label.padEnd(46)}  ${oldText.padEnd(26)} → ${tiers.at.join('/').padEnd(12)} (${hits} · ${g.padEnd(8)} · ${rx.padEnd(9)})  ${evOld.toFixed(2)} → ${evNew.toFixed(2)}`);
}
console.log(`\nΣ EV over the corporations: ${evOldSum.toFixed(1)} → ${evNewSum.toFixed(1)}`);
if (propose) {
  const out = process.argv.find((a) => a.startsWith('--out='));
  if (out !== undefined) {
    fs.writeFileSync(out.slice(6), JSON.stringify(proposal, null, 1));
    console.log(`wrote ${out.slice(6)}`);
  }
}
