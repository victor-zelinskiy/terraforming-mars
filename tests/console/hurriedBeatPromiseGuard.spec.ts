import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';

/*
 * NO PROMISE AWAITS A BARE HURRIED BEAT (FREEZE ZERO — the autopilot in a real browser, CI run 45494668264, game 56,
 * finding #137: «"card-receive" held for over 35000ms — force-released by the safety ceiling»).
 *
 * `scheduleHurriedParliamentBeat` is dropped UNFIRED by a kill, and the silent teardown of the flights
 * (`killParliamentFlights` — a stage's ceiling recovering its poses, the section's unmount) drops every pending one.
 * A CALLBACK scheduled that way simply never runs; a PROMISE resolved only by it never ends — and whatever awaits it
 * (a scene, with its hold) stands until a ceiling. A scene that awaits the hurried clock takes
 * `hurriedParliamentWait`, which carries its own net.
 */
const ROOT = path.resolve('src', 'client');

function sources(dir: string): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sources(full));
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('a promise never awaits a bare hurried Parliament beat', () => {
  it('every awaited wait on the hurried clock goes through `hurriedParliamentWait` (its own net ends it)', () => {
    const found: Array<string> = [];
    for (const file of sources(ROOT)) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (line.includes('new Promise') && line.includes('scheduleHurriedParliamentBeat(')) {
          found.push(`${path.relative(process.cwd(), file).replace(/\\/g, '/')}:${i + 1}`);
        }
      });
    }
    expect(found, 'a promise resolved only by a hurried beat never ends after a silent teardown of the flights — use hurriedParliamentWait').deep.eq([]);
  });
});
