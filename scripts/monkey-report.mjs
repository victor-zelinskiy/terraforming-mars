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
  const row = (cls, tier) => classes[cls] ?? (classes[cls] = {tier, shape: shapeOfClass(cls), tests: 0, records: 0, lines: 0, outcomes: {}, worstStoodS: 0, first: undefined});
  const net = (shape, tier) => nets[shape] ?? (nets[shape] = {tier, records: 0, lines: 0, tests: 0});
  for (const f of [...last.values()].sort((a, b) => `${a.file}${a.title}`.localeCompare(`${b.file}${b.title}`))) {
    if (f.monkey !== undefined) {
      totals.walks++;
      totals.presses += Number(f.monkey.presses ?? 0);
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
      c.first ??= {file: f.file, title: f.title, seed: f.monkey?.seed, atMs: r.atMs, line: r.title, dims: r.dims};
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
  for (const [kind, universe] of Object.entries(machines)) {
    const made = new Set();
    for (const key of keys) {
      const m = new RegExp(`^state ${kind}(?::[^ ]*)? (.+ → .+)$`).exec(key);
      if (m !== null) {
        made.add(m[1]);
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

/** Does the run pass the bar's gate: no episode left uncured, no defect class the earlier run did not have. */
export function gateVerdict(report, diff) {
  const reasons = [];
  if (report.totals.notCured > 0) {
    reasons.push(`${report.totals.notCured} episode(s) were never cured`);
  }
  if (diff !== undefined && diff.newClasses.length > 0) {
    reasons.push(`${diff.newClasses.length} NEW defect class(es): ${diff.newClasses.join(', ')}`);
  }
  return {pass: reasons.length === 0, reasons};
}

export function renderReport(report, diff) {
  const L = [];
  const t = report.totals;
  L.push(`MONKEY REPORT — ${t.tests} test(s) with a file${t.walks > 0 ? `, ${t.walks} walk(s), ${t.presses} presses` : ''}`);
  L.push(`records ${t.records} · of them defects ${t.defects} · episodes ${t.episodes}` +
    `${t.episodes > 0 ? ` (${Object.entries(t.outcomes).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''} · NEVER CURED ${t.notCured}`);
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
      L.push(`${String(c.tests).padStart(4)} test(s) ${String(c.records).padStart(5)} rec  ${cls}${outcomes !== '' ? `   [${outcomes}; worst ${c.worstStoodS}s]` : ''}`);
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
  const report = {at: new Date().toISOString(), dir: path.resolve(dir), ...aggregateCauseFiles(files), ...(coverage !== undefined ? {coverage} : {})};
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
