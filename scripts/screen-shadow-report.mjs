#!/usr/bin/env node
/*
 * screen-shadow-report — the SCREEN SHADOW of a whole e2e run (phase 0 of the screen director,
 * `src/client/console/screenDirector.ts` — «who must serve the server's question» for the whole console).
 *
 * Two sources the harness files per test (`tests/e2e/consoleTest.ts` `screenShadowHarvest`):
 *  · `<outputDir>/screen-shadow/*.json` — the FINDINGS (`[screen-shadow]` lines);
 *  · `<outputDir>/screen-shadow-judged.jsonl` — HOW THE SHADOW LOOKED (every test, findings or not): the passes judged,
 *    the verdicts, the holds and beats that explained a wait (with the longest unbroken run of each), who served each
 *    prompt shape.
 * A remote run pulls both into `.e2e-remote/<task>/test-results/` (the timing pass under `test-results/timing/`).
 *
 *   node scripts/screen-shadow-report.mjs <task | test-results dir> [more…] [--detail] [--write-evidence <file>]
 *
 * Several arguments are merged (a whole suite split into parts). The report ends with the TABLE'S COVERAGE: every row
 * of `expectedScreenOwners` the suite never judged (unverified), and every row whose expected owners were never all
 * observed (a candidate to tighten before a cure trusts it).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const evidenceAt = process.argv.indexOf('--write-evidence');
const evidenceOut = evidenceAt === -1 ? undefined : process.argv[evidenceAt + 1];
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--write-evidence');
const detail = process.argv.includes('--detail');
if (args.length === 0) {
  console.error('usage: node scripts/screen-shadow-report.mjs <task | test-results dir> [more…] [--detail]');
  process.exit(2);
}
const roots = [];
for (const arg of args) {
  const base = fs.existsSync(arg) ? arg : path.join('.e2e-remote', arg, 'test-results');
  for (const dir of [base, path.join(base, 'timing')]) {
    if (fs.existsSync(dir)) {
      roots.push(dir);
    }
  }
}
if (roots.length === 0) {
  console.log(`nothing to read for ${args.join(', ')}`);
  process.exit(0);
}

// ── findings ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const groups = new Map();
/** STEP 4, prepared: the cure lines (`[screen-shadow] cure-plan …` — a dry run; `[screen-shadow] cure …` — applied). */
const cures = new Map();
/** The specs that put a defect in ON PURPOSE (the positive controls) — their findings and cures are expected. */
const DELIBERATE = new Set(['console-screen-shadow-control.spec.ts', 'console-screen-director-cure.spec.ts']);
const label = (rec) => `${rec.file} › ${rec.title}${rec.retry > 0 ? ` (retry ${rec.retry})` : ''}${DELIBERATE.has(rec.file) ? '  [deliberate — a positive control]' : ''}`;
let findingFiles = 0;
for (const root of roots) {
  const dir = path.join(root, 'screen-shadow');
  if (!fs.existsSync(dir)) {
    continue;
  }
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    findingFiles++;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const line of rec.findings) {
      const cure = /^\[screen-shadow\] (cure-plan|cure) «([^»]*)» by (\w+)/.exec(line);
      if (cure !== null) {
        const key = `${cure[1] === 'cure' ? 'APPLIED' : 'planned (dry run)'} · ${cure[2]} · by ${cure[3]}`;
        const c = cures.get(key) ?? {count: 0, tests: new Set()};
        c.count++;
        c.tests.add(label(rec));
        cures.set(key, c);
        continue;
      }
      const brace = line.indexOf(' {');
      let f = {};
      try {
        f = JSON.parse(line.slice(brace + 1));
      } catch {
        f = {kind: '?', expected: ['?'], present: ['?'], prompt: line.slice(0, 120)};
      }
      const shape = String(f.prompt ?? '').replace(/#\d*$/, '');
      const present = (f.present ?? []).join('|') || 'nothing';
      const key = `${f.kind} · ${shape} · expected ${(f.expected ?? []).join('|')} → on screen ${present}${f.cure !== undefined ? ` · ${f.cure}` : ''}`;
      const g = groups.get(key) ?? {count: 0, tests: new Set(), samples: []};
      g.count++;
      g.tests.add(label(rec));
      if (g.samples.length < 3) {
        g.samples.push(line.slice(brace + 1, brace + 1 + 900));
      }
      groups.set(key, g);
    }
  }
}

// ── how the shadow looked ────────────────────────────────────────────────────────────────────────────────────────────
const add = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);
const verdicts = new Map();
const held = new Map();
const heldMaxRun = new Map();
const heldMaxAt = new Map();
const beats = new Map();
const shapes = new Map();
const owners = new Map(); // shape → Map(owner → n)
const shapeTests = new Map(); // shape → Set(file)
const masked = new Map(); // shape → Map(`held:<reason> | <on screen>` → n)
let tests = 0;
let testsJudged = 0;
let judgedTotal = 0;
let noReadout = 0;
for (const root of roots) {
  const file = path.join(root, 'screen-shadow-judged.jsonl');
  if (!fs.existsSync(file)) {
    continue;
  }
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (raw.trim() === '') {
      continue;
    }
    const rec = JSON.parse(raw);
    tests++;
    judgedTotal += rec.judged;
    if (rec.judged > 0) {
      testsJudged++;
    }
    if ((rec.pages ?? []).length === 0) {
      noReadout++;
    }
    for (const p of rec.pages ?? []) {
      const s = p.stats;
      if (s === undefined || s === null) {
        continue;
      }
      for (const [k, n] of Object.entries(s.verdicts)) add(verdicts, k, n);
      for (const [k, n] of Object.entries(s.held)) add(held, k, n);
      for (const [k, n] of Object.entries(s.heldMaxRun)) {
        if (n > (heldMaxRun.get(k) ?? 0)) {
          heldMaxRun.set(k, n);
          heldMaxAt.set(k, `${rec.file} › ${rec.title}`);
        }
      }
      for (const [k, n] of Object.entries(s.beats)) add(beats, k, n);
      for (const [k, n] of Object.entries(s.shapes)) {
        add(shapes, k, n);
        (shapeTests.get(k) ?? shapeTests.set(k, new Set()).get(k)).add(rec.file);
      }
      for (const [shape, row] of Object.entries(s.masked ?? {})) {
        const m = masked.get(shape) ?? masked.set(shape, new Map()).get(shape);
        for (const [k, n] of Object.entries(row)) add(m, k, n);
      }
      for (const [shape, row] of Object.entries(s.owners)) {
        const m = owners.get(shape) ?? owners.set(shape, new Map()).get(shape);
        for (const [o, n] of Object.entries(row)) add(m, o, n);
      }
    }
  }
}
const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);

console.log(`SCREEN SHADOW — ${roots.length} result dir(s)\n`);
console.log(`tests: ${tests} (${testsJudged} with at least one judged pass, ${noReadout} with no readout — a page closed before the harvest)`);
console.log(`judged passes: ${judgedTotal}`);
console.log(`verdicts: ${sorted(verdicts).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
console.log(`\nHELD — reason · passes · longest unbroken run (passes ≈ seconds) · where`);
for (const [k, n] of sorted(held)) {
  console.log(`  ${k.padEnd(22)} ${String(n).padStart(6)}   max run ${String(heldMaxRun.get(k) ?? 0).padStart(4)}   ${heldMaxAt.get(k) ?? ''}`);
}
console.log(`\nBEATS — scene · passes`);
for (const [k, n] of sorted(beats)) {
  console.log(`  ${k.padEnd(22)} ${String(n).padStart(6)}`);
}
console.log(`\nWHO SERVED — prompt shape · passes judged · owners observed (agree passes)`);
for (const [shape, n] of sorted(shapes)) {
  const row = owners.get(shape);
  const seen = row === undefined ? '—' : sorted(row).map(([o, c]) => `${o} ${c}`).join(' · ');
  console.log(`  ${shape.padEnd(28)} ${String(n).padStart(6)}  in ${String(shapeTests.get(shape)?.size ?? 0).padStart(3)} file(s)   ${seen}`);
}

console.log(`
WHAT A WAIT HID — prompt shape · the hold (or beat) · what stood under it (a foreign surface here is a table row to read)`);
for (const [shape] of sorted(shapes)) {
  const row = masked.get(shape);
  if (row === undefined) {
    continue;
  }
  console.log(`  ${shape}`);
  for (const [k, n] of sorted(row)) {
    console.log(`      ${String(n).padStart(6)}  ${k}`);
  }
}

// ── the evidence file (step 2): what served each shape, by basis — the table's rows are guarded against it ─────────
if (evidenceOut !== undefined) {
  const evidence = {
    note: 'Written by scripts/screen-shadow-report.mjs --write-evidence from a whole-suite run; read by tests/console/screenDirector.spec.ts (the evidence gate). Owners by basis: table = the row, serves = a frame\'s serves, host = the flow\'s host, branch = the board under a nested placement.',
    sources: args,
    tests,
    judged: judgedTotal,
    shapes: {},
  };
  for (const [shape, n] of [...shapes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const entry = {judged: n, table: {}, serves: {}, host: {}, branch: {}};
    for (const [key, count] of owners.get(shape) ?? []) {
      const [owner, basis] = key.includes('@') ? key.split('@') : [key, 'table'];
      entry[basis][owner] = (entry[basis][owner] ?? 0) + count;
    }
    evidence.shapes[shape] = entry;
  }
  fs.writeFileSync(evidenceOut, JSON.stringify(evidence, null, 1) + '\n');
  console.log(`\nevidence written: ${evidenceOut} (${Object.keys(evidence.shapes).length} shapes)`);
}

// ── the table's coverage ────────────────────────────────────────────────────────────────────────────────────────────
const src = fs.readFileSync(path.join('src', 'client', 'console', 'screenDirector.ts'), 'utf8');
const block = src.slice(src.indexOf('const EXPECTED'), src.indexOf('\n};', src.indexOf('const EXPECTED')));
const rows = [...block.matchAll(/^ {2}(\w+): \(/gm)].map((m) => [m[1], m[0]]);
const rowText = new Map([...block.matchAll(/^ {2}(\w+): (.*)$/gm)].map((m) => [m[1], m[2]]));
const observedKinds = new Set([...shapes.keys()].map((s) => s.split(':')[0]));
console.log(`\nTHE TABLE'S COVERAGE — ${rows.length} rows`);
const outOfScope = rows.filter(([k]) => /'(free|start|unknown)'/.test(rowText.get(k) ?? '') && !/\[/.test(rowText.get(k) ?? ''));
/**
 * Rows the console never meets as a LIVE prompt today — each with the reason, read off the server's producers (step 1,
 * 2026-11-01). A row here is not «verified»: it is a row the suite cannot reach, and the reason is what to re-check
 * when the scope widens (a held-back Prelude 2 card enters, a composer stops pre-collecting).
 */
const KNOWN_UNREACHABLE = new Map([
  ['composite', 'never asked STANDALONE in scope: every AndOptions is nested in the action menu (the party actions, the colony trade) or routes to its own kind (Stormcraft, the Venus bonus, a distribution)'],
]);
const unreachable = rows.filter(([k]) => !observedKinds.has(k) && KNOWN_UNREACHABLE.has(k));
const unverified = rows.filter(([k]) => !observedKinds.has(k) && !outOfScope.some(([o]) => o === k) && !KNOWN_UNREACHABLE.has(k));
const reachedAnyway = rows.filter(([k]) => observedKinds.has(k) && KNOWN_UNREACHABLE.has(k));
console.log(`  out of the judge's scope: ${outOfScope.map(([k]) => k).join(', ')}`);
for (const [k] of unreachable) {
  console.log(`  not reachable live in scope: ${k} — ${KNOWN_UNREACHABLE.get(k)}`);
}
for (const [k] of reachedAnyway) {
  console.log(`  ⚠ ${k} is listed as unreachable but was JUDGED — the scope moved: drop it from KNOWN_UNREACHABLE`);
}
console.log(`  NEVER JUDGED by this run (unverified rows): ${unverified.length === 0 ? 'none' : unverified.map(([k]) => k).join(', ')}`);

// ── the findings ────────────────────────────────────────────────────────────────────────────────────────────────────
const fRows = [...groups.entries()].sort((a, b) => b[1].tests.size - a[1].tests.size);
console.log(`\nFINDINGS — ${findingFiles} test file(s) with findings, ${fRows.length} distinct shape(s)`);
for (const [key, g] of fRows) {
  console.log(`■ ${key}  — ${g.count}× in ${g.tests.size} test(s)`);
  for (const t of [...g.tests].slice(0, 6)) {
    console.log(`    ${t}`);
  }
  if (g.tests.size > 6) {
    console.log(`    … +${g.tests.size - 6}`);
  }
  if (detail) {
    for (const s of g.samples) {
      console.log(`    ${s}`);
    }
  }
}

// ── the cures (step 4, prepared) ────────────────────────────────────────────────────────────────────────────────────
const cRows = [...cures.entries()].sort((a, b) => b[1].tests.size - a[1].tests.size);
console.log(`\nCURES — ${cRows.length === 0 ? 'none (no confirmed finding reached a plan)' : `${cRows.length} distinct`} · an APPLIED cure off a positive control is a latch bug to stand up`);
for (const [key, c] of cRows) {
  console.log(`■ ${key}  — ${c.count}× in ${c.tests.size} test(s)`);
  for (const t of [...c.tests].slice(0, 6)) {
    console.log(`    ${t}`);
  }
}
