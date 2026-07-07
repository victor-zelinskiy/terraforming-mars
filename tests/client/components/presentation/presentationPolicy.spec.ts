import {expect} from 'chai';
import {
  PresentationFlags,
  foregroundBlockReason,
  mandatoryPromptsHeld,
  notificationDeliveryBlocked,
  pendingQueueSummary,
} from '@/client/components/presentation/presentationPolicy';

function flags(partial: Partial<PresentationFlags> = {}): PresentationFlags {
  return {
    resultModalOpen: false,
    mandatoryLeases: 0,
    ceremonyLeases: 0,
    theaterOpen: false,
    flowHoldingNotificationVisible: false,
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
  });

  describe('notificationDeliveryBlocked', () => {
    it('blocked by any blocking foreground item', () => {
      expect(notificationDeliveryBlocked(flags())).eq(false);
      expect(notificationDeliveryBlocked(flags({resultModalOpen: true}))).eq(true);
      expect(notificationDeliveryBlocked(flags({mandatoryLeases: 1}))).eq(true);
      expect(notificationDeliveryBlocked(flags({theaterOpen: true}))).eq(true);
    });

    it('a visible flow-holding card does NOT block delivery by itself (the single visible slot serializes)', () => {
      expect(notificationDeliveryBlocked(flags({flowHoldingNotificationVisible: true}))).eq(false);
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
      // the two flow signals.
      expect(mandatoryPromptsHeld(flags({resultModalOpen: true, mandatoryLeases: 3}))).eq(false);
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
