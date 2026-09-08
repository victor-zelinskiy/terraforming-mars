/**
 * E2E RATCHET BASELINE — (re)generate tests/console/e2eRatchetBaseline.json.
 *
 * The baseline freezes per-file counts of the two mechanically-decidable e2e
 * anti-patterns (docs/E2E_ARCHITECTURE_REWORK.md phase 0):
 *
 *   · `waitForTimeout(` — a fixed sleep is a guess about state; new waiting
 *     goes through `settle()` / `pressUntil*` / poll loops, and an honest
 *     mid-cinematic pause through `cinematicBeat()` (which lives in the
 *     driver, so its one internal sleep rides the driver's own number);
 *   · `requestAnimationFrame` — headless Chromium drives rAF off the
 *     compositor, which STOPS on a quiet screen: a rAF-clocked probe dies
 *     exactly when the bug it watches for fires. Probes are
 *     MutationObserver + setInterval, or pair rAF with the forceFrame pump.
 *
 * The guard (`tests/console/e2eDriverGuard.spec.ts`) fails when a file GROWS
 * past its frozen count (new debt) and when it FALLS below it (an improvement
 * that must be locked in — rerun this script and commit the diff). A file not
 * listed is allowed zero.
 *
 * Usage:  node scripts/e2e-ratchet-baseline.mjs --write   (regenerate)
 *         node scripts/e2e-ratchet-baseline.mjs           (print, no write)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E_DIR = path.join(repo, 'tests', 'e2e');
const OUT = path.join(repo, 'tests', 'console', 'e2eRatchetBaseline.json');

/** Keep IN SYNC with the guard's copy — same stripping, same patterns. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

const PATTERNS = {
  waitForTimeout: /\bwaitForTimeout\s*\(/g,
  requestAnimationFrame: /\brequestAnimationFrame\b/g,
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const baseline = {};
for (const file of walk(E2E_DIR).sort()) {
  const rel = path.relative(E2E_DIR, file).replace(/\\/g, '/');
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const counts = {};
  for (const [name, re] of Object.entries(PATTERNS)) {
    const n = (text.match(re) ?? []).length;
    if (n > 0) {
      counts[name] = n;
    }
  }
  if (Object.keys(counts).length > 0) {
    baseline[rel] = counts;
  }
}

const totals = {};
for (const counts of Object.values(baseline)) {
  for (const [name, n] of Object.entries(counts)) {
    totals[name] = (totals[name] ?? 0) + n;
  }
}

const doc = {
  '//': 'Frozen per-file counts of e2e anti-patterns. Counts may only FALL. ' +
        'Regenerate with: node scripts/e2e-ratchet-baseline.mjs --write',
  totals,
  files: baseline,
};

const json = JSON.stringify(doc, null, 2) + '\n';
if (process.argv.includes('--write')) {
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(repo, OUT)} — totals: ${JSON.stringify(totals)}`);
} else {
  console.log(json);
  console.log(`(dry run — totals: ${JSON.stringify(totals)})`);
}
