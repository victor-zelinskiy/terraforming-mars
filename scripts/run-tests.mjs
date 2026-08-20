#!/usr/bin/env node
/*
 * TEST RUNNER WRAPPER — «зелёный» must mean «tests ran».
 *
 * WHY THIS EXISTS. A mocha/mochapack run that collects ZERO tests exits 0 and
 * prints «0 passing», which every CI in the world reads as success. This fork
 * shipped exactly that: a fixed-name `vendors` split chunk turned the whole
 * `npm run test:client` suite into a silent no-op (see webpack.test.config.js),
 * and the dead suite went unnoticed for months because the pipeline was green.
 * A bad glob, a renamed directory or a `--require` that throws can do the same
 * to the server suite.
 *
 * So the count is now an ASSERTION, not a log line: every suite declares the
 * floor it must clear. The floor is a tripwire, not a target — set it a little
 * under the real count so ordinary spec churn does not trip it, and RAISE it
 * when a batch of specs lands.
 *
 * This wrapper never rescues a failing run and never retries: it only adds
 * «and something actually ran».
 *
 * …AND «RED» MUST NAME WHAT FAILED. A full suite prints thousands of ✓ lines
 * after the failure block, so anyone reading the TAIL of the log — CI's own
 * summary, a `| tail`, a captured background job — sees the count and not one
 * spec name. That cost two intermittent client-suite failures in a row: both
 * were real output, both unreadable, so neither could be diagnosed. On a
 * failing run the mocha failure section is therefore ECHOED at the end, after
 * the count. It is a re-print of output the run already produced — nothing is
 * suppressed, re-ordered or rescued.
 *
 * Usage:
 *   node scripts/run-tests.mjs --label client --min 400 -- <command> [args...]
 */
import {spawn} from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep === -1) {
  console.error('run-tests: expected `-- <command>` in the arguments');
  process.exit(2);
}
const flags = argv.slice(0, sep);
const command = argv.slice(sep + 1);
if (command.length === 0) {
  console.error('run-tests: no command given after `--`');
  process.exit(2);
}

function flag(name, fallback) {
  const i = flags.indexOf(`--${name}`);
  return i === -1 ? fallback : flags[i + 1];
}

const label = flag('label', 'tests');
const min = Number(flag('min', '1'));

/*
 * NO SHELL, deliberately: the spec globs must reach the runner verbatim. A
 * shell on Windows re-splits them and `tests/client/**\/*.spec.ts` silently
 * becomes several arguments (or, worse, nothing) — which is itself a way to
 * collect zero tests. Callers therefore spawn `node <bin>` directly.
 */
const child = spawn(command[0], command.slice(1), {
  env: process.env,
  stdio: ['inherit', 'pipe', 'inherit'],
});

let captured = '';
child.stdout.on('data', (chunk) => {
  captured += chunk.toString();
  process.stdout.write(chunk);
});

/**
 * Sum every mocha epilogue in the output. `--parallel` and a watch run can emit
 * more than one; a single run emits exactly one. Absent ⇒ 0, which is the case
 * this wrapper exists to catch.
 */
function tally(kind) {
  const re = new RegExp(`^\\s*(\\d+)\\s+${kind}\\b`, 'gm');
  let total = 0;
  let m;
  while ((m = re.exec(captured)) !== null) total += Number(m[1]);
  return total;
}

/**
 * Re-print mocha's own failure section (from the `N failing` epilogue line to
 * the end of the run) so the TAIL of the log names the specs. Best-effort by
 * design: a runner that formats differently simply gets no echo, never a
 * swallowed error — the original output is already on stdout above.
 */
function echoFailures() {
  const marker = /^\s*\d+\s+failing\b/gm;
  let start = -1;
  let m;
  while ((m = marker.exec(captured)) !== null) start = m.index;
  if (start === -1) {
    return;
  }
  console.error('\n[test-count] ── FAILURES (re-printed so the tail names them) ──');
  console.error(captured.slice(start).trimEnd());
}

child.on('close', (code, signal) => {
  const passing = tally('passing');
  const failing = tally('failing');
  const pending = tally('pending');
  const collected = passing + failing + pending;

  console.log(
    `\n[test-count] ${label}: ${collected} collected ` +
    `(${passing} passing, ${failing} failing, ${pending} pending) — floor ${min}`);

  if (failing > 0) {
    echoFailures();
  }
  if (signal !== null) {
    console.error(`[test-count] ${label}: killed by ${signal}`);
    process.exit(1);
  }
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  if (collected < min) {
    console.error(
      `\n[test-count] ✖ ${label.toUpperCase()} COLLECTED ${collected} TESTS, EXPECTED AT LEAST ${min}.\n` +
      '  The run exited 0 but did not do its job — this is a FALSE GREEN, not a pass.\n' +
      '  Likely causes: the spec glob matched nothing, a --require file threw, or the\n' +
      '  bundle\'s entry module never executed (see webpack.test.config.js).\n' +
      '  Do NOT lower the floor to make this pass.');
    process.exit(1);
  }
  process.exit(0);
});
