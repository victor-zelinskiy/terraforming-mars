import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE CHAIN's PHASE HAS ONE WRITER, OWNED BY ITS RUN (FREEZE ZERO — the box's game 1431). A second «hurry» cut a rival
 * reaction inside its read beat; the old continuation, past its last await, still wrote `paying`, nothing wrote the
 * phase again, and the card-reaction hold (`phase !== 'idle'`) stood with nothing on screen until the foreground
 * watchdog expired it. Every write now goes through `setReactionPhase(run, phase)`, which refuses a run that is not the
 * current one — and only the cut writes past it. A new direct write is the old class coming back: this row refuses it.
 */
const DIRECTOR = path.resolve('src/client/console/cardReaction/cardReactionDirector.ts');

describe('cardReactionDirector — the phase has one writer, owned by its run', () => {
  const src = fs.readFileSync(DIRECTOR, 'utf8');
  const writes = [...src.matchAll(/cardReactionState\.phase = /g)].map((m) => src.slice(0, m.index).split('\n').length);

  it('reads the director (anti-vacuous): the writer and the cut are found', () => {
    expect(src).to.contain('function setReactionPhase(run: number');
    expect(src).to.contain('export function cutCardReactions(');
  });

  it('every write of the phase is the writer\'s or the cut\'s — no continuation writes it directly', () => {
    const lineOf = (needle: string): number => src.slice(0, src.indexOf(needle)).split('\n').length;
    const writerAt = lineOf('function setReactionPhase(run: number');
    const cutAt = lineOf('export function cutCardReactions(');
    const owner = (line: number): string => {
      const within = (start: number) => line > start && line < start + 40;
      return within(writerAt) ? 'writer' : within(cutAt) ? 'cut' : `line ${line}`;
    };
    expect(writes.map(owner).sort(), 'route the write through `setReactionPhase(run, …)` and return when it refuses').to.deep.equal(['cut', 'writer']);
  });
});
