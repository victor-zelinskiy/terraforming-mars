/**
 * E2E SHARD PLAN — balance CI shards by MEASURED time, not by file count
 * (docs/E2E_ARCHITECTURE_REWORK.md phase 3).
 *
 * Playwright's --shard splits by position, so the run's wall time is the
 * unluckiest shard. This script reads a Playwright JSON report (a local full
 * run or CI's merged blobs), sums each spec FILE's duration, greedy-bins the
 * files into N buckets and writes tests/e2e/shardPlan.json. The CI run step
 * consumes it through scripts/e2e-shard-files.mjs and falls back to --shard
 * when the plan has no buckets for the requested shard count.
 *
 * ONE FILE, SEVERAL SHARD COUNTS (2026-10-23): `--shards 4,6,8,10` writes a plan
 * per count under `plans`, so the workflow's `shards` input can be changed on
 * the day without a regeneration — every count it offers stays time-balanced.
 *
 * Usage: node scripts/e2e-shard-plan.mjs <report.json | ledger.jsonl...> [--shards 4,6,8] [--write]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(repo, 'tests', 'e2e', 'shardPlan.json');

const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--'));
if (reportPath === undefined) {
  console.error('usage: node scripts/e2e-shard-plan.mjs <playwright-report.json | ledger.jsonl...> [--shards 4] [--write]');
  process.exit(2);
}
const shardsIdx = args.indexOf('--shards');
const SHARD_COUNTS = (shardsIdx >= 0 ? args[shardsIdx + 1] : '4').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);

const durations = new Map();
// THE TIMING LEDGER (`TM_E2E_TIMINGS` — one JSON line per test attempt, the Steam Machine's wrapper always writes
// one) is accepted beside a Playwright report: several ledgers may be given (the FUNCTIONAL and the TIMING runs are
// two runs), each line's `totalMs` summed per spec file. The box is faster than a CI runner, but the plan only needs
// the RELATIVE weights — and a ledger exists for every run, a merged CI report only when CI has run.
const ledgers = args.filter((a) => a.endsWith('.jsonl'));
const sources = ledgers.length > 0 ? ledgers.map((l) => path.basename(path.dirname(path.dirname(l))) + '/' + path.basename(l)) : [path.basename(reportPath)];
for (const ledger of ledgers) {
  for (const line of fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean)) {
    const row = JSON.parse(line);
    const key = path.basename(row.file ?? '');
    if (key !== '') {
      durations.set(key, (durations.get(key) ?? 0) + (row.totalMs ?? 0));
    }
  }
}
const report = ledgers.length > 0 ? {suites: []} : JSON.parse(fs.readFileSync(reportPath, 'utf8'));

function collect(suite, file) {
  const ownFile = suite.file ?? file;
  for (const child of suite.suites ?? []) {
    collect(child, ownFile);
  }
  for (const spec of suite.specs ?? []) {
    const specFile = spec.file ?? ownFile;
    let ms = 0;
    for (const t of spec.tests ?? []) {
      for (const r of t.results ?? []) {
        ms += r.duration ?? 0;
      }
    }
    const key = path.basename(specFile);
    durations.set(key, (durations.get(key) ?? 0) + ms);
  }
}
for (const suite of report.suites ?? []) {
  collect(suite, undefined);
}

if (durations.size === 0) {
  console.error('no spec durations found in the report');
  process.exit(2);
}

// Greedy: heaviest file into the lightest bucket.
function binPack(shards) {
  const files = [...durations.entries()].sort((a, b) => b[1] - a[1]);
  const buckets = Array.from({length: shards}, () => ({ms: 0, files: []}));
  for (const [file, ms] of files) {
    buckets.sort((a, b) => a.ms - b.ms);
    buckets[0].files.push(file);
    buckets[0].ms += ms;
  }
  buckets.sort((a, b) => b.ms - a.ms);
  return {
    bucketMinutes: buckets.map((b) => Number((b.ms / 60_000).toFixed(1))),
    buckets: buckets.map((b) => b.files.sort()),
  };
}

const plans = {};
for (const n of SHARD_COUNTS) {
  plans[String(n)] = binPack(n);
}
const plan = {
  '//': 'Time-balanced CI shard buckets, one plan per shard count. Regenerate from a full run: ' +
        'node scripts/e2e-shard-plan.mjs <report.json | ledger.jsonl...> --shards 4,6,8,10 --write. ' +
        'Files not listed here are round-robined by e2e-shard-files.mjs. The minutes are RELATIVE weights ' +
        '(a ledger is measured on the Steam Machine, a CI runner is slower) — read them as the balance, not the clock.',
  generatedAt: new Date().toISOString(),
  sources,
  files: durations.size,
  plans,
};

const json = JSON.stringify(plan, null, 2) + '\n';
for (const [n, p] of Object.entries(plans)) {
  console.log(`${n} shards — buckets (minutes): ${p.bucketMinutes.join(' / ')}`);
}
console.log(`across ${durations.size} files`);
if (args.includes('--write')) {
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(repo, OUT)}`);
} else {
  console.log('(dry run — pass --write to save)');
}
