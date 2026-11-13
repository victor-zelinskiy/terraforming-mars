#!/usr/bin/env node
/*
 * WHERE the Vapor compiler refuses a template (docs/claude/vapor/ROADMAP.md § 4a · B2).
 *
 *   node scripts/vapor/why-refused.mjs <component.vue> [more…]
 *
 * `vapor-check.mjs` says THAT a component is refused, with the compiler's sentence; this prints every error and
 * warning of the Vapor template compiler with its LINE in the file and the source of the node it points at — the
 * place to edit.
 */
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {parse} = require('@vue/compiler-sfc');
const vapor = require('@vue/compiler-vapor');

for (const file of process.argv.slice(2)) {
  const source = fs.readFileSync(file, 'utf8');
  const {descriptor} = parse(source, {filename: file});
  const template = descriptor.template;
  if (template === null) {
    console.log(`${file}: no template`);
    continue;
  }
  const firstLine = template.loc.start.line;
  const found = [];
  const note = (kind) => (error) => {
    const loc = error.loc;
    found.push({kind, message: error.message, line: loc ? firstLine + loc.start.line - 1 : undefined, source: loc ? loc.source.split('\n')[0].slice(0, 140) : ''});
  };
  try {
    vapor.compile(template.content, {filename: file, onError: note('error'), onWarn: note('warn'), bindingMetadata: {}});
  } catch (error) {
    note('threw')(error);
  }
  console.log(`${file} — ${found.length} finding(s)`);
  for (const f of found) {
    console.log(`  ${f.kind.padEnd(5)} line ${f.line ?? '?'}: ${f.message}\n        ${f.source}`);
  }
}
