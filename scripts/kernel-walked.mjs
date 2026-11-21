#!/usr/bin/env node
/**
 * THE KERNEL'S STATE SPACE — WALKED OR DECLARED (FREEZE ZERO, stage 4 — docs/claude/console/freeze-zero/PLAN.md § 8:
 * «machine moves 100 % walked-or-declared; flows 100 %»).
 *
 * One pass of the monkey walks a part of the space, and its report says which (`monkey-report` § THE KERNEL'S STATE
 * SPACE). The stage's number is over EVERY pass there is — the plain walk, the guided one, the reload, the hidden
 * page, the broken wire, each seed — so this reads several passes' directories at once, unions what they walked and
 * holds the rest against the ledger of what is declared unwalked WITH A REASON:
 *
 *   tests/client/bottle/kernelUnwalked.json — {flows, frames, moves}: each key the union of the passes never walked,
 *   with its `why` ('' — nobody has said yet: the stage's debt).
 *
 *   node scripts/kernel-walked.mjs <pass dir> [<pass dir> …]            the numbers, and what the ledger does not hold
 *   node scripts/kernel-walked.mjs <pass dir> … --write                 rewrite the ledger: what the union walked
 *                                                                       LEAVES it, what it never walked stays with its
 *                                                                       reason, a key new to it enters with `why: ''`
 *   node scripts/kernel-walked.mjs <pass dir> … --gate                  exit 3 when a key is neither walked nor on
 *                                                                       the ledger (the ledger is stale — or the
 *                                                                       passes given are fewer than it was written from)
 *
 * A pass directory is what the monkey writes (`<dir>/cause-classes/*.json`, each with the page's `coverage`).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {aggregateCoverage} from './monkey-report.mjs';
import {flowUniverse} from './flow-universe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = path.join(ROOT, 'tests', 'client', 'bottle', 'kernelUnwalked.json');

/** Every parsed `cause-classes` file under the pass directories given. */
export function readPasses(dirs) {
  const files = [];
  for (const dir of dirs) {
    const classes = fs.existsSync(path.join(dir, 'cause-classes')) ? path.join(dir, 'cause-classes') : dir;
    for (const name of fs.readdirSync(classes).filter((n) => n.endsWith('.json')).sort()) {
      try {
        files.push(JSON.parse(fs.readFileSync(path.join(classes, name), 'utf8')));
      } catch {
        // (a file cut by a killed shard — it carries nothing to union)
      }
    }
  }
  return files;
}

/** What the union of the passes NEVER walked: `{flows: [id], frames: [id], moves: {machine: [edge]}}`. */
export function unwalkedOf(coverage) {
  return {
    flows: [...coverage.flows.never].sort(),
    frames: [...coverage.frames.never].sort(),
    moves: Object.fromEntries(Object.entries(coverage.machines).map(([machine, row]) => [machine, [...row.never].sort()])),
  };
}

/** The ledger as `{flows: {id: why}, frames: {id: why}, moves: {machine: {edge: why}}}` (empty when there is none). */
export function readLedger(file = LEDGER) {
  if (!fs.existsSync(file)) {
    return {flows: {}, frames: {}, moves: {}};
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {flows: raw.flows ?? {}, frames: raw.frames ?? {}, moves: raw.moves ?? {}};
}

/**
 * The union held against the ledger. `missing` — never walked and not on the ledger; `stale` — on the ledger and
 * walked by these passes (it leaves at the next `--write`); `undeclared` — on the ledger with no reason (the debt).
 */
export function judgeWalked(unwalked, ledger) {
  const missing = [];
  const stale = [];
  const undeclared = [];
  const hold = (group, keys, rows) => {
    const never = new Set(keys);
    for (const key of keys) {
      if (rows[key] === undefined) {
        missing.push(`${group} · ${key}`);
      } else if (rows[key] === '') {
        undeclared.push(`${group} · ${key}`);
      }
    }
    for (const key of Object.keys(rows)) {
      if (!never.has(key)) {
        stale.push(`${group} · ${key}`);
      }
    }
  };
  hold('flow', unwalked.flows, ledger.flows);
  hold('frame', unwalked.frames, ledger.frames);
  for (const machine of new Set([...Object.keys(unwalked.moves), ...Object.keys(ledger.moves)])) {
    hold(`move ${machine}`, unwalked.moves[machine] ?? [], ledger.moves[machine] ?? {});
  }
  return {missing, stale, undeclared};
}

function main() {
  const args = process.argv.slice(2);
  const dirs = args.filter((a) => !a.startsWith('--'));
  if (dirs.length === 0) {
    console.error('usage: node scripts/kernel-walked.mjs <pass dir> [<pass dir> …] [--write | --gate]');
    process.exit(2);
  }
  const files = readPasses(dirs);
  const coverage = aggregateCoverage(files, flowUniverse().flows);
  if (coverage === undefined) {
    console.error('[kernel-walked] no walk of these passes carried coverage');
    process.exit(2);
  }
  const unwalked = unwalkedOf(coverage);
  const ledger = readLedger();
  const verdict = judgeWalked(unwalked, ledger);
  const moves = Object.values(coverage.machines).reduce((a, row) => ({all: a.all + row.moves, made: a.made + row.made}), {all: 0, made: 0});
  console.log(`THE KERNEL'S STATE SPACE, OVER ${dirs.length} PASS(ES) — ${coverage.walks} walk(s), ${coverage.keys} key(s)`);
  console.log(`flows   ${coverage.flows.opened} of ${coverage.flows.declared} opened (${coverage.flows.pct} %) — never ${unwalked.flows.length}`);
  console.log(`frames  ${coverage.frames.opened} of ${coverage.frames.kinds} (${coverage.frames.pct} %) — never ${unwalked.frames.length}`);
  for (const [machine, row] of Object.entries(coverage.machines)) {
    console.log(`machine ${machine.padEnd(9)} ${row.made} of ${row.moves} moves (${row.pct} %) — never ${row.never.length}`);
  }
  console.log(`moves   ${moves.made} of ${moves.all} in all`);
  console.log(`the ledger: declared with a reason ${Object.values(ledger.flows).filter((w) => w !== '').length + Object.values(ledger.frames).filter((w) => w !== '').length +
    Object.values(ledger.moves).reduce((a, rows) => a + Object.values(rows).filter((w) => w !== '').length, 0)} · ` +
    `UNDECLARED (the debt) ${verdict.undeclared.length} · not on it ${verdict.missing.length} · walked since it was written ${verdict.stale.length}`);
  if (args.includes('--write')) {
    const keep = (keys, rows) => Object.fromEntries(keys.map((key) => [key, rows[key] ?? '']));
    const next = {
      note: 'THE KERNEL\'S STATE SPACE THAT NO PASS WALKS — each key with the reason it may stand unwalked (\'\' = nobody has said yet). ' +
        'Rewritten by `node scripts/kernel-walked.mjs <passes…> --write`: a key the passes walked leaves, the reasons are kept. FREEZE ZERO, stage 4.',
      flows: keep(unwalked.flows, ledger.flows),
      frames: keep(unwalked.frames, ledger.frames),
      moves: Object.fromEntries(Object.entries(unwalked.moves).map(([machine, keys]) => [machine, keep(keys, ledger.moves[machine] ?? {})])),
    };
    fs.writeFileSync(LEDGER, `${JSON.stringify(next, null, 1)}\n`);
    console.log(`→ ${path.relative(ROOT, LEDGER)} rewritten`);
    return;
  }
  for (const line of verdict.missing.slice(0, 40)) {
    console.log(`  NOT ON THE LEDGER  ${line}`);
  }
  if (args.includes('--gate') && verdict.missing.length > 0) {
    console.error(`[kernel-walked] ${verdict.missing.length} key(s) neither walked by these passes nor declared — walk them, or run with every pass the ledger was written from`);
    process.exit(3);
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
