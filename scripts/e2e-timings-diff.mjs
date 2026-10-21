#!/usr/bin/env node
/**
 * A/B OVER TWO RUNS' `timings.jsonl` (the e2e speed iteration): the same tests under two configurations —
 * per test the status on each side, the total, the press and the rest; then the summary and the tests that
 * changed status (a red on B only = the configuration's cost, to be classified).
 *
 *   node scripts/e2e-timings-diff.mjs <A.jsonl> <B.jsonl> [--all]
 */
import * as fs from 'node:fs';

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const all = process.argv.includes('--all');
if (!a || !b || !fs.existsSync(a) || !fs.existsSync(b)) {
  console.error('usage: node scripts/e2e-timings-diff.mjs <A.jsonl> <B.jsonl> [--all]');
  process.exit(2);
}
const load = (f) => {
  const m = new Map();
  for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    m.set(`${r.file} › ${r.title}`, r); // the last attempt of a retried test wins
  }
  return m;
};
const A = load(a);
const B = load(b);
const s = (ms) => (ms / 1000).toFixed(1).padStart(6);
const ms = (r, k) => r?.buckets?.[k]?.ms ?? 0;

let totA = 0;
let totB = 0;
let n = 0;
const flipped = [];
const rows = [];
for (const [key, ra] of A) {
  const rb = B.get(key);
  if (!rb) {
    continue;
  }
  n += 1;
  totA += ra.totalMs;
  totB += rb.totalMs;
  const mark = ra.status === rb.status ? ' ' : '!';
  if (ra.status !== rb.status) {
    flipped.push({key, a: ra.status, b: rb.status});
  }
  rows.push({key, ra, rb, mark});
}
console.log(`${n} tests in both · total ${s(totA)} s → ${s(totB)} s (${((100 * (totB - totA)) / totA).toFixed(0)} %) · press ${s([...A.values()].reduce((x, r) => x + ms(r, 'press'), 0))} → ${s([...B.values()].reduce((x, r) => x + ms(r, 'press'), 0))} · rest ${s([...A.values()].reduce((x, r) => x + r.restMs, 0))} → ${s([...B.values()].reduce((x, r) => x + r.restMs, 0))}`);
console.log(`A: ${[...A.values()].filter((r) => r.status === 'passed').length} passed / ${A.size} · B: ${[...B.values()].filter((r) => r.status === 'passed').length} passed / ${B.size}`);
if (flipped.length > 0) {
  console.log('');
  console.log('STATUS CHANGED:');
  for (const f of flipped) {
    console.log(`  ${f.a} → ${f.b}  ${f.key.slice(0, 120)}`);
  }
}
if (all) {
  console.log('');
  console.log(`  ${'A'.padStart(6)} ${'B'.padStart(6)}  ${'press'.padStart(13)}  ${'rest'.padStart(13)}  test`);
  for (const {key, ra, rb, mark} of rows.sort((x, y) => (y.ra.totalMs - y.rb.totalMs) - (x.ra.totalMs - x.rb.totalMs))) {
    console.log(`${mark} ${s(ra.totalMs)} ${s(rb.totalMs)}  ${s(ms(ra, 'press'))}→${s(ms(rb, 'press'))}  ${s(ra.restMs)}→${s(rb.restMs)}  ${key.slice(0, 90)}`);
  }
}
