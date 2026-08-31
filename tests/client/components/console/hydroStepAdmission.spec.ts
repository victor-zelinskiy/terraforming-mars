import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  HydroStepLedger,
  hydroActiveStepSource,
  hydroStepOwnerPosition,
  hydroStepQueued,
  revealSourceCard,
} from '@/client/console/hydroMarker/hydroStepAdmission';

/*
 * THE STAGE-BOUND EXECUTION CONTRACT, as a pure decision.
 *
 * The defect these pin (`20260831011413_1.jpg`): a DP07 traversal crosses
 * stages 5, 6 and 7. Stage 5 asks the player to keep 2 of 4 cards; stage 7's
 * reward repeats AI Central's action, which draws 2 more. The server resolves
 * the WHOLE traversal inside the request that answers the stage-5 pick (the
 * parked batch tail drains there), so AI Central's batch is on the wire while
 * the marker is still standing on cell 5 — and the console presented it, over a
 * track whose highlight, header and marker all still said «Гидромоделирование».
 */

const AI_CENTRAL = CardName.AI_CENTRAL;
const DEV_CENTER = CardName.DEVELOPMENT_CENTER;

/** The plan of the screenshot's advance: 5 (deck stop) · 6 · 7 (repeat). */
function surgePlan(activated: ReadonlyArray<number> = [], parkedAt = -1): HydroStepLedger {
  return {
    steps: [
      {position: 5},
      {position: 6},
      {position: 7, sourceCard: AI_CENTRAL},
    ],
    activated: new Set(activated),
    parkedAt,
  };
}

describe('hydroStepAdmission (the traversal ACTIVATION gate)', () => {
  describe('revealSourceCard — identity is structural, never textual', () => {
    it('names the card of a card-sourced batch', () => {
      expect(revealSourceCard({type: 'card', cardName: AI_CENTRAL})).to.equal(AI_CENTRAL);
    });

    it('names nothing for a source no step can own', () => {
      expect(revealSourceCard(undefined)).to.be.undefined;
      expect(revealSourceCard({type: 'tile'})).to.be.undefined;
      expect(revealSourceCard({type: 'other'})).to.be.undefined;
    });
  });

  describe('THE BUG: stage 7\'s copied action while the marker stands on 5', () => {
    it('QUEUES the copied action\'s batch — nothing of stage 7 may be shown', () => {
      // The marker has settled on 5 and the stop is open (the deck pick).
      const ledger = surgePlan([5], 5);
      expect(hydroStepOwnerPosition(ledger, AI_CENTRAL), 'owned by stage 7').to.equal(7);
      expect(hydroStepQueued(ledger, AI_CENTRAL), 'queued, not active').to.be.true;
    });

    it('keeps queueing it through 6 — «the exits finished» is not «we arrived»', () => {
      // The stage-5 scene has fully left and the marker has walked to 6. This is
      // exactly the state the old scene-exit barrier admitted on.
      const ledger = surgePlan([5, 6], -1);
      expect(hydroStepQueued(ledger, AI_CENTRAL)).to.be.true;
    });

    it('ADMITS it the moment cell 7 has arrived and settled', () => {
      const ledger = surgePlan([5, 6, 7], 7);
      expect(hydroStepQueued(ledger, AI_CENTRAL), 'the step owns the scene now').to.be.false;
      expect(hydroStepOwnerPosition(ledger, AI_CENTRAL)).to.equal(-1);
    });

    it('keeps admitting it after the marker walks ON — activation only HARDENS', () => {
      // A batch yanked off the scene because the marker moved is the same defect
      // in the other direction: the step's own surfaces outlive its cell.
      const ledger = surgePlan([5, 6, 7, 8, 9], -1);
      expect(hydroStepQueued(ledger, AI_CENTRAL)).to.be.false;
    });
  });

  describe('the gate is PERMISSIVE in the right direction', () => {
    it('never queues a source the standing plan did not promise', () => {
      const ledger = surgePlan([5], 5);
      expect(hydroStepQueued(ledger, DEV_CENTER), 'another card entirely').to.be.false;
      expect(hydroStepQueued(ledger, undefined), 'an unattributed surface').to.be.false;
    });

    it('never queues anything when NO plan stands (a single landing, idle)', () => {
      const ledger: HydroStepLedger = {steps: [], activated: new Set(), parkedAt: -1};
      expect(hydroStepQueued(ledger, AI_CENTRAL)).to.be.false;
      expect(hydroActiveStepSource(ledger)).to.be.undefined;
    });

    it('never queues the Hydronetwork\'s OWN stage rewards (no source card)', () => {
      // Stage 5's own draw is sourced to the Delta Project, which no step
      // declares — it must flow through the gate untouched.
      const ledger = surgePlan([5], 5);
      expect(hydroStepQueued(ledger, CardName.DELTA_PROJECT)).to.be.false;
    });
  });

  describe('a plan that repeats the same card at two stages', () => {
    const twice: HydroStepLedger = {
      steps: [
        {position: 3, sourceCard: AI_CENTRAL},
        {position: 7, sourceCard: AI_CENTRAL},
      ],
      activated: new Set<number>(),
      parkedAt: -1,
    };

    it('is owed by the EARLIER step first — path order, never «any match»', () => {
      expect(hydroStepOwnerPosition(twice, AI_CENTRAL)).to.equal(3);
    });

    it('moves to the later step once the earlier one has been activated', () => {
      const after3 = {...twice, activated: new Set([3])};
      expect(hydroStepOwnerPosition(after3, AI_CENTRAL)).to.equal(7);
      expect(hydroStepQueued(after3, AI_CENTRAL)).to.be.true;
    });

    it('opens once BOTH have been activated', () => {
      const both = {...twice, activated: new Set([3, 7])};
      expect(hydroStepQueued(both, AI_CENTRAL)).to.be.false;
    });
  });

  describe('the ACTIVE step\'s source card (the workspace\'s source seat)', () => {
    it('is the parked step\'s repeated card', () => {
      expect(hydroActiveStepSource(surgePlan([5, 6, 7], 7))).to.equal(AI_CENTRAL);
    });

    it('is absent while the marker is WALKING — it may not precede its stage', () => {
      expect(hydroActiveStepSource(surgePlan([5, 6], -1))).to.be.undefined;
    });

    it('is absent on a stop that repeats nothing (the stage-5 deck stop)', () => {
      expect(hydroActiveStepSource(surgePlan([5], 5))).to.be.undefined;
    });
  });
});
