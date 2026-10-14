import {expect} from 'chai';
import {relativeDeltas, settleTop} from '../../src/client/console/settledColumn';

/**
 * THE SETTLED COLUMN — the pure geometry of a decision column that composes centred and never re-centres while the
 * player decides in it (the owner's 4K report of 2026-10-14: choosing a variant re-centred the column and slid the
 * tiles 126 px under the cursor). The DOM half is guarded by e2e `console-variant-settle`.
 */
describe('settledColumn', () => {
  describe('settleTop — the pin stays, the clamp moves it up only as far as it must', () => {
    it('a block that still fits keeps its pinned top (growth goes DOWNWARD)', () => {
      expect(settleTop(300, 1700, 900)).eq(300);
      expect(settleTop(300, 1700, 1400), 'exactly to the floor').eq(300);
    });

    it('a block that would overflow rises by the overflow — never re-centres', () => {
      expect(settleTop(300, 1700, 1500)).eq(200);
    });

    it('a block taller than the column stands at the top (the scroller takes the rest)', () => {
      expect(settleTop(300, 1700, 2400)).eq(0);
    });

    it('a block that shrinks keeps its top (the bottom comes up, nothing above moves)', () => {
      expect(settleTop(120, 1700, 300)).eq(120);
    });
  });

  describe('relativeDeltas — each group slides by its OWN move, never its parent\'s twice', () => {
    it('a group under a parent that moved by the same amount does not slide again', () => {
      // block (0) moved up 40; a row (1) inside it moved up 40 too; the commit rail (2) inside it moved DOWN 243 relative.
      const before = [{top: 500, parent: -1}, {top: 600, parent: 0}, {top: 1000, parent: 0}];
      const after = [{top: 460, parent: -1}, {top: 560, parent: 0}, {top: 1203, parent: 0}];
      expect(relativeDeltas(before, after)).deep.eq([40, 0, -243]);
    });

    it('a NEW group has no delta (it rises in instead)', () => {
      const before = [{top: 500, parent: -1}, undefined];
      const after = [{top: 500, parent: -1}, {top: 700, parent: 0}];
      expect(relativeDeltas(before, after)).deep.eq([0, undefined]);
    });

    it('nested twice: a chip row inside a section inside the block', () => {
      const before = [{top: 0, parent: -1}, {top: 100, parent: 0}, {top: 120, parent: 1}];
      const after = [{top: 0, parent: -1}, {top: 150, parent: 0}, {top: 170, parent: 1}];
      expect(relativeDeltas(before, after)).deep.eq([0, -50, 0]);
    });
  });
});
