import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A TEMPLATE REF IS `null` WHEN ITS ELEMENT IS GONE — never only `undefined` (ledger HC, the monkey's first finding,
 * 2026-11-08: «Информация › Очки» threw `querySelectorAll` of null in `ConsoleScoreExplorer.catRows` three tables out
 * of 129 — Vue stopped patching the subtree, the screen stopped updating).
 *
 * Vue 3 writes `null` into `$refs.x` when a `v-if` element unmounts. `this.$refs.x as HTMLElement | undefined` is a
 * cast that LIES about that, and every `=== undefined` check behind it lets the `null` through. The codebase carried
 * 500+ such casts; each is now normalized at the read — `(this.$refs.x ?? undefined) as T | undefined` — or followed by
 * its own `?? …`. A bare cast fails here with its file and line.
 */
const CLIENT = path.resolve(__dirname, '../../src/client');

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (/\.(vue|ts)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const BARE_CAST = /\$refs\.\w+ as [^\n;]*?\| undefined(\)?)(\s*\?\?)?/g;

describe('template ref null guard', () => {
  it('no ref is cast to `T | undefined` without turning its `null` into `undefined`', () => {
    const offenders: Array<string> = [];
    let normalized = 0;
    for (const file of walk(CLIENT)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) {
          return;
        }
        normalized += (line.match(/\$refs\.\w+ \?\? undefined\)/g) ?? []).length;
        for (const m of line.matchAll(BARE_CAST)) {
          if (m[2] === undefined) {
            offenders.push(`${path.relative(CLIENT, file).split(path.sep).join('/')}:${i + 1}`);
          }
        }
      });
    }
    expect(normalized, 'anti-vacuous: the normalized reads are found').to.be.greaterThan(300);
    expect(offenders, 'write `(this.$refs.x ?? undefined) as T | undefined`').to.deep.equal([]);
  });
});
