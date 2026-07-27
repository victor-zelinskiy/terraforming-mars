import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  detectReturnedToHand, returnPoseSlots, returnPoseRect, ReturnDiffView,
} from '@/client/console/played/playedReturnModel';
import {
  stagePlayedCardReturns, abortPlayedCardReturns, resetPlayedCardReturns, hasPendingPlayedReturns,
} from '@/client/console/played/playedCardReturn';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';

/**
 * The play's RETURN BEAT (Astra Mechanica «верните до 2 событий в руку»):
 * the cards rise out of the table, turn face to the camera and are carried
 * into the dock by the standard intake.
 *
 * The two invariants worth guarding are (1) WHICH cards the beat claims —
 * derived from the authoritative view diff, never from the client's own pick
 * (a refused play must not animate a lie), and (2) that a card the server DID
 * put in the hand can never be LOST behind the animation: the dock withhold
 * armed before the commit is released on every exit path.
 */

const EVENTS = new Set<string>([CardName.ASTEROID, CardName.BIG_ASTEROID, CardName.FLOODING]);
const isEvent = (n: CardName) => EVENTS.has(n);

function view(tableau: Array<CardName>, hand: Array<CardName>): ReturnDiffView {
  return {
    thisPlayer: {tableau: tableau.map((name) => ({name}))},
    cardsInHand: hand.map((name) => ({name})),
  };
}

describe('playedReturnModel · which cards came back', () => {
  it('a card that left the TABLE and arrived in the HAND is a return', () => {
    const prev = view([CardName.ASTRA_MECHANICA, CardName.ASTEROID, CardName.BIG_ASTEROID], []);
    const next = view([CardName.ASTRA_MECHANICA], [CardName.ASTEROID, CardName.BIG_ASTEROID]);
    const out = detectReturnedToHand(prev, next, isEvent);
    expect(out.map((c) => c.name)).to.deep.eq([CardName.ASTEROID, CardName.BIG_ASTEROID]);
    // Events lie face-down on the pile — they must turn on the way out.
    expect(out.every((c) => c.faceDown)).to.be.true;
  });

  it('ONE returned card is the single-card beat', () => {
    const prev = view([CardName.ASTEROID, CardName.BIG_ASTEROID], []);
    const next = view([CardName.BIG_ASTEROID], [CardName.ASTEROID]);
    expect(detectReturnedToHand(prev, next, isEvent).map((c) => c.name)).to.deep.eq([CardName.ASTEROID]);
  });

  it('a card that merely LEFT the table (discarded) is not a return', () => {
    const prev = view([CardName.ASTEROID], []);
    const next = view([], []);
    expect(detectReturnedToHand(prev, next, isEvent)).to.be.empty;
  });

  it('a card DRAWN into the hand (never on the table) is not a return', () => {
    const prev = view([CardName.ASTEROID], []);
    const next = view([CardName.ASTEROID], [CardName.BIG_ASTEROID]);
    expect(detectReturnedToHand(prev, next, isEvent)).to.be.empty;
  });

  it('a non-event card returns face-UP (its own slot, no turn)', () => {
    const prev = view([CardName.TREES], []);
    const next = view([], [CardName.TREES]);
    const out = detectReturnedToHand(prev, next, isEvent);
    expect(out).to.have.length(1);
    expect(out[0].faceDown).to.be.false;
  });

  it('nothing to diff (first response / spectator view) → no beat', () => {
    expect(detectReturnedToHand(undefined, view([], []), isEvent)).to.be.empty;
    expect(detectReturnedToHand({}, {}, isEvent)).to.be.empty;
  });
});

describe('playedReturnModel · the pose', () => {
  const W = 1920;
  const H = 1080;
  const NW = 320;
  const NH = 460;

  it('a lone card poses centred on the presentation band', () => {
    const [pose] = returnPoseSlots(1, W, H, NW, NH);
    expect(pose.x).to.eq(W / 2);
    expect(pose.scale).to.be.greaterThan(0);
    const rect = returnPoseRect(pose, NW, NH);
    expect(Math.round(rect.left + rect.width / 2)).to.eq(W / 2);
    expect(rect.top).to.be.greaterThan(0);
  });

  it('a PAIR splits symmetrically around that same centre, in one row', () => {
    const poses = returnPoseSlots(2, W, H, NW, NH);
    expect(poses).to.have.length(2);
    expect((poses[0].x + poses[1].x) / 2).to.be.closeTo(W / 2, 0.001);
    expect(poses[0].y).to.eq(poses[1].y);
    // Two cards read together: a notch smaller than the lone hero pose…
    expect(poses[0].scale).to.be.lessThan(returnPoseSlots(1, W, H, NW, NH)[0].scale);
    // …and they never overlap.
    const a = returnPoseRect(poses[0], NW, NH);
    const b = returnPoseRect(poses[1], NW, NH);
    expect(a.left + a.width).to.be.lessThan(b.left);
  });

  it('no cards → no poses', () => {
    expect(returnPoseSlots(0, W, H, NW, NH)).to.be.empty;
  });
});

describe('playedCardReturn · the dock withhold', () => {
  afterEach(() => {
    resetPlayedCardReturns();
    handDeliveryState.held = [];
  });

  it('staging withholds the returned cards from the dock (the commit cannot show them early)', () => {
    stagePlayedCardReturns(
      view([CardName.ASTRA_MECHANICA, CardName.ASTEROID], []),
      view([CardName.ASTRA_MECHANICA], [CardName.ASTEROID]));
    expect(hasPendingPlayedReturns()).to.be.true;
    expect(handDeliveryState.held).to.deep.eq([CardName.ASTEROID]);
  });

  it('an ABORT gives the cards straight back to the pack — never lost behind a dead animation', () => {
    stagePlayedCardReturns(
      view([CardName.ASTEROID], []),
      view([], [CardName.ASTEROID]));
    abortPlayedCardReturns();
    expect(hasPendingPlayedReturns()).to.be.false;
    expect(handDeliveryState.held).to.be.empty;
  });

  it('a play that returned NOTHING arms no beat and withholds nothing', () => {
    stagePlayedCardReturns(view([], []), view([], [CardName.ASTEROID]));
    expect(hasPendingPlayedReturns()).to.be.false;
    expect(handDeliveryState.held).to.be.empty;
  });

  it('re-staging drops the previous arm (one beat per response)', () => {
    stagePlayedCardReturns(view([CardName.ASTEROID], []), view([], [CardName.ASTEROID]));
    stagePlayedCardReturns(view([CardName.BIG_ASTEROID], []), view([], [CardName.BIG_ASTEROID]));
    expect(handDeliveryState.held).to.deep.eq([CardName.BIG_ASTEROID]);
  });
});
