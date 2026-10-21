import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * TWO PARTS OF ONE PAYOUT ARE TWO PLATES — NEVER A PRINTED SEPARATOR BETWEEN THEM (PL-795).
 *
 * The vote panel's one-number reading lays a law's parts out as FRAMED plates in one wrapping row. A text
 * separator drawn as the RIGHT plate's `::before` («·») rode that plate onto the next line whenever the row
 * wrapped, so the wrapped line OPENED with a stray dot (RX40's «· [карта] 4 → +4» on the 4K vote frame). The
 * plates separate themselves by their own frames and the row's gap; a wrapped line always starts on a plate.
 * jsdom never computes a pseudo-element's content, so the rule is guarded where it lives — in the stylesheet.
 */
const FILE = path.resolve(__dirname, '..', '..', 'src', 'styles', 'console_influence_yield.less');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the influence yield — no printed separator between two parts (PL-795)', () => {
  it('no group of the reading draws a `content` before or after itself', () => {
    const css = stripComments(fs.readFileSync(FILE, 'utf8'));
    const offenders = css.split('\n')
      .map((line, i) => ({line: line.trim(), n: i + 1}))
      .filter(({line}) => /con-iyield__group[^{]*::(before|after)/.test(line) && /content\s*:/.test(line));
    expect(offenders.map((o) => `${o.n}: ${o.line}`), 'a separator riding a plate opens a wrapped line with it').to.deep.eq([]);
  });
});
