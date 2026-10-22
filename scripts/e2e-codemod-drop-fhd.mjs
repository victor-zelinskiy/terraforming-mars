#!/usr/bin/env node
/**
 * THE fhd-DROP CODEMOD (the e2e speed iteration, phase 4 — the owner's call 2026-10-21: «главное нам
 * проверять основной профиль TV»): a card / feature spec that runs its tests under BOTH `fhd` (1920×1080,
 * the standard profile) and `tv4k` (the TV profile) runs every test twice, and the second profile covers a
 * layout the profile sweeps already guard. This drops the `fhd` ENTRY from a spec's PROFILES / PRESETS
 * table when a `tv4k` entry stands beside it — one line per file, the test bodies untouched.
 *
 * A spec that ran ONE extra test on the cheaper profile (`if (preset.id === 'fhd') { test(…) }`, an early
 * `return` on the other, a `shoot(page, 'fhd', …)` label on a one-off test that boots `PRESETS[0]`) keeps the
 * test: the gate and the label move to `tv4k` — on the GPU box the 4K raster is free (phase 4), so «once» is
 * now «once, on the TV».
 *
 * It SKIPS: the timing class (`tests/e2e/timingSpecs.ts`), the profile sweeps (a file whose name says
 * `profile` / `screens` / `hud-frame` / `parity` / `frame`, and the KEEP list — a spec whose fhd branch
 * carries fhd-specific NUMBERS or budgets), a file that names `'fhd'` in any other shape (hand-check), and a
 * table whose fhd line is not a one-line object literal (hand-check).
 *
 *   node scripts/e2e-codemod-drop-fhd.mjs            # dry run
 *   node scripts/e2e-codemod-drop-fhd.mjs --write
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(ROOT, 'tests', 'e2e');
const write = process.argv.includes('--write');

const timingSource = fs.readFileSync(path.join(E2E, 'timingSpecs.ts'), 'utf8');
const timing = new Set([...timingSource.matchAll(/'([a-z0-9-]+\.spec\.ts)'/g)].map((m) => m[1]));
const SWEEP = /profile|screens|hud-frame|parity|frame/;
// Two-profile BY DESIGN: the fhd branch asserts fhd-specific numbers (a 26px heading, the 120 / 900 ms handoff
// thresholds, the 1080 ladder, the per-profile line budgets, the scene's budgetMs + `const FHD`, the three-
// profile podium with its `tv:` flag).
const KEEP = new Set([
  'console-blue-action-purchase.spec.ts',
  'console-prompt-family.spec.ts',
  'console-desc-tier-fit.spec.ts',
  'console-card-lore-measure.spec.ts',
  'console-terraformed-scene.spec.ts',
  'console-finale-podium.spec.ts',
]);
// The «once» shapes that move to the TV profile.
const ONCE_GATE = /((?:preset|profile|p)\.(?:id|tag|name) (?:===|!==) )'fhd'/g;
const ONCE_SHOT = /(shoot\(page, )'fhd'(,)/g;
// One-line fhd entry of a PROFILES / PRESETS table: `{id|tag|name: 'fhd', …},` on its own line.
const FHD_LINE = /^[ \t]*\{(?:id|tag|name): 'fhd'[^\n]*\},?[ \t]*\r?\n/m;
const TV_LINE = /^[ \t]*\{(?:id|tag|name): 'tv4k'/m;

let changed = 0;
const skipped = [];
for (const name of fs.readdirSync(E2E).filter((f) => f.endsWith('.spec.ts')).sort()) {
  const file = path.join(E2E, name);
  const src = fs.readFileSync(file, 'utf8');
  if (!TV_LINE.test(src) || !/'fhd'/.test(src)) {
    continue;
  }
  if (timing.has(name)) {
    skipped.push(`${name} — the timing class`);
    continue;
  }
  if (SWEEP.test(name)) {
    skipped.push(`${name} — a profile sweep by name`);
    continue;
  }
  if (KEEP.has(name)) {
    skipped.push(`${name} — two profiles by design (KEEP)`);
    continue;
  }
  const m = FHD_LINE.exec(src);
  if (!m) {
    skipped.push(`${name} — the fhd entry is not a one-line object (hand-check)`);
    continue;
  }
  let rest = src.replace(m[0], '');
  let moved = 0;
  rest = rest
    .replace(ONCE_GATE, (_, head) => (moved += 1, `${head}'tv4k'`))
    .replace(ONCE_SHOT, (_, head, tail) => (moved += 1, `${head}'tv4k'${tail}`));
  if (/'fhd'/.test(rest)) {
    skipped.push(`${name} — names 'fhd' in another shape (hand-check)`);
    continue;
  }
  changed += 1;
  console.log(`${write ? 'dropped fhd in' : 'would drop fhd in'}  ${name}${moved ? `  (+ ${moved} once-gate/label → tv4k)` : ''}`);
  if (write) {
    fs.writeFileSync(file, rest);
  }
}
console.log(`\n${changed} file(s)${write ? ' rewritten' : ' would change'} · ${skipped.length} skipped:`);
for (const s of skipped) {
  console.log(`  ·  ${s}`);
}
