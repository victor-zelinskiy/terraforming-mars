import {expect} from 'chai';
import {
  discardPileAnchorOf, discardPileHeldBy, discardPileState, ensureDiscardPileCount, landOnDiscardPile,
  noteDiscardPileClosed, openDiscardPile, releaseDiscardPile, releaseDiscardPileExcept, resetDiscardPile,
  whenDiscardPileClosed,
} from '@/client/console/discardPile/discardPile';

/**
 * «СБРОШЕННЫЕ» — THE DISCARD PILE, one object of the table (TR52, the owner's concept (a) of 2026-10-13).
 *
 * The pure half: WHERE the pile hangs (beside the HUD deck, under the strip — measured, never a viewport share) and
 * WHO holds it out (named leases; the last release closes it; an episode's count lives until the pile has fully
 * closed). The DOM half (the slide, the landings) is the stand's and the e2e's.
 */
describe('discardPile', () => {
  beforeEach(() => {
    resetDiscardPile();
  });
  after(() => {
    resetDiscardPile();
  });

  describe('the home — UNDER the HUD deck, below the strip\'s chip lane (PL-260, PL-271)', () => {
    const base = {stripBottom: 104, viewportW: 3840, plateW: 424, safeRight: 36};

    it('the plate\'s left edge is the deck pile\'s — the stack under the stack; its clip hangs from the strip\'s bottom edge', () => {
      const a = discardPileAnchorOf({...base, deck: {left: 3240, top: 20, width: 53, height: 76}, count: {left: 3300, top: 30, width: 50, height: 44}});
      expect(a).deep.eq({left: 3240, top: 104});
    });

    it('a deck near the right edge: the plate shifts left to stay inside the safe edge, never off screen (the 1080 strip after the events counter left)', () => {
      // Measured 2026-10-13 at 1080: the deck pile ~1700, the count 1747–1783, the plate 212 px, the safe edge 18.
      const a = discardPileAnchorOf({stripBottom: 44, viewportW: 1920, plateW: 212, safeRight: 18,
        deck: {left: 1700, top: 8, width: 40, height: 30}, count: {left: 1747, top: 8, width: 36, height: 28}});
      expect(a).deep.eq({left: 1920 - 18 - 212, top: 44});
      expect(a.left).lessThanOrEqual(1700);
    });

    it('no pile measurable: the count is the anchor; nothing measurable: the top-right corner', () => {
      const viaCount = discardPileAnchorOf({...base, deck: undefined, count: {left: 3300, top: 30, width: 50, height: 44}});
      expect(viaCount.left).eq(3300);
      const corner = discardPileAnchorOf({...base, deck: undefined, count: undefined});
      expect(corner).deep.eq({left: 3840 - 36 - 424, top: 104});
    });
  });

  describe('the leases — one pile, held out by its owners, closed by the last one', () => {
    it('the first lease brings the pile out; another owner joins the SAME pile; the last release closes it', () => {
      openDiscardPile('scene:7');
      expect(discardPileState.visible).eq(true);
      openDiscardPile('reveal:7');
      expect(discardPileState.holders).deep.eq(['reveal:7', 'scene:7']);
      releaseDiscardPile('scene:7');
      expect(discardPileState.visible, 'the reveal still holds it').eq(true);
      releaseDiscardPile('reveal:7');
      expect(discardPileState.visible).eq(false);
      expect(discardPileHeldBy('reveal:7')).eq(false);
    });

    it('a lease is idempotent per name, and releasing a name nobody holds changes nothing', () => {
      openDiscardPile('hand-discard');
      openDiscardPile('hand-discard');
      releaseDiscardPile('colony');
      expect(discardPileState.visible).eq(true);
      releaseDiscardPile('hand-discard');
      expect(discardPileState.visible).eq(false);
    });

    it('a family sweep releases its own names and keeps the rest', () => {
      openDiscardPile('stream:3');
      openDiscardPile('stream:4');
      openDiscardPile('colony');
      releaseDiscardPileExcept('stream:', ['stream:4']);
      expect(discardPileState.holders).deep.eq(['colony', 'stream:4']);
    });
  });

  describe('the count — landings, the server\'s floor, the episode', () => {
    it('ticks on each landing and answers with a pulse', () => {
      openDiscardPile('scene:1');
      landOnDiscardPile();
      landOnDiscardPile();
      expect(discardPileState.count).eq(2);
      expect(discardPileState.pulseNonce).eq(2);
    });

    it('a reveal that never saw the flights raises the count to the server\'s number — and never lowers it', () => {
      openDiscardPile('reveal:2');
      ensureDiscardPileCount(3);
      expect(discardPileState.count).eq(3);
      ensureDiscardPileCount(1);
      expect(discardPileState.count).eq(3);
    });

    it('the episode ends only once the pile has fully CLOSED: a lease taken during the leave carries the count on', async () => {
      openDiscardPile('scene:5');
      landOnDiscardPile();
      releaseDiscardPile('scene:5');
      openDiscardPile('hand-discard'); // re-opened before the leave finished
      noteDiscardPileClosed();
      expect(discardPileState.count, 'the same pile carries on').eq(1);
      releaseDiscardPile('hand-discard');
      const closed = whenDiscardPileClosed();
      noteDiscardPileClosed();
      await closed;
      expect(discardPileState.count).eq(0);
      expect(discardPileState.anchor).eq(undefined);
    });
  });
});
