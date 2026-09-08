/**
 * E2E SHARD PLAN — balance CI shards by MEASURED time, not by file count
 * (docs/E2E_ARCHITECTURE_REWORK.md phase 3).
 *
 * Playwright's --shard splits by position, so the run's wall time is the
 * unluckiest shard. This script reads a Playwright JSON report (a local full
 * run or CI's merged blobs), sums each spec FILE's duration, greedy-bins the
 * files into N buckets and writes tests/e2e/shardPlan.json. The CI run step
 * consumes it through scripts/e2e-shard-files.mjs and falls back to --shard
 * when the plan is absent or shaped for a different shard count.
 *
 * Usage: node scripts/e2e-shard-plan.mjs <report.json> [--shards 4] [--write]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(repo, 'tests', 'e2e', 'shardPlan.json');

const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--'));
if (reportPath === undefined) {
  console.error('usage: node scripts/e2e-shard-plan.mjs <playwright-report.json> [--shards 4] [--write]');
  process.exit(2);
}
const shardsIdx = args.indexOf('--shards');
const SHARDS = shardsIdx >= 0 ? Number(args[shardsIdx + 1]) : 4;

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const durations = new Map();

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
const files = [...durations.entries()].sort((a, b) => b[1] - a[1]);
const buckets = Array.from({length: SHARDS}, () => ({ms: 0, files: []}));
for (const [file, ms] of files) {
  buckets.sort((a, b) => a.ms - b.ms);
  buckets[0].files.push(file);
  buckets[0].ms += ms;
}
buckets.sort((a, b) => b.ms - a.ms);

const plan = {
  '//': 'Time-balanced CI shard buckets. Regenerate from a full run: ' +
        'node scripts/e2e-shard-plan.mjs <report.json> --shards 4 --write. ' +
        'Files not listed here are round-robined by e2e-shard-files.mjs.',
  generatedAt: new Date().toISOString(),
  shards: SHARDS,
  bucketMinutes: buckets.map((b) => Number((b.ms / 60_000).toFixed(1))),
  buckets: buckets.map((b) => b.files.sort()),
};

const json = JSON.stringify(plan, null, 2) + '\n';
console.log(`buckets (minutes): ${plan.bucketMinutes.join(' / ')} across ${durations.size} files`);
if (args.includes('--write')) {
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(repo, OUT)}`);
} else {
  console.log('(dry run — pass --write to save)');
}
