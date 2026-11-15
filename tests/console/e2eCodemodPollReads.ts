/**
 * CODEMOD — a one-shot read of a live state becomes a POLL (FLAKE ZERO, class A; `.claude/rules/tests.md` § КАК ПИСАТЬ
 * E2E-ПРОВЕРКУ, law 4).
 *
 *   expect(await page.locator('.x').count(), 'msg').toBe(1);
 *     →  await expect.poll(() => page.locator('.x').count(), {message: 'msg'}).toBe(1);
 *
 * The read is the SAME expression and the matcher the SAME call: what the check asserts does not change, only WHEN it
 * looks — a poll that already holds returns at once, one that does not yet hold is given the expect timeout instead of
 * reading wherever the machine had got to. The detector is the scanner's (`tests/console/e2eFlakeScan.ts`
 * `oneShotReads`), so a site this rewrites is a site the guard stops counting. Only a STANDALONE statement is
 * rewritten (after `;` `{` `}`, ending in `;`) — an `expect` inside an expression is left for a hand.
 *
 * Usage: tsx tests/console/e2eCodemodPollReads.ts [--write] [file.spec.ts …]   (no files = every spec; dry run by default)
 */
import * as fs from 'fs';
import * as path from 'path';
import {allE2eFiles, E2E_DIR, oneShotReads, stripComments} from './e2eFlakeScan';

const write = process.argv.includes('--write');
const exceptArg = process.argv.indexOf('--except');
const except = new Set(exceptArg >= 0 ? process.argv[exceptArg + 1].split(',').map((f) => path.basename(f.trim())) : []);
const named = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--except').map((f) => path.basename(f));
const files = (named.length > 0 ? named : allE2eFiles().filter((f) => f.endsWith('.spec.ts'))).filter((f) => !except.has(f));

let total = 0;
let skipped = 0;
for (const rel of files) {
  const file = path.join(E2E_DIR, rel);
  const raw = fs.readFileSync(file, 'utf8');
  const text = stripComments(raw);
  const sites = oneShotReads(text);
  if (sites.length === 0) {
    continue;
  }
  let out = raw;
  let n = 0;
  // From the end: earlier offsets stay valid.
  for (const s of [...sites].sort((a, b) => b.start - a.start)) {
    const before = text.slice(0, s.start).replace(/\s+$/, '');
    const after = text.slice(s.end).replace(/^\s+/, '');
    const standalone = (before === '' || /[;{}]$/.test(before)) && after.startsWith(';');
    if (!standalone) {
      skipped++;
      console.log(`  skip ${rel}:${text.slice(0, s.start).split('\n').length} (not a standalone statement)`);
      continue;
    }
    const asyncRead = /\bawait\b/.test(s.read) ? 'async ' : '';
    const message = s.message === '' ? '' : `, {message: ${s.message}}`;
    const replacement = `await expect.poll(${asyncRead}() => ${s.read}${message})${s.chain}`;
    out = out.slice(0, s.start) + replacement + out.slice(s.end);
    n++;
  }
  total += n;
  console.log(`${rel}: ${n} rewritten`);
  if (write && n > 0) {
    fs.writeFileSync(file, out);
  }
}
console.log(`${write ? 'rewrote' : 'would rewrite'} ${total} one-shot reads (${skipped} skipped)`);
