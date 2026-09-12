import {expect} from 'chai';
import {nextTick, reactive, watchEffect} from 'vue';
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
  refreshAnimationHolds,
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
    unregisterAnimationHoldSupplier('spec-supplier-sweep');
    resetAnimationHoldsForTest();
  });

  it('a manual hold counts, blocks delivery, holds mandatory surfaces; release is idempotent', () => {
    // The message NAMES the leak: a red run here is almost always another
    // spec's module state tripping a module-scope supplier — the label says
    // which flow, instead of a bare «expected true to equal false».
    expect(isAnimationHoldActive(), `stray holds at entry: ${activeAnimationHoldLabels().join(', ')}`).eq(false);
    const hold = beginAnimationHold('spec-beat');
    expect(animationHoldCount()).eq(1);
    expect(blockingAnimationHoldCount()).eq(1);
    expect(currentBlockReason()).eq('animation');
    expect(isNotificationDeliveryBlocked()).eq(true);
    expect(isMandatoryPromptsHeld()).eq(true);
    // The label carries its SCOPE: the first production leak report could not
    // say whether the stuck hold was 'blocking' or 'notification-only', which
    // is exactly what narrows a leak down to a flow.
    expect(activeAnimationHoldLabels()).deep.eq(['spec-beat[blocking]']);
    hold.release();
    hold.release(); // double release must not underflow
    expect(animationHoldCount()).eq(0);
    expect(currentBlockReason()).eq(undefined);
    expect(isMandatoryPromptsHeld()).eq(false);
  });

  it('a notification-only hold blocks delivery but never holds mandatory surfaces', () => {
    const hold = beginAnimationHold('spec-deal', {scope: 'notification-only'});
    expect(animationHoldCount()).eq(1);
    expect(blockingAnimationHoldCount(), `stray blocking holds: ${activeAnimationHoldLabels().join(', ')}`).eq(0);
    expect(isNotificationDeliveryBlocked()).eq(true);
    expect(isMandatoryPromptsHeld(), `mandatory held by: ${activeAnimationHoldLabels().join(', ')}`).eq(false);
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

  // REGRESSION (Steam Deck perf iteration 1): the console watchdog bumps
  // `refreshAnimationHolds()` every second (the phantom-hold net). The counts
  // computed must be IDENTITY-STABLE when nothing changed, so that quiet tick
  // ends at the counts boundary instead of re-deriving every dependent
  // (admission signals, idle flags, presentationFlow) once a second.
  it('refreshAnimationHolds with nothing changed does not re-fire dependents', async () => {
    let evals = 0;
    const stop = watchEffect(() => {
      void animationHoldCount();
      evals++;
    });
    await nextTick();
    const before = evals;
    refreshAnimationHolds();
    refreshAnimationHolds();
    await nextTick();
    expect(evals).eq(before);
    // …and a REAL change still propagates through the same boundary.
    const hold = beginAnimationHold('spec-tick');
    await nextTick();
    expect(evals).greaterThan(before);
    hold.release();
    stop();
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

  it('the ceiling runs the OWNER RECOVERY — the wedge behind the hold ends, not just the count', async () => {
    // The field lesson (2026-09-10): «tile-placement-remote» and
    // «hydro-marker» were each "force-released" at 35 s while their module
    // state stayed wedged — every input gate and close gate reading that
    // state directly stayed frozen behind a hold the registry had already
    // stopped counting. The `expire` hook is the owner's own abort: the
    // ceiling now ends the transaction, and the predicate then falls
    // honestly by itself.
    const flow = reactive({active: true});
    let recovered = 0;
    registerAnimationHoldSupplier('spec-supplier-stuck', () => flow.active, {
      maxHoldMs: 20,
      expire: () => {
        recovered++;
        flow.active = false; // the owner's abort drops its own state
      },
    });
    expect(animationHoldCount()).eq(1);
    await wait(45);
    expect(recovered, 'the owner recovery ran exactly once').eq(1);
    expect(flow.active, 'the module state itself was recalled').eq(false);
    expect(animationHoldCount()).eq(0);
    // …and a recovery that THROWS is warned, never propagated into the timer.
    flow.active = true;
    registerAnimationHoldSupplier('spec-supplier-stuck', () => flow.active, {
      maxHoldMs: 20,
      expire: () => {
        throw new Error('owner recovery boom');
      },
    });
    await wait(45);
    expect(animationHoldCount(), 'the mask still applied despite the throw').eq(0);
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

  // REGRESSION (field log 2026-09-12): the ceiling lived ONLY in the
  // per-supplier watch, which fires on REACTIVE edges — a supplier whose term
  // is a plain module variable (the remote-placement queue) could go TRUE
  // with no edge, so the counts held everything (the sweep sees the predicate
  // fresh) while the ceiling that would bound it NEVER ARMED: an unbounded
  // freeze with no owner recovery. The sweep now reconciles the ceiling too.
  it('the sweep ARMS the ceiling for a rising edge no watcher ever saw', async () => {
    let holding = false; // deliberately PLAIN — no reactive edge ever fires
    let recovered = 0;
    registerAnimationHoldSupplier('spec-supplier-sweep', () => holding, {
      maxHoldMs: 20,
      expire: () => {
        recovered++;
        holding = false; // the owner's abort drops its own state
      },
    });
    holding = true;
    refreshAnimationHolds(); // the console's 1 s tick — the only edge there is
    expect(animationHoldCount(), 'the sweep counts the hold').eq(1);
    await wait(45);
    expect(recovered, 'the ceiling armed off the sweep and ran the recovery').eq(1);
    refreshAnimationHolds();
    expect(animationHoldCount()).eq(0);
  });

  // …and the mirror image: the queue drains through a path that touches no
  // reactive field (the degrade branch), so the watcher never sees the
  // FALLING edge — the stale timer then fired at 35 s over an honestly idle
  // module («force-released… {"active":false,"queued":0}», twice in one day's
  // log). The sweep disarms it; no warn, no phantom expiry.
  it('the sweep DISARMS a stale ceiling after a falling edge no watcher ever saw', async () => {
    let holding = false;
    let recovered = 0;
    const warns: Array<string> = [];
    const realWarn = console.warn;
    console.warn = (...args: Array<unknown>) => warns.push(String(args[0]));
    try {
      registerAnimationHoldSupplier('spec-supplier-sweep', () => holding, {
        maxHoldMs: 20,
        expire: () => recovered++,
      });
      holding = true;
      refreshAnimationHolds(); // arms the ceiling
      holding = false; // …drains with no reactive edge (the degrade path)
      refreshAnimationHolds(); // the next tick must disarm the stale timer
      await wait(45);
      expect(recovered, 'no phantom owner recovery').eq(0);
      expect(warns.filter((w) => w.includes('spec-supplier-sweep')),
        'no false «force-released» alarm').deep.eq([]);
      // …and a LATER real hold gets a fresh, working ceiling.
      holding = true;
      refreshAnimationHolds();
      await wait(45);
      expect(recovered, 'the fresh window still guards').eq(1);
    } finally {
      console.warn = realWarn;
    }
  });
});
