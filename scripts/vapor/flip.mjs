#!/usr/bin/env node
/*
 * STEP B — THE FLIP: `<script setup lang="ts">` → `<script setup vapor lang="ts">` (docs/claude/vapor/ROADMAP.md § 4a).
 *
 * The attribute is the whole of the mechanical change; everything that makes it RIGHT is done before it (the
 * component's sheet prints a clear STEP B line, `vapor-check.mjs` compiles it clean, its edges — a parent's `$el` read,
 * an order-dependent watcher pair — are closed) and proven after it (its specs, its surface's e2e on the box).
 *
 * Usage:
 *   node scripts/vapor/flip.mjs <component.vue> [more…] [--write]     the named components
 *   node scripts/vapor/flip.mjs --all [--write]                       every component that compiles clean as Vapor
 *   node scripts/vapor/flip.mjs --unflip <component.vue> [more…] --write   back to the virtual DOM
 * Without `--write` it only says what it would do. A component the Vapor compiler refuses or warns about, or whose
 * script still needs the virtual DOM, is never flipped by `--all` (named explicitly it is refused with the reason).
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ALL = args.includes('--all');
const UNFLIP = args.includes('--unflip');
const named = args.filter((a) => !a.startsWith('--')).map((a) => a.split(path.sep).join('/'));

let check;
try {
  check = JSON.parse(execFileSync(process.execPath, [path.join('scripts', 'vapor', 'vapor-check.mjs'), '--json'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}));
} catch (error) {
  check = JSON.parse(String(error.stdout ?? '{}'));
}
const clean = new Set(check.clean ?? []);
const why = new Map([
  ...(check.errors ?? []).map((e) => [e.file, `the Vapor compiler refuses it — ${e.error}`]),
  ...(check.warned ?? []).map((w) => [w.file, `it compiles with a warning — ${w.warnings.join(' · ')}`]),
  ...(check.vdomOnly ?? []).map((v) => [v.file, `its script needs the virtual DOM — ${v.why.join(' · ')}`]),
]);

const targets = ALL ? [...clean].sort() : named;
if (targets.length === 0) {
  console.error('nothing to flip — name components, or pass --all');
  process.exit(2);
}
let done = 0;
let refused = 0;
for (const file of targets) {
  const source = fs.readFileSync(file, 'utf8');
  const isVapor = /^<script setup[^>\n]*\svapor[\s>]/m.test(source); // the block's own tag — it opens its line
  if (UNFLIP) {
    if (!isVapor) {
      continue;
    }
    if (WRITE) {
      fs.writeFileSync(file, source.replace(/^<script setup vapor(?=[\s>])/m, '<script setup'));
    }
    done++;
    continue;
  }
  if (isVapor) {
    continue;
  }
  if (!clean.has(file)) {
    console.error(`REFUSE  ${file} — ${why.get(file) ?? 'it is not a <script setup> component'}`);
    refused++;
    continue;
  }
  if (!/<script setup(?=[\s>])/.test(source)) {
    console.error(`REFUSE  ${file} — no <script setup> block`);
    refused++;
    continue;
  }
  if (WRITE) {
    fs.writeFileSync(file, source.replace(/^<script setup(?=[\s>])/m, '<script setup vapor'));
  }
  done++;
}
console.log(`${UNFLIP ? 'unflipped' : 'flipped'}${WRITE ? '' : ' (dry run)'}: ${done} · refused: ${refused} · Vapor before: ${check.vaporNow ?? '?'} of ${check.total ?? '?'}`);
process.exit(refused > 0 && !ALL ? 1 : 0);
