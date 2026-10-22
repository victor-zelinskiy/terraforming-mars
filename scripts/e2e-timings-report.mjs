#!/usr/bin/env node
/**
 * WHERE THE SECONDS GO — the report over a run's `timings.jsonl` (one line per test, written by the
 * harness's `timingLedger` fixture when `TM_E2E_TIMINGS` is set; `npm run e2e:remote` sets it to
 * `<task>/test-results/timings.jsonl`, pulled back into `.e2e-remote/<task>/test-results/`).
 *
 *   node scripts/e2e-timings-report.mjs .e2e-remote/<task>/test-results/timings.jsonl [--top 15]
 *
 * Prints the suite-wide split (which bucket holds how many seconds), the per-file totals, and the top
 * offenders per bucket — the worklist of the e2e speed iteration (`docs/claude/e2e-speed-iteration.md`).
 *
 * When the run had reds it ends with the CLASSIFICATION WORKLIST: every test that did not pass, grouped by
 * file, each with its attempts (`failed → passed` is FLAKY, all red is RED), the file's CLASS (TIMING if it
 * stands in `tests/e2e/timingSpecs.ts`, else FUNCTIONAL) and the date the spec was last touched in git — the
 * three facts the triage needs: an old untouched file is ROT first, a timing-class red is a timing, a recent
 * functional red is a LOGIC bug or a candidate for the timing class WITH ITS REASON.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const file = process.argv[2];
const topN = Number((process.argv.find((a, i) => process.argv[i - 1] === '--top')) ?? 15);
if (!file || !fs.existsSync(file)) {
  console.error('usage: node scripts/e2e-timings-report.mjs <timings.jsonl> [--top N]');
  process.exit(2);
}
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
if (rows.length === 0) {
  console.log('no rows');
  process.exit(0);
}
const BUCKETS = ['boot', 'reload', 'fixture', 'press', 'pressSleep', 'settle', 'beat', 'sleep', 'home', 'opening'];
const LEAVES = ['boot', 'reload', 'fixture', 'press', 'settle', 'beat', 'sleep'];
const s = (ms) => (ms / 1000).toFixed(1).padStart(7);
const pct = (ms, total) => total > 0 ? `${((100 * ms) / total).toFixed(0).padStart(3)}%` : '   -';

const total = rows.reduce((n, r) => n + r.totalMs, 0);
const sum = {};
const cnt = {};
for (const b of BUCKETS) {
  sum[b] = rows.reduce((n, r) => n + (r.buckets[b]?.ms ?? 0), 0);
  cnt[b] = rows.reduce((n, r) => n + (r.buckets[b]?.n ?? 0), 0);
}
const leaves = LEAVES.reduce((n, b) => n + sum[b], 0);

console.log(`${rows.length} tests · ${s(total)} s wall (sum of tests) · host ${[...new Set(rows.map((r) => r.host ?? '?'))].join(',')}`);
console.log('');
console.log('SUITE-WIDE SPLIT (leaves sum to the driver\'s waits; «rest» is the product + the assertions):');
for (const b of LEAVES) {
  console.log(`  ${b.padEnd(10)} ${s(sum[b])} s ${pct(sum[b], total)}  (${cnt[b]}×${b === 'press' ? `, of which fixed sleep ${s(sum.pressSleep).trim()} s` : ''})`);
}
console.log(`  ${'rest'.padEnd(10)} ${s(total - leaves)} s ${pct(total - leaves, total)}`);
console.log(`  ${'home'.padEnd(10)} ${s(sum.home)} s ${pct(sum.home, total)}  (wall of waitForBoardHome, inside the above)`);
console.log(`  ${'opening'.padEnd(10)} ${s(sum.opening)} s ${pct(sum.opening, total)}  (wall of the UI start-flow walk, inside the above)`);

const byFile = new Map();
for (const r of rows) {
  const f = r.file;
  const cell = byFile.get(f) ?? {tests: 0, totalMs: 0, buckets: {}};
  cell.tests += 1;
  cell.totalMs += r.totalMs;
  for (const b of BUCKETS) {
    cell.buckets[b] = (cell.buckets[b] ?? 0) + (r.buckets[b]?.ms ?? 0);
  }
  byFile.set(f, cell);
}
console.log('');
console.log(`PER FILE (top ${topN} by total):`);
console.log(`  ${'total'.padStart(7)} ${'boot'.padStart(7)} ${'press'.padStart(7)} ${'settle'.padStart(7)} ${'beat'.padStart(7)} ${'sleep'.padStart(7)} ${'rest'.padStart(7)}  tests  file`);
for (const [f, c] of [...byFile.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs).slice(0, topN)) {
  const l = LEAVES.reduce((n, b) => n + (c.buckets[b] ?? 0), 0);
  console.log(`  ${s(c.totalMs)} ${s(c.buckets.boot)} ${s(c.buckets.press)} ${s(c.buckets.settle)} ${s(c.buckets.beat)} ${s(c.buckets.sleep)} ${s(c.totalMs - l)}  ${String(c.tests).padStart(5)}  ${f}`);
}

for (const b of ['press', 'sleep', 'beat', 'settle', 'boot']) {
  const ranked = [...byFile.entries()].filter(([, c]) => (c.buckets[b] ?? 0) > 0).sort((a, c) => (c[1].buckets[b] ?? 0) - (a[1].buckets[b] ?? 0)).slice(0, Math.min(topN, 8));
  if (ranked.length === 0) {
    continue;
  }
  console.log('');
  console.log(`TOP ${ranked.length} FILES BY ${b.toUpperCase()}:`);
  for (const [f, c] of ranked) {
    console.log(`  ${s(c.buckets[b])} s  ${pct(c.buckets[b], c.totalMs)} of its ${s(c.totalMs).trim()} s  ${f}`);
  }
}

// ── WHERE THE SLEEPS ARE (each ledger row carries its top call sites — `consoleTest.ts` § sleepSiteOf) ───────
const sites = new Map();
for (const r of rows) {
  for (const x of r.sleepSites ?? []) {
    const c = sites.get(x.site) ?? {n: 0, ms: 0, tests: 0};
    sites.set(x.site, {n: c.n + x.n, ms: c.ms + x.ms, tests: c.tests + 1});
  }
}
if (sites.size > 0) {
  console.log('');
  console.log(`TOP ${Math.min(topN, sites.size)} SLEEP SITES (suite-wide, the bare sleeps only):`);
  for (const [site, c] of [...sites.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, topN)) {
    console.log(`  ${s(c.ms)} s  ${String(c.n).padStart(6)}×  in ${String(c.tests).padStart(4)} tests  ${site}`);
  }
}

// ── THE CLASSIFICATION WORKLIST ──────────────────────────────────────────────────────────────────────────
// One ledger line per ATTEMPT: a retried test appears twice. Group by file + title and read the sequence.
const attempts = new Map();
for (const r of rows) {
  const key = `${r.file}\u0000${r.title}`;
  const cell = attempts.get(key) ?? {file: r.file, title: r.title, statuses: [], totalMs: 0};
  cell.statuses.push(r.status ?? '?');
  cell.totalMs += r.totalMs;
  attempts.set(key, cell);
}
const notGreen = [...attempts.values()].filter((a) => a.statuses.some((st) => st !== 'passed' && st !== 'skipped'));
if (notGreen.length > 0) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let timing = new Set();
  try {
    const src = fs.readFileSync(path.join(ROOT, 'tests', 'e2e', 'timingSpecs.ts'), 'utf8');
    timing = new Set([...src.matchAll(/'([a-z0-9-]+\.spec\.ts)'/g)].map((m) => m[1]));
  } catch {
    // no class list at hand — every file reads as FUNCTIONAL
  }
  // The last commit that touched the spec BY HAND — the suite-wide codemods (the `key()` rewrite, the fhd
  // drop; their messages say «codemod») touched a hundred files each and would date every spec «today».
  const touched = (f) => {
    const out = spawnSync('git', ['log', '-1', '--format=%cs', '--invert-grep', '--grep=codemod', '--', f], {cwd: ROOT, encoding: 'utf8'});
    return out.status === 0 && out.stdout.trim() ? out.stdout.trim() : '?';
  };
  const byRedFile = new Map();
  for (const a of notGreen) {
    const list = byRedFile.get(a.file) ?? [];
    list.push(a);
    byRedFile.set(a.file, list);
  }
  const reds = notGreen.filter((a) => !a.statuses.includes('passed')).length;
  const flaky = notGreen.length - reds;
  console.log('');
  console.log(`CLASSIFICATION WORKLIST — ${reds} red, ${flaky} flaky (red then green on a retry), in ${byRedFile.size} files:`);
  for (const [f, list] of [...byRedFile.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    const base = path.basename(f);
    const cls = timing.has(base) ? 'TIMING    ' : 'FUNCTIONAL';
    console.log(`  ${cls}  touched ${touched(f)}  ${f}  (${list.length} of ${[...attempts.values()].filter((a) => a.file === f).length} tests)`);
    for (const a of list) {
      const verdict = a.statuses.includes('passed') ? 'FLAKY' : 'RED  ';
      console.log(`      ${verdict}  ${a.statuses.join(' → ').padEnd(24)}  ${s(a.totalMs).trim()} s  ${a.title}`);
    }
  }
  console.log('  Triage: an old untouched FUNCTIONAL file → ROT (run it alone with no flag first); a TIMING file → a timing (re-run --exclusive);');
  console.log('  a recent FUNCTIONAL red → a LOGIC bug, or the timing class WITH ITS REASON in timingSpecs.ts.');
}
