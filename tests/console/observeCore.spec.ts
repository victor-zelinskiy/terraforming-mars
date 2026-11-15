import {expect} from 'chai';
import {firstWhere, inOrder, readTrail, sameJson, sequenceOf, settledValue} from '../e2e/observeCore';

/**
 * The pure half of the e2e observation primitives (`readSettled` · `armWitness`, FLAKE ZERO): what «settled», «ever»
 * and «in order» mean is decided here, once, and pinned — the page halves only feed it reads.
 */
describe('e2e observation core', () => {
  describe('settledValue — two reads a frame apart that agree', () => {
    it('is short until the last `equal` reads agree', () => {
      expect(settledValue([], 2)).to.equal(undefined);
      expect(settledValue([10], 2)).to.equal(undefined);
      expect(settledValue([10, 12], 2)).to.equal(undefined);
      expect(settledValue([10, 12, 12], 2)).to.deep.equal({value: 12});
    });

    it('a mid-motion read is never the answer — only the tail counts', () => {
      // An entrance read once at its first keyframe, then twice at rest.
      expect(settledValue([{y: 40}, {y: 22}, {y: 18}, {y: 18}], 2)).to.deep.equal({value: {y: 18}});
      expect(settledValue([{y: 18}, {y: 18}, {y: 22}], 2)).to.equal(undefined);
    });

    it('a longer streak can be demanded, and equality can be the caller’s', () => {
      expect(settledValue([1, 1, 2, 2], 3)).to.equal(undefined);
      expect(settledValue([1, 2, 2, 2], 3)).to.deep.equal({value: 2});
      const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
      expect(settledValue([10, 10.2], 2, near)).to.deep.equal({value: 10.2});
    });

    it('equal ≤ 1 accepts the single read (the caller asked for none)', () => {
      expect(settledValue([7], 1)).to.deep.equal({value: 7});
      expect(settledValue([7], 0)).to.deep.equal({value: 7});
    });
  });

  describe('a recording read as questions', () => {
    const rec = [
      {t: 1, v: {plate: false, n: 0}, doc: 'a'},
      {t: 2, v: {plate: true, n: 0}, doc: 'a'},
      {t: 3, v: {plate: true, n: 1}, doc: 'a'},
      {t: 9, v: {plate: false, n: 1}, doc: 'b'},
    ];

    it('firstWhere finds the first sample, across documents', () => {
      expect(firstWhere(rec, (v) => v.plate)?.t).to.equal(2);
      expect(firstWhere(rec, (v) => v.n > 5)).to.equal(undefined);
    });

    it('sequenceOf collapses repeats — what happened, whatever the frame rate', () => {
      expect(sequenceOf(rec.map((s) => s.v), (v) => v.plate)).to.deep.equal([false, true, false]);
      // The same story sampled twice as often reads the same.
      const dense = rec.flatMap((s) => [s.v, s.v]);
      expect(sequenceOf(dense, (v) => v.plate)).to.deep.equal([false, true, false]);
    });

    it('inOrder is a subsequence test — a slow machine skips states, it never reorders them', () => {
      expect(inOrder(['idle', 'plate', 'flight', 'tick', 'idle'], ['plate', 'tick'])).to.equal(true);
      expect(inOrder(['idle', 'tick', 'plate'], ['plate', 'tick'])).to.equal(false);
      expect(inOrder(['a'], [])).to.equal(true);
    });
  });

  it('sameJson treats undefined as null and compares structure', () => {
    expect(sameJson(undefined, null)).to.equal(true);
    expect(sameJson({a: 1}, {a: 1})).to.equal(true);
    expect(sameJson({a: 1}, {a: 2})).to.equal(false);
  });

  it('readTrail prints the last reads with their ordinals', () => {
    expect(readTrail([1, 2, 3], 2)).to.equal('  #2 2\n  #3 3');
  });
});
