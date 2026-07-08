import {expect} from 'chai';
import {nextTick} from 'vue';
import {
  acquireForegroundLease,
  currentBlockReason,
  isMandatoryPromptsHeld,
  isNotificationDeliveryBlocked,
  onForegroundBlocked,
  onForegroundFreed,
  registerFlowHoldSupplier,
  resetPresentationLeases,
} from '@/client/components/presentation/presentationFlow';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import {botTurnReviewState, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {notificationFlowHoldSupplier} from '@/client/components/notifications/notificationState';

describe('presentationFlow (reactive orchestrator)', () => {
  beforeEach(() => {
    resetPresentationLeases();
    resetBotTurnReview();
    dismissReveal();
    drawnCardsState.events = [];
    registerFlowHoldSupplier(() => false);
  });

  after(() => {
    // Restore the REAL supplier (notificationState's) — module state is shared
    // across every spec in the bundle.
    registerFlowHoldSupplier(notificationFlowHoldSupplier);
  });

  it('leases: acquire blocks, release frees; the release fn is idempotent', () => {
    expect(currentBlockReason()).eq(undefined);
    const release = acquireForegroundLease('mandatory-choice');
    expect(currentBlockReason()).eq('mandatory-choice');
    expect(isNotificationDeliveryBlocked()).eq(true);
    release();
    release(); // double release must not underflow
    expect(currentBlockReason()).eq(undefined);
    const release2 = acquireForegroundLease('mandatory-choice');
    expect(currentBlockReason()).eq('mandatory-choice');
    release2();
  });

  it('derived result-modal occupancy: the reveal-result overlay blocks delivery', () => {
    revealResultState.active = true;
    expect(currentBlockReason()).eq('result-modal');
    expect(isNotificationDeliveryBlocked()).eq(true);
    dismissReveal();
    expect(currentBlockReason()).eq(undefined);
  });

  it('derived result-modal occupancy: a visible drawn-cards batch blocks delivery', () => {
    drawnCardsState.events = [{
      id: 1, cards: [], takenIndices: new Set<number>(), acking: false, dismissed: false,
    }];
    expect(currentBlockReason()).eq('result-modal');
    drawnCardsState.events[0].dismissed = true;
    expect(currentBlockReason()).eq(undefined);
  });

  it('review occupancy: an open «Разбор хода» holds mandatory prompts + blocks delivery', () => {
    botTurnReviewState.open = true;
    expect(currentBlockReason()).eq('turn-theater');
    expect(isMandatoryPromptsHeld()).eq(true);
    botTurnReviewState.open = false;
    expect(isMandatoryPromptsHeld()).eq(false);
  });

  it('the injected flow-hold supplier holds mandatory prompts WITHOUT blocking delivery', () => {
    let holding = false;
    registerFlowHoldSupplier(() => holding);
    expect(isMandatoryPromptsHeld()).eq(false);
    holding = true;
    expect(isMandatoryPromptsHeld()).eq(true);
    expect(isNotificationDeliveryBlocked()).eq(false);
  });

  it('broadcasts freed/blocked transitions to subscribers', async () => {
    let freed = 0;
    let blocked = 0;
    onForegroundFreed(() => freed++);
    onForegroundBlocked(() => blocked++);

    const release = acquireForegroundLease('mandatory-choice');
    await nextTick();
    expect(blocked).eq(1);

    // A second lease while already blocked is NOT a new transition.
    const release2 = acquireForegroundLease('ceremony');
    await nextTick();
    expect(blocked).eq(1);

    release();
    await nextTick();
    expect(freed).eq(0); // ceremony still holds

    release2();
    await nextTick();
    expect(freed).eq(1);
  });
});
