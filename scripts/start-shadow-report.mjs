#!/usr/bin/env node
/*
 * start-shadow-report — the START SHADOW's findings of a whole e2e run, grouped (phase 0 of «правда сервера → одно
 * состояние → один владелец экрана», `src/client/console/startDirector.ts`).
 *
 * The harness files one JSON per test under `<outputDir>/start-shadow/` (`tests/e2e/consoleTest.ts`
 * `startShadowHarvest`); a remote run pulls them into `.e2e-remote/<task>/test-results/start-shadow/`.
 *
 *   node scripts/start-shadow-report.mjs <task | dir> [--detail]
 *
 * One row per (kind, expected → on screen, prompt shape — the prompt id dropped), with how many tests hit it and
 * which; `--detail` prints every finding's JSON tail (serves, firstAct, frames, the scene's diag).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const arg = process.argv[2];
if (arg === undefined) {
  console.error('usage: node scripts/start-shadow-report.mjs <task | dir> [--detail]');
  process.exit(2);
}
const detail = process.argv.includes('--detail');
const dir = fs.existsSync(arg) ? arg : path.join('.e2e-remote', arg, 'test-results', 'start-shadow');
if (!fs.existsSync(dir)) {
  console.log(`no findings directory (${dir}) — the run filed no START SHADOW finding`);
  process.exit(0);
}

const groups = new Map();
let files = 0;
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
  files++;
  const rec = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  for (const line of rec.findings) {
    const brace = line.indexOf(' {');
    let f = {};
    try {
      f = JSON.parse(line.slice(brace + 1));
    } catch {
      f = {kind: '?', expected: '?', actual: '?', prompt: line.slice(0, 120)};
    }
    const shape = String(f.prompt ?? '').replace(/#\d*$/, '');
    const key = `${f.kind} · ${f.expected} → ${f.actual}${f.block ? ` (held by ${f.block})` : ''} · ${shape}`;
    const g = groups.get(key) ?? {count: 0, tests: new Set(), samples: []};
    g.count++;
    g.tests.add(`${rec.file} › ${rec.title}${rec.retry > 0 ? ` (retry ${rec.retry})` : ''}`);
    if (g.samples.length < 3) {
      g.samples.push(line.slice(brace + 1, brace + 1 + 900));
    }
    groups.set(key, g);
  }
}

const rows = [...groups.entries()].sort((a, b) => b[1].tests.size - a[1].tests.size);
console.log(`START SHADOW — ${files} test file(s) with findings, ${rows.length} distinct shape(s)\n`);
for (const [key, g] of rows) {
  console.log(`■ ${key}  — ${g.count}× in ${g.tests.size} test(s)`);
  for (const t of [...g.tests].slice(0, 6)) {
    console.log(`    ${t}`);
  }
  if (g.tests.size > 6) {
    console.log(`    … +${g.tests.size - 6}`);
  }
  if (detail) {
    for (const s of g.samples) {
      console.log(`    ${s}`);
    }
  }
}
