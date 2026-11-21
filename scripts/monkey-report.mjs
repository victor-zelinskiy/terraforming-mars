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
 * Writes `<test-results dir>/monkey-report.json` (or `--out`) and prints the text.
 */
import * as fs from 'fs';
import * as path from 'path';
import {pathToFileURL} from 'url';
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
  for (const f of [...last.values()].sort((a, b) => `${a.file}${a.title}`.localeCompare(`${b.file}${b.title}`))) {
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
  // THE DERIVATION, HELD AGAINST EVERY RENDER (stage 2 ③): each prompt surface's condition of today beside «the function
  // says this owner serves» — the differences as spans (how often, how long), by surface.
  const eqSurfaces = Object.keys(owner.rows ?? {}).filter((shape) => shape.startsWith('eq:')).map((shape) => shape.slice(3)).sort();
  if (eqSurfaces.length > 0) {
    const spanRows = Object.entries(owner.spans ?? {}).filter(([key]) => !key.startsWith('opening|')).sort((x, y) => y[1].ms - x[1].ms || y[1].n - x[1].n);
    const total = spanRows.reduce((a, [, v]) => a + v.n, 0);
    const both = eqSurfaces.reduce((a, surface) => a + (owner.rows[`eq:${surface}`]['eq-both'] ?? 0), 0);
    L.push(`THE DERIVATION — ${eqSurfaces.length} surface(s), ${both} render(s) standing by both: ${total} difference span(s)` +
      (Object.keys(owner.open ?? {}).some((k) => !k.startsWith('opening|')) ? ` · STILL OPEN at the walk's end: ${Object.entries(owner.open).filter(([k]) => !k.startsWith('opening|')).map(([k, n]) => `${k} ×${n}`).join(' · ')}` : ''));
    for (const [key, v] of spanRows.slice(0, 60)) {
      const [surface, ...rest] = key.split('|');
      L.push(`  ${surface.padEnd(14)} ${String(v.n).padStart(5)}×  ${String(Math.round(v.ms)).padStart(7)} ms in all · longest ${String(Math.round(v.max)).padStart(6)} ms  ${rest.join('|')}   [${v.tables.join(', ')}]`);
    }
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
 * Does the run pass the bar's gate: no episode left uncured, no defect class the earlier run did not have — and the
 * one-owner law at zero (where the walks carried its measure).
 */
export function gateVerdict(report, diff) {
  const reasons = [];
  if (report.totals.notCured > 0) {
    reasons.push(`${report.totals.notCured} episode(s) were never cured`);
  }
  if (diff !== undefined && diff.newClasses.length > 0) {
    reasons.push(`${diff.newClasses.length} NEW defect class(es): ${diff.newClasses.join(', ')}`);
  }
  for (const [verdict, n, what] of ownerLawBroken(report)) {
    reasons.push(`the one-owner law — ${verdict} ×${n}: ${what} (the report's «THE ONE FUNCTION» section names the tables)`);
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
  const values = new Set(['against', 'out'].map((n) => flag(n)).filter((v) => typeof v === 'string'));
  const dir = positional.find((p) => !values.has(p));
  if (dir === undefined || !fs.existsSync(dir)) {
    console.error('usage: node scripts/monkey-report.mjs <test-results dir> [--against <monkey-report.json>] [--out <file>] [--gate]');
    return 2;
  }
  const files = findCauseFiles(dir).map((f) => {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {
      return undefined;
    }
  }).filter((f) => f !== undefined);
  const coverage = aggregateCoverage(files, flowUniverse().flows);
  const owner = aggregateOwner(files);
  const report = {at: new Date().toISOString(), dir: path.resolve(dir), ...aggregateCauseFiles(files), ...(coverage !== undefined ? {coverage} : {}), ...(owner !== undefined ? {owner} : {})};
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
  const out = typeof flag('out') === 'string' ? flag('out') : path.join(dir, 'monkey-report.json');
  fs.writeFileSync(out, JSON.stringify({...report, ...(diff !== undefined ? {diff} : {})}, null, 1));
  console.log(renderReport(report, diff));
  console.log(renderCoverage(coverage));
  console.log(renderOwner(owner));
  console.log(`\n→ ${out}`);
  if (flag('gate') === true) {
    const verdict = gateVerdict(report, diff);
    console.log(verdict.pass ? '\nGATE: pass' : `\nGATE: FAIL — ${verdict.reasons.join('; ')}`);
    return verdict.pass ? 0 : 3;
  }
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
