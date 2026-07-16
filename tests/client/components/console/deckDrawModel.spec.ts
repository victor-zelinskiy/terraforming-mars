import {expect} from 'chai';
import {
  DrawBeat, FULL_RHYTHM_DISCARDS, MIN_DISCARD_PACE, deckCountAfter, deckDrawBudgetMs,
  deckDrawTimings, discardPace, holdSlots, inspectPoint, planDeckDraw, planEndMs,
  reducedDeckDrawTimings,
} from '@/client/console/deckDraw/deckDrawModel';

/**
 * The PURE plan of the deck-draw cinematic. The invariants under test are the
 * ones the scene's semantics rest on: the server's order is replayed verbatim,
 * a discard is a fast beat and a match a fuller one, a long unlucky search
 * tightens instead of growing linearly, and no card is ever skipped.
 */
const T = deckDrawTimings();

function seq(...matched: ReadonlyArray<boolean>) {
  return matched.map((m) => ({matched: m}));
}

/** A beat's full occupancy (peel → travel → inspect → route). */
function endOf(b: DrawBeat): number {
  return b.atMs + T.peelMs + b.travelMs + b.inspectMs + b.routeMs;
}

describe('deckDrawModel', () => {
  describe('planDeckDraw — the server sequence is the script', () => {
    it('replays the reveal order VERBATIM, never grouping discards before matches', () => {
      const beats = planDeckDraw(seq(false, true, false, true), T, false);
      expect(beats.map((b) => b.kind)).to.deep.eq(['discard', 'match', 'discard', 'match']);
      expect(beats.map((b) => b.index)).to.deep.eq([0, 1, 2, 3]);
    });

    it('routes each card by its verdict: matches take hold slots, discards stack the tray', () => {
      const beats = planDeckDraw(seq(false, true, false, false, true), T, false);
      expect(beats.filter((b) => b.kind === 'match').map((b) => b.holdSlot)).to.deep.eq([0, 1]);
      expect(beats.filter((b) => b.kind === 'discard').map((b) => b.trayDepth)).to.deep.eq([0, 1, 2]);
      // A match never lands in the tray, a discard never occupies a hold slot.
      expect(beats.every((b) => (b.kind === 'match') === (b.holdSlot !== undefined))).to.eq(true);
      expect(beats.every((b) => (b.kind === 'discard') === (b.trayDepth !== undefined))).to.eq(true);
    });

    it('every revealed card gets a beat — a long search never skips or batches one', () => {
      const steps = seq(...Array.from({length: 24}, (_, i) => i === 23));
      const beats = planDeckDraw(steps, T, false);
      expect(beats).to.have.length(24);
      expect(beats.every((b) => b.travelMs > 0 && b.routeMs > 0)).to.eq(true);
    });

    it('a match gets a longer readable moment than a discard', () => {
      const beats = planDeckDraw(seq(false, true), T, false);
      expect(beats[1].inspectMs).is.greaterThan(beats[0].inspectMs);
    });

    it('only ONE card occupies the inspect zone at a time — the next peels off after it commits to leaving', () => {
      const beats = planDeckDraw(seq(false, false, true, false, true), T, false);
      for (let i = 1; i < beats.length; i++) {
        const prevLeavesInspect = beats[i - 1].atMs + T.peelMs + beats[i - 1].travelMs + beats[i - 1].inspectMs;
        // The next card starts peeling only after the previous one has begun
        // its exit, and its own inspect arrival is strictly later.
        expect(beats[i].atMs).is.greaterThanOrEqual(prevLeavesInspect);
        expect(beats[i].atMs).is.greaterThan(beats[i - 1].atMs);
      }
    });

    it('beats never overlap end-to-start, so the stream stays readable', () => {
      const beats = planDeckDraw(seq(false, true, false, true), T, false);
      for (let i = 1; i < beats.length; i++) {
        expect(beats[i].atMs).is.lessThan(endOf(beats[i - 1]) + T.gapMs * 2); // no dead air…
      }
    });
  });

  describe('adaptive rhythm — a long unlucky search tightens, never flickers', () => {
    it('the first discards play at the full teaching rhythm', () => {
      for (let i = 0; i < FULL_RHYTHM_DISCARDS; i++) {
        expect(discardPace(i)).to.eq(1);
      }
    });

    it('further discards tighten monotonically', () => {
      expect(discardPace(FULL_RHYTHM_DISCARDS)).is.lessThan(1);
      for (let i = FULL_RHYTHM_DISCARDS; i < 20; i++) {
        expect(discardPace(i + 1)).is.lessThanOrEqual(discardPace(i));
      }
    });

    it('the pace floors out — it never collapses to a flicker', () => {
      expect(discardPace(50)).to.eq(MIN_DISCARD_PACE);
      expect(MIN_DISCARD_PACE).is.greaterThan(0.3);
    });

    it('MATCHES always keep their full hero beat, however long the search ran', () => {
      const steps = seq(...Array.from({length: 15}, (_, i) => i === 14));
      const beats = planDeckDraw(steps, T, false);
      const lastMatch = beats[14];
      const firstDiscard = beats[0];
      expect(lastMatch.inspectMs).is.greaterThan(firstDiscard.inspectMs);
      expect(lastMatch.travelMs).to.eq(T.travelMs);
    });

    it('a 20-discard search stays far below a linear blow-up', () => {
      const steps = seq(...Array.from({length: 21}, (_, i) => i === 20));
      const tight = planEndMs(planDeckDraw(steps, T, false), T);
      const linear = planEndMs(planDeckDraw(seq(false, true), T, false), T) / 2 * 21;
      expect(tight).is.lessThan(linear * 0.75);
    });
  });

  describe('plain draw — no verdicts, no flips', () => {
    it('cards stay face down and fly straight to the hold zone', () => {
      const beats = planDeckDraw(seq(true, true), T, true);
      expect(beats.map((b) => b.kind)).to.deep.eq(['plain', 'plain']);
      expect(beats.every((b) => b.flipPortion === 0)).to.eq(true);
      expect(beats.every((b) => b.inspectMs === 0)).to.eq(true);
      expect(beats.map((b) => b.holdSlot)).to.deep.eq([0, 1]);
      expect(beats.every((b) => b.trayDepth === undefined)).to.eq(true);
    });

    it('a single plain card is a complete scene', () => {
      const beats = planDeckDraw(seq(true), T, true);
      expect(beats).to.have.length(1);
      expect(deckDrawBudgetMs(beats, T)).is.greaterThan(0);
    });

    it('staggers with no dead air', () => {
      const beats = planDeckDraw(seq(true, true, true), T, true);
      expect(beats[1].atMs).is.greaterThan(beats[0].atMs);
      expect(beats[2].atMs - beats[1].atMs).to.eq(beats[1].atMs - beats[0].atMs);
    });
  });

  describe('budget + deck count', () => {
    it('the budget covers the whole scene incl. the finish and handoff', () => {
      const beats = planDeckDraw(seq(false, true), T, false);
      expect(deckDrawBudgetMs(beats, T)).is.greaterThan(planEndMs(beats, T));
    });

    it('an empty plan is a zero-length scene', () => {
      expect(planDeckDraw([], T, false)).to.have.length(0);
      expect(planEndMs([], T)).to.eq(0);
    });

    it('the deck count ticks down per card that physically left, and floors at 0', () => {
      expect(deckCountAfter(185, 0)).to.eq(185);
      expect(deckCountAfter(185, 3)).to.eq(182);
      expect(deckCountAfter(2, 5)).to.eq(0);
    });

    it('reduced motion keeps the full path, only shorter', () => {
      const r = reducedDeckDrawTimings();
      expect(r.travelMs).is.greaterThan(0);
      expect(r.routeMs).is.greaterThan(0);
      expect(r.travelMs).is.lessThan(T.travelMs);
      const beats = planDeckDraw(seq(false, true), r, false);
      expect(beats.map((b) => b.kind)).to.deep.eq(['discard', 'match']);
      expect(deckDrawBudgetMs(beats, r)).is.lessThan(deckDrawBudgetMs(planDeckDraw(seq(false, true), T, false), T));
    });
  });

  describe('geometry', () => {
    it('the inspect point sits clear of the top bar — the deck is never covered by its own card', () => {
      expect(inspectPoint(1280, 800).y).is.greaterThan(130);
      expect(inspectPoint(3840, 2160).y).is.greaterThan(130);
    });

    it('hold slots are a centred row', () => {
      const slots = holdSlots(3, 1920, 1080, 200);
      expect(slots).to.have.length(3);
      const centre = (slots[0].x + slots[2].x) / 2;
      expect(Math.round(centre)).to.eq(1920 / 2);
      expect(slots[1].x).is.greaterThan(slots[0].x);
      expect(slots.every((s) => s.y === slots[0].y)).to.eq(true);
    });

    it('a single held card sits dead centre', () => {
      expect(holdSlots(1, 1280, 800, 200)[0].x).to.eq(640);
    });

    it('many held cards squeeze instead of running off a handheld screen', () => {
      const slots = holdSlots(6, 1280, 800, 240);
      expect(slots[0].x).is.greaterThan(0);
      expect(slots[5].x).is.lessThan(1280);
    });

    it('no slots for an empty hold zone', () => {
      expect(holdSlots(0, 1920, 1080, 200)).to.have.length(0);
    });
  });
});
