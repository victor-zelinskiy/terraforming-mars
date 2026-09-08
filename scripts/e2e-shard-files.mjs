/**
 * E2E SHARD FILES — print shard N's spec files from tests/e2e/shardPlan.json.
 *
 * Consumed by the CI run step: when a valid plan exists for the requested
 * shard count, the step runs the printed file list (time-balanced); otherwise
 * this exits 2 and the step falls back to Playwright's positional --shard.
 *
 * Safety rails, both deterministic:
 *  · a spec file NOT in the plan (new since generation) is round-robined by
 *    name hash — a new spec can never be silently dropped from CI;
 *  · a planned file that no longer exists is skipped.
 *
 * Usage: node scripts/e2e-shard-files.mjs <shard 1-based> <total>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(repo, 'tests', 'e2e');
const PLAN = path.join(E2E, 'shardPlan.json');

const shard = Number(process.argv[2]);
const total = Number(process.argv[3]);
if (!Number.isInteger(shard) || !Number.isInteger(total) || shard < 1 || shard > total) {
  console.error('usage: node scripts/e2e-shard-files.mjs <shard 1-based> <total>');
  process.exit(2);
}
if (!fs.existsSync(PLAN)) {
  console.error('no shardPlan.json — fall back to --shard');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
if (plan.shards !== total || !Array.isArray(plan.buckets) || plan.buckets.length !== total) {
  console.error(`plan is for ${plan.shards} shards, requested ${total} — fall back to --shard`);
  process.exit(2);
}

const planned = new Set(plan.buckets.flat());
const onDisk = fs.readdirSync(E2E).filter((f) => f.endsWith('.spec.ts'));

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const mine = plan.buckets[shard - 1].filter((f) => onDisk.includes(f));
for (const f of onDisk) {
  if (!planned.has(f) && (hash(f) % total) === shard - 1) {
    mine.push(f);
  }
}

console.log(mine.map((f) => `tests/e2e/${f}`).join(' '));
