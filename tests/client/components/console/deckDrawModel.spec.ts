import {expect} from 'chai';
import {
  FULL_RHYTHM_DISCARDS, MIN_DISCARD_PACE, deckCountAfter, deckDrawBudgetMs,
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
      // 24 physical cards for 24 revealed cards — the count is exact.
      expect(beats).to.have.length(24);
      expect(beats.every((b) => b.travelMs > 0)).to.eq(true);
      // The 23 discards each physically flow to the tray (a distinct depth).
      expect(beats.filter((b) => b.kind === 'discard')).to.have.length(23);
      expect(beats.filter((b) => b.kind === 'discard').map((b) => b.trayDepth))
        .to.deep.eq(Array.from({length: 23}, (_, i) => i));
    });

    it('a DISCARD never pauses to be judged and never flips face-up', () => {
      const beats = planDeckDraw(seq(false, false, true), T, false);
      const discards = beats.filter((b) => b.kind === 'discard');
      expect(discards.every((b) => b.inspectMs === 0)).to.eq(true); // no inspect hold
      expect(discards.every((b) => b.flipPortion === 0)).to.eq(true); // stays face down
      expect(discards.every((b) => b.routeMs === 0)).to.eq(true); // one flight, no relay
      expect(discards.every((b) => b.holdSlot === undefined)).to.eq(true);
    });

    it('a MATCH pauses face-up and a discard does not — the match is the only readable card', () => {
      const beats = planDeckDraw(seq(false, true), T, false);
      expect(beats[0].inspectMs).to.eq(0); // discard
      expect(beats[1].inspectMs).is.greaterThan(0); // match is read
      expect(beats[1].flipPortion).is.greaterThan(0); // and flips up
    });

    it('the DISCARD stream is tight — cards peel `streamStepMs` apart, several in the air at once', () => {
      const beats = planDeckDraw(seq(false, false, false, false, true), T, false);
      const discards = beats.filter((b) => b.kind === 'discard');
      // Consecutive discards start only streamStepMs apart (paced), FAR less
      // than a whole flight — so the stream overlaps and reads as a count.
      for (let i = 1; i < discards.length; i++) {
        const step = discards[i].atMs - discards[i - 1].atMs;
        expect(step).is.greaterThan(0);
        expect(step).is.lessThanOrEqual(T.streamStepMs + 0.001);
        expect(step).is.lessThan(discards[i - 1].travelMs); // overlaps in flight
      }
    });

    it('a MATCH after a discard stream waits for the stream to clear the deck', () => {
      const beats = planDeckDraw(seq(false, false, false, true), T, false);
      const lastDiscard = beats[2];
      const match = beats[3];
      // The match peels after the last discard has peeled (order preserved),
      // and its own beat is the long one.
      expect(match.atMs).is.greaterThan(lastDiscard.atMs);
      expect(match.inspectMs).is.greaterThan(0);
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

  describe('plain draw — no verdicts, each card tumbles open into the hold zone', () => {
    it('cards fly straight to the hold zone and get a 3D flip (never a one-frame swap)', () => {
      const beats = planDeckDraw(seq(true, true), T, true);
      expect(beats.map((b) => b.kind)).to.deep.eq(['plain', 'plain']);
      // A plain card physically turns over as it lands (the director owns the
      // choreography) — flipPortion marks it, so it is NEVER a back→face swap.
      expect(beats.every((b) => b.flipPortion > 0)).to.eq(true);
      // But it is never JUDGED — no inspect pause, straight to its hold slot.
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
