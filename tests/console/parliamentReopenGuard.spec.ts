import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE OVERVIEW AFTER A SITTING IS OPENED BY ITS OWN HELPER.
 *
 * A sitting the viewer just closed is still the `.con-parl` on screen for a while (its results page stands until the
 * phase's own leave takes it down), so `openParliament` counts that surface, opens nothing and hands the caller a
 * sitting whose body is not the parties — the overview's ruler slot empty — and the section leaves a beat later
 * (CI 2026-11-11, `console-parliament-gallery` «Unity in power»: the ruler «not found»). Right after `closeSitting(page …)`
 * the overview is opened by `openParliamentAfterSitting` (`parliamentDrive.ts`), which waits for the sitting to leave
 * and for the overview's ruler to stand. A plain `openParliament(page)` within a few lines of a `closeSitting(page`
 * fails here with its file and line.
 */
const E2E = path.resolve(__dirname, '../e2e');
const WINDOW = 6;

describe('parliament reopen guard', () => {
  it('the overview after a closed sitting is opened by openParliamentAfterSitting, never by openParliament', () => {
    const offenders: Array<string> = [];
    for (const name of fs.readdirSync(E2E).filter((f) => f.endsWith('.spec.ts'))) {
      const lines = fs.readFileSync(path.join(E2E, name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/closeSitting\(page\b/.test(line)) {
          return;
        }
        for (let j = i + 1; j <= Math.min(lines.length - 1, i + WINDOW); j++) {
          if (/\bopenParliament\(page\b/.test(lines[j])) {
            offenders.push(`${name}:${j + 1}`);
          }
        }
      });
    }
    expect(offenders, 'open the overview after a closed sitting with `openParliamentAfterSitting(page)`').to.deep.equal([]);
  });

  it('the helper waits for the sitting to leave and for the overview\'s ruler', () => {
    const drive = fs.readFileSync(path.join(E2E, 'parliamentDrive.ts'), 'utf8');
    const body = drive.slice(drive.indexOf('export async function openParliamentAfterSitting'));
    expect(body, 'the helper exists').to.match(/^export async function openParliamentAfterSitting/);
    expect(body.slice(0, 900)).to.include('.con-parl[data-sitting-stage], .con-parl[data-parl-leaving]');
    expect(body.slice(0, 900)).to.include('[data-parl-ruler-slot] .con-parl__party[data-party]');
  });
});
