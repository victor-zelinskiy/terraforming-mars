import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  DISCARD_SAFETY_MS,
  DISCARD_TIMINGS,
  discardPhaseHolds,
  discardPileBacks,
  discardTimings,
  discardedFromHand,
  pileJitterDeg,
  stackOffset,
  usableDiscardRect,
} from '@/client/console/cardDiscard/discardModel';
import {DEFAULT_MAX_HOLD_MS} from '@/client/components/presentation/animationHold';

describe('discardModel', () => {
  it('holds the foreground only while something is on screen', () => {
    expect(discardPhaseHolds('idle')).is.false;
    // Armed = the answer is in flight and nothing has been drawn yet.
    expect(discardPhaseHolds('armed')).is.false;
    // A refused answer must not keep the game frozen behind a dead scene.
    expect(discardPhaseHolds('failed')).is.false;
    for (const phase of ['seizing', 'leaving', 'consuming', 'settling'] as const) {
      expect(discardPhaseHolds(phase), phase).is.true;
    }
  });

  it('keeps its own ceiling BELOW the animation-hold registry net', () => {
    // Else the registry would force-release first and the scene would clean up
    // after the game had already moved on.
    expect(DISCARD_SAFETY_MS).lessThan(DEFAULT_MAX_HOLD_MS);
  });

  it('reduced motion keeps the whole ladder, only shorter', () => {
    const reduced = discardTimings(true);
    expect(Object.keys(reduced)).deep.eq(Object.keys(DISCARD_TIMINGS));
    expect(reduced.tossMs).lessThan(DISCARD_TIMINGS.tossMs);
    expect(discardTimings(false)).deep.eq(DISCARD_TIMINGS);
  });

  it('THE SERVER IS THE TRUTH: only cards it actually removed are disposed of', () => {
    const hand = (...names: Array<CardName>) => names.map((name) => ({name}));
    expect(discardedFromHand(
      [CardName.ANTS, CardName.BUSHES],
      hand(CardName.BUSHES, CardName.TARDIGRADES)))
      .deep.eq([CardName.ANTS]);

    // A refused answer (the card is still in hand) animates nothing.
    expect(discardedFromHand([CardName.ANTS], hand(CardName.ANTS))).deep.eq([]);
    expect(discardedFromHand([], hand(CardName.ANTS))).deep.eq([]);
  });

  it('caps the pile thickness — the count carries the rest', () => {
    expect(discardPileBacks(0)).eq(0);
    expect(discardPileBacks(2)).eq(2);
    expect(discardPileBacks(9)).eq(3);
    expect(discardPileBacks(-1)).eq(0);
  });

  it('rejects a collapsed rect rather than flying to the viewport origin', () => {
    expect(usableDiscardRect(undefined)).is.false;
    expect(usableDiscardRect({left: 0, top: 0, width: 0, height: 0})).is.false;
    expect(usableDiscardRect({left: 10, top: 10, width: 200, height: 280})).is.true;
  });

  it('stacks a multi-card discard as ONE object, centred on the pile', () => {
    const n = 3;
    const offsets = [0, 1, 2].map((i) => stackOffset(i, n, 1));
    expect(offsets[1]).deep.eq({dx: 0, dy: 0, rotation: 0}); // the middle card
    expect(offsets[0].dx).eq(-offsets[2].dx);
    expect(offsets[0].rotation).eq(-offsets[2].rotation);
  });

  it('scatters deterministically — a replay is identical, no Math.random()', () => {
    expect(pileJitterDeg(0)).eq(pileJitterDeg(0));
    expect(pileJitterDeg(0)).not.eq(pileJitterDeg(1));
    for (const i of [0, 1, 2, 3, 7]) {
      expect(Math.abs(pileJitterDeg(i)), `card ${i}`).at.most(4.2);
    }
  });
});
