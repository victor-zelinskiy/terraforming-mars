import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A LESS VARIABLE DIVIDED AS A TRANSFORM FUNCTION'S ARGUMENT IS NOT EVALUATED (colony polish 1).
 *
 * Less's parens-division math leaves `translateZ(@t / 2)` as it is, the browser receives
 * `translateZ(0.16rem / 2)` — invalid — and drops the WHOLE declaration. `console_card3d.less` shipped that way:
 * the Card3DInner faces had no thickness and the back was never turned away, hidden for months because every
 * flight also wore `.con-deal-proxy__back` (whose own rotateY did the turning). The first body that was ONLY a
 * Card3DInner — the settlement table's place — painted its back over its face. The division needs its own
 * parentheses: `translateZ((@t / 2))`.
 */
describe('lessDivisionGuard', () => {
  it('no transform function takes an unparenthesized variable division', () => {
    const dir = path.resolve('src/styles');
    const offenders: Array<string> = [];
    const pattern = /\b(?:translate[XYZ]?|translate3d|rotate[XYZ]?|scale[XYZ]?)\(\s*-?@[\w-]+\s*\/\s*[\d.]+\s*\)/;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.less'))) {
      // Comments go first (block comments span lines — blanked to spaces so the line numbers hold).
      const code = fs.readFileSync(path.join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, '');
      code.split('\n').forEach((line, i) => {
        if (pattern.test(line)) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'wrap the division in its own parentheses: translateZ((@t / 2))').to.deep.eq([]);
  });
});
