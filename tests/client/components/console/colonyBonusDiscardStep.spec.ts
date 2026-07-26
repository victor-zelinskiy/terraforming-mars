import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {
  bonusDiscardStep, BONUS_DISCARD_LOCKED_REASON,
} from '@/client/console/colonyTrade/colonyBonusDiscardStep';
import {
  drawnCardsState, currentRevealEvent, holdRevealForFollowUp, isRevealHeldForFollowUp,
  markAllTaken, markCardTaken, releaseRevealFollowUp,
} from '@/client/components/drawnCards/drawnCardsState';

/*
 * PLUTO'S PAYOUT CLOSES INSIDE THE REVEAL MODAL. The colony bonus pays
 * "draw N, then discard N", so the discard is the last step of the SAME payout —
 * hosted by the reveal modal instead of arriving as a detached prompt the player
 * cannot connect to the trade they just made.
 *
 * Guarded here: the step's own derivation (shared by the modal and the command
 * bar, so they can never disagree) and the follow-up HOLD that keeps a fully
 * taken batch on screen until the player takes that step.
 */
describe('the colony bonus\'s closing discard step', () => {
  describe('bonusDiscardStep', () => {
    it('is absent unless the server marked the prompt', () => {
      expect(bonusDiscardStep(undefined, 0)).to.eq(undefined);
    });

    it('stays LOCKED, with an honest reason, while any card is untaken', () => {
      const step = bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 1}, 2);
      expect(step?.ready).to.eq(false);
      expect(step?.lockedReason).to.eq(BONUS_DISCARD_LOCKED_REASON);
    });

    it('unlocks only when EVERY card of the payout has been taken', () => {
      // Choosing what to throw away before seeing everything that arrived would
      // be the wrong order — bonus cards and trade income alike must land first.
      expect(bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 1}, 1)?.ready).to.eq(false);
      const ready = bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 1}, 0);
      expect(ready?.ready).to.eq(true);
      expect(ready?.lockedReason).to.eq('');
    });

    it('is singular for ONE cube and plural for several (the count IS the cubes)', () => {
      expect(bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 1}, 0)?.label)
        .to.eq('Pick a card to discard');
      expect(bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 3}, 0)?.label)
        .to.eq('Pick cards to discard');
      expect(bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 3}, 0)?.count).to.eq(3);
    });

    it('never asks for fewer than one card (a degenerate marker)', () => {
      expect(bonusDiscardStep({colonyName: ColonyName.PLUTO, count: 0}, 0)?.count).to.eq(1);
    });
  });

  describe('the follow-up hold', () => {
    beforeEach(() => {
      releaseRevealFollowUp();
      drawnCardsState.events.splice(0, drawnCardsState.events.length);
      drawnCardsState.events.push({
        id: 77,
        cards: [{name: 'A'}, {name: 'B'}],
        takenIndices: new Set<number>(),
      } as never);
    });
    afterEach(() => {
      releaseRevealFollowUp();
      drawnCardsState.events.splice(0, drawnCardsState.events.length);
    });

    it('keeps a FULLY TAKEN batch current, so the modal can host its last step', () => {
      markAllTaken(77);
      // Without the hold the batch drops out and the modal unmounts — which is
      // exactly how the discard used to escape into a prompt of its own.
      expect(currentRevealEvent()).to.eq(undefined);

      holdRevealForFollowUp(77);
      expect(currentRevealEvent()?.id).to.eq(77);
      expect(isRevealHeldForFollowUp(77)).to.eq(true);
    });

    it('releases on the player taking the step (the only way out of the modal)', () => {
      markAllTaken(77);
      holdRevealForFollowUp(77);
      releaseRevealFollowUp();
      expect(isRevealHeldForFollowUp(77)).to.eq(false);
      expect(currentRevealEvent()).to.eq(undefined);
    });

    it('does not change an ordinary payout: untaken cards keep it current anyway', () => {
      markCardTaken(77, 0);
      expect(currentRevealEvent()?.id).to.eq(77);
      expect(isRevealHeldForFollowUp(77)).to.eq(false);
    });

    it('holds only the batch it was asked to hold', () => {
      markAllTaken(77);
      holdRevealForFollowUp(999);
      expect(currentRevealEvent()).to.eq(undefined);
      expect(isRevealHeldForFollowUp(undefined)).to.eq(false);
    });
  });
});
