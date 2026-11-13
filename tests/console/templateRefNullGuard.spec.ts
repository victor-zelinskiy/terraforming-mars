import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A TEMPLATE REF IS `null` WHEN ITS ELEMENT IS GONE — never only `undefined` (ledger HC, the monkey's first finding,
 * 2026-11-08: «Информация › Очки» threw `querySelectorAll` of null in `ConsoleScoreExplorer.catRows` three tables out
 * of 129 — Vue stopped patching the subtree, the screen stopped updating).
 *
 * Vue 3 writes `null` into a template ref when a `v-if` element unmounts. A cast to `T | undefined` LIES about that,
 * and every `=== undefined` check behind it lets the `null` through. The codebase carried 500+ such casts; each is
 * normalized at the read, in the form of the component it stands in:
 *
 *  · `<script setup>` (every component since V3 wave 4) — the ref is `const x = useTemplateRef<T>('x')`, typed
 *    `T | null`, and a read that wants `undefined` says `x.value ?? undefined`. The compiler holds an UNCAST read to
 *    that; what it cannot see is a cast — `x.value as T | undefined` — which is the old lie in the new form;
 *  · the Options API (`this.$refs.x`, untyped) — `(this.$refs.x ?? undefined) as T | undefined`. No component is
 *    written that way any more; the rule stays so that one cannot come back unguarded.
 *
 * A bare cast fails here with its file and line.
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

const BARE_OPTIONS_CAST = /\$refs\.\w+ as [^\n;]*?\| undefined(\)?)(\s*\?\?)?/g;
/** The template refs a file declares: `const x = useTemplateRef<T>('key')`. */
const TEMPLATE_REF = /\bconst (\w+) = useTemplateRef\b/g;

describe('template ref null guard', function() {
  // A tree read, not logic: mocha's 2 s is no budget for it on a loaded machine (`.claude/rules/tests.md` § ⑤).
  // eslint-disable-next-line no-invalid-this
  this.timeout(30_000);

  it('no ref is cast to `T | undefined` without turning its `null` into `undefined`', () => {
    const offenders: Array<string> = [];
    let normalized = 0;
    let refsDeclared = 0;
    for (const file of walk(CLIENT)) {
      const text = fs.readFileSync(file, 'utf8');
      const refs = [...text.matchAll(TEMPLATE_REF)].map((m) => m[1]);
      refsDeclared += refs.length;
      // `x.value as … | undefined` with no `?? …` behind it, for a template ref `x` of this file
      const bareSetupCast = refs.length === 0 ? undefined :
        new RegExp(`(?<![\\w$.])(?:${refs.join('|')})\\.value as [^\\n;]*?\\| undefined(\\)?)(\\s*\\?\\?)?`, 'g');
      const normalizedSetupRead = refs.length === 0 ? undefined : new RegExp(`(?<![\\w$.])(?:${refs.join('|')})\\.value \\?\\? undefined`, 'g');
      const where = path.relative(CLIENT, file).split(path.sep).join('/');
      text.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) {
          return;
        }
        normalized += (line.match(/\$refs\.\w+ \?\? undefined\)/g) ?? []).length;
        if (normalizedSetupRead !== undefined) {
          normalized += (line.match(normalizedSetupRead) ?? []).length;
        }
        for (const m of [...line.matchAll(BARE_OPTIONS_CAST), ...(bareSetupCast === undefined ? [] : line.matchAll(bareSetupCast))]) {
          if (m[2] === undefined) {
            offenders.push(`${where}:${i + 1}`);
          }
        }
      });
    }
    expect(refsDeclared, 'anti-vacuous: the template refs are found').to.be.greaterThan(200);
    expect(normalized, 'anti-vacuous: the normalized reads are found').to.be.greaterThan(300);
    expect(offenders, 'write `x.value ?? undefined` (Options: `(this.$refs.x ?? undefined) as T | undefined`)').to.deep.equal([]);
  });
});
