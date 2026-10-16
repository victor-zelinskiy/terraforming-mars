import {expect} from 'chai';
import {nextTick} from 'vue';
import {relativeDeltas, settleTop, SettledColumn} from '../../src/client/console/settledColumn';

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

  describe('stop — the unmount writes NOTHING to the column (the leave keeps it painted)', () => {
    // A column and its block, faked to the few members the pin touches: the block stands 240 px into a 1000 px column.
    function stand(): {column: FakeEl, block: FakeEl} {
      const column = new FakeEl({top: 0, height: 1000});
      const block = new FakeEl({top: 240, height: 400});
      block.parentElement = column;
      return {column, block};
    }
    class FakeEl {
      public style: Record<string, string> = {};
      public attrs = new Map<string, string>();
      public parentElement: FakeEl | null = null;
      public clientTop = 0;
      public clientWidth = 600;
      public clientHeight: number;
      public offsetHeight: number;
      constructor(private readonly box: {top: number, height: number}) {
        this.clientHeight = box.height;
        this.offsetHeight = box.height;
      }
      getBoundingClientRect() {
        return {top: this.box.top, left: 0, width: 600, height: this.box.height};
      }
      setAttribute(k: string, v: string) {
        this.attrs.set(k, v);
      }
      removeAttribute(k: string) {
        this.attrs.delete(k);
      }
      querySelectorAll() {
        return [];
      }
    }
    const g = globalThis as unknown as {getComputedStyle?: unknown};
    let saved: unknown;
    before(() => {
      saved = g.getComputedStyle;
      g.getComputedStyle = () => ({paddingTop: '0px', paddingBottom: '0px', position: 'static'});
    });
    after(() => {
      g.getComputedStyle = saved;
    });

    it('the press PINS the block where it stands; the unmount leaves the pin on the dying node', () => {
      const {column, block} = stand();
      const settled = new SettledColumn({
        column: () => column as unknown as HTMLElement,
        block: () => block as unknown as HTMLElement,
        active: () => true,
      });
      settled.pin();
      expect(column.style.paddingTop, 'pinned at its centred top').eq('240px');
      expect(column.style.justifyContent).eq('flex-start');
      settled.stop();
      // Un-pinning here re-centred the column on the leave's first frame: the colony ledger jumped 134 px (fhd) at full
      // opacity as the workspace left. The node dies with the mount — its inline pin goes with it.
      expect(column.style.paddingTop, 'never un-pinned by the unmount').eq('240px');
      expect(column.style.justifyContent).eq('flex-start');
      expect(column.attrs.has('data-settled')).is.true;
    });

    it('back from a step (TR56): the pin is re-clamped against the block that RETURNS, after the patch — never the step that left', async () => {
      const {column, block} = stand();
      const settled = new SettledColumn({
        column: () => column as unknown as HTMLElement,
        block: () => block as unknown as HTMLElement,
        active: () => true,
      });
      settled.pin();
      expect(column.style.paddingTop).eq('240px');
      settled.suspend(true);
      expect(column.style.paddingTop, 'the step owns the column').eq('');
      // The host's `pre` watcher resumes while the DOM still holds the (short) step…
      settled.suspend(false);
      expect(column.style.paddingTop).eq('240px');
      // …then the patch puts the review back, taller than the room under the old pin: 240 + 900 > 1000.
      block.offsetHeight = 900;
      block.clientHeight = 900;
      (block as unknown as {getBoundingClientRect: () => unknown}).getBoundingClientRect = () => ({top: 240, left: 0, width: 600, height: 900});
      await nextTick();
      expect(column.style.paddingTop, 'the block rises exactly as far as it must — its scroller never turns on').eq('100px');
    });

    it('a live RELEASE (a new composition) still un-pins — only the unmount is state-only', () => {
      const {column, block} = stand();
      const settled = new SettledColumn({
        column: () => column as unknown as HTMLElement,
        block: () => block as unknown as HTMLElement,
        active: () => true,
      });
      settled.pin();
      settled.release();
      expect(column.style.paddingTop).eq('');
      expect(column.attrs.has('data-settled')).is.false;
    });
  });
});
