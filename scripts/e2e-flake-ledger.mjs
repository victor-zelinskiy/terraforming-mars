/**
 * E2E FLAKE LEDGER — turn «passed on retry» from an invisible rescue into a
 * measured number with a threshold (docs/E2E_ARCHITECTURE_REWORK.md phase 0).
 *
 * `retries=2` stays (a flaky suite that blocks every push helps nobody), but
 * each rescue is now COUNTED: the ledger keeps the last N runs' flaky/failed
 * test titles, and a test that flaked in ≥ FLAKE_THRESHOLD of the last
 * WINDOW runs fails this script — the signal that a spec must be fixed or
 * quarantined, not re-rolled.
 *
 * Usage:
 *   npx playwright merge-reports --reporter=json ./all-blobs > merged.json
 *   node scripts/e2e-flake-ledger.mjs merged.json [--ledger e2e-flake-ledger.json] [--run-id ID]
 *
 * Exit codes: 0 = ok (flakes recorded, under threshold); 1 = threshold hit.
 * Writes a summary to $GITHUB_STEP_SUMMARY when present.
 */
import * as fs from 'node:fs';

const WINDOW = 20;
const FLAKE_THRESHOLD = 3;
const KEEP_RUNS = 50;

const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--'));
if (reportPath === undefined) {
  console.error('usage: node scripts/e2e-flake-ledger.mjs <merged-report.json> [--ledger <file>] [--run-id <id>]');
  process.exit(2);
}
const flagValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const ledgerPath = flagValue('--ledger', 'e2e-flake-ledger.json');
const runId = flagValue('--run-id', new Date().toISOString());

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

/** Walk the Playwright JSON suite tree collecting per-test outcomes. */
function collect(suite, file, out) {
  const ownFile = suite.file ?? file;
  for (const child of suite.suites ?? []) {
    collect(child, ownFile, out);
  }
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      // `status` is the OUTCOME: expected | unexpected | flaky | skipped.
      out.push({file: spec.file ?? ownFile, title: spec.title, outcome: t.status});
    }
  }
}
const tests = [];
for (const suite of report.suites ?? []) {
  collect(suite, undefined, tests);
}

const key = (t) => `${t.file} › ${t.title}`;
const flaky = [...new Set(tests.filter((t) => t.outcome === 'flaky').map(key))].sort();
const failed = [...new Set(tests.filter((t) => t.outcome === 'unexpected').map(key))].sort();

let ledger = {runs: []};
if (fs.existsSync(ledgerPath)) {
  try {
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  } catch {
    console.warn(`ledger ${ledgerPath} unreadable — starting fresh`);
  }
}
ledger.runs.push({runId, at: new Date().toISOString(), total: tests.length, flaky, failed});
ledger.runs = ledger.runs.slice(-KEEP_RUNS);
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

// ── The threshold: the same test flaky in ≥ FLAKE_THRESHOLD of the last WINDOW runs. ──
const window = ledger.runs.slice(-WINDOW);
const counts = new Map();
for (const run of window) {
  for (const t of run.flaky ?? []) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
}
const repeatOffenders = [...counts.entries()]
  .filter(([, n]) => n >= FLAKE_THRESHOLD)
  .sort((a, b) => b[1] - a[1]);

const lines = [];
lines.push(`## E2E flake ledger — run ${runId}`);
lines.push(`- tests seen: ${tests.length}, flaky this run: ${flaky.length}, failed: ${failed.length}`);
if (flaky.length > 0) {
  lines.push('', '### Flaky this run (passed on retry)');
  for (const t of flaky) {
    lines.push(`- ${t} (${counts.get(t) ?? 1}× in last ${window.length} runs)`);
  }
}
if (repeatOffenders.length > 0) {
  lines.push('', `### ⛔ REPEAT OFFENDERS (≥${FLAKE_THRESHOLD}× flaky in last ${window.length} runs) — fix or quarantine`);
  for (const [t, n] of repeatOffenders) {
    lines.push(`- ${t} — ${n}×`);
  }
}
const summary = lines.join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

process.exit(repeatOffenders.length > 0 ? 1 : 0);
