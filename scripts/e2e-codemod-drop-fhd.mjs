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
  // The Parliament's geometry / fit guards are profile sweeps by contract (`.claude/rules/console-ui.md` § THE
  // PARLIAMENT SITTING: «the government's geometry on three profiles», «1080 + 4K», «the acceptance of every
  // parliament surface») — they keep every profile whatever the 1080 row is called.
  'console-parliament-vote-fit.spec.ts',
  'console-parliament-vote-geometry.spec.ts',
  'console-parliament-zone-v5-regression.spec.ts',
  'console-parliament-gallery.spec.ts',
  'console-resolution-face.spec.ts',
  'console-parliament-reds-plaque.spec.ts',
  'console-parliament-stability.spec.ts',
  // FIT SWEEPS — the spec's own claim is «zero scroll / fits on every profile» (the effect forecast's law 4, the
  // explorers' probed scale ladder, the Parliament's own fit guards).
  'console-parliament.spec.ts',
  'console-parliament-v2.spec.ts',
  'console-parliament-sitting.spec.ts',
  'console-effect-forecast.spec.ts',
  'console-effects-explorer.spec.ts',
  'console-extras-explorer.spec.ts',
  'console-score-explorer.spec.ts',
]);
// The 1080 row's id(s): `--ids fhd,standard-1080` (default `fhd` — the first pass); the TV row is `tv4k` or `tv-4k`
// (the second pass, 2026-10-22: 87 files still ran a 1080 profile, 21 % of the suite, most of it named
// `standard-1080`).
const idsArg = process.argv.find((a, i) => process.argv[i - 1] === '--ids');
const FHD_IDS = (idsArg ?? 'fhd').split(',').map((x) => x.trim()).filter(Boolean);
const ALT = FHD_IDS.map((x) => x.replace(/[-]/g, '\\-')).join('|');
const NAMED = new RegExp(`'(?:${ALT})'`);
// The «once» shapes that move to the TV profile.
const ONCE_GATE = new RegExp(`((?:preset|profile|p)\\.(?:id|tag|name) (?:===|!==) )'(?:${ALT})'`, 'g');
const ONCE_SHOT = new RegExp(`(shoot\\(page, )'(?:${ALT})'(,)`, 'g');
// One-line 1080 entry of a PROFILES / PRESETS table: `{id|tag|name: '<id>', …},` on its own line.
const FHD_LINE = new RegExp(`^[ \\t]*\\{(?:id|tag|name): '(?:${ALT})'[^\\n]*\\},?[ \\t]*\\r?\\n`, 'm');
const TV_LINE = /^[ \t]*\{(?:id|tag|name): '(tv4k|tv-4k)'/m;

let changed = 0;
const skipped = [];
for (const name of fs.readdirSync(E2E).filter((f) => f.endsWith('.spec.ts')).sort()) {
  const file = path.join(E2E, name);
  const src = fs.readFileSync(file, 'utf8');
  const tv = TV_LINE.exec(src);
  if (tv === null || !NAMED.test(src)) {
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
    .replace(ONCE_GATE, (_, head) => (moved += 1, `${head}'${tv[1]}'`))
    .replace(ONCE_SHOT, (_, head, tail) => (moved += 1, `${head}'${tv[1]}'${tail}`));
  if (NAMED.test(rest)) {
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
