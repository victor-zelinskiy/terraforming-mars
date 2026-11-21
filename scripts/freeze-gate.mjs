#!/usr/bin/env node
/**
 * THE FREEZE GATE — «did this build bring a freeze class that was not there?», answered with NO BOX
 * (FREEZE ZERO · part D — docs/claude/console/freeze-zero/PLAN.md §5).
 *
 *   npm run gate:freeze                       the whole gate (≈ 35 min of a laptop in two shards)
 *   npm run gate:freeze -- --shards 8 --parallel 3   the pass cut into 8 processes, 3 at a time (default: 6 and 2)
 *   npm run gate:freeze -- --only parliament  a regex over the table names (a slice — never a release's answer)
 *   npm run gate:freeze -- --skip-replays     the monkey's pass alone
 *   npm run gate:freeze -- --guided           the walk presses what the command bar offers (far deeper into the flows)
 *   npm run gate:freeze -- --fault 6          THE WIRE BREAKS: once in 6 presses the next request is refused, lost,
 *                                             malformed, silent… (stage 4 — a pass of its own: its classes are the
 *                                             product not unwinding from a broken request; never `--write-baseline`)
 *   npm run gate:freeze -- --write-baseline   accept what this pass named: the baseline is rewritten (the notes kept)
 *   npm run gate:freeze -- --report-only      judge the pass that is already in `.e2e-remote/bottle-gate` again
 *                                             (after a triage, a baseline edit) — nothing is run
 *
 * WHAT IT RUNS, in this order (the first red stops it):
 *   1. THE REPLAYS — `npm run test:bottle`: every freeze class the program closed, stood up again in the bottle by
 *      the presses that produced it and held to the property its fix established (2 min). A class that comes back
 *      is red under its own name.
 *   2. THE MONKEY IN THE BOTTLE — the box monkey's own walk (the same fixtures, the same seed → the same presses)
 *      over EVERY table, on the manual clock, deterministic (`tests/client/bottle/monkey.bottle.ts`).
 *   3. THE REPORT, as a gate — `scripts/monkey-report.mjs --against tests/client/bottle/monkeyBaseline.json --gate`:
 *      exit 3 when a walk ended with an episode that was never cured, or the pass named a DEFECT class the baseline
 *      does not hold.
 *
 * THE BASELINE (`tests/client/bottle/monkeyBaseline.json`) is the list of classes the bottle is KNOWN to name, each
 * with its reason («the bottle has no layout: a wait for a measured end», «a real class — PLAN §4, row …»). It is a
 * UNION OVER SEEDS: another seed is another 606 walks (`--seed fz1`) — the cheapest way there is to find a class —
 * and what it names that a real browser does not is added beside the first seed's rows (`--write-baseline` adds,
 * never drops; a row that no pass names any more is taken out by hand). A class that is not on it is a FINDING: read it (`node scripts/monkey-report.mjs .e2e-remote/bottle-gate`), then either
 * close it (a law, a guard, a replay — and it never reaches the baseline) or — when a real browser says «not there»
 * — add it with its reason (`--write-baseline`, then write the `why` by hand). A baseline row without a `why` fails
 * `tests/console/freezeGateBaseline.spec.ts`.
 *
 * The bottle has no layout and no paint: what stands on geometry, the compositor and real time is the BOX monkey's
 * (`tests/e2e/console-monkey.spec.ts`) — this gate does not replace it, it runs where the box cannot.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'tests', 'client', 'bottle', 'monkeyBaseline.json');
const OUT = path.join(ROOT, '.e2e-remote', 'bottle-gate');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 || args[at + 1] === undefined ? fallback : args[at + 1];
};
// SHARDS ARE PROCESSES, `--parallel` IS HOW MANY RUN AT ONCE. A bottle's page is a whole application, and a process
// that has stood a hundred of them holds gigabytes (2026-11-17: two shards of 303 walks each ran out of a 4 GB heap
// at walk 168) — so the pass is cut into MORE processes than run side by side: each one is short, and the gate fits
// a CI runner's memory as well as a laptop's.
const shards = Math.max(1, Number(value('shards', '6')) || 6);
const parallel = Math.max(1, Math.min(shards, Number(value('parallel', '2')) || 2));
const seed = value('seed', 'fz0');
const only = value('only', undefined);
// THE PASS'S PERTURBATIONS (each its own seeded stream — `tests/client/bottle/monkeyWalk.ts`).
const fault = value('fault', undefined);
const guided = flag('guided');

/** Run one process to its end; its output goes to `log` (and its last lines to the console when it fails). */
function run(label, command, commandArgs, env, log) {
  return new Promise((resolve) => {
    const out = fs.createWriteStream(log);
    const child = spawn(command, commandArgs, {cwd: ROOT, env: {...process.env, ...env}, shell: false});
    child.stdout.pipe(out);
    child.stderr.pipe(out);
    child.on('error', (error) => {
      console.error(`[freeze-gate] ${label} could not start: ${error.message}`);
      resolve(127);
    });
    child.on('close', (code) => {
      out.end();
      resolve(code ?? 1);
    });
  });
}

const tail = (file, lines) => {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
};

async function main() {
  const reportOnly = flag('report-only');
  if (!reportOnly) {
    fs.rmSync(OUT, {recursive: true, force: true});
  }
  fs.mkdirSync(OUT, {recursive: true});
  const started = Date.now();
  const node = process.execPath;
  const runner = path.join(ROOT, 'scripts', 'client-tests.mts');
  const bottleEnv = {NODE_ENV: 'development'};

  // 1. THE REPLAYS.
  if (!reportOnly && !flag('skip-replays')) {
    console.log('[freeze-gate] 1/3 the replays of the closed classes (npm run test:bottle) …');
    const log = path.join(OUT, 'replays.log');
    const code = await run('the replays', node, [runner, 'tests/client/bottle/*.bottle.ts'], bottleEnv, log);
    if (code !== 0) {
      console.error(tail(log, 40));
      console.error(`[freeze-gate] RED — a closed class came back, or the bottle itself is broken (exit ${code}; ${path.relative(ROOT, log)})`);
      return 1;
    }
  }

  // 2. THE MONKEY, in shards.
  console.log(reportOnly ? '[freeze-gate] 2/3 the monkey in the bottle — NOT run (--report-only: the pass on disk is judged)' :
    `[freeze-gate] 2/3 the monkey in the bottle — seed ${seed}, ${shards} shard(s), ${parallel} at a time${only === undefined ? ', every table' : `, only /${only}/`} …`);
  const codes = [];
  if (!reportOnly) {
    let next = 0;
    const lane = async () => {
      while (next < shards) {
        const i = next++;
        codes[i] = await run(
          `shard ${i + 1}`, node, [runner, 'tests/client/bottle/monkey.bottle.ts'],
          {
            ...bottleEnv, TM_BOTTLE_MONKEY: '1', TM_BOTTLE_MONKEY_SEED: seed, TM_BOTTLE_MONKEY_SHARD: `${i + 1}/${shards}`,
            TM_BOTTLE_MONKEY_OUT: path.relative(ROOT, OUT), ...(only === undefined ? {} : {TM_BOTTLE_MONKEY_ONLY: only}),
            ...(fault === undefined ? {} : {TM_BOTTLE_MONKEY_FAULT: fault}), ...(guided ? {TM_BOTTLE_MONKEY_MODE: 'guided'} : {}),
          },
          path.join(OUT, `shard-${i + 1}.log`));
      }
    };
    await Promise.all(Array.from({length: parallel}, lane));
  }
  // A SHARD THAT DIED (out of memory, a crash of the runner) walked only a part of its tables: the pass is not whole,
  // and a gate over a part of the tables is no gate — said, and red, whatever the report would say.
  const died = codes.map((code, i) => ({code, i})).filter(({i}) => {
    try {
      return /FATAL ERROR|heap out of memory/.test(fs.readFileSync(path.join(OUT, `shard-${i + 1}.log`), 'utf8'));
    } catch {
      return true;
    }
  });
  if (died.length > 0) {
    died.forEach(({code, i}) => console.error(`── shard ${i + 1} died (exit ${code}) ──
${tail(path.join(OUT, `shard-${i + 1}.log`), 12)}`));
    console.error(`[freeze-gate] RED — ${died.length} shard(s) died before walking their tables: the pass is not whole`);
    return 1;
  }
  // A walk that ends «not ok» fails its test on purpose (the class is filed either way) — the JUDGE is the report.
  // What must not pass in silence is a shard that did not run at all.
  const filed = fs.existsSync(path.join(OUT, 'cause-classes')) ? fs.readdirSync(path.join(OUT, 'cause-classes')).length : 0;
  if (filed === 0) {
    codes.forEach((code, i) => console.error(`── shard ${i + 1} (exit ${code}) ──\n${tail(path.join(OUT, `shard-${i + 1}.log`), 25)}`));
    console.error('[freeze-gate] RED — the monkey filed nothing: the pass did not run');
    return 1;
  }

  // A WALK THE BOTTLE COULD NOT MAKE (its own error — `status: 'harness'`) is a table nobody walked: the report files it
  // as a note of the harness, never a class of the game, and a pass with such walks is not whole (2026-11-18: 14 of 20
  // walks of a slice died on the harness's own line, and the gate said GREEN).
  const unwalked = fs.readdirSync(path.join(OUT, 'cause-classes')).filter((name) => name.endsWith('.json')).map((name) => {
    try {
      const walk = JSON.parse(fs.readFileSync(path.join(OUT, 'cause-classes', name), 'utf8'));
      return walk.status === 'harness' ? `${walk.monkey?.fixture ?? name}: ${String(walk.records?.[walk.records.length - 1]?.title ?? '').slice(0, 200)}` : undefined;
    } catch {
      return `${name}: not a readable walk file`;
    }
  }).filter((line) => line !== undefined);
  if (unwalked.length > 0) {
    unwalked.slice(0, 8).forEach((line) => console.error(`   ${line}`));
    console.error(`[freeze-gate] RED — ${unwalked.length} table(s) were not walked (the bottle's own error): the pass is not whole`);
    return 1;
  }

  // 3. THE REPORT, as a gate.
  console.log(`[freeze-gate] 3/3 the report against ${path.relative(ROOT, BASELINE)} …`);
  const report = path.join(OUT, 'monkey-report.json');
  const reportArgs = [path.join(ROOT, 'scripts', 'monkey-report.mjs'), OUT, '--out', report, ...(fs.existsSync(BASELINE) ? ['--against', BASELINE] : []), '--gate'];
  const reportLog = path.join(OUT, 'report.log');
  const verdict = await run('the report', node, reportArgs, {}, reportLog);
  console.log(fs.readFileSync(reportLog, 'utf8').split('\n').filter((line) => !line.startsWith('  ') || /NEW|never cured/i.test(line)).slice(0, 80).join('\n'));

  if (flag('write-baseline') && fault !== undefined) {
    // (A fault pass names what the product does under a wire broken ON PURPOSE — a finding to close, never a row the
    // ordinary gate should learn to live with.)
    console.error('[freeze-gate] --write-baseline is refused on a --fault pass: its classes are findings, not baseline rows');
    process.exit(2);
  }
  if (flag('write-baseline')) {
    const now = JSON.parse(fs.readFileSync(report, 'utf8'));
    const before = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {classes: {}};
    // A UNION: the rows that stand are kept as they are (their notes are a human's or an agent's word); what THIS pass
    // names beside them is added WITHOUT a note — and the baseline's guard is red until somebody has read the class
    // and said why it may stand (or closed it and taken the row out).
    const classes = {...(before.classes ?? {})};
    let added = 0;
    for (const [cls, row] of Object.entries(now.classes)) {
      if (row.tier !== 'defect' || classes[cls] !== undefined) {
        continue;
      }
      classes[cls] = {tier: 'defect', tables: row.tests, first: row.first?.seed ?? '', why: ''};
      added++;
    }
    const seeds = [...new Set([...(before.seeds ?? (before.seed === undefined ? [] : [before.seed])), seed])];
    fs.writeFileSync(BASELINE, `${JSON.stringify({
      what: 'the DEFECT classes the monkey in the bottle is KNOWN to name, over every seed walked — each with why it may stand (scripts/freeze-gate.mjs)',
      seeds, presses: now.totals.presses, walks: now.totals.walks, at: new Date().toISOString().slice(0, 10),
      classes: Object.fromEntries(Object.entries(classes).sort(([a], [b]) => a.localeCompare(b))),
    }, null, 2)}\n`);
    console.log(`[freeze-gate] the baseline holds ${Object.keys(classes).length} class(es) over the seeds ${seeds.join(', ')} — ${added} added: write the «why» of every new row`);
    return 0;
  }
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  if (verdict === 0) {
    console.log(`[freeze-gate] GREEN in ${minutes} min — no class the baseline does not hold, no episode left uncured`);
    return 0;
  }
  console.error(`[freeze-gate] RED in ${minutes} min (exit ${verdict}) — read: node scripts/monkey-report.mjs ${path.relative(ROOT, OUT)} --against ${path.relative(ROOT, BASELINE)}`);
  return verdict;
}

main().then((code) => process.exit(code));
