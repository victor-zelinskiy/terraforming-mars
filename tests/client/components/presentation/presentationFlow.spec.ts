import {expect} from 'chai';
import {nextTick} from 'vue';
import {
  acquireForegroundLease,
  currentBlockReason,
  foregroundHoldLabels,
  isMandatoryPromptsHeld,
  isNotificationDeliveryBlocked,
  onForegroundBlocked,
  onForegroundFreed,
  registerFlowHoldSupplier,
  registerRevealParkSupplier,
  resetPresentationLeases,
} from '@/client/components/presentation/presentationFlow';
import {closeRevealViewer, revealViewerState} from '@/client/components/notifications/revealViewerState';
import {botTurnReviewState, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {DrawnCardEntry, drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {notificationFlowHoldSupplier} from '@/client/components/notifications/notificationState';
import {resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';

describe('presentationFlow (reactive orchestrator)', () => {
  beforeEach(() => {
    resetPresentationLeases();
    resetBotTurnReview();
    closeRevealViewer();
    drawnCardsState.events = [];
    resetAnimationHoldsForTest();
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
    // …but a decision surface being up is «the player is WORKING», not «the
    // screen is busy» — the event feed keeps flowing inside a workspace.
    expect(isNotificationDeliveryBlocked()).eq(false);
    release();
    release(); // double release must not underflow
    expect(currentBlockReason()).eq(undefined);
    const release2 = acquireForegroundLease('mandatory-choice');
    expect(currentBlockReason()).eq('mandatory-choice');
    release2();
  });

  it('a CEREMONY lease silences the feed (it owns the screen)', () => {
    const release = acquireForegroundLease('ceremony');
    expect(isNotificationDeliveryBlocked()).eq(true);
    release();
    expect(isNotificationDeliveryBlocked()).eq(false);
  });

  it('derived result-modal occupancy: the read-only revealed-cards viewer blocks delivery', () => {
    revealViewerState.open = true;
    expect(currentBlockReason()).eq('result-modal');
    expect(isNotificationDeliveryBlocked()).eq(true);
    closeRevealViewer();
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

  // ── THE REVEAL PARK EXEMPTION («Экран завис» deadlock) ────────────────────
  // A foreign colony bonus's batch is deliberately presented NOWHERE until the
  // player opens its mandatory announcement — and that announcement's FIRST
  // presentation waits for the notification feed to settle. Counted as a live
  // result-modal, the parked batch silenced the very feed its own door was
  // waiting for: batch → silence → queued toasts → announce never presents →
  // nothing on screen, and only the foreground watchdog (or a reload) got out
  // («[console-foreground-watchdog] … expired result-modal»).
  describe('the reveal park exemption', () => {
    const PLUTO: CardDrawRevealSource = {type: 'colony', colonyName: ColonyName.PLUTO};
    const OWN: CardDrawRevealSource = {type: 'card', cardName: CardName.RESTRICTED_AREA};
    const batch = (id: number, source: CardDrawRevealSource): DrawnCardEntry => ({
      id, source, cards: [], takenIndices: new Set<number>(), acking: false, dismissed: false,
    });
    const parksColonies = (source: CardDrawRevealSource | undefined) => source?.type === 'colony';

    it('a PARKED batch neither claims the foreground nor silences the feed', () => {
      drawnCardsState.events = [batch(1, PLUTO)];
      expect(currentBlockReason(), 'default: nothing is parked').eq('result-modal');
      const restore = registerRevealParkSupplier(parksColonies);
      expect(currentBlockReason()).eq(undefined);
      // The queue can drain → notificationsSettled() can come true → the
      // announcement (the park's own door) can present. The deadlock's edge.
      expect(isNotificationDeliveryBlocked()).eq(false);
      restore();
      expect(currentBlockReason(), 'restore brings the default back').eq('result-modal');
    });

    it('the park is PER BATCH: the viewer\'s own unparked batch still silences', () => {
      const restore = registerRevealParkSupplier(parksColonies);
      drawnCardsState.events = [batch(1, OWN), batch(2, PLUTO)];
      expect(currentBlockReason()).eq('result-modal');
      drawnCardsState.events[0].dismissed = true;
      expect(currentBlockReason(), 'only the parked one left').eq(undefined);
      restore();
    });

    it('the park lifting re-raises the block (the batch is about to present)', () => {
      let parked = true;
      const restore = registerRevealParkSupplier(() => parked);
      drawnCardsState.events = [batch(1, PLUTO)];
      expect(currentBlockReason()).eq(undefined);
      parked = false; // the entry armed — the reveal presents now
      expect(currentBlockReason()).eq('result-modal');
      restore();
    });

    it('a stale restore never clobbers a LATER registration', () => {
      drawnCardsState.events = [batch(1, PLUTO)];
      // Two DISTINCT closures on purpose — the restore guard is by function
      // identity, which is exactly what two real registrants would have.
      const restore1 = registerRevealParkSupplier((source) => parksColonies(source));
      const restore2 = registerRevealParkSupplier((source) => parksColonies(source));
      restore1(); // the earlier holder letting go must not undo the live one
      expect(currentBlockReason()).eq(undefined);
      restore2();
      expect(currentBlockReason()).eq('result-modal');
    });

    it('resetPresentationLeases restores the default supplier (bundle-shared state)', () => {
      registerRevealParkSupplier(() => true);
      drawnCardsState.events = [batch(1, PLUTO)];
      expect(currentBlockReason()).eq(undefined);
      resetPresentationLeases();
      expect(currentBlockReason()).eq('result-modal');
    });

    it('the hold label names the live result-modal member (the watchdog\'s recovery warn)', () => {
      drawnCardsState.events = [batch(1, OWN)];
      expect(foregroundHoldLabels()).deep.eq(['result-modal[drawn]']);
      revealViewerState.open = true;
      expect(foregroundHoldLabels()).deep.eq(['result-modal[drawn+viewer]']);
      drawnCardsState.events = [];
      expect(foregroundHoldLabels()).deep.eq(['result-modal[viewer]']);
    });
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

  // The broadcast rides the SILENCING predicate — both subscribers are the
  // feed's own bookkeeping (re-queue on block, drain on free), so a mandatory
  // lease (a workspace the player opened) must not fire either of them.
  it('broadcasts freed/blocked transitions to subscribers', async () => {
    let freed = 0;
    let blocked = 0;
    onForegroundFreed(() => freed++);
    onForegroundBlocked(() => blocked++);

    const working = acquireForegroundLease('mandatory-choice');
    await nextTick();
    expect(blocked, 'a decision surface never silences the feed').eq(0);

    revealViewerState.open = true;
    await nextTick();
    expect(blocked).eq(1);

    // A second silencing item while already silenced is NOT a new transition.
    const release2 = acquireForegroundLease('ceremony');
    await nextTick();
    expect(blocked).eq(1);

    closeRevealViewer();
    await nextTick();
    expect(freed).eq(0); // the ceremony still holds

    release2();
    await nextTick();
    expect(freed).eq(1);
    working();
  });
});
