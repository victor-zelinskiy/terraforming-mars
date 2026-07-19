import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TV TYPE-FLOOR GUARD (docs/CONSOLE_TV_PREMIUM_PLAN.md §3.4 / §8.1): the TV
 * profile's own stylesheet must never set text below the couch floor —
 * 0.8rem = 16 logical px. Base sheets may keep smaller handheld sizes;
 * the TV recomposition exists precisely to raise them, so a sub-floor
 * font-size HERE is always a bug.
 */
describe('console_tv.less type floor', () => {
  it('declares no font-size below 0.8rem', () => {
    const file = path.join(__dirname, '..', '..', 'src', 'styles', 'console_tv.less');
    const text = fs.readFileSync(file, 'utf8');
    const offenders: Array<string> = [];
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const noComments = line.replace(/\/\*.*?\*\//g, '');
      if (noComments.trim().startsWith('*') || noComments.trim().startsWith('/*')) {
        return;
      }
      const m = noComments.match(/font-size:\s*(0?\.\d+)rem/);
      if (m !== null && Number(m[1]) < 0.8) {
        offenders.push(`${i + 1}: ${line.trim()}`);
      }
    });
    expect(offenders, 'sub-floor font sizes in the TV profile:\n' + offenders.join('\n')).to.be.empty;
  });
});
