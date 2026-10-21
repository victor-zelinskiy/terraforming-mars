#!/usr/bin/env node
/**
 * THE `key()` CODEMOD (the e2e speed iteration, phase 2): 78 specs carry their own press helper —
 *
 *   async function key(page: Page, code: string, settleMs = 450): Promise<void> {
 *     await page.keyboard.press(code);
 *     await page.waitForTimeout(settleMs);
 *   }
 *
 * — a press plus a FIXED sleep that bypasses the driver's `press` (no echo wait, no adaptive quiet). This
 * rewrites the helper's BODY to `await press(page, code, settleMs);` and adds `press` to the spec's
 * `./consoleStart` import; every call site stays as it is. Variants handled: the parameter named `settle`,
 * the inline `import('@playwright/test').Page` type, `tap` as the name, any default.
 *
 *   node scripts/e2e-codemod-key-helper.mjs            # dry run — lists what would change
 *   node scripts/e2e-codemod-key-helper.mjs --write    # rewrites the files
 *
 * After `--write`: `npm run build:test`, `npm run e2e:baseline` (every file loses one `waitForTimeout(` —
 * the ratchet locks the fall), and the driver guard.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(ROOT, 'tests', 'e2e');
const write = process.argv.includes('--write');

// Any parameter names (`code`/`k`, `settleMs`/`settle`/`wait`), either Page type, CRLF or LF.
const HELPER = /async function (key|tap)\(page: (?:Page|import\('@playwright\/test'\)\.Page), (\w+): string, (\w+)(?: = (\d+))?\): Promise<void> \{\r?\n  await page\.keyboard\.press\(\2\);\r?\n  await page\.waitForTimeout\(\3\);\r?\n\}/g;

let changed = 0;
for (const name of fs.readdirSync(E2E).filter((f) => f.endsWith('.spec.ts')).sort()) {
  const file = path.join(E2E, name);
  const src = fs.readFileSync(file, 'utf8');
  if (!HELPER.test(src)) {
    HELPER.lastIndex = 0;
    continue;
  }
  HELPER.lastIndex = 0;
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let out = src.replace(HELPER, (_m, fn, codeParam, waitParam, def) =>
    `async function ${fn}(page: Page, ${codeParam}: string, ${waitParam}${def === undefined ? '' : ` = ${def}`}): Promise<void> {${eol}  await press(page, ${codeParam}, ${waitParam});${eol}}`);
  // `press` from the driver: extend an existing `./consoleStart` import or add one.
  const importRe = /import \{([^}]*)\} from '\.\/consoleStart';/;
  const m = importRe.exec(out);
  if (m) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.includes('press')) {
      names.push('press');
      names.sort((a, b) => a.localeCompare(b));
      out = out.replace(importRe, `import {${names.join(', ')}} from './consoleStart';`);
    }
  } else {
    out = out.replace(/(import [^\n]*from '\.\/consoleTest';\n)/, `$1import {press} from './consoleStart';\n`);
    if (!out.includes("import {press} from './consoleStart';")) {
      console.log(`  ?  ${name} — no ./consoleTest import to anchor on; skipped`);
      continue;
    }
  }
  // The inline Page type: make sure `Page` is imported when the helper used the inline form.
  if (/\(page: Page, code: string/.test(out) && !/\bPage\b.*from '\.\/consoleTest'|\bPage\b.*from '@playwright\/test'|type Page\b/.test(out)) {
    out = out.replace(/(import \{[^}]*)\} from '\.\/consoleTest';/, (mm, head) => head.includes('Page') ? mm : `${head}, Page} from './consoleTest';`);
  }
  changed += 1;
  console.log(`${write ? 'rewrote' : 'would rewrite'}  ${name}`);
  if (write) {
    fs.writeFileSync(file, out);
  }
}
console.log(`${changed} file(s)${write ? ' rewritten' : ' would change'}`);
