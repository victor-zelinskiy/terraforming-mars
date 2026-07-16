import {expect} from 'chai';
import {nextTick, reactive} from 'vue';
import {
  DEFAULT_MAX_HOLD_MS,
  GsapLikeAnimation,
  animationHoldCount,
  beginAnimationHold,
  blockingAnimationHoldCount,
  holdAnimationWhile,
  holdForGsapAnimation,
  isAnimationHoldActive,
  activeAnimationHoldLabels,
  registerAnimationHoldSupplier,
  resetAnimationHoldsForTest,
  unregisterAnimationHoldSupplier,
  whenAnimationsSettled,
} from '@/client/components/presentation/animationHold';
import {
  currentBlockReason,
  isMandatoryPromptsHeld,
  isNotificationDeliveryBlocked,
  onForegroundFreed,
  resetPresentationLeases,
} from '@/client/components/presentation/presentationFlow';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('animationHold (the critical-animation registry)', () => {
  beforeEach(() => {
    resetAnimationHoldsForTest();
    resetPresentationLeases();
  });

  afterEach(() => {
    // Module state is BUNDLE-SHARED in mochapack — leave nothing behind.
    unregisterAnimationHoldSupplier('spec-supplier');
    unregisterAnimationHoldSupplier('spec-supplier-soft');
    unregisterAnimationHoldSupplier('spec-supplier-throwing');
    unregisterAnimationHoldSupplier('spec-supplier-stuck');
    resetAnimationHoldsForTest();
  });

  it('a manual hold counts, blocks delivery, holds mandatory surfaces; release is idempotent', () => {
    expect(isAnimationHoldActive()).eq(false);
    const hold = beginAnimationHold('spec-beat');
    expect(animationHoldCount()).eq(1);
    expect(blockingAnimationHoldCount()).eq(1);
    expect(currentBlockReason()).eq('animation');
    expect(isNotificationDeliveryBlocked()).eq(true);
    expect(isMandatoryPromptsHeld()).eq(true);
    expect(activeAnimationHoldLabels()).deep.eq(['spec-beat']);
    hold.release();
    hold.release(); // double release must not underflow
    expect(animationHoldCount()).eq(0);
    expect(currentBlockReason()).eq(undefined);
    expect(isMandatoryPromptsHeld()).eq(false);
  });

  it('a notification-only hold blocks delivery but never holds mandatory surfaces', () => {
    const hold = beginAnimationHold('spec-deal', {scope: 'notification-only'});
    expect(animationHoldCount()).eq(1);
    expect(blockingAnimationHoldCount()).eq(0);
    expect(isNotificationDeliveryBlocked()).eq(true);
    expect(isMandatoryPromptsHeld()).eq(false);
    hold.release();
  });

  it('a registered supplier holds exactly while its reactive predicate is true', () => {
    const flow = reactive({active: false});
    registerAnimationHoldSupplier('spec-supplier', () => flow.active);
    expect(animationHoldCount()).eq(0);
    flow.active = true;
    expect(animationHoldCount()).eq(1);
    expect(currentBlockReason()).eq('animation');
    flow.active = false;
    expect(animationHoldCount()).eq(0);
    expect(currentBlockReason()).eq(undefined);
  });

  it('re-registering the same label replaces the previous supplier; unregister removes it', () => {
    const flow = reactive({active: true});
    registerAnimationHoldSupplier('spec-supplier', () => flow.active);
    registerAnimationHoldSupplier('spec-supplier', () => false);
    expect(animationHoldCount()).eq(0);
    registerAnimationHoldSupplier('spec-supplier', () => flow.active);
    expect(animationHoldCount()).eq(1);
    unregisterAnimationHoldSupplier('spec-supplier');
    expect(animationHoldCount()).eq(0);
  });

  it('a throwing supplier is treated as not holding (the orchestrator must never break)', () => {
    registerAnimationHoldSupplier('spec-supplier-throwing', () => {
      throw new Error('boom');
    });
    expect(animationHoldCount()).eq(0);
    expect(currentBlockReason()).eq(undefined);
  });

  it('the safety ceiling force-releases a leaked manual hold', async () => {
    beginAnimationHold('spec-leak', {maxHoldMs: 20}); // deliberately never released
    expect(animationHoldCount()).eq(1);
    await wait(45);
    expect(animationHoldCount()).eq(0);
  });

  it('the safety ceiling expires a stuck supplier — and re-arms once it honestly drops', async () => {
    const flow = reactive({active: true});
    registerAnimationHoldSupplier('spec-supplier-stuck', () => flow.active, {maxHoldMs: 20});
    expect(animationHoldCount()).eq(1);
    await wait(45);
    expect(animationHoldCount()).eq(0); // expired — excluded until it goes false
    flow.active = false;
    await nextTick();
    flow.active = true;
    await nextTick();
    expect(animationHoldCount()).eq(1); // a fresh honest hold counts again
    flow.active = false;
  });

  it('holdAnimationWhile releases on resolve AND on reject', async () => {
    let resolveWork: () => void = () => {};
    const settled = holdAnimationWhile('spec-work', new Promise<void>((resolve) => {
      resolveWork = resolve;
    }));
    expect(animationHoldCount()).eq(1);
    resolveWork();
    await settled;
    expect(animationHoldCount()).eq(0);

    let rejectWork: (e: Error) => void = () => {};
    const failed = holdAnimationWhile('spec-work-fail', new Promise<void>((_resolve, reject) => {
      rejectWork = reject;
    }));
    expect(animationHoldCount()).eq(1);
    rejectWork(new Error('fail'));
    await failed.catch(() => {});
    expect(animationHoldCount()).eq(0);
  });

  it('holdForGsapAnimation releases on natural completion (thenable) — chained onInterrupt preserved', async () => {
    let complete: () => void = () => {};
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    let interruptFired = 0;
    const callbacks: Record<string, ((...args: Array<unknown>) => void) | null | undefined> = {
      onInterrupt: () => interruptFired++,
    };
    const fakeTimeline: GsapLikeAnimation = {
      then: (onFulfilled?: (value: unknown) => unknown) => completion.then(onFulfilled),
      eventCallback: (type: string, callback?: ((...args: Array<unknown>) => void) | null) => {
        if (callback === undefined) {
          return callbacks[type];
        }
        callbacks[type] = callback;
        return fakeTimeline;
      },
    };
    holdForGsapAnimation('spec-gsap', fakeTimeline);
    expect(animationHoldCount()).eq(1);
    complete();
    await wait(0);
    expect(animationHoldCount()).eq(0);
    // The pre-existing onInterrupt keeps firing through the chained wrapper.
    callbacks['onInterrupt']?.();
    expect(interruptFired).eq(1);
  });

  it('holdForGsapAnimation releases on kill/interrupt (a killed timeline never resolves .then())', () => {
    const callbacks: Record<string, ((...args: Array<unknown>) => void) | null | undefined> = {};
    const fakeTimeline: GsapLikeAnimation = {
      then: () => new Promise(() => {}), // never resolves — a killed animation
      eventCallback: (type: string, callback?: ((...args: Array<unknown>) => void) | null) => {
        if (callback === undefined) {
          return callbacks[type];
        }
        callbacks[type] = callback;
        return fakeTimeline;
      },
    };
    holdForGsapAnimation('spec-gsap-kill', fakeTimeline);
    expect(animationHoldCount()).eq(1);
    callbacks['onInterrupt']?.(); // gsap fires this on kill()
    expect(animationHoldCount()).eq(0);
  });

  it('whenAnimationsSettled resolves immediately when idle, else at the LAST release', async () => {
    await whenAnimationsSettled(); // idle — immediate
    const a = beginAnimationHold('spec-a');
    const b = beginAnimationHold('spec-b');
    let settled = false;
    void whenAnimationsSettled().then(() => {
      settled = true;
    });
    a.release();
    await nextTick();
    await wait(0);
    expect(settled).eq(false); // b still holds
    b.release();
    await nextTick();
    await wait(0);
    expect(settled).eq(true);
  });

  it('releasing the last hold fires the orchestrator freed-broadcast (the queue drains at once)', async () => {
    let freed = 0;
    onForegroundFreed(() => freed++);
    const hold = beginAnimationHold('spec-drain');
    await nextTick();
    hold.release();
    await nextTick();
    expect(freed).eq(1);
  });

  it('the default ceiling sits ABOVE every per-flow safety timer', () => {
    // Largest flow safety today: the deck-draw scene (30 s) — the flow's own
    // abort must always fire first and clean up its visuals.
    expect(DEFAULT_MAX_HOLD_MS).greaterThan(30_000);
  });
});
