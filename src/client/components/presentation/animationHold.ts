/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
/*
 * ANIMATION HOLD — the ONE registry through which every CRITICAL premium
 * animation (card deal / reveal, tile flight, resource-chip transfers, marker
 * glides, ceremonies, future scenes) reports "I own the screen right now" to
 * the presentation orchestrator (presentationFlow) — WITHOUT the game logic
 * ever knowing how the animation is implemented (GSAP / rAF / CSS).
 *
 * WHY: the per-flow module states already gate the COMMIT (the WaitingFor
 * `holdingFor*` promises resolve on the real GSAP completion), but the
 * POST-COMMIT halves (reveal beats, reward chips, ceremonies) and the
 * poll-driven notification feed were invisible to the orchestrator — a new
 * modal / toast could mount OVER a still-running scene. Registering a hold
 * makes the scene a first-class foreground occupant: notifications queue
 * behind it, mandatory surfaces (task host / draft / mandatory modal) wait,
 * and the moment the LAST hold releases, the orchestrator's existing
 * freed-transition drains the queue. There is NO timer in this chain: the
 * release IS the flow's own completion signal (GSAP onComplete → the flow's
 * `active`/phase flag drops); the ceiling below is a leak net, never pacing.
 *
 * TWO ATTACHMENT STYLES (pick one per animation):
 *
 *  1. SUPPLIER — for module-state flows that already expose a reactive
 *     "the scene owns the foreground" predicate:
 *         registerAnimationHoldSupplier('played-hero', playedHeroHolding);
 *     The predicate's own lifecycle (end / abort / safety timers) releases
 *     the hold on EVERY path with zero extra bookkeeping — skip, reduced
 *     motion, unmount and errors are handled wherever the flow already
 *     handles them.
 *
 *  2. HANDLE — for component beats / one-off timelines:
 *         const hold = beginAnimationHold('terraforming-ceremony');
 *         ... hold.release();   // idempotent — call from every exit path
 *     Convenience wrappers: `holdAnimationWhile(label, promise)` releases on
 *     settle (resolve OR reject); `holdForGsapAnimation(label, tl)` releases
 *     on the timeline's natural completion AND on kill/interrupt (chained —
 *     it never clobbers an existing onInterrupt), so composed timelines and
 *     skip contracts work without any extra code.
 *
 * TWO SCOPES:
 *  - 'blocking' (default) — the scene lives OUTSIDE the mandatory surfaces:
 *    it blocks notification delivery AND holds mandatory surfaces
 *    (isMandatoryPromptsHeld) until it completes.
 *  - 'notification-only' — the cinematic runs INSIDE a mandatory surface
 *    (the card-deal inside the task host / start scene): it must block
 *    notifications but MUST NOT hold the very surface that hosts it —
 *    holding it would unmount the scene's own stage (a self-deadlock).
 *
 * SAFETY CEILING: a hold (or a supplier stuck true) longer than `maxHoldMs`
 * (default 35 s — deliberately ABOVE every flow's own safety timer, so the
 * flow's abort always fires first and cleans up its visuals) is force-
 * released with a console.warn. The game can never be frozen by a leaked
 * hold; a ceiling release only risks a modal over a stuck animation — the
 * honest degraded mode.
 *
 * The registry is Vue-reactive: presentationFlow folds the counts into its
 * occupancy flags, so the existing blocked/freed broadcast (which drains the
 * notification queue and re-mounts held surfaces) fires the instant the last
 * hold releases — the UI continues immediately, never a fixed delay.
 */
import {computed, reactive, watch} from 'vue';

export type AnimationHoldScope = 'blocking' | 'notification-only';

export type AnimationHoldOptions = {
  /** Default 'blocking' — see the scope contract above. */
  scope?: AnimationHoldScope,
  /** Leak-net ceiling; keep it ABOVE the flow's own safety timer. */
  maxHoldMs?: number,
};

/** Idempotent release token — safe to call from every exit path, twice over. */
export type AnimationHold = {release: () => void};

/** Above every per-flow safety timer (largest today: the deck-draw 30 s). */
export const DEFAULT_MAX_HOLD_MS = 35_000;

type SupplierEntry = {
  scope: AnimationHoldScope,
  maxHoldMs: number,
  supplier: () => boolean,
  stop: () => void,
  ceilingTimer: ReturnType<typeof setTimeout> | undefined,
};

/** Registered flow predicates (functions — kept OUTSIDE the reactive store). */
const suppliers = new Map<string, SupplierEntry>();

const store = reactive({
  /** Bumped on (un)register so the counts computed re-scans the Map. */
  version: 0,
  /** Live imperative holds (beginAnimationHold). */
  manual: new Map<number, {label: string, scope: AnimationHoldScope}>(),
  /** Supplier labels past the safety ceiling — excluded until they go false. */
  expired: new Set<string>(),
});

let nextHoldId = 1;

const supplierWarned = new Set<string>();

/** A throwing supplier must never break the orchestrator's flags(). */
function safeRead(label: string, supplier: () => boolean): boolean {
  try {
    return supplier();
  } catch (e) {
    if (!supplierWarned.has(label)) {
      supplierWarned.add(label);
      console.warn(`[animation-hold] supplier "${label}" threw — treated as not holding`, e);
    }
    return false;
  }
}

const counts = computed(() => {
  void store.version;
  let all = 0;
  let blocking = 0;
  for (const [label, entry] of suppliers) {
    if (store.expired.has(label) || !safeRead(label, entry.supplier)) {
      continue;
    }
    all++;
    if (entry.scope === 'blocking') {
      blocking++;
    }
  }
  for (const hold of store.manual.values()) {
    all++;
    if (hold.scope === 'blocking') {
      blocking++;
    }
  }
  return {all, blocking};
});

// ── the contract ─────────────────────────────────────────────────────────────

/**
 * Register a flow's reactive "the scene owns the foreground" predicate.
 * Idempotent by label (a re-register replaces the previous entry — safe under
 * HMR / shared test bundles). The predicate is polled REACTIVELY (it reads
 * the flow's own reactive state), so the hold releases the instant the flow's
 * completion signal drops the flag — end, abort, skip, safety, unmount alike.
 */
export function registerAnimationHoldSupplier(label: string, supplier: () => boolean, options?: AnimationHoldOptions): void {
  unregisterAnimationHoldSupplier(label);
  const entry: SupplierEntry = {
    scope: options?.scope ?? 'blocking',
    maxHoldMs: options?.maxHoldMs ?? DEFAULT_MAX_HOLD_MS,
    supplier,
    stop: () => {},
    ceilingTimer: undefined,
  };
  // The ceiling: a supplier stuck true past maxHoldMs is EXPIRED (excluded
  // from the counts, with a warn) until it honestly goes false again.
  entry.stop = watch(() => safeRead(label, supplier), (holding) => {
    if (holding) {
      if (entry.ceilingTimer === undefined) {
        entry.ceilingTimer = setTimeout(() => {
          entry.ceilingTimer = undefined;
          store.expired.add(label);
          console.warn(`[animation-hold] "${label}" held for over ${entry.maxHoldMs}ms — force-released by the safety ceiling (leaked hold?)`);
        }, entry.maxHoldMs);
      }
    } else {
      if (entry.ceilingTimer !== undefined) {
        clearTimeout(entry.ceilingTimer);
        entry.ceilingTimer = undefined;
      }
      store.expired.delete(label);
    }
  }, {immediate: true});
  suppliers.set(label, entry);
  store.version++;
}

/** Remove a registered supplier (per-instance flows / test cleanup). */
export function unregisterAnimationHoldSupplier(label: string): void {
  const entry = suppliers.get(label);
  if (entry === undefined) {
    return;
  }
  entry.stop();
  if (entry.ceilingTimer !== undefined) {
    clearTimeout(entry.ceilingTimer);
  }
  suppliers.delete(label);
  store.expired.delete(label);
  store.version++;
}

/**
 * Begin an imperative hold (component beats / one-off animations). The
 * returned release is idempotent; the ceiling auto-releases a leaked handle.
 */
export function beginAnimationHold(label: string, options?: AnimationHoldOptions): AnimationHold {
  const id = nextHoldId++;
  store.manual.set(id, {label, scope: options?.scope ?? 'blocking'});
  const maxHoldMs = options?.maxHoldMs ?? DEFAULT_MAX_HOLD_MS;
  const ceiling = setTimeout(() => {
    if (store.manual.delete(id)) {
      console.warn(`[animation-hold] "${label}" held for over ${maxHoldMs}ms — force-released by the safety ceiling (leaked hold?)`);
    }
  }, maxHoldMs);
  let released = false;
  return {
    release: () => {
      if (released) {
        return;
      }
      released = true;
      clearTimeout(ceiling);
      store.manual.delete(id);
    },
  };
}

/** Hold for a promise's whole lifetime — releases on resolve AND reject. */
export function holdAnimationWhile<T>(label: string, work: Promise<T>, options?: AnimationHoldOptions): Promise<T> {
  const hold = beginAnimationHold(label, options);
  return work.finally(() => hold.release());
}

/**
 * The minimal completion surface of a GSAP animation (Tween / Timeline),
 * typed STRUCTURALLY so this module never depends on gsap itself — the
 * contract is "something that completes or gets interrupted", not GSAP.
 */
export type GsapLikeAnimation = {
  /** GSAP animations are thenable — resolves on NATURAL completion only. */
  then(onFulfilled?: (value: unknown) => unknown): PromiseLike<unknown>;
  /** GSAP's callback accessor — getter with 1 arg, setter with 2. */
  eventCallback(type: string, callback?: ((...args: Array<unknown>) => void) | null): unknown;
};

/**
 * Attach a hold to a GSAP animation for its whole critical lifetime:
 * releases on natural completion (`.then()` — works for single tweens and
 * composed timelines alike) AND on kill/interrupt (`onInterrupt`, chained so
 * an existing handler keeps firing). A `.then()` never fires for a killed
 * animation — that is exactly what the interrupt path and the ceiling cover.
 */
export function holdForGsapAnimation(label: string, animation: GsapLikeAnimation, options?: AnimationHoldOptions): AnimationHold {
  const hold = beginAnimationHold(label, options);
  void animation.then(() => hold.release());
  const previous = animation.eventCallback('onInterrupt');
  animation.eventCallback('onInterrupt', function(this: unknown, ...args: Array<unknown>) {
    if (typeof previous === 'function') {
      previous.apply(this, args);
    }
    hold.release();
  });
  return hold;
}

// ── reads (the orchestrator + diagnostics) ──────────────────────────────────

/** Every live hold (both scopes) — blocks notification delivery. */
export function animationHoldCount(): number {
  return counts.value.all;
}

/** The 'blocking'-scope subset — additionally holds MANDATORY surfaces. */
export function blockingAnimationHoldCount(): number {
  return counts.value.blocking;
}

export function isAnimationHoldActive(): boolean {
  return counts.value.all > 0;
}

/** Diagnostics (?gpDebug / dev): what is holding right now. */
export function activeAnimationHoldLabels(): Array<string> {
  void store.version;
  const labels: Array<string> = [];
  for (const [label, entry] of suppliers) {
    if (!store.expired.has(label) && safeRead(label, entry.supplier)) {
      labels.push(label);
    }
  }
  for (const hold of store.manual.values()) {
    labels.push(hold.label);
  }
  return labels;
}

// ── settle promise (imperative await for future call sites) ─────────────────

const settleResolvers: Array<() => void> = [];
const idleRef = computed(() => counts.value.all === 0);

watch(idleRef, (idle) => {
  if (idle && settleResolvers.length > 0) {
    const resolvers = settleResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }
});

/** Resolves the moment every hold has released — IMMEDIATELY when idle. */
export function whenAnimationsSettled(): Promise<void> {
  if (idleRef.value) {
    return Promise.resolve();
  }
  return new Promise((resolve) => settleResolvers.push(resolve));
}

// ── test support ─────────────────────────────────────────────────────────────

/** Test-only: drop every manual hold + expiry (suppliers mirror flow state,
 *  which the specs reset themselves; unregister per-spec labels explicitly). */
export function resetAnimationHoldsForTest(): void {
  store.manual.clear();
  store.expired.clear();
}
