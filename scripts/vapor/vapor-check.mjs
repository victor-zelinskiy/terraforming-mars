#!/usr/bin/env node
/*
 * STEP B, MEASURED — does every `<script setup>` component COMPILE as a Vapor component?
 * (docs/claude/vapor/ROADMAP.md § 4a — what stands between step A and `createVaporApp(App)`.)
 *
 * For each `.vue` under `src/client` the tool compiles the component as if its script block carried `vapor`: the same
 * `@vue/compiler-sfc` the build uses, the template INLINED (the production shape — `compileScript` reads the flag off
 * the descriptor and hands the template to `@vue/compiler-vapor`). It reports
 *   · the components the Vapor compiler REFUSES (an error), with the message;
 *   · the compiler's WARNINGS by kind (a construct Vapor ignores — `v-memo` — or does not support);
 *   · what the script itself still asks of the virtual DOM: a render function (`h(`), a `FunctionalComponent`.
 *
 * It answers «does it compile», NOT «does it behave»: behaviour is the capability suite's (`vaporCapability.spec.ts`)
 * and each wave's e2e. A component that compiles clean is a CANDIDATE for step B, not a converted one.
 *
 * Usage: node scripts/vapor/vapor-check.mjs [--json] [--list]
 */
import fs from 'node:fs';
import path from 'node:path';
import {compileScript, parse} from '@vue/compiler-sfc';

const ROOT = path.resolve('src/client');
const JSON_OUT = process.argv.includes('--json');
const LIST = process.argv.includes('--list');

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

const report = {total: 0, vaporNow: 0, clean: [], errors: [], warned: [], vdomOnly: []};
const warningKinds = new Map();
for (const file of files) {
  const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
  const source = fs.readFileSync(file, 'utf8');
  report.total++;
  const already = /<script setup[^>]*\svapor[\s>]/.test(source);
  if (already) {
    report.vaporNow++;
  }
  const asVapor = already ? source : source.replace(/<script setup(?=[\s>])/, '<script setup vapor');
  const warnings = [];
  let error;
  // what the SCRIPT still asks of the virtual DOM (the compiler does not look there)
  const script = /<script setup[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1] ?? '';
  const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const vdom = [];
  if (/import\s*(?:type\s*)?\{[^}]*\bh\b[^}]*\}\s*from\s*'vue'/.test(code) && /\bh\(/.test(code)) {
    vdom.push('a render function (`h(`)');
  }
  const quiet = console.warn;
  console.warn = (...args) => warnings.push(String(args[0]));
  try {
    const {descriptor, errors} = parse(asVapor, {filename: rel});
    if (errors.length > 0) {
      throw errors[0];
    }
    compileScript(descriptor, {
      id: 'vapor-check',
      inlineTemplate: true,
      templateOptions: {compilerOptions: {onWarn: (w) => warnings.push(w.message), onError: (e) => {
        throw e;
      }}},
    });
  } catch (e) {
    error = String(e?.message ?? e).split('\n')[0].slice(0, 200);
  } finally {
    console.warn = quiet;
  }
  // a warning's KIND: its first sentence, without the colour codes and the code frame that follow it
  const kinds = [...new Set(warnings.map((w) => w.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '').replace(/\[@vue\/[\w-]+\]\s*/, '').replace(/\s+/g, ' ').split(/(?<=\.)\s/)[0].slice(0, 110)))];
  for (const kind of kinds) {
    warningKinds.set(kind, (warningKinds.get(kind) ?? 0) + 1);
  }
  if (error !== undefined) {
    report.errors.push({file: rel, error});
  } else if (vdom.length > 0) {
    report.vdomOnly.push({file: rel, why: vdom});
  } else if (kinds.length > 0) {
    report.warned.push({file: rel, warnings: kinds});
  } else {
    report.clean.push(rel);
  }
}

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({...report, warningKinds: Object.fromEntries(warningKinds)}, null, 1) + '\n');
} else {
  console.log(`vapor compile check — ${report.total} components (${report.vaporNow} are Vapor today)`);
  console.log(`  compile CLEAN as Vapor:           ${report.clean.length}`);
  console.log(`  compile with WARNINGS:            ${report.warned.length}`);
  console.log(`  the script needs the virtual DOM: ${report.vdomOnly.length}`);
  console.log(`  the Vapor compiler REFUSES:       ${report.errors.length}`);
  for (const [kind, n] of [...warningKinds].sort((a, b) => b[1] - a[1])) {
    console.log(`    warning ×${n}: ${kind}`);
  }
  for (const e of report.errors) {
    console.log(`    REFUSED ${e.file} — ${e.error}`);
  }
  for (const v of report.vdomOnly) {
    console.log(`    VDOM    ${v.file} — ${v.why.join(' · ')}`);
  }
  if (LIST) {
    for (const w of report.warned) {
      console.log(`    WARN    ${w.file} — ${w.warnings.join(' · ')}`);
    }
  }
}
