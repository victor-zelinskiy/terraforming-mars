import {expect} from 'chai';
import {
  PresentationFlags,
  foregroundBlockReason,
  mandatoryPromptsHeld,
  notificationDeliveryBlocked,
  notificationSilencingReason,
  pendingQueueSummary,
  presentationStalled,
} from '@/client/components/presentation/presentationPolicy';

function flags(partial: Partial<PresentationFlags> = {}): PresentationFlags {
  return {
    resultModalOpen: false,
    mandatoryLeases: 0,
    ceremonyLeases: 0,
    theaterOpen: false,
    flowHoldingNotificationVisible: false,
    animationHolds: 0,
    blockingAnimationHolds: 0,
    ...partial,
  };
}

describe('presentationPolicy (pure)', () => {
  describe('foregroundBlockReason', () => {
    it('is undefined when nothing is up', () => {
      expect(foregroundBlockReason(flags())).eq(undefined);
    });

    it('a result modal wins over everything (the player\'s own action outcome)', () => {
      expect(foregroundBlockReason(flags({
        resultModalOpen: true, theaterOpen: true, mandatoryLeases: 1, ceremonyLeases: 1,
      }))).eq('result-modal');
    });

    it('the theater outranks a mandatory lease (draft waits behind it)', () => {
      expect(foregroundBlockReason(flags({theaterOpen: true, mandatoryLeases: 1}))).eq('turn-theater');
    });

    it('a mandatory lease blocks; a ceremony only when nothing stronger is up', () => {
      expect(foregroundBlockReason(flags({mandatoryLeases: 2}))).eq('mandatory-choice');
      expect(foregroundBlockReason(flags({ceremonyLeases: 1}))).eq('ceremony');
    });

    it('a LIVE critical animation outranks everything (it IS what is on screen)', () => {
      expect(foregroundBlockReason(flags({animationHolds: 1}))).eq('animation');
      expect(foregroundBlockReason(flags({
        animationHolds: 1, resultModalOpen: true, theaterOpen: true, mandatoryLeases: 1,
      }))).eq('animation');
    });
  });

  describe('notificationDeliveryBlocked', () => {
    it('blocked by whatever OWNS THE SCREEN', () => {
      expect(notificationDeliveryBlocked(flags())).eq(false);
      expect(notificationDeliveryBlocked(flags({resultModalOpen: true}))).eq(true);
      expect(notificationDeliveryBlocked(flags({theaterOpen: true}))).eq(true);
      expect(notificationDeliveryBlocked(flags({ceremonyLeases: 1}))).eq(true);
    });

    // A decision surface / workspace being open is «the player is WORKING», not
    // «the screen is busy telling a story». Silencing the feed for it piled the
    // game's events up as «СОБЫТИЯ В ОЧЕРЕДИ +N» for most of a turn.
    it('a mandatory-choice lease alone never silences the feed', () => {
      expect(notificationDeliveryBlocked(flags({mandatoryLeases: 3}))).eq(false);
    });

    // The winner of `foregroundBlockReason` is NOT the answer here: a ceremony
    // sits BELOW a mandatory lease in the priority order, so collapsing to the
    // top reason first would let a toast float over it.
    it('a silencing reason hidden BEHIND a mandatory lease still counts', () => {
      expect(foregroundBlockReason(flags({mandatoryLeases: 1, ceremonyLeases: 1}))).eq('mandatory-choice');
      expect(notificationDeliveryBlocked(flags({mandatoryLeases: 1, ceremonyLeases: 1}))).eq(true);
      expect(notificationSilencingReason(flags({mandatoryLeases: 1, ceremonyLeases: 1}))).eq('ceremony');
      expect(notificationSilencingReason(flags({mandatoryLeases: 1}))).eq(undefined);
    });

    it('a visible flow-holding card does NOT block delivery by itself (the single visible slot serializes)', () => {
      expect(notificationDeliveryBlocked(flags({flowHoldingNotificationVisible: true}))).eq(false);
    });

    it('ANY animation hold blocks delivery — both scopes (nothing floats over a scene)', () => {
      expect(notificationDeliveryBlocked(flags({animationHolds: 1}))).eq(true);
      expect(notificationDeliveryBlocked(flags({animationHolds: 1, blockingAnimationHolds: 1}))).eq(true);
    });
  });

  describe('mandatoryPromptsHeld', () => {
    it('held while the AI-turn card is visible or the theater is open', () => {
      expect(mandatoryPromptsHeld(flags())).eq(false);
      expect(mandatoryPromptsHeld(flags({flowHoldingNotificationVisible: true}))).eq(true);
      expect(mandatoryPromptsHeld(flags({theaterOpen: true}))).eq(true);
    });

    it('an ordinary corner toast never holds a draft (only flow-holding items participate)', () => {
      // No flag for ordinary toasts exists at all — held is derived ONLY from
      // the flow signals + blocking animation holds.
      expect(mandatoryPromptsHeld(flags({resultModalOpen: true, mandatoryLeases: 3}))).eq(false);
    });

    it('a BLOCKING animation holds mandatory surfaces; a notification-only one never does (it runs INSIDE one)', () => {
      expect(mandatoryPromptsHeld(flags({animationHolds: 1, blockingAnimationHolds: 1}))).eq(true);
      // notification-only: counted in animationHolds but NOT in the blocking subset.
      expect(mandatoryPromptsHeld(flags({animationHolds: 1, blockingAnimationHolds: 0}))).eq(false);
    });

    // A flow-holding card asks the NEXT prompt to wait — it may never RETRACT a
    // surface the player already has open. Free while the feed was silenced by
    // that surface's own lease; now that the feed flows inside a workspace, a
    // bot-turn card would otherwise unmount a live payment for its whole TTL.
    it('a flow-holding card cannot hold back a surface that is ALREADY up', () => {
      expect(mandatoryPromptsHeld(flags({flowHoldingNotificationVisible: true}))).eq(true);
      expect(mandatoryPromptsHeld(flags({flowHoldingNotificationVisible: true, mandatoryLeases: 1}))).eq(false);
      // The theater and a blocking animation are different: they OWN the
      // screen, so they keep holding regardless.
      expect(mandatoryPromptsHeld(flags({theaterOpen: true, mandatoryLeases: 1}))).eq(true);
      expect(mandatoryPromptsHeld(flags({blockingAnimationHolds: 1, mandatoryLeases: 1}))).eq(true);
    });
  });

  describe('presentationStalled', () => {
    const stall = {claimed: true, surfaceRendered: false, waiting: true};

    it('all three parts must hold — a claim backed by a rendered surface is honest', () => {
      expect(presentationStalled(stall)).eq(true);
      expect(presentationStalled({...stall, surfaceRendered: true})).eq(false);
    });

    it('an unclaimed foreground is never stalled, however empty the screen is', () => {
      expect(presentationStalled({...stall, claimed: false})).eq(false);
    });

    it('a claim nobody is waiting on is left alone (the player is not blocked)', () => {
      expect(presentationStalled({...stall, waiting: false})).eq(false);
    });
  });

  describe('pendingQueueSummary', () => {
    it('counts the queue and flags critical content', () => {
      expect(pendingQueueSummary([])).deep.eq({count: 0, critical: false});
      expect(pendingQueueSummary([{priority: 5}, {priority: 4}])).deep.eq({count: 2, critical: false});
      expect(pendingQueueSummary([{priority: 5}, {priority: 2}])).deep.eq({count: 2, critical: true});
      expect(pendingQueueSummary([{priority: 5, holdsFlow: true}])).deep.eq({count: 1, critical: true});
    });
  });
});
