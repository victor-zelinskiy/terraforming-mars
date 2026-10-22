#!/usr/bin/env node
/**
 * THE LIVE-START → API CODEMOD for the MarsBot corporation family (the e2e speed iteration, phase 2: «live-start
 * specs → fixtures / the API where the opening is not the subject»).
 *
 * Eighteen specs probe the BOT's board after a game begins and drove the whole opening through the UI to get there:
 * `page.goto(player)` → wait for the shell → `bootToBoard(page)` (walkToSummary → submitSummary → playStartQueue →
 * the board home). Measured on the Steam Machine: ≈ 57 s of a 63 s test was that walk (156 sleeps + 34 presses),
 * while none of these specs asserts anything about the opening. `bootSeededGame(page, request, id)` answers the same
 * pregame over the API and opens the console straight on the board (≈ 3 s).
 *
 * It rewrites exactly the four-line shape and nothing else:
 *   await page.goto(`/player?id=${players[0].id}&console=1`);
 *   await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
 *   await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
 *   (blank)
 *   await bootToBoard(page);
 * → await bootSeededGame(page, request, players[0].id);
 * and swaps `bootToBoard` for `bootSeededGame` in the `./consoleStart` import when it is no longer used.
 *
 *   node scripts/e2e-codemod-bot-boot.mjs            # dry run
 *   node scripts/e2e-codemod-bot-boot.mjs --write
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(ROOT, 'tests', 'e2e');
const write = process.argv.includes('--write');

const SHAPE = new RegExp(
  String.raw`([ \t]*)await page\.goto\(\`/player\?id=\$\{players\[0\]\.id\}&console=1\`\);\r?\n` +
  String.raw`[ \t]*await page\.waitForSelector\('\.con-start__frame, \.con-root', \{timeout: 45_000\}\);\r?\n` +
  String.raw`[ \t]*await page\.waitForSelector\('\.con-load', \{state: 'detached'\}\)\.catch\(\(\) => \{\}\);\r?\n` +
  String.raw`(?:[ \t]*\r?\n)?` +
  String.raw`[ \t]*await bootToBoard\(page\);(\r?\n)`,
);

let changed = 0;
for (const name of fs.readdirSync(E2E).filter((f) => /^console-bot-corp.*\.spec\.ts$/.test(f)).sort()) {
  const file = path.join(E2E, name);
  const src = fs.readFileSync(file, 'utf8');
  const m = SHAPE.exec(src);
  if (!m) {
    console.log(`skip  ${name} — not the four-line shape (hand-check)`);
    continue;
  }
  let out = src.replace(SHAPE, `${m[1]}await bootSeededGame(page, request, players[0].id);${m[2]}`);
  if (!/\bbootToBoard\(/.test(out)) {
    out = out.replace(/(import \{[^}]*)\bbootToBoard\b([^}]*\} from '\.\/consoleStart';)/, (_, a, b) => {
      const names = `${a}bootSeededGame${b}`;
      return names;
    });
  }
  if (!/import \{[^}]*\bbootSeededGame\b[^}]*\} from '\.\/consoleStart';/.test(out)) {
    console.log(`skip  ${name} — could not fix its import (hand-check)`);
    continue;
  }
  changed += 1;
  console.log(`${write ? 'rewrote' : 'would rewrite'}  ${name}`);
  if (write) {
    fs.writeFileSync(file, out);
  }
}
console.log(`\n${changed} file(s)${write ? ' rewritten' : ' would change'}`);
