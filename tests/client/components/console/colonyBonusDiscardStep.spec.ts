import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {
  bonusDiscardStep, bonusZones, BONUS_DISCARD_LABEL, BONUS_DISCARD_LOCKED_REASON,
} from '@/client/console/colonyTrade/colonyBonusDiscardStep';
import {
  drawnCardsState, currentRevealEvent, holdRevealForFollowUp, isRevealHeldForFollowUp,
  markAllTaken, markCardTaken, releaseRevealFollowUp,
} from '@/client/components/drawnCards/drawnCardsState';

/*
 * PLUTO'S PAYOUT CLOSES INSIDE THE REVEAL MODAL, ONE COLONY AT A TIME.
 *
 * The colony bonus pays "draw 1, then discard 1", and by the rules each colony
 * resolves separately and in FULL before the next is revealed — a player with
 * three cubes answers three payouts in a row and must never see all three cards
 * before choosing what to throw away. The modal shows that as one zone per
 * colony (exactly one live) and hosts each discard under the card it belongs to,
 * instead of letting it arrive as a detached prompt.
 *
 * Guarded here: the zone layout and the step derivation (both shared by the
 * modal and the command bar, so they can never disagree) and the follow-up HOLD
 * that keeps a fully taken batch on screen until the player takes that step.
 */
describe('the colony bonus sequence', () => {
  const meta = (index: number, total: number) => ({colonyName: ColonyName.PLUTO, index, total});

  describe('bonusZones — one zone per colony, exactly one live', () => {
    it('is empty without the marker (an ordinary reveal has no sequence)', () => {
      expect(bonusZones(undefined)).to.deep.eq([]);
    });

    it('a single cube is a single ACTIVE zone (the ordinary case is unchanged)', () => {
      expect(bonusZones(meta(1, 1))).to.deep.eq([{index: 1, total: 1, state: 'active'}]);
    });

    it('lays the whole sequence out: earlier done, current active, later waiting', () => {
      // The rules resolve one colony at a time, so the later zones cannot show a
      // card — the server has not drawn it yet. They are placeholders.
      expect(bonusZones(meta(2, 3))).to.deep.eq([
        {index: 1, total: 3, state: 'done'},
        {index: 2, total: 3, state: 'active'},
        {index: 3, total: 3, state: 'future'},
      ]);
    });

    it('the last colony leaves nothing waiting behind it', () => {
      const zones = bonusZones(meta(3, 3));
      expect(zones.map((z) => z.state)).to.deep.eq(['done', 'done', 'active']);
    });

    it('clamps a degenerate marker instead of rendering a broken strip', () => {
      expect(bonusZones(meta(0, 0))).to.deep.eq([{index: 1, total: 1, state: 'active'}]);
      expect(bonusZones(meta(9, 2)).map((z) => z.state)).to.deep.eq(['done', 'active']);
    });
  });

  describe('bonusDiscardStep — the step that closes ONE colony', () => {
    it('is absent unless the server marked the prompt', () => {
      expect(bonusDiscardStep(undefined, 0)).to.eq(undefined);
    });

    it('stays LOCKED, with an honest reason, while any card is untaken', () => {
      const step = bonusDiscardStep(meta(1, 3), 2);
      expect(step?.ready).to.eq(false);
      expect(step?.lockedReason).to.eq(BONUS_DISCARD_LOCKED_REASON);
    });

    it('unlocks only when everything on the table has been taken', () => {
      // On the trade's first payout that includes the trade income, not just
      // the bonus card — you take what you were given before choosing.
      expect(bonusDiscardStep(meta(1, 3), 1)?.ready).to.eq(false);
      const ready = bonusDiscardStep(meta(1, 3), 0);
      expect(ready?.ready).to.eq(true);
      expect(ready?.lockedReason).to.eq('');
    });

    it('is ALWAYS singular — one colony, one card, never a merged discard', () => {
      expect(bonusDiscardStep(meta(1, 1), 0)?.label).to.eq(BONUS_DISCARD_LABEL);
      expect(bonusDiscardStep(meta(2, 4), 0)?.label).to.eq(BONUS_DISCARD_LABEL);
    });

    it('carries its place in the sequence for the zone caption', () => {
      const step = bonusDiscardStep(meta(2, 3), 0);
      expect(step?.index).to.eq(2);
      expect(step?.total).to.eq(3);
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
