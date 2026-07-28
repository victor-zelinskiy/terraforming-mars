import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  DISCARD_SAFETY_MS,
  DISCARD_TIMINGS,
  discardPhaseHolds,
  discardPhaseInOverlay,
  discardPileBacks,
  discardTimings,
  discardedFromHand,
  packetCentre,
  packetOffset,
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
    for (const phase of
      ['fixating', 'flipping', 'gathering', 'leaving', 'carrying', 'landing', 'settling'] as const) {
      expect(discardPhaseHolds(phase), phase).is.true;
    }
  });

  it('knows which beats still happen INSIDE the pick surface', () => {
    // The hand must stay frozen (and the packet must not be carried) for
    // exactly the beats that play among the real cards.
    for (const phase of ['fixating', 'flipping', 'gathering'] as const) {
      expect(discardPhaseInOverlay(phase), phase).is.true;
    }
    for (const phase of ['idle', 'armed', 'leaving', 'carrying', 'landing', 'settling', 'failed'] as const) {
      expect(discardPhaseInOverlay(phase), phase).is.false;
    }
  });

  it('is a TABLETOP gesture: pick up, turn over, square up, carry, land', () => {
    const t = DISCARD_TIMINGS;
    // The grip is the shortest beat — it is a grip, not a presentation.
    expect(t.fixateMs).lessThan(t.flipMs);
    // The turn is readable (the brief said 260–340ms per card).
    expect(t.flipMs).within(260, 340);
    // Several cards cascade rather than turning in machine unison…
    expect(t.flipStepMs).greaterThan(0);
    // …but the cascade must never out-run the turn itself.
    expect(t.flipStepMs).lessThan(t.flipMs / 2);
    // The carry is the longest travelling beat, and it is PRECEDED by a lift:
    // the packet never snaps straight into motion.
    expect(t.liftMs).greaterThan(0);
    expect(t.carryMs).greaterThan(t.liftMs);
    // The pile keeps the acknowledgement longer than the landing itself, so it
    // cannot be cut one frame after the cards arrive.
    expect(t.settleMs).greaterThan(t.landMs);
  });

  it('keeps its own ceiling BELOW the animation-hold registry net', () => {
    // Else the registry would force-release first and the scene would clean up
    // after the game had already moved on.
    expect(DISCARD_SAFETY_MS).lessThan(DEFAULT_MAX_HOLD_MS);
  });

  it('reduced motion keeps the whole ladder, only shorter', () => {
    const reduced = discardTimings(true);
    expect(Object.keys(reduced)).deep.eq(Object.keys(DISCARD_TIMINGS));
    for (const key of Object.keys(DISCARD_TIMINGS) as Array<keyof typeof DISCARD_TIMINGS>) {
      expect(reduced[key], key).lessThan(DISCARD_TIMINGS[key]);
    }
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

  it('squares the packet at the cards OWN centroid — where they were lying', () => {
    const rect = (left: number, top: number) => ({left, top, width: 200, height: 280});
    expect(packetCentre([rect(0, 0), rect(200, 0)])).deep.eq({x: 200, y: 140});
    expect(packetCentre([])).deep.eq({x: 0, y: 0});
  });

  it('squares a packet TIGHTER than the loose pile pose', () => {
    // A packet in a hand is neat; the pile it lands on is not.
    const packet = packetOffset(0, 3, 1);
    const pile = stackOffset(0, 3, 1);
    expect(Math.abs(packet.dx)).lessThan(Math.abs(pile.dx));
    expect(Math.abs(packet.rotation)).lessThan(Math.abs(pile.rotation));
    // The middle card of an odd packet still carries a hair of hand-squaring.
    expect(packetOffset(1, 3, 1).dx).eq(0);
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
