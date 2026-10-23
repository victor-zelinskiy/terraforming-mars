/**
 * E2E FIX BRIEF — everything a fix needs, on the run's own summary page, as ONE copyable block.
 *
 * The merged HTML report is the full story, but it is hundreds of MB to download for what is usually a handful of
 * lines: which test, where, what the assertion said, and what the drivers printed just before it. This script reads
 * the SAME merged JSON report the flake ledger reads and writes to $GITHUB_STEP_SUMMARY:
 *   · the FAILED and FLAKY tests by name (the ledger names only the flaky ones);
 *   · one fenced block — GitHub draws a copy button on it — holding, per test and per FAILED ATTEMPT: the status,
 *     file:line, the project, the describe path, the error (ANSI stripped) with its location and code frame, the tail
 *     of the test's own stdout (the drivers' diagnostics: `[drive]`, `[frames]`, `[queue]`…) and the annotations
 *     (seed, build, timing). A flaky test shows the attempt that failed, so a flake is debuggable without a re-run.
 *
 * The step summary is capped at 1 MiB per step; the block is budgeted below that and says so when it is cut.
 *
 * Usage: node scripts/e2e-fix-brief.mjs merged-report.json [--run "<id>"] [--commit <sha>] [--out brief.txt]
 * Always exits 0 — a brief is information, never a gate.
 */
import * as fs from 'node:fs';

const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
if (reportPath === undefined || !fs.existsSync(reportPath)) {
  console.error(`e2e-fix-brief: no report at ${reportPath ?? '(none given)'}`);
  process.exit(0);
}

/** The summary is capped at 1 MiB per step; leave room for the lists around the block. */
const BLOCK_BUDGET = 700_000;
/** Per attempt: enough of the error and the stdout to see the cause, never a whole log. */
const ERROR_LINES = 40;
const SNIPPET_LINES = 14;
const STDOUT_LINES = 25;
const LINE_MAX = 400;

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const strip = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
const clip = (line) => (line.length > LINE_MAX ? line.slice(0, LINE_MAX) + ' …' : line);
const head = (text, n) => {
  const lines = strip(text).split('\n').map(clip);
  return lines.length > n ? [...lines.slice(0, n), `… (${lines.length - n} more lines)`] : lines;
};
const tail = (lines, n) => (lines.length > n ? [`… (${lines.length - n} earlier lines)`, ...lines.slice(-n)] : lines);
/** Every path reads repo-relative (`tests/e2e/…`): spec files come testDir-relative, error locations absolute. */
const rel = (file) => {
  const p = String(file ?? '').replace(/\\/g, '/').replace(/^.*?(tests\/e2e\/)/, '$1');
  return p === '' || p.startsWith('tests/') ? p : `tests/e2e/${p}`;
};

/** Walk the suite tree, keeping the describe path. */
const entries = [];
function walk(suite, file, path) {
  const ownFile = suite.file ?? file;
  const ownPath = suite.title && suite.title !== ownFile && !/\.spec\.ts$/.test(suite.title) ? [...path, suite.title] : path;
  for (const child of suite.suites ?? []) {
    walk(child, ownFile, ownPath);
  }
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      entries.push({spec, test, file: rel(spec.file ?? ownFile), path: ownPath});
    }
  }
}
for (const suite of report.suites ?? []) {
  walk(suite, undefined, []);
}

const failed = entries.filter((e) => e.test.status === 'unexpected');
const flaky = entries.filter((e) => e.test.status === 'flaky');
const nameOf = (e) => `${e.file}:${e.spec.line} › ${[...e.path, e.spec.title].join(' › ')}${e.test.projectName ? ` [${e.test.projectName}]` : ''}`;

function attemptBlock(result) {
  const out = [];
  out.push(`  attempt ${result.retry ?? 0}: ${result.status} in ${((result.duration ?? 0) / 1000).toFixed(1)}s`);
  const errors = result.errors?.length ? result.errors : result.error ? [result.error] : [];
  for (const err of errors) {
    if (err.location) {
      out.push(`    at ${rel(err.location.file)}:${err.location.line}:${err.location.column}`);
    }
    for (const line of head(err.message ?? err.value ?? '', ERROR_LINES)) {
      out.push(`    | ${line}`);
    }
    if (err.snippet) {
      out.push('    code:');
      for (const line of head(err.snippet, SNIPPET_LINES)) {
        out.push(`    ${line}`);
      }
    }
  }
  const stdout = (result.stdout ?? []).map((c) => c.text ?? (c.buffer ? Buffer.from(c.buffer, 'base64').toString('utf8') : ''))
    .join('').split('\n').map((l) => clip(strip(l))).filter((l) => l.trim() !== '');
  if (stdout.length > 0) {
    out.push('    stdout (tail):');
    for (const line of tail(stdout, STDOUT_LINES)) {
      out.push(`      ${line}`);
    }
  }
  return out;
}

function testBlock(e, kind) {
  const out = [`■ ${kind} — ${nameOf(e)}`];
  for (const a of e.test.annotations ?? []) {
    if (a.description) {
      out.push(`  ${a.type}: ${clip(strip(a.description).replace(/\n/g, ' ⏎ '))}`);
    }
  }
  for (const r of e.test.results ?? []) {
    if (r.status === 'passed' || r.status === 'skipped') {
      out.push(`  attempt ${r.retry ?? 0}: ${r.status} in ${((r.duration ?? 0) / 1000).toFixed(1)}s`);
      continue;
    }
    out.push(...attemptBlock(r));
  }
  return out.join('\n');
}

const runLabel = flag('--run');
const commit = flag('--commit');
const stats = report.stats ?? {};
const header = [
  `E2E FIX BRIEF — run ${runLabel}${commit ? ` · commit ${commit.slice(0, 10)}` : ''}`,
  `tests: ${entries.length} · passed: ${stats.expected ?? '?'} · failed: ${failed.length} · flaky: ${flaky.length} · skipped: ${stats.skipped ?? '?'} · duration: ${((stats.duration ?? 0) / 60000).toFixed(1)} min`,
  'CI: ubuntu-latest, 1 worker per shard, retries=2, SwiftShader (no GPU). Attempt 0 is the first try.',
];

let block = header.join('\n');
let cut = 0;
for (const [kind, list] of [['FAILED', failed], ['FLAKY', flaky]]) {
  for (const e of list) {
    const section = '\n\n' + testBlock(e, kind);
    if (block.length + section.length > BLOCK_BUDGET) {
      cut++;
      continue;
    }
    block += section;
  }
}
if (cut > 0) {
  block += `\n\n… ${cut} test(s) cut to stay under the summary's 1 MiB cap — their names are in the lists above; the merged HTML report has them.`;
}
if (failed.length === 0 && flaky.length === 0) {
  block += '\n\nAll green — nothing to fix.';
}

const md = [];
md.push('## E2E fix brief');
md.push(`- tests: ${entries.length}, failed: **${failed.length}**, flaky: **${flaky.length}**`);
if (failed.length > 0) {
  md.push('', '### Failed (every retry)');
  for (const e of failed) {
    md.push(`- \`${nameOf(e)}\``);
  }
}
if (flaky.length > 0) {
  md.push('', '### Flaky (passed on retry)');
  for (const e of flaky) {
    md.push(`- \`${nameOf(e)}\``);
  }
}
// A fence longer than any backtick run inside the block, so a stack trace can never close it early.
const longest = Math.max(2, ...[...block.matchAll(/`+/g)].map((m) => m[0].length));
const fence = '`'.repeat(longest + 1);
md.push('', '### Everything a fix needs — copy this block (the copy button is at its top-right)', '', fence + 'text', block, fence, '');

const out = md.join('\n');
const outFile = flag('--out');
if (outFile) {
  fs.writeFileSync(outFile, block + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
} else {
  console.log(out);
}
