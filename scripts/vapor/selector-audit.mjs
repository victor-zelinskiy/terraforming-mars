#!/usr/bin/env node
/*
 * THE SELECTOR AUDIT — a `v-for` row compared with an OUTER value, and what that outer read may dereference
 * (docs/claude/vapor/ROADMAP.md § 4a · B12 · RECIPES § R27).
 *
 * For a row binding of the shape `:class="{hot: row.id === outer.id}"` the Vapor compiler does not write one effect
 * per row: it lifts the OUTER side into a SELECTOR — `_createSelector(() => outer.id)` — whose source is watched
 * SYNCHRONOUSLY (the reactivity's own `watch`, no scheduler), so that a change re-runs two rows instead of all of them.
 * The price: the source runs INSIDE THE ASSIGNMENT that changed it, before any `v-if` around the list has had its turn.
 *
 *     <div v-if="tip !== null">  <p v-for="row in rows" :class="{hot: row === tip.color}">   // rc.15
 *     tip.value = null;        // TypeError: Cannot read properties of null (reading 'color') — thrown out of THIS line
 *
 * On the virtual DOM the same template is safe: the whole component re-renders top-down and the `v-if` goes first. So
 * the day such a component gains `vapor`, the code that CLOSES the guard throws in the middle of whatever it was
 * doing (an event handler, a controller's step) — no type error, no red unit spec unless the spec closes the guard.
 *
 * This tool compiles every component as Vapor and lists each selector's source. A source is SAFE when it cannot
 * throw: a bare binding (`focusKey.value`, `__props.selected`), a call of a script function, or a chain made null-safe
 * with `?.`. Everything else is a finding: make the outer side null-safe in the template (`tip?.color`) or name it
 * in the script (`const tipColor = computed(() => tip.value?.color)`).
 *
 *   node scripts/vapor/selector-audit.mjs            the report (exit 1 on a finding)
 *   node scripts/vapor/selector-audit.mjs --json     the same, as JSON
 *   node scripts/vapor/selector-audit.mjs --all      every selector, the safe ones too
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {parse, compileScript} = require('@vue/compiler-sfc');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const ALL = args.includes('--all');
const ROOT = path.join(process.cwd(), 'src', 'client');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.name.endsWith('.vue')) {
      files.push(p);
    }
  }
})(ROOT);

/** The source expression of every `_createSelector(() => …)` of a compiled module (balanced to the call's end). */
function selectorSources(code) {
  const out = [];
  const marker = '_createSelector(() => ';
  for (let at = code.indexOf(marker); at >= 0; at = code.indexOf(marker, at + 1)) {
    let depth = 1;
    let i = at + marker.length;
    const start = i;
    for (; i < code.length && depth > 0; i++) {
      const ch = code[i];
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
      }
    }
    out.push(code.slice(start, i - 1).trim());
  }
  return out;
}

/**
 * Can this source throw on a nullish link? It can when it reads a property (or an index) OFF something that is not
 * the component's own root object: after the roots the compiler writes are set aside — `x.value` of a ref, `__props.x`,
 * `_ctx.x`, `$props.x` — any further `.member` / `[index]` that is not `?.` is a dereference of a value.
 */
function mayThrow(source) {
  const text = source.replace(/^\((.*)\)$/s, '$1').trim();
  const rooted = text
    .replace(/\b(?:__props|_ctx|\$props|props)\.([A-Za-z_$][\w$]*)/g, '$1') // a prop / a binding read off its holder
    .replace(/\b([A-Za-z_$][\w$]*)\.value\b/g, '$1') // a ref
    .replace(/_unref\(([A-Za-z_$][\w$]*)\)/g, '$1');
  // what is left: any plain member access or index on a value
  return /[\w$)\]]\s*\.(?!\.)\s*[A-Za-z_$]/.test(rooted.replace(/\?\./g, ' ?_ ')) || /[\w$)\]]\[/.test(rooted.replace(/\?\.\[/g, ' ?_ '));
}

/** A source the rule calls a dereference and that cannot be one — `<file>|<source>` → the reason. */
const ALLOWED = new Map([
  ['src/client/components/console/menu/ConsoleAdminRollback.vue|targetSave.value.generation',
    'the computed always answers an object (it falls back to a zero save)'],
  ['src/client/components/endgame/FinalScoringReveal.vue|reveal.value.tieBreak?.winner',
    '`reveal` is a computed model that is never nullish; the optional link after it is null-safe'],
]);

const findings = [];
const safe = [];
const allowed = new Set();
let scanned = 0;
for (const file of files) {
  const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  if (!/^<script setup\b/m.test(source)) {
    continue;
  }
  scanned++;
  const asVapor = /^<script setup[^>\n]*\svapor[\s>]/m.test(source) ? source : source.replace(/^<script setup(?=[\s>])/m, '<script setup vapor');
  let code = '';
  const quiet = console.warn;
  console.warn = () => {};
  try {
    const {descriptor, errors} = parse(asVapor, {filename: rel});
    if (errors.length > 0) {
      continue;
    }
    code = compileScript(descriptor, {id: 'selector-audit', inlineTemplate: true, templateOptions: {compilerOptions: {onWarn: () => {}, onError: () => {}}}}).content;
  } catch {
    continue; // not a Vapor candidate today — `vapor-check.mjs` says why
  } finally {
    console.warn = quiet;
  }
  for (const selector of selectorSources(code)) {
    const key = `${rel}|${selector}`;
    if (ALLOWED.has(key)) {
      allowed.add(key);
      safe.push({file: rel, source: selector, allowed: ALLOWED.get(key)});
    } else {
      (mayThrow(selector) ? findings : safe).push({file: rel, source: selector});
    }
  }
}

// an ALLOWED row whose selector is gone must go too
const stale = [...ALLOWED.keys()].filter((key) => !allowed.has(key));

if (JSON_OUT) {
  console.log(JSON.stringify({scanned, findings, safe, stale}, null, 1));
} else {
  console.log(`selector audit — ${scanned} components, ${findings.length + safe.length} selectors: ${safe.length} safe, ${findings.length} that can throw inside an assignment`);
  for (const f of findings) {
    console.log(`  THROWS? ${f.file} — ${f.source}`);
  }
  if (ALL) {
    for (const s of safe) {
      console.log(`  safe    ${s.file} — ${s.source}`);
    }
  }
}
if (!JSON_OUT) {
  for (const key of stale) {
    console.log(`  STALE   allowed row with no selector behind it: ${key}`);
  }
}
process.exit(findings.length > 0 || stale.length > 0 ? 1 : 0);
