import {expect} from 'chai';
import {readFileSync} from 'fs';
import {join} from 'path';
import {analyseBeats, BeatSample, heldIntervals} from '../e2e/beatWitness';

/**
 * THE BEAT WITNESS'S HELD ENTRY (`tests/e2e/beatWitness.ts`) — pure, so its law is held here, not re-learned on CI.
 * A Web Animation created in the frames of a mount is PENDING until the compositor resolves its start, and the main
 * thread reads it at its START keyframe (`fill: backwards`) all that while — CI 2026-11-11, run 42998242617,
 * `console-smoothness` (A): the step's cards held at 0 through the whole window, «cards –→–», «never half there». A held
 * interval is the frames' time (netted out like a long task), a jump out of a held read is no snap, and the window must
 * not close on a held part (`awaitBeatsSettled`).
 */
function s(t: number, cards: number, opts: {anim?: boolean, held?: boolean} = {}): BeatSample {
  return {t, vis: {cards}, anim: {cards: opts.anim ?? false}, held: {cards: opts.held ?? false}};
}

describe('beat witness · a held entry', () => {
  it('a part that jumps 0 → 1 with nothing moving is a snap', () => {
    const r = analyseBeats([s(0, 0), s(18, 1)]);
    expect(r.marks.cards.snapped).to.deep.equal({t: 18, gap: 18});
  });

  it('a jump out of a HELD read is no snap — the compositor was already playing it', () => {
    const r = analyseBeats([s(0, 0, {held: true}), s(18, 1)]);
    expect(r.marks.cards.snapped).to.equal(undefined);
  });

  it('a running animation on either side is no snap', () => {
    expect(analyseBeats([s(0, 0, {anim: true}), s(18, 1)]).marks.cards.snapped).to.equal(undefined);
    expect(analyseBeats([s(0, 0), s(18, 1, {anim: true})]).marks.cards.snapped).to.equal(undefined);
  });

  it('heldIntervals spans each held read to the next read', () => {
    const r = analyseBeats([s(0, 0), s(28, 0, {anim: true, held: true}), s(300, 0, {anim: true, held: true}), s(420, 0.4, {anim: true}), s(600, 1)]);
    expect(heldIntervals(r, 'cards')).to.deep.equal([[28, 272], [300, 120]]);
  });

  it('a trail with no held field yields no intervals (old reports stay readable)', () => {
    const r = analyseBeats([{t: 0, vis: {cards: 0}, anim: {cards: false}}, {t: 40, vis: {cards: 1}, anim: {cards: true}}]);
    expect(heldIntervals(r, 'cards')).to.deep.equal([]);
  });

  it('the source: the witness reads `pending`, takes a last sample at stop, and the smoothness window waits for the cards', () => {
    const witness = readFileSync(join(__dirname, '../e2e/beatWitness.ts'), 'utf8');
    expect(witness).to.match(/a\.pending/);
    expect(witness).to.match(/held\[name\] = heldOf\(el\)/);
    expect(witness).to.match(/stop: \(\) => \{[\s\S]{0,400}?sample\(\);[\s\S]{0,40}?stopped = true/);
    const spec = readFileSync(join(__dirname, '../e2e/console-smoothness.spec.ts'), 'utf8');
    expect(spec).to.match(/awaitBeatsSettled\(page, \['cards'\]/);
    expect(spec.match(/glassNet\(glass, long, held\)/g)?.length).to.equal(2);
  });
});
