import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';

/*
 * P55 · FO — THE HAND'S REVEAL EPISODE HAS A REACTIVE EDGE (invariant 17). `isHandRevealEpisodeRunning()` is read by
 * the shell's computed `handScrollActive` (the right stick's target in the album) over PLAIN module state (`building`,
 * `episode`, `episode.finished` — a GSAP timeline is never made reactive): a computed that read «running» during the
 * album's open kept that answer until an unrelated edge, and the stick was dead in the album. Every write now bumps the
 * episode's epoch and the predicate is declared to the reactivity witness. This guard keeps the next write site honest:
 * a write with no edge after it is the latch coming back.
 */
const FILE = path.resolve('src/client/console/handDock/handRevealDirector.ts');

describe('hand reveal episode — every write has its reactive edge', () => {
  const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);

  it('the predicate is declared to the witness and reads the epoch', () => {
    const src = lines.join('\n');
    expect(src).to.match(/export const isHandRevealEpisodeRunning = reactivePredicate\('hand-reveal-episode'/);
    expect(src).to.match(/void episodeEdge\.value;/);
  });

  it('every write to building / episode / episode.finished is followed by markEpisodeEdge()', () => {
    const writes = /^\s*(building = (true|false);|episode = [^=]|ep\.finished = true;)/;
    const naked: Array<string> = [];
    lines.forEach((line, i) => {
      if (writes.test(line) && !/markEpisodeEdge\(\);/.test(lines[i + 1] ?? '')) {
        naked.push(`${i + 1}: ${line.trim()}`);
      }
    });
    expect(naked, 'a write with no reactive edge after it').to.deep.eq([]);
    expect(lines.filter((l) => writes.test(l)).length, 'the write sites were found').to.be.greaterThan(5);
  });
});
