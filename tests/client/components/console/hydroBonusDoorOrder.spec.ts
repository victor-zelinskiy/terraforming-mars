import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import {AdmissionSignals, isPromptAdmitted, promptAdmissionBlock} from '@/client/console/consolePromptAdmission';
import {hydroBonusDoorAction, hydroZoneState} from '@/client/console/hydroFlow/hydroBonusOffer';

/**
 * THE ORDER, PROVED AT THE SEAM THAT ENFORCES IT.
 *
 * One ocean placement routinely produces TWO things in a single server
 * response: the hex's own card-draw bonus (`grantSpaceBonus` → `player.drawCard`,
 * synchronous) and the Dynamic Ocean Barrier offer (`BonusDeltaAdvance`, queued
 * at `BACK_OF_THE_LINE`). The server is right to ask immediately — so the ORDER
 * the player experiences is the client's to guarantee, and it is guaranteed in
 * exactly one place: the door asks `admits('followUp')`, whose policy waits out
 * the whole arrival chain («processed» for a draw means every card TAKEN).
 *
 * This walks that chain state by state and asserts the door's answer at each —
 * which is the ordering claim itself, deterministically, with no timing:
 *
 *   ocean placed → the reveal assembles → the player takes the cards → the
 *   intake lands → and ONLY THEN may the Hydronetwork open.
 *
 * The e2e sibling (`tests/e2e/console-hydro-bonus-order.spec.ts`) watches the
 * same order in the real DOM; this one is what makes a regression impossible to
 * misdiagnose, because it names the exact block that would be missing.
 */
const OFFER: DeltaBonusPromptMeta = {
  source: CardName.DYNAMIC_OCEAN_BARRIER,
  steps: 1,
  fromPosition: 2,
  toPosition: 3,
  energyCost: 0,
  waivesTag: false,
  advanceIndex: 0,
  skipIndex: 1,
};

function settled(overrides: Partial<AdmissionSignals> = {}): AdmissionSignals {
  return {
    revealOpen: false,
    revealPending: false,
    playedHero: false,
    tileHero: false,
    cardArrival: false,
    boardBonus: false,
    cardDiscard: false,
    presentation: false,
    announceGate: false,
    anyAnimation: false,
    ...overrides,
  };
}

/** The door, exactly as ConsoleShell composes it. */
function door(signals: AdmissionSignals, frameKnown = false) {
  return hydroBonusDoorAction({
    offerLive: OFFER !== undefined && isPromptAdmitted('followUp', signals),
    frameKnown,
  });
}

describe('the bonus offer waits for the placement it came from', () => {
  /**
   * THE CHAIN, in the order one ocean placement produces it. Every leg must
   * hold the door — a `none` here is the workspace arriving over the cards.
   */
  const CHAIN: ReadonlyArray<{leg: string, signals: Partial<AdmissionSignals>, block: string}> = [
    {leg: 'the tile is still landing', signals: {tileHero: true}, block: 'tile-hero'},
    {leg: 'the cell bonus-card cover is lifting', signals: {boardBonus: true}, block: 'board-bonus'},
    {leg: 'a drawn batch is pending presentation', signals: {revealPending: true}, block: 'reveal'},
    {leg: 'the drawn-cards reveal is OPEN', signals: {revealOpen: true}, block: 'reveal'},
    {leg: 'the taken cards are still flying to the dock', signals: {cardArrival: true}, block: 'card-arrival'},
    {leg: 'a blocking presentation owns the screen', signals: {presentation: true}, block: 'presentation'},
  ];

  for (const {leg, signals, block} of CHAIN) {
    it(`holds the door while ${leg}`, () => {
      const s = settled(signals);
      expect(promptAdmissionBlock('followUp', s), leg).to.eq(block);
      expect(door(s), leg).to.eq('none');
    });
  }

  it('opens the workspace ONLY once the whole chain is settled', () => {
    expect(promptAdmissionBlock('followUp', settled())).is.undefined;
    expect(door(settled())).to.eq('open');
  });

  // The player is ALREADY on the track (they placed the ocean from a reward of
  // their own advance): the offer joins the flow instead of rebuilding it.
  it('queues into a Hydronetwork that is already standing, still only after the chain', () => {
    expect(door(settled({revealOpen: true}), true)).to.eq('none');
    expect(door(settled(), true)).to.eq('queue');
  });

  /**
   * AND THE ZONE OBEYS THE SAME ORDER ONE LEVEL DOWN. Admission decides WHEN
   * the workspace may open; the zone decides what it may paint once it is
   * open — and a move already in flight outranks a fresh offer there too, so
   * a second ocean can never overwrite the first one's commit.
   */
  it('a second offer never paints over the move the first one started', () => {
    expect(hydroZoneState({offerLive: true, committing: true, resolving: false})).to.eq('committing');
    expect(hydroZoneState({offerLive: true, committing: false, resolving: true})).to.eq('resolving');
    expect(hydroZoneState({offerLive: true, committing: false, resolving: false})).to.eq('bonus-offer');
  });

  /**
   * THE DOOR IS THE `followUp` FAMILY AND NOT A LOOSER ONE. `section` is the
   * presence family — it deliberately does NOT wait for `card-arrival` (the
   * hydro draw lands its cards INSIDE a section pick), so a door built on it
   * would open over the very reveal this exists to wait for. Pinned, because
   * the two differ by exactly the block that caused the bug.
   */
  it('is gated by followUp, not by the presence family', () => {
    const arriving = settled({cardArrival: true});
    expect(isPromptAdmitted('section', arriving), 'section tolerates an arrival').is.true;
    expect(isPromptAdmitted('followUp', arriving), 'followUp must not').is.false;
  });
});
