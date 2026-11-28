#!/usr/bin/env node
/**
 * THE MONKEY'S REPORT — a run of the e2e suite (the monkey's above all) summed BY CAUSE CLASS.
 *
 *   node scripts/monkey-report.mjs <test-results dir> [--against <an earlier monkey-report.json>] [--out <file>] [--gate]
 *
 * Every test files the cause classes its pages named under `<outputDir>/cause-classes/*.json` (`tests/e2e/
 * causeHarvest.ts` — the SAME key the field files a stall under: `src/common/diagnostics/cause.ts`). This script reads
 * them all and answers what a release needs answered (docs/claude/console/freeze-zero/PLAN.md §3.3, §5):
 *
 *   · which DEFECT classes the run found — per class: in how many walks, how many records, how its episodes ended, and
 *     the first case (the table, the seed) to rerun;
 *   · what was NEW against an earlier run, and what is GONE (`--against`);
 *   · the fires of EVERY net (a class's first two words are its shape — `wait-graph/ceiling`) per 1000 presses: the
 *     evidence a net's retirement needs, and the controlled denominator a fixed seed set gives;
 *   · the bar's own numbers: episodes that were never cured;
 *   · HOW MUCH OF THE KERNEL'S STATE SPACE THE RUN WALKED (when the walks carried coverage — `TM_E2E_COVERAGE=1`,
 *     which the monkey sets): the declared flows that were opened (`scripts/flow-universe.mjs` is the universe), the
 *     workspace frames and the phases each reached, the machines' moves that were made — and the list of what was
 *     NEVER reached, which is what the next run steers at.
 *
 * `--gate` makes it a release gate: exit 3 when the run has an episode that was never cured, or a DEFECT class the
 * earlier report did not have. Without `--gate` it always exits 0 (a report is data).
 *
 * `--zero` is THE ZERO BAR of the whole games (the owner, 2026-11-25: «0 % ошибок, зависаний и даже ворнингов —
 * чтобы лог был чист … на ЛЮБЫХ запусках автопилота»): beside everything `--gate` refuses, exit 3 on ANY record of
 * ANY tier (a «planned» fire of a net and an «info» line are debt, not a norm), on any answer through the door, on
 * any press the ladder's own order routed, on any judged state of the opening that parted — and on any line of the
 * games' LOG: a warning, an error, a page error, an HTTP answer of 400 and above.
 *
 * Writes `<test-results dir>/monkey-report.json` (or `--out`) and prints the text.
 */
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {flowUniverse} from './flow-universe.mjs';

/** Every `cause-classes/*.json` under `dir` (the functional pass and `timing/` both). */
export function findCauseFiles(dir) {
  const out = [];
  const walk = (d, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(d, {withFileTypes: true});
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'cause-classes') {
          for (const f of fs.readdirSync(full)) {
            if (f.endsWith('.json')) {
              out.push(path.join(full, f));
            }
          }
        } else if (depth < 3) {
          walk(full, depth + 1);
        }
      }
    }
  };
  walk(dir, 0);
  return out.sort();
}

/** An episode that the net did not cure before the walk (or the page) was over. */
const NOT_CURED = new Set(['unhealed', 'reload', 'rebuilt', 'quit', 'test-ended']);

/** The shape of a class: its first two words (`wait-graph/ceiling/played-hero:payback` → `wait-graph/ceiling`). */
export function shapeOfClass(cls) {
  return cls.split('/').slice(0, 2).join('/');
}

/**
 * The run summed. `files` — the parsed `cause-classes` files (`{file, title, retry, status, monkey?, records}`); a
 * test that was retried counts by its LAST run only (the earlier attempts' files are named `-r0`, `-r1`…).
 */
export function aggregateCauseFiles(files) {
  const last = new Map();
  for (const f of files) {
    const key = `${f.file}::${f.title}`;
    const known = last.get(key);
    if (known === undefined || (f.retry ?? 0) >= (known.retry ?? 0)) {
      last.set(key, f);
    }
  }
  const classes = {};
  const nets = {};
  const totals = {tests: last.size, walks: 0, presses: 0, records: 0, defects: 0, episodes: 0, notCured: 0, outcomes: {}};
  /*
   * A CLASS IS AS BAD AS ITS WORST RECORD. One class may be read at two tiers — the same line is an honest wait or a
   * defect by WHO OWNED the wait (`shapes.ts` `read`: a story the player kept covered, a story the board saw and did
   * not tell). The class once took the tier of the FIRST record met, in the order of the files: on 2026-11-18 a run
   * counted «defects 1» and named no defect class — the defect stood behind a planned record of another table, the
   * gate passed and nothing was filed. The tier rises to the worst record's, and `first` is the first record OF THAT
   * TIER (the one to re-run); `tiers` says how many records were read at each.
   */
  const RANK = {info: 0, planned: 1, defect: 2};
  const raised = (holder, tier) => {
    if ((RANK[tier] ?? 0) > (RANK[holder.tier] ?? 0)) {
      holder.tier = tier;
      return true;
    }
    return false;
  };
  const row = (cls, tier) => {
    const c = classes[cls] ?? (classes[cls] = {tier, shape: shapeOfClass(cls), tests: 0, records: 0, lines: 0, outcomes: {}, worstStoodS: 0, first: undefined, tiers: {}});
    if (raised(c, tier)) {
      c.first = undefined;
    }
    c.tiers[tier] = (c.tiers[tier] ?? 0) + 1;
    return c;
  };
  const net = (shape, tier) => {
    const n = nets[shape] ?? (nets[shape] = {tier, records: 0, lines: 0, tests: 0});
    raised(n, tier);
    return n;
  };
  /*
   * A TEST WHOSE HARNESS THREW MEASURED NOTHING (stage M — the audit of 2026-11-28, A7). The bottle's driver files a
   * game that threw as `status: 'harness'` with its error at tier INFO and no game block: it was dropped from the
   * count of games, its line was «info», and the pass read «GATE: pass». A thrown test is named here, whatever tier
   * its line carries — the gate refuses the pass.
   */
  totals.thrown = [];
  for (const f of [...last.values()].sort((a, b) => `${a.file}${a.title}`.localeCompare(`${b.file}${b.title}`))) {
    if (f.status === 'harness' || (f.records ?? []).some((r) => /^[a-z-]+\/harness-error(\/|$)/.test(String(r.cls)))) {
      totals.thrown.push(f.title);
    }
    if (f.monkey !== undefined) {
      totals.walks++;
      totals.presses += Number(f.monkey.presses ?? 0);
      // (THE WIRE'S FAULTS a walk TOOK — stage 4's pass: `<fault>@<submit | poll | view>`.)
      for (const fault of f.monkey.faults ?? []) {
        totals.faults ??= {};
        totals.faults[fault] = (totals.faults[fault] ?? 0) + 1;
      }
    }
    const seenClass = new Set();
    const seenShape = new Set();
    for (const r of f.records ?? []) {
      totals.records++;
      const c = row(r.cls, r.tier);
      c.records++;
      c.lines += r.lines ?? 1;
      if (!seenClass.has(r.cls)) {
        seenClass.add(r.cls);
        c.tests++;
      }
      if (r.tier === c.tier) {
        c.first ??= {file: f.file, title: f.title, seed: f.monkey?.seed, atMs: r.atMs, line: r.line ?? r.title, dims: r.dims};
      }
      const n = net(r.shape ?? shapeOfClass(r.cls), r.tier);
      n.records++;
      n.lines += r.lines ?? 1;
      if (!seenShape.has(r.shape)) {
        seenShape.add(r.shape);
        n.tests++;
      }
      if (r.tier === 'defect') {
        totals.defects++;
      }
      if (r.episode !== undefined) {
        totals.episodes++;
        const outcome = r.episode.outcome;
        c.outcomes[outcome] = (c.outcomes[outcome] ?? 0) + 1;
        totals.outcomes[outcome] = (totals.outcomes[outcome] ?? 0) + 1;
        c.worstStoodS = Math.max(c.worstStoodS, r.episode.stoodS ?? 0);
        if (NOT_CURED.has(outcome)) {
          totals.notCured++;
        }
        // What spoke INSIDE the episode fired too — counted under its own class and net.
        for (const inner of r.episode.nets ?? []) {
          const ic = row(inner.cls, inner.tier);
          ic.records++;
          ic.lines += inner.n;
          const inet = net(shapeOfClass(inner.cls), inner.tier);
          inet.records++;
          inet.lines += inner.n;
        }
      }
    }
  }
  const per1000 = (n) => (totals.presses === 0 ? null : Math.round(n / totals.presses * 100_000) / 100);
  for (const n of Object.values(nets)) {
    n.per1000Presses = per1000(n.records);
  }
  return {totals, classes, nets};
}

/** `a of b` as a percentage with one decimal (`null` for an empty universe). */
function pct(a, b) {
  return b === 0 ? null : Math.round(a / b * 1000) / 10;
}

/**
 * THE ONE FUNCTION AGAINST THE SCREEN (FREEZE ZERO, stage 2 — `servingOwnerMeasure.ts`). `files` — the parsed
 * `cause-classes` files (their `owner` is the page's `__conServingOwner()`): how often `servingOwnerOf` agreed with
 * what painted, by verdict and by shape, and every DISTINCT disagreement with the tables that met it. `undefined`
 * when no walk carried the measure.
 */
export function aggregateOwner(files) {
  let walks = 0;
  let looks = 0;
  const verdicts = {};
  const rows = {};
  const disagreements = new Map();
  const spans = {};
  const open = {};
  for (const f of files) {
    const o = f.owner;
    if (o === undefined || o === null || typeof o.looks !== 'number') {
      continue;
    }
    walks++;
    looks += o.looks;
    for (const [shape, row] of Object.entries(o.rows ?? {})) {
      const into = rows[shape] ?? (rows[shape] = {});
      for (const [verdict, n] of Object.entries(row)) {
        into[verdict] = (into[verdict] ?? 0) + n;
        const head = verdict.split(':')[0];
        verdicts[head] = (verdicts[head] ?? 0) + n;
      }
    }
    for (const [key, span] of Object.entries(o.spans ?? {})) {
      const into = spans[key] ?? (spans[key] = {n: 0, ms: 0, max: 0, tables: []});
      into.n += span.n ?? 0;
      into.ms += span.ms ?? 0;
      into.max = Math.max(into.max, span.max ?? 0);
      if (into.tables.length < 4) {
        into.tables.push(String(f.title ?? '').replace(/^monkey · /, ''));
      }
    }
    for (const d of o.open ?? []) {
      const key = `${d.surface}|${d.verdict}`;
      open[key] = (open[key] ?? 0) + 1;
    }
    for (const d of o.disagreements ?? []) {
      const key = `${d.shape} — ${d.verdict}: says «${d.owner}${d.host ? `@${d.host}` : ''}»${d.hold ? ` held by ${d.hold}` : ''}, painted «${(d.present ?? []).join('|') || 'nothing'}»`;
      const known = disagreements.get(key) ?? {n: 0, tables: [], facts: typeof d.facts === 'string' ? d.facts : ''};
      known.n++;
      if (known.tables.length < 4) {
        known.tables.push(String(f.title ?? '').replace(/^monkey · /, ''));
      }
      disagreements.set(key, known);
    }
  }
  if (walks === 0) {
    return undefined;
  }
  return {
    walks, looks, verdicts, rows, spans, open,
    disagreements: [...disagreements.entries()].sort((a, b) => b[1].n - a[1].n).map(([what, v]) => ({what, walks: v.n, tables: v.tables, facts: v.facts})),
  };
}

export function renderOwner(owner) {
  if (owner === undefined) {
    return '';
  }
  const v = owner.verdicts;
  const judged = (v.agree ?? 0) + (v.held ?? 0) + (v.MISS ?? 0) + (v.EXTRA ?? 0);
  const pct = (n) => (judged === 0 ? '—' : `${Math.round((n ?? 0) / judged * 1000) / 10} %`);
  const L = [];
  L.push('');
  L.push(`── THE ONE FUNCTION AGAINST THE SCREEN (stage 2) — ${owner.walks} walk(s), ${owner.looks} look(s), ${judged} judged ──`);
  L.push(`agrees ${v.agree ?? 0} (${pct(v.agree)}) · held as said ${v.held ?? 0} (${pct(v.held)}) · MISS ${v.MISS ?? 0} (${pct(v.MISS)}) · EXTRA ${v.EXTRA ?? 0} (${pct(v.EXTRA)})` +
    ((v.unsettled ?? 0) > 0 ? ` · unsettled ${v.unsettled} (the first look of a disagreement — not judged)` : ''));
  // THE PAD's half (stage 2 ②): which rung of the ladder took each press, against the function's owner.
  const presses = (v['pad-agree'] ?? 0) + (v['pad-held'] ?? 0) + (v['pad-MISS'] ?? 0) + (v['pad-free'] ?? 0) + (v['pad-look'] ?? 0) + (v['pad-beat'] ?? 0);
  if (presses > 0) {
    const asked = presses - (v['pad-free'] ?? 0);
    const share = (n) => (asked === 0 ? '—' : `${Math.round((n ?? 0) / asked * 1000) / 10} %`);
    L.push(`THE PAD — ${presses} press(es), ${asked} under a question: the owner's rung ${v['pad-agree'] ?? 0} (${share(v['pad-agree'])}) · under a hold ${v['pad-held'] ?? 0} (${share(v['pad-held'])}) · the player's own look ${v['pad-look'] ?? 0} (${share(v['pad-look'])}) · a beat ${v['pad-beat'] ?? 0} (${share(v['pad-beat'])}) · ANOTHER RUNG ${v['pad-MISS'] ?? 0} (${share(v['pad-MISS'])})`);
  }
  // …and THE MAP OF THE HOLDS: who took the press under a hold of each kind (`pad-held:<kind>:<who>` — `own` the held
  // owner's rung, `look` / `beat` the ladder's upper half, else the rung by name). What the ladder is to be derived from.
  const heldMap = {};
  for (const [shape, row] of Object.entries(owner.rows ?? {})) {
    if (!shape.startsWith('pad:')) {
      continue;
    }
    for (const [verdict, n] of Object.entries(row)) {
      const m = /^pad-held:([a-z]+):(.+)$/.exec(verdict);
      if (m !== null) {
        const into = heldMap[m[1]] ?? (heldMap[m[1]] = {});
        into[m[2]] = (into[m[2]] ?? 0) + n;
      }
    }
  }
  for (const [kind, who] of Object.entries(heldMap).sort((a, b) => a[0].localeCompare(b[0]))) {
    const total = Object.values(who).reduce((a, b) => a + b, 0);
    L.push(`  under ${kind.padEnd(9)} ${String(total).padStart(6)} — ${Object.entries(who).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(' · ')}`);
  }
  // THE OPENING's OWN STAGE (stage 2b): the start director's word beside the latches', every disagreement and every
  // strand as a span — who was expected, who stood, what would have been done at once, how long, what ended it.
  const opening = owner.rows?.opening;
  const openingRows = Object.entries(owner.spans ?? {}).filter(([key]) => key.startsWith('opening|')).sort((x, y) => y[1].max - x[1].max || y[1].n - x[1].n);
  if (opening !== undefined || openingRows.length > 0) {
    const n = (verdict) => opening?.[`opening-${verdict}`] ?? 0;
    const stillOpen = Object.entries(owner.open ?? {}).filter(([k]) => k.startsWith('opening|'));
    L.push(`THE OPENING — ${n('agree') + n('disagree') + n('held') + n('out')} judged state(s) of the start: agree ${n('agree')} · APART ${n('disagree')} · held ${n('held')} · out of scope ${n('out')}` +
      (stillOpen.length > 0 ? ` · STILL APART at the walk's end: ${stillOpen.map(([k, c]) => `${k.slice(8)} ×${c}`).join(' · ')}` : ''));
    for (const [key, v] of openingRows.slice(0, 80)) {
      L.push(`  ${String(v.n).padStart(5)}×  longest ${String(Math.round(v.max)).padStart(6)} ms · ${String(Math.round(v.ms)).padStart(7)} ms in all  ${key.slice(8)}   [${v.tables.join(', ')}]`);
    }
  }
  // THE BEAT LAW (stage 3): every transient beat is read by frame — how many stood with nothing in flight, and how long.
  const beatRows = Object.entries(owner.spans ?? {}).filter(([key]) => key.startsWith('beat|'));
  if (beatRows.length > 0) {
    const quiet = beatRows.filter(([key]) => key.includes(' · QUIET'));
    const count = (rows) => rows.reduce((sum, [, v]) => sum + (v.n ?? 0), 0);
    L.push(`THE BEAT LAW — ${count(beatRows)} span(s) of a transient beat: QUIET ${count(quiet)}` +
      (quiet.length > 0 ? ` (longest ${Math.round(quiet.reduce((m, [, v]) => Math.max(m, v.max ?? 0), 0))} ms; the bar is ${BEAT_LAW_QUIET_MS} ms)` : ''));
    for (const [beat, n, max, tables] of beatLawBroken({owner})) {
      L.push(`  BROKEN: «${beat}» stood ${max} ms with nothing in flight under it ×${n}  [${tables.join(', ')}]`);
    }
  }
  // THE ANSWER AT ITS LAST REACTIVE EDGE (stage 2 ③): would a cache derived from the function hold the truth?
  const edgeN = {agree: 0, latch: 0};
  for (const [shape, row] of Object.entries(owner.rows ?? {})) {
    if (shape.startsWith('edge:')) {
      edgeN.agree += row['edge-agree'] ?? 0;
      edgeN.latch += row['edge-LATCH'] ?? 0;
    }
  }
  if (edgeN.agree + edgeN.latch > 0) {
    L.push(`THE EDGE — ${edgeN.agree + edgeN.latch} look(s): the answer stood as at its last reactive edge ${edgeN.agree} · LATCH (moved with no edge) ${edgeN.latch}`);
  }
  // THE BAND, DERIVED: the ONE rung the switch would name, against the rung the ladder took — the last measure before the swap.
  const bandN = {agree: 0, above: 0, apart: 0, fallback: 0};
  const bandPairs = {};
  const bandFallbacks = {};
  for (const [shape, row] of Object.entries(owner.rows ?? {})) {
    if (!shape.startsWith('band:')) {
      continue;
    }
    for (const [verdict, n] of Object.entries(row)) {
      if (verdict === 'band-agree') {
        bandN.agree += n;
      } else if (verdict === 'band-above') {
        bandN.above += n;
      } else if (verdict.startsWith('band-APART:')) {
        bandN.apart += n;
        const pair = verdict.slice('band-APART:'.length);
        bandPairs[pair] = (bandPairs[pair] ?? 0) + n;
      } else if (verdict.startsWith('band-fallback:')) {
        bandN.fallback += n;
        const pair = verdict.slice('band-fallback:'.length);
        bandFallbacks[pair] = (bandFallbacks[pair] ?? 0) + n;
      }
    }
  }
  if (bandN.agree + bandN.above + bandN.apart + bandN.fallback > 0) {
    L.push(`THE BAND, DERIVED — ${bandN.agree + bandN.above + bandN.apart + bandN.fallback} press(es): the ladder took the derived rung ${bandN.agree} · its upper half took it ${bandN.above} · APART ${bandN.apart} · the ladder's own order routed it (FALLBACK) ${bandN.fallback}`);
    if (bandN.fallback > 0) {
      L.push(`  FALLBACK: ${Object.entries(bandFallbacks).sort((x, y) => y[1] - x[1]).slice(0, 40).map(([pair, n]) => `«${pair.split('>')[0]}» → «${pair.split('>')[1]}» ${n}`).join(' · ')}`);
    }
    if (bandN.apart > 0) {
      L.push(`  APART: ${Object.entries(bandPairs).sort((x, y) => y[1] - x[1]).slice(0, 40).map(([pair, n]) => `«${pair.split('>')[0]}» → «${pair.split('>')[1]}» ${n}`).join(' · ')}`);
    }
  }
  // THE SURFACES' OWN CONDITIONS (stage 2 ③): every prompt condition that HOLDS on a look, against the function's answer.
  const flagN = {};
  const flagRows = {};
  for (const [shape, row] of Object.entries(owner.rows ?? {})) {
    if (!shape.startsWith('flag:')) {
      continue;
    }
    for (const [verdict, n] of Object.entries(row)) {
      const head = verdict.split(':')[0];
      flagN[head] = (flagN[head] ?? 0) + n;
      if (head === 'flag-MISS' || head === 'flag-EXTRA' || verdict.startsWith('flag-agree:two')) {
        flagRows[verdict] = (flagRows[verdict] ?? 0) + n;
      }
    }
  }
  const flagAll = Object.values(flagN).reduce((x, y) => x + y, 0);
  if (flagAll > 0) {
    L.push(`THE CONDITIONS — ${flagAll} look(s): agree ${flagN['flag-agree'] ?? 0} · held ${flagN['flag-held'] ?? 0} · free ${flagN['flag-free'] ?? 0} · MISS ${flagN['flag-MISS'] ?? 0} · EXTRA ${flagN['flag-EXTRA'] ?? 0}` +
      ((flagN['flag-unsettled'] ?? 0) > 0 ? ` · unsettled ${flagN['flag-unsettled']}` : ''));
    const rows = Object.entries(flagRows).sort((x, y) => y[1] - x[1]).slice(0, 30);
    if (rows.length > 0) {
      L.push(`  ${rows.map(([verdict, n]) => `${verdict} ${n}`).join(' · ')}`);
    }
  }
  // THE BAR's half: the branch the command bar stood on against the rung that took the press — two copies of one decision.
  const barPairs = {};
  const barBeats = {};
  const barN = {agree: 0, look: 0, beat: 0, apart: 0};
  for (const [shape, row] of Object.entries(owner.rows ?? {})) {
    if (!shape.startsWith('bar:')) {
      continue;
    }
    for (const [verdict, n] of Object.entries(row)) {
      if (verdict === 'bar-agree') {
        barN.agree += n;
      } else if (verdict.startsWith('bar-look:')) {
        barN.look += n;
      } else if (verdict.startsWith('bar-beat:')) {
        barN.beat += n;
        const pair = verdict.slice('bar-beat:'.length);
        barBeats[pair] = (barBeats[pair] ?? 0) + n;
      } else if (verdict.startsWith('bar-APART:')) {
        barN.apart += n;
        const pair = verdict.slice('bar-APART:'.length);
        barPairs[pair] = (barPairs[pair] ?? 0) + n;
      }
    }
  }
  const barAll = barN.agree + barN.look + barN.beat + barN.apart;
  if (barAll > 0) {
    const of = (n) => `${Math.round(n / barAll * 1000) / 10} %`;
    L.push(`THE BAR — ${barAll} press(es): the bar's branch took it ${barN.agree} (${of(barN.agree)}) · the player's own look ${barN.look} (${of(barN.look)}) · a beat under a standing bar ${barN.beat} (${of(barN.beat)}) · APART ${barN.apart} (${of(barN.apart)})`);
    const pairs = (map) => Object.entries(map).sort((x, y) => y[1] - x[1]).slice(0, 30).map(([pair, n]) => `«${pair.split('>')[0]}» → «${pair.split('>')[1]}» ${n}`).join(' · ');
    if (barN.beat > 0) {
      L.push(`  a beat: ${pairs(barBeats)}`);
    }
    if (barN.apart > 0) {
      L.push(`  APART: ${pairs(barPairs)}`);
    }
  }
  for (const d of owner.disagreements.slice(0, 60)) {
    L.push(`${String(d.walks).padStart(5)} walk(s)  ${d.what}   [${d.tables.join(', ')}]`);
    if (d.facts) {
      L.push(`               facts: ${d.facts}`);
    }
  }
  if (owner.disagreements.length > 60) {
    L.push(`  … +${owner.disagreements.length - 60} (all of them are in the report's JSON)`);
  }
  return L.join('\n');
}

/**
 * A MACHINE'S MOVE, BY REGION. The trace prints a transition by the machine's whole state VALUE, and for a machine of
 * ORTHOGONAL regions (the claim: stage × beat × arrival × host) the explorer's universe is their PRODUCT — 242 «moves»
 * of which a table walks nine, and a number nobody can read: the same `beat: pending → over` is counted once per
 * combination of the three regions it does not touch. A move of such a machine is a REGION's move:
 *
 *   {"live":{"stage":"awaiting","beat":"pending",…}} → {"live":{"stage":"awaiting","beat":"over",…}}   live/beat: pending → over
 *   {"live":{…}} → released                                                                            live → released
 *   browse → {"executing":"away"}                                                                      browse → executing.away
 *
 * (a compound state's one child is part of the state's name; a value of several keys is orthogonal regions; an event
 * that moves two regions at once is each region's move). A machine with no orthogonal region reads as before.
 */
export function regionMoves(edge) {
  const parse = (side) => {
    try {
      return JSON.parse(side);
    } catch {
      return side;
    }
  };
  const regionsOf = (value) => {
    const out = {};
    const walk = (v, region, prefix) => {
      if (typeof v !== 'object' || v === null) {
        out[region] = prefix === '' ? String(v) : `${prefix}.${v}`;
        return;
      }
      const keys = Object.keys(v);
      if (keys.length === 1) {
        walk(v[keys[0]], region, prefix === '' ? keys[0] : `${prefix}.${keys[0]}`);
        return;
      }
      for (const key of keys) {
        walk(v[key], [region, prefix, key].filter((part) => part !== '').join('/'), '');
      }
    };
    walk(value, '', '');
    return out;
  };
  const sides = edge.split(' → ');
  if (sides.length !== 2) {
    return [edge];
  }
  const [from, to] = sides.map((side) => regionsOf(parse(side)));
  const rootOf = (regions) => {
    const keys = Object.keys(regions);
    return keys.length === 1 && keys[0] === '' ? regions[''] : keys[0].split('/')[0];
  };
  if (Object.keys(from).sort().join('|') !== Object.keys(to).sort().join('|')) {
    return [`${rootOf(from)} → ${rootOf(to)}`];
  }
  return Object.keys(from).filter((region) => from[region] !== to[region]).map((region) => `${region === '' ? '' : `${region}: `}${from[region]} → ${to[region]}`);
}

/**
 * HOW MUCH OF THE KERNEL'S STATE SPACE THE RUN WALKED. `files` — the parsed `cause-classes` files (their `coverage`
 * is the page's `__conCoverage()`: `{keys, machines, frames}`); `declared` — the flows the sources declare
 * (`flowUniverse().flows`: id → where). `undefined` when no walk carried coverage.
 */
export function aggregateCoverage(files, declared) {
  const keys = new Set();
  const machines = {};
  const frames = new Set();
  let walks = 0;
  for (const f of files) {
    const c = f.coverage;
    if (c === undefined || c === null || !Array.isArray(c.keys)) {
      continue;
    }
    walks++;
    for (const key of c.keys) {
      keys.add(key);
    }
    for (const [kind, edges] of Object.entries(c.machines ?? {})) {
      const set = machines[kind] ?? (machines[kind] = new Set());
      for (const edge of edges) {
        set.add(edge);
      }
    }
    for (const frame of c.frames ?? []) {
      frames.add(frame);
    }
  }
  if (walks === 0) {
    return undefined;
  }
  const opened = new Set([...keys].filter((k) => k.startsWith('open ')).map((k) => k.slice('open '.length)));
  // THE DECLARED FLOWS — what the sources write as a literal label.
  const ids = Object.keys(declared).sort();
  const never = ids.filter((id) => !opened.has(id));
  const byKind = {};
  for (const id of ids) {
    const kind = id.split(':')[0];
    const row = byKind[kind] ?? (byKind[kind] = {declared: 0, opened: 0});
    row.declared++;
    row.opened += opened.has(id) ? 1 : 0;
  }
  // THE FRAMES — every workspace kind, and the phases each reached (a frame's machine moves are `state frame:<kind> a → b`).
  const frameIds = [...frames].sort();
  const phases = {};
  for (const key of keys) {
    const m = /^state (frame:[^ ]+) (.+) → (.+)$/.exec(key);
    if (m !== null) {
      const set = phases[m[1]] ?? (phases[m[1]] = new Set());
      set.add(m[2]);
      set.add(m[3]);
    }
  }
  // THE MACHINES — by the scope kind each runs in: the moves made (the label does not matter) against the moves possible.
  const machineRows = {};
  for (const [kind, edges] of Object.entries(machines)) {
    // (By REGION — `regionMoves`: the universe the explorer lists, and the moves the trace made.)
    const universe = new Set([...edges].flatMap(regionMoves));
    const made = new Set();
    for (const key of keys) {
      // (The move is the key's LAST `<from> → <to>` — a state value carries no space, a label may: an announce's is its
      // question's title.)
      const m = new RegExp(`^state ${kind}(?::.*)? (\\S+ → \\S+)$`).exec(key);
      if (m !== null) {
        for (const move of regionMoves(m[1])) {
          made.add(move);
        }
      }
    }
    const all = [...universe].sort();
    machineRows[kind] = {
      moves: all.length, made: all.filter((edge) => made.has(edge)).length, pct: pct(all.filter((edge) => made.has(edge)).length, all.length),
      never: all.filter((edge) => !made.has(edge)),
      // A move the trace made that the explorer never reached is a hole in the machine's sample events — say it.
      unlisted: [...made].filter((edge) => !universe.has(edge)).sort(),
    };
  }
  const ended = (how) => [...keys].filter((k) => k.startsWith('end ') && k.endsWith(` ${how}`)).map((k) => k.slice(4, -how.length - 1)).sort();
  return {
    walks, keys: keys.size,
    flows: {declared: ids.length, opened: ids.length - never.length, pct: pct(ids.length - never.length, ids.length), byKind, never},
    frames: {
      kinds: frameIds.length, opened: frameIds.filter((id) => opened.has(id)).length, pct: pct(frameIds.filter((id) => opened.has(id)).length, frameIds.length),
      never: frameIds.filter((id) => !opened.has(id)),
      phases: Object.fromEntries(Object.entries(phases).map(([id, set]) => [id, [...set].sort()])),
    },
    machines: machineRows,
    // What a healthy run does not do at all — each is a finding with its own line, listed here by flow.
    expired: ended('expired'), failed: ended('failed'),
    bounds: [...keys].filter((k) => k.startsWith('bound ')).map((k) => k.slice(6)).sort(),
    cycles: [...keys].filter((k) => k.startsWith('cycle ')).map((k) => k.slice(6)).sort(),
    // Flows that ran and that no literal declares (a label built at run time) — seen only because they ran.
    undeclared: [...opened].filter((id) => declared[id] === undefined && !id.startsWith('frame:') && !id.startsWith('task:')).sort(),
  };
}

export function renderCoverage(c) {
  if (c === undefined) {
    return '';
  }
  const L = [];
  L.push('');
  L.push(`── THE KERNEL'S STATE SPACE — walked by ${c.walks} walk(s), ${c.keys} key(s) ──`);
  L.push(`flows opened      ${c.flows.opened} of ${c.flows.declared} declared (${c.flows.pct} %) — ` +
    Object.entries(c.flows.byKind).map(([kind, row]) => `${kind} ${row.opened}/${row.declared}`).join(' · '));
  L.push(`workspace frames  ${c.frames.opened} of ${c.frames.kinds} (${c.frames.pct} %)${c.frames.never.length > 0 ? ` — never: ${c.frames.never.map((id) => id.slice(6)).join(', ')}` : ''}`);
  for (const [kind, row] of Object.entries(c.machines)) {
    L.push(`machine ${kind.padEnd(9)} ${row.made} of ${row.moves} moves (${row.pct} %)${row.never.length > 0 ? ` — never: ${row.never.slice(0, 8).join(' | ')}${row.never.length > 8 ? ` | +${row.never.length - 8}` : ''}` : ''}`);
  }
  if (c.expired.length + c.failed.length + c.bounds.length + c.cycles.length > 0) {
    L.push(`expired ${c.expired.length} · failed ${c.failed.length} · bounds ${c.bounds.length} · cycles ${c.cycles.length}` +
      ` — ${[...c.expired.map((s) => `expired ${s}`), ...c.failed.map((s) => `failed ${s}`), ...c.bounds.map((s) => `bound ${s}`), ...c.cycles.map((s) => `cycle ${s}`)].slice(0, 12).join(' | ')}`);
  }
  const never = c.flows.never.filter((id) => !id.startsWith('surface:'));
  L.push(`never opened (the flows; a component's own scope opens only when it waits — ${c.flows.never.length - never.length} of those are not listed): ${never.length}`);
  for (const id of never.slice(0, 60)) {
    L.push(`  ${id}`);
  }
  if (never.length > 60) {
    L.push(`  … +${never.length - 60} (all of them are in the report's JSON)`);
  }
  return L.join('\n');
}

/** What a run has that an earlier one did not, and what it lost — DEFECT classes only (a planned wait is not a finding). */
export function compareReports(now, before) {
  const defects = (report) => new Set(Object.entries(report?.classes ?? {}).filter(([, c]) => c.tier === 'defect').map(([cls]) => cls));
  const a = defects(now);
  const b = defects(before);
  return {
    newClasses: [...a].filter((cls) => !b.has(cls)).sort(),
    goneClasses: [...b].filter((cls) => !a.has(cls)).sort(),
    kept: [...a].filter((cls) => b.has(cls)).sort(),
  };
}

/**
 * THE ONE-OWNER LAW's NUMBERS (FREEZE ZERO, stage 2 — `servingOwnerMeasure.ts`): what must read ZERO on every walk since
 * the prompt surfaces, the pad's band and the bar are derived from one answer. Each is a way the copies could part
 * again — and a gate that only LISTED them would be read by nobody.
 */
export const OWNER_LAW = {
  'MISS': 'the function says an owner serves and it does not paint',
  'EXTRA': 'the function names a hold and the surface paints',
  'pad-MISS': 'the pad gave the press to another rung than the owner\'s',
  'band-APART': 'the ladder took another rung than the function\'s word',
  'bar-APART': 'the bar showed one owner\'s commands and another rung took the press',
  'flag-MISS': 'the function says an owner serves and its surface has nothing to draw',
  'flag-EXTRA': 'a prompt surface stands that the function does not name',
  'edge-LATCH': 'the answer moved with no reactive edge',
};

/** The law's rows of a report that are not at zero — `[verdict, count, what]`. */
export function ownerLawBroken(report) {
  const verdicts = report.owner?.verdicts ?? {};
  return Object.entries(OWNER_LAW).filter(([verdict]) => (verdicts[verdict] ?? 0) > 0).map(([verdict, what]) => [verdict, verdicts[verdict], what]);
}

/**
 * THE BEAT LAW (FREEZE ZERO, stage 3 — «a pause inside a beat is a DECLARED wait»): a frame in a transient beat
 * (`executing` · `completing` — its own phase, or the one its surface reports) with NOTHING IN FLIGHT under it is
 * either a stall or a pause somebody wrote and nobody declared — a net's timer (`guarantee`), a controller's own
 * clock — where the kernel has `span` and the wait graph a ceiling wait. Three of those stood on healthy tables when
 * the BEAT track first read honestly (2026-11-23: the standard project's read of its terminal commit, the action
 * commit's minimum beat, the Hydronetwork's result read — 0.3 – 1.2 s each); every door by level reads «nothing in
 * flight» as «nobody is working», so an undeclared pause is exactly what a door would cut. The track reads every
 * beat by painted frame (`outcomeController.measureStandingBeat` → `beat|<kind>:<beat> · QUIET{…}`), and since those
 * three it reads ZERO quiet beats — the whole e2e suite, the gate's 1 214 walks, the box. The law holds it there.
 *
 * THE BAR is the doors' own (twelve frames ∧ 250 ms — `levelDoor.ts`): past a hand-off between two flights, never
 * seconds. Read on the span's longest standing.
 */
export const BEAT_LAW_QUIET_MS = 250;

/** The beats that stood quiet past the bar — `[beat, spans, longest ms, tables]`, the longest first. */
export function beatLawBroken(report) {
  const by = new Map();
  for (const [key, span] of Object.entries(report.owner?.spans ?? {})) {
    if (!key.startsWith('beat|') || !key.includes(' · QUIET') || (span.max ?? 0) < BEAT_LAW_QUIET_MS) {
      continue;
    }
    const beat = key.slice('beat|'.length).split(' · ')[0];
    const known = by.get(beat) ?? {n: 0, max: 0, tables: []};
    known.n += span.n ?? 0;
    known.max = Math.max(known.max, span.max ?? 0);
    for (const table of span.tables ?? []) {
      if (known.tables.length < 4 && !known.tables.includes(table)) {
        known.tables.push(table);
      }
    }
    by.set(beat, known);
  }
  return [...by.entries()].sort((a, b) => b[1].max - a[1].max).map(([beat, v]) => [beat, v.n, Math.round(v.max), v.tables]);
}

/**
 * Does the run pass the bar's gate: no episode left uncured, no defect class the earlier run did not have — and the
 * one-owner law and the beat law at zero (where the walks carried their measure).
 */
/**
 * THE WHOLE GAMES (FREEZE ZERO, stage 6 — the autopilot: `tests/client/bottle/autopilot.ts`,
 * `tests/e2e/console-autopilot.spec.ts`). A game writes how it ended beside its classes (`autopilot` in its file); the
 * stage's number is read off these: N whole games, every one to its final scoring — or to the pilot's own cap, said —
 * with no episode and no rebuild. `undefined` when the run played no whole game (a monkey's pass, the e2e suite).
 *
 * THE DOOR's SHARE is the honest side-number: a question the pilot could not answer on the screen within its budget
 * is answered through the server's door, as a second device would — the game goes on, and the share says how much of
 * the play the SCREEN served.
 */
/** How many answers through the door at ONE screen of one game are «a screen that could not be answered». */
export const DOOR_STUCK_AT = 3;

/**
 * The SCREEN a door's row stood under — its frames and its bar (`… · frames <frames> · bar «…»[ · grey <key>]`), the
 * question, the generation, the owner's word and what followed the gesture taken out. `undefined` for a row that
 * names no screen.
 */
export function doorScreenOf(door) {
  const row = String(door);
  const from = row.indexOf('frames ');
  if (from < 0) {
    return undefined;
  }
  const ends = [row.indexOf(' → after the gesture', from), row.indexOf(' · owner «', from)].filter((i) => i >= 0);
  return row.slice(from, ends.length > 0 ? Math.min(...ends) : undefined).trim();
}

export function aggregateAutopilot(files) {
  const last = new Map();
  for (const f of files) {
    if (f.autopilot === undefined) {
      continue;
    }
    const key = `${f.file}::${f.title}`;
    const known = last.get(key);
    if (known === undefined || (f.retry ?? 0) >= (known.retry ?? 0)) {
      last.set(key, f);
    }
  }
  if (last.size === 0) {
    return undefined;
  }
  const sum = (row) => Object.values(row ?? {}).reduce((a, n) => a + Number(n ?? 0), 0);
  const out = {games: 0, finished: 0, capped: [], stuck: [], rebuilds: 0, doorStuck: [], presses: 0, byUi: 0, byApi: 0, passes: {ui: 0, api: 0}, playMin: 0, doors: [], log: [],
    cards: [], weather: {games: 0, faults: 0, submits: 0, said: 0}, slow: {games: 0, frames: 0}, shapes: [], types: undefined};
  // THE QUESTIONS' SHAPES the screen answered (a type × the server's markers), summed — and the input TYPES among them
  // against the ones the server declares (`common/input/PlayerInputType.ts` — read from the source, so a new type
  // is a new row of the denominator the day it is added).
  const shapes = new Map();
  // …and the response TYPES the screen sent (a composer's batch included — its sub-answers never stand alone).
  const sent = new Map();
  // THE CARDS THE PILOT PLAYED through the console (the viewer's tableau at each game's end), summed — an axis of the
  // coverage whose denominator is the cards in scope (`--cards <file>` writes the set for the scope's own reader).
  const cards = new Map();
  // THE LOG OF THE GAMES — every class of line a page said in a whole game (a warning, an error, a page error, an
  // HTTP answer ≥ 400), summed: how often, in how many games, and the first game that said it.
  const book = new Map();
  // WHERE THE DOOR ANSWERED — the seat's question, the frames that stood, the bar it was offered (the generation
  // taken out: the same place in two games is one row). A question the screen cannot be WALKED TO is answered here
  // for the seat, and the game «finishes»: the rows are the worklist the pilot's own budget hides (the Colonies
  // opened over a sitting — a loop no press left, named by no net, 2026-11-24).
  const doors = new Map();
  for (const f of [...last.values()].sort((a, b) => `${a.file}${a.title}`.localeCompare(`${b.file}${b.title}`))) {
    const a = f.autopilot;
    out.games++;
    out.presses += Number(a.presses ?? 0);
    // A REBUILD IS READ OFF THE PAGE (stage M — A6): the bottle's driver counts the rebuilds it was asked for, the real
    // browser's files no such field — its report printed «rebuilds 0» two lines under «episodes 2 (rebuilt 2)» (run
    // 46144276012). What the PAGE said is the count both worlds have — a `session-rebuild` record of its own, or (the
    // shape a real page files) a stall's episode that ENDED in the rebuild: its outcome, the line that spoke inside it.
    // The largest of the three words is the game's, never their sum.
    const isRebuild = (cls) => String(cls).startsWith('session-rebuild/');
    const rebuiltBySaying = (f.records ?? []).filter((r) => isRebuild(r.cls)).reduce((n, r) => n + Number(r.count ?? 1), 0);
    const rebuiltByEnding = (f.records ?? []).filter((r) => r.episode !== undefined && (r.episode.outcome === 'rebuilt' || (r.episode.nets ?? []).some((inner) => isRebuild(inner.cls)))).length;
    out.rebuilds += Math.max(Number(a.rebuilds ?? 0), rebuiltBySaying, rebuiltByEnding);
    out.byUi += sum(a.byUi);
    out.byApi += sum(a.byApi);
    out.passes.ui += Number(a.passes?.ui ?? 0);
    out.passes.api += Number(a.passes?.api ?? 0);
    out.playMin += Math.round(Number(a.tookMs ?? 0) / 60_000);
    for (const line of a.log ?? []) {
      const row = book.get(line.key) ?? {key: line.key, type: line.type, n: 0, games: new Set(), first: `${f.title} at ${Math.round(Number(line.atMs ?? 0) / 1000)} s · ${line.stood ?? ''}`};
      row.n += Number(line.n ?? 0);
      row.games.add(f.title);
      book.set(line.key, row);
    }
    for (const name of a.cards ?? []) {
      cards.set(name, (cards.get(name) ?? 0) + 1);
    }
    for (const [shape, n] of Object.entries(a.shapes ?? {})) {
      shapes.set(shape, (shapes.get(shape) ?? 0) + Number(n ?? 0));
    }
    for (const [type, n] of Object.entries(a.sent ?? {})) {
      sent.set(type, (sent.get(type) ?? 0) + Number(n ?? 0));
    }
    if (Number(a.slow ?? 1) > 1) {
      out.slow.games++;
      out.slow.frames += Number(a.slowFrames ?? 0);
    }
    if (a.weather !== undefined) {
      out.weather.games++;
      out.weather.faults += Number(a.weather.faults ?? 0);
      out.weather.submits += Number(a.weather.submits ?? 0);
      out.weather.said += Number(a.weather.said ?? 0);
    }
    /*
     * THE DOOR UNDER ONE SCREEN (stage M — A1). The door answers a question the walk did not get through, «as a second
     * device would», and the game goes on. When it answers again and again AT ONE UNCHANGED SCREEN — the same frames,
     * the same bar, whatever the question — the screen is not being walked around: it cannot be answered. CI's browser
     * game 632 stood on «Парламент · A Выполняется…» from generation 4 to the cap, twenty-four questions through the
     * door, and was a clean game by every count. Three at one screen in one game is the freeze's own signature (or a
     * layout the pilot has no hands for — a finding too): named, and the gate refuses it.
     */
    const screens = new Map();
    for (const door of a.doors ?? []) {
      const where = String(door).replace(/ · gen \d+/, '');
      const row = doors.get(where) ?? {where, n: 0, games: new Set()};
      row.n++;
      row.games.add(f.title);
      doors.set(where, row);
      const screen = doorScreenOf(door);
      if (screen !== undefined) {
        screens.set(screen, (screens.get(screen) ?? 0) + 1);
      }
    }
    const seeded = `${f.title}${f.monkey?.seed !== undefined ? ` (${f.monkey.seed})` : ''}`;
    for (const [screen, n] of screens) {
      if (n >= DOOR_STUCK_AT) {
        out.doorStuck.push(`${seeded} — the door answered ${n}× under «${screen}»`);
      }
    }
    const where = `${seeded} — generation ${a.generation ?? '?'}, ${a.phase ?? '?'}, ${a.presses ?? '?'} presses`;
    if (a.end === 'finished') {
      out.finished++;
    } else if (a.end === 'stuck') {
      out.stuck.push(where);
    } else {
      out.capped.push(where);
    }
  }
  out.shapes = [...shapes.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([shape, n]) => ({shape, n}));
  if (shapes.size > 0) {
    const reach = reachableInputTypes();
    const declared = reach.reachable;
    const answered = new Set([...shapes.keys()].map((s) => s.replace(/\[.*$/, '').replace(/^or:menu$/, 'or')));
    // (A type the screen SENT inside a batch is answered on the screen too.)
    for (const type of sent.keys()) {
      answered.add(type);
    }
    out.types = {declared: declared.length, answered: declared.filter((type) => answered.has(type)).length, never: declared.filter((type) => !answered.has(type)),
      excluded: reach.excluded};
  }
  out.cards = [...cards.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([name, games]) => ({name, games}));
  out.doors = [...doors.values()].sort((x, y) => y.n - x.n || x.where.localeCompare(y.where)).map((row) => ({where: row.where, n: row.n, games: row.games.size}));
  out.log = [...book.values()].sort((x, y) => y.games.size - x.games.size || y.n - x.n || x.key.localeCompare(y.key))
    .map((row) => ({key: row.key, type: row.type, n: row.n, games: row.games.size, first: row.first}));
  return out;
}

/**
 * THE INPUT TYPES A TABLE OF THE PREMIUM SCOPE CAN BE ASKED — the denominator, derived from the code (the owner,
 * 2026-11-26: «оси покрытия со знаменателями из кода»). A type is DECLARED by `common/input/PlayerInputType.ts`; it is
 * SENT by a server input whose `toModel()` writes `type: '<it>'`; it is REACHABLE when some file constructs that input
 * outside the card directories of modules the premium scope leaves out (`common/cards/premiumScope.ts` — a table the
 * autopilot creates never deals them) and outside a classic card the Redux set REPLACES (`turmoilReduxReplacements.ts`
 * — under Redux the classic is never dealt). A type no input sends, or only an out-of-scope one, is EXCLUDED — by name,
 * with its reason, in the report (never a silent shrink of the bar). A helper of the engine counts as in scope whoever
 * calls it: the scan errs toward a larger denominator, never a smaller one.
 */
export const OUT_OF_SCOPE_CARD_DIRS = ['ceos', 'community', 'moon', 'pathfinders', 'starwars', 'underworld'];
/** …and the ENGINE directories of those modules (`src/server/<dir>/` — the Moon's, the Pathfinders', the Underworld's). */
export const OUT_OF_SCOPE_ENGINE_DIRS = ['moon', 'pathfinders', 'underworld'];

function serverSources(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts')) {
        out.push({file: path.relative(root, full).split(path.sep).join('/'), text: fs.readFileSync(full, 'utf8')});
      }
    }
  };
  walk(path.join(root, 'src', 'server'));
  return out;
}

/** PURE over the sources: `{reachable, excluded: [{type, why}]}` (see above). */
export function inputTypesReach(declared, sources, replacedClassics) {
  // Who sends what: a class whose own `toModel()` writes the type — and every class that EXTENDS one (an abstract
  // input's concrete subclasses are what the code constructs).
  const parent = new Map();
  for (const s of sources) {
    for (const m of s.text.matchAll(/class (\w+)(?:<[^>{]*>)? extends (\w+)/g)) {
      parent.set(m[1], m[2]);
    }
  }
  const own = new Map();
  for (const s of sources) {
    if (!s.text.includes('toModel(')) {
      continue;
    }
    const classes = [...s.text.matchAll(/export (?:abstract )?class (\w+)/g)].map((m) => m[1]);
    for (const m of s.text.matchAll(/\btype: '([a-zA-Z]+)'/g)) {
      if (declared.includes(m[1])) {
        classes.forEach((c) => own.set(c, new Set([...(own.get(c) ?? []), m[1]])));
      }
    }
  }
  const senders = new Map();
  for (const c of new Set([...parent.keys(), ...own.keys()])) {
    for (let at = c, depth = 0; at !== undefined && depth < 8; at = parent.get(at), depth++) {
      for (const type of own.get(at) ?? []) {
        senders.set(type, new Set([...(senders.get(type) ?? []), c]));
      }
    }
  }
  const outOfScope = (s) => {
    const dir = /^src\/server\/cards\/([^/]+)\//.exec(s.file)?.[1];
    if (dir !== undefined && OUT_OF_SCOPE_CARD_DIRS.includes(dir)) {
      return `the ${dir} cards`;
    }
    const engine = /^src\/server\/([^/]+)\//.exec(s.file)?.[1];
    if (engine !== undefined && OUT_OF_SCOPE_ENGINE_DIRS.includes(engine)) {
      return `the ${engine} engine`;
    }
    const name = /name: CardName\.(\w+)/.exec(s.text)?.[1];
    if (dir === 'turmoil' && name !== undefined && replacedClassics.includes(name)) {
      return `the classic ${name} (the Redux set replaces it)`;
    }
    return undefined;
  };
  const reachable = [];
  const excluded = [];
  for (const type of declared) {
    const classes = [...(senders.get(type) ?? [])];
    if (classes.length === 0) {
      excluded.push({type, why: 'no server input sends it'});
      continue;
    }
    const builders = sources.filter((s) => classes.some((c) => s.text.includes(`new ${c}(`)));
    const inScope = builders.filter((s) => outOfScope(s) === undefined);
    if (inScope.length > 0) {
      reachable.push(type);
    } else {
      const whys = [...new Set(builders.map(outOfScope).filter((w) => w !== undefined))];
      excluded.push({type, why: whys.length > 0 ? `only ${whys.join(', ')}` : 'nothing constructs its input'});
    }
  }
  return {reachable, excluded};
}

/** The reach of THIS checkout (empty when the sources are absent — a report read elsewhere). */
function reachableInputTypes() {
  try {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const typeSource = fs.readFileSync(path.join(root, 'src', 'common', 'input', 'PlayerInputType.ts'), 'utf8');
    const declared = [...typeSource.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
    const replacements = fs.readFileSync(path.join(root, 'src', 'common', 'cards', 'turmoilReduxReplacements.ts'), 'utf8');
    const replaced = [...replacements.matchAll(/classic: CardName\.(\w+)/g)].map((m) => m[1]);
    return inputTypesReach(declared, serverSources(root), replaced);
  } catch {
    return {reachable: [], excluded: []};
  }
}

export function renderAutopilot(a) {
  if (a === undefined) {
    return '';
  }
  const answered = a.byUi + a.byApi;
  const L = ['', `── THE WHOLE GAMES — ${a.games} game(s): ${a.finished} to the final scoring · ${a.capped.length} capped · ${a.stuck.length} STUCK · rebuilds ${a.rebuilds} ──`];
  L.push(`   ${a.presses} presses, ${a.playMin} min of play · answered on the screen ${a.byUi} · through the door ${a.byApi}` +
    `${answered > 0 ? ` (${pct(a.byApi, answered)} % of the answers)` : ''} · passes ${a.passes.ui} by the wheel / ${a.passes.api} by the door`);
  if (a.types !== undefined) {
    L.push(`   question shapes answered on the screen: ${a.shapes.length} distinct · input types ${a.types.answered} of ${a.types.declared}` +
      `${a.types.never.length > 0 ? ` — never: ${a.types.never.join(', ')}` : ''}`);
    if ((a.types.excluded ?? []).length > 0) {
      L.push(`   input types out of the bar: ${a.types.excluded.map((x) => `${x.type} (${x.why})`).join(' · ')}`);
    }
  }
  if ((a.cards ?? []).length > 0) {
    L.push(`   cards played through the console: ${a.cards.length} distinct · the weather: ${a.weather.games} storm game(s), ` +
      `${a.weather.faults} fault(s) over ${a.weather.submits} submit(s), ${a.weather.said} line(s) the page said of them · ` +
      `the slow machine: ${a.slow?.games ?? 0} game(s), ${a.slow?.frames ?? 0} long frame(s) — the machine's, booked apart`);
  }
  for (const game of a.stuck) {
    L.push(`   STUCK   ${game}`);
  }
  for (const game of a.capped) {
    L.push(`   capped  ${game}`);
  }
  for (const game of a.doorStuck ?? []) {
    L.push(`   THE DOOR UNDER ONE SCREEN  ${game}`);
  }
  if ((a.doors ?? []).length > 0) {
    L.push(`   THE DOOR ANSWERED — where the seat stood (${a.doors.length} place(s); a question the screen cannot be walked to hides here):`);
    for (const door of a.doors.slice(0, 24)) {
      L.push(`   ${String(door.n).padStart(4)}× in ${String(door.games).padStart(2)} game(s)  ${door.where}`);
    }
  }
  if ((a.log ?? []).length > 0) {
    L.push(`   THE LOG — ${a.log.length} class(es) of line the pages said (a clean game says none):`);
    for (const line of a.log.slice(0, 40)) {
      L.push(`   ${String(line.n).padStart(5)}× in ${String(line.games).padStart(3)} game(s)  ${line.key}`);
      L.push(`          first: ${line.first}`);
    }
  }
  return L.join('\n');
}

export function gateVerdict(report, diff, opts = {}) {
  const reasons = [];
  /*
   * THE DENOMINATOR (stage M — the audit of 2026-11-28, A7): a pass is judged only when it is WHOLE. An empty
   * directory, a shard that died, a results file cut short and a game whose harness threw each read «GATE: pass»
   * (proven with synthetic passes) — a pass that measured nothing agreed with every bar. `opts.expect` is the number
   * of tests the pass asked for (the workflow knows it: the games it dealt, the tables it walks).
   */
  const tests = report.totals?.tests;
  if (tests === 0) {
    reasons.push('no test left a file — nothing was measured');
  } else if (opts.expect !== undefined && tests !== undefined && tests < opts.expect) {
    reasons.push(`the pass is not whole — ${tests} of the ${opts.expect} test(s) it asked for left a file: a shard that died is not a shard that passed`);
  }
  if ((report.unreadable ?? []).length > 0) {
    reasons.push(`${report.unreadable.length} file(s) of the pass could not be read (cut short, or not a report): ${report.unreadable.slice(0, 8).join(', ')}`);
  }
  if ((report.totals?.thrown ?? []).length > 0) {
    reasons.push(`the harness threw in ${report.totals.thrown.length} test(s) — nothing of them was measured: ${report.totals.thrown.slice(0, 8).join(', ')}`);
  }
  // THE ZERO BAR (`--zero`): nothing at all — no record of any tier, no door, no routed press, no line in the log.
  if (opts.zero === true) {
    const classes = Object.entries(report.classes ?? {});
    if (classes.length > 0) {
      reasons.push(`ZERO: ${report.totals.records} record(s) of ${classes.length} class(es) — ` +
        classes.sort((a, b) => b[1].records - a[1].records).slice(0, 12).map(([cls, c]) => `${cls} ×${c.records} (${c.tier})`).join(', '));
    }
    const a = report.autopilot;
    if (a !== undefined) {
      if (a.byApi > 0 || a.passes.api > 0) {
        reasons.push(`ZERO: ${a.byApi} answer(s) and ${a.passes.api} pass(es) went through the door (${(a.doors ?? []).length} place(s))`);
      }
      if ((a.log ?? []).length > 0) {
        reasons.push(`ZERO: the log is not clean — ${a.log.length} class(es) of line: ` + a.log.slice(0, 10).map((line) => `«${line.key}» ×${line.n}`).join(', '));
      }
    }
    const rows = report.owner?.rows ?? {};
    const routed = Object.entries(rows).flatMap(([row, verdicts]) => Object.entries(verdicts).filter(([verdict]) => /fallback|APART|MISS|EXTRA|disagree/.test(verdict)).map(([verdict, n]) => `${row} ${verdict} ×${n}`));
    if (routed.length > 0) {
      reasons.push(`ZERO: the one-owner measure is not at zero — ${routed.slice(0, 10).join(', ')}`);
    }
  }
  if (report.totals.notCured > 0) {
    reasons.push(`${report.totals.notCured} episode(s) were never cured`);
  }
  // THE WHOLE GAMES' OWN BAR (stage 6): a game nobody could move is the freeze itself; a rebuild is the last line
  // taken — in a whole game played by the rules of the screen neither may happen once.
  if (report.autopilot !== undefined && report.autopilot.stuck.length > 0) {
    reasons.push(`${report.autopilot.stuck.length} whole game(s) STUCK: ${report.autopilot.stuck.join('; ')}`);
  }
  if (report.autopilot !== undefined && report.autopilot.rebuilds > 0) {
    reasons.push(`${report.autopilot.rebuilds} rebuild(s) in whole games — the last line was taken`);
  }
  // A CAPPED GAME IS NOT A GAME THAT WAS PLAYED, and a door that answers under one screen is a screen that cannot be
  // answered (stage M — A1: game 632 was both, and a clean game by every count the gate read).
  if (report.autopilot !== undefined && report.autopilot.capped.length > 0) {
    reasons.push(`${report.autopilot.capped.length} whole game(s) ended on the pilot's cap, not on the final scoring: ${report.autopilot.capped.join('; ')}`);
  }
  if (report.autopilot !== undefined && (report.autopilot.doorStuck ?? []).length > 0) {
    reasons.push(`the door answered three times or more under ONE screen in ${report.autopilot.doorStuck.length} game(s) — a screen that could not be answered: ` +
      report.autopilot.doorStuck.join('; '));
  }
  if (diff !== undefined && diff.newClasses.length > 0) {
    reasons.push(`${diff.newClasses.length} NEW defect class(es): ${diff.newClasses.join(', ')}`);
  }
  for (const [verdict, n, what] of ownerLawBroken(report)) {
    reasons.push(`the one-owner law — ${verdict} ×${n}: ${what} (the report's «THE ONE FUNCTION» section names the tables)`);
  }
  for (const [beat, n, max, tables] of beatLawBroken(report)) {
    reasons.push(`the beat law — «${beat}» stood ${max} ms with nothing in flight under it (×${n}): a stall, or a pause nobody declared — ` +
      `write it as a \`span\` / a ceiling wait [${tables.join(', ')}]`);
  }
  return {pass: reasons.length === 0, reasons};
}

export function renderReport(report, diff) {
  const L = [];
  const t = report.totals;
  L.push(`MONKEY REPORT — ${t.tests} test(s) with a file${t.walks > 0 ? `, ${t.walks} walk(s), ${t.presses} presses` : ''}`);
  L.push(`records ${t.records} · of them defects ${t.defects} · episodes ${t.episodes}` +
    `${t.episodes > 0 ? ` (${Object.entries(t.outcomes).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''} · NEVER CURED ${t.notCured}`);
  if (t.faults !== undefined) {
    // THE WIRE BROKE ON PURPOSE (stage 4): what the walks took. The fault's own word is filed `info`; a defect class
    // of this pass is the product not unwinding from a broken request (`fault/standing-screen/…` — a screen left standing).
    const taken = Object.entries(t.faults).sort((a, b) => b[1] - a[1]);
    L.push(`THE WIRE'S FAULTS — ${taken.reduce((a, [, n]) => a + n, 0)} taken: ${taken.map(([k, n]) => `${k} ×${n}`).join(' · ')}`);
  }
  const rows = Object.entries(report.classes).sort((a, b) => b[1].tests - a[1].tests || b[1].records - a[1].records || a[0].localeCompare(b[0]));
  for (const tier of ['defect', 'planned', 'info']) {
    const of = rows.filter(([, c]) => c.tier === tier);
    if (of.length === 0) {
      continue;
    }
    L.push('');
    L.push(`── ${tier.toUpperCase()} classes (${of.length}) ──`);
    for (const [cls, c] of of) {
      const outcomes = Object.entries(c.outcomes).map(([k, v]) => `${k} ${v}`).join(', ');
      // (A class read at two tiers says so: «2 rec» of a defect class may be one defect and one honest wait.)
      const mixed = Object.keys(c.tiers ?? {}).length > 1 ? `   {${Object.entries(c.tiers).map(([k, v]) => `${k} ${v}`).join(', ')}}` : '';
      L.push(`${String(c.tests).padStart(4)} test(s) ${String(c.records).padStart(5)} rec  ${cls}${mixed}${outcomes !== '' ? `   [${outcomes}; worst ${c.worstStoodS}s]` : ''}`);
      if (tier === 'defect' && c.first !== undefined) {
        L.push(`       first: ${c.first.file} › ${c.first.title}${c.first.seed !== undefined ? `  (seed ${c.first.seed})` : ''}`);
      }
    }
  }
  L.push('');
  L.push('── the fires of every net (by shape) ──');
  for (const [shape, n] of Object.entries(report.nets).sort((a, b) => b[1].records - a[1].records || a[0].localeCompare(b[0]))) {
    L.push(`${String(n.records).padStart(5)} rec ${String(n.lines).padStart(6)} lines  ${String(n.tests).padStart(4)} test(s)  ${n.per1000Presses === null || n.per1000Presses === undefined ? '' : `${String(n.per1000Presses).padStart(7)} / 1000 presses  `}${shape} (${n.tier})`);
  }
  if (diff !== undefined) {
    L.push('');
    L.push(`── against the earlier run: ${diff.newClasses.length} NEW · ${diff.goneClasses.length} gone · ${diff.kept.length} kept ──`);
    for (const cls of diff.newClasses) {
      L.push(`  NEW   ${cls}`);
    }
    for (const cls of diff.goneClasses) {
      L.push(`  gone  ${cls}`);
    }
  }
  return L.join('\n');
}

function main(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i < 0 ? undefined : (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
  };
  // (A flag's value is not a positional.)
  const values = new Set(['against', 'out', 'expect'].map((n) => flag(n)).filter((v) => typeof v === 'string'));
  const zero = argv.includes('--zero');
  const dir = positional.find((p) => !values.has(p));
  const expect = typeof flag('expect') === 'string' ? Number(flag('expect')) : undefined;
  if (dir === undefined || !fs.existsSync(dir) || (expect !== undefined && !(Number.isInteger(expect) && expect > 0))) {
    console.error('usage: node scripts/monkey-report.mjs <test-results dir> [--against <monkey-report.json>] [--out <file>] [--gate] [--zero] [--expect <tests the pass asked for>]');
    return 2;
  }
  // A FILE THAT CANNOT BE READ IS A FILE OF THE PASS (stage M): it was dropped in silence — a report cut short by a
  // dying shard left no trace in the sum. It is named, and the gate refuses the pass.
  const unreadable = [];
  const files = findCauseFiles(dir).map((f) => {
    try {
      const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.records)) {
        throw new Error('not a cause-classes file');
      }
      return parsed;
    } catch {
      unreadable.push(path.relative(dir, f).replace(/\\/g, '/'));
      return undefined;
    }
  }).filter((f) => f !== undefined);
  const coverage = aggregateCoverage(files, flowUniverse().flows);
  const owner = aggregateOwner(files);
  const autopilot = aggregateAutopilot(files);
  const report = {at: new Date().toISOString(), dir: path.resolve(dir), ...aggregateCauseFiles(files), ...(coverage !== undefined ? {coverage} : {}), ...(owner !== undefined ? {owner} : {}),
    ...(autopilot !== undefined ? {autopilot} : {}), ...(unreadable.length > 0 ? {unreadable} : {}), ...(expect !== undefined ? {expect} : {})};
  const against = flag('against');
  let diff;
  if (typeof against === 'string') {
    try {
      diff = compareReports(report, JSON.parse(fs.readFileSync(against, 'utf8')));
    } catch (err) {
      console.error(`the earlier report could not be read (${against}): ${err.message}`);
      return 2;
    }
  }
  // BOTH VERDICTS ARE THE REPORT's, always (stage M — A5): the gate's and the ZERO bar's are written into the file and
  // printed whatever flag was passed — the owner's bar was a flag no workflow passed, so no run ever said how far
  // from it a pass stood. The exit code is the bar that was asked for.
  const gate = gateVerdict(report, diff, {expect});
  const zeroBar = gateVerdict(report, diff, {zero: true, expect});
  const out = typeof flag('out') === 'string' ? flag('out') : path.join(dir, 'monkey-report.json');
  fs.writeFileSync(out, JSON.stringify({...report, ...(diff !== undefined ? {diff} : {}), verdicts: {gate, zero: zeroBar}}, null, 1));
  console.log(renderReport(report, diff));
  if (autopilot !== undefined) {
    console.log(renderAutopilot(autopilot));
  }
  console.log(renderCoverage(coverage));
  console.log(renderOwner(owner));
  console.log(`\n→ ${out}`);
  if (flag('gate') === true || zero) {
    const verdict = zero ? zeroBar : gate;
    console.log(verdict.pass ? '\nGATE: pass' : `\nGATE: FAIL — ${verdict.reasons.join('; ')}`);
    if (!zero) {
      console.log(zeroBar.pass ? 'THE ZERO BAR: pass' : `THE ZERO BAR: FAIL (${zeroBar.reasons.length} reason(s)) — ${zeroBar.reasons.join('; ')}`);
    }
    return verdict.pass ? 0 : 3;
  }
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
