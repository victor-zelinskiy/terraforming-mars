import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * NO UNIVERSAL SIBLING PAIR — `* + x` / `* ~ x` — IN ANY STYLESHEET.
 *
 * The «owl» (`> * + *`) reads as the cheapest way to space a row's children,
 * and in Blink it is one of the most expensive selectors there is: the
 * compound LEFT of a sibling combinator is what the engine keys its sibling
 * invalidation on, and a universal one has no feature to key on — so the rule
 * lands in the UNIVERSAL sibling invalidation set, and from then on EVERY
 * insertion or removal of ANY element anywhere in the document restyles the
 * whole subtree of that node's next sibling.
 *
 * Measured (Turmoil Redux TR25, the A/B of an ordinary colony build against
 * the base build): one such rule in `console_colony_berths.less` took the
 * style recalc on the build's press from 323 elements / 2.9 ms to 1204
 * elements / 7.0 ms — the mount of one shell-level layer restyled every
 * surface after it — and the cube's proxy was born a frame later. Nothing
 * about the rule's own block was on screen.
 *
 * Key the pair on a class (`> .player-cube + .player-cube`). A pair INSIDE
 * `:has(…)` is a different invalidation mechanism and is not judged here.
 */
const STYLES = path.resolve(__dirname, '..', '..', 'src', 'styles');

/** Comments blanked (newlines kept — the guard reports line numbers). */
function stripComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/.*$/gm, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

describe('stylesheets — no universal sibling pair (`* + x`, `* ~ x`)', () => {
  it('the scanner sees an owl and spares a class-keyed pair, a calc and a `:has()`', () => {
    const owl = /(^|[\s>{,(])\*\s*[+~]\s/;
    expect(owl.test('  > * + * { margin: 0; }')).to.eq(true);
    expect(owl.test('  * ~ .x { margin: 0; }')).to.eq(true);
    expect(owl.test('  > .player-cube + .player-cube { margin: 0; }')).to.eq(false);
    expect(owl.test('  width: calc(2 * 3rem + 1px);')).to.eq(false);
    expect(owl.test('  &__ask + * { margin: 0; }')).to.eq(false);
  });

  it('no stylesheet declares one', () => {
    const files = fs.readdirSync(STYLES).filter((name) => name.endsWith('.less'));
    expect(files.length, 'the stylesheets were found').to.be.greaterThan(20);
    const offenders: Array<string> = [];
    for (const name of files) {
      const lines = stripComments(fs.readFileSync(path.join(STYLES, name), 'utf8')).split('\n');
      lines.forEach((line, index) => {
        // A pair inside `:has(…)` is not a sibling invalidation of the document.
        const judged = line.replace(/:has\([^)]*\)/g, '');
        if (/(^|[\s>{,(])\*\s*[+~]\s/.test(judged)) {
          offenders.push(`${name}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `a universal sibling pair restyles the document on every insertion — key it on a class:\n${offenders.join('\n')}`).to.deep.eq([]);
  });
});
