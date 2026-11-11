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
 *
 * EVERY HOLD IS A RUN OF THE FLOW TREE (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §10 · C2). A
 * hold that stands is a `scene` scope of the flow kernel, opened in the session that stands when it rises
 * (`scene:hold:<label>#n` under `session:game#n`; under the lobby when no game screen is up): the tree names every scene
 * that owns the foreground and since when, the ceiling is a timer OWNED by that scope (the kernel's clock — one
 * clock, a manual one in a spec), and the run ends exactly once — `done` when its flow lets go, `expired` at the
 * ceiling (or when a net ends it), `cancelled` when ITS SESSION ENDS UNDER IT. That last end is the one the registry
 * did not have: a hold raised in a game that is gone used to stand into the next one for the rest of its 35 s (a
 * supplier whose module nobody reset — for ever, masked only by the ceiling). Now the session's end is the ceiling:
 * the hold is taken down through its owner's recovery, the same door the ceiling uses, at the moment the game screen
 * leaves. A manual hold's handle carries its scope (`hold.scope`) — a beat's own timers and waits belong IN it
 * (`hold.scope.after(…)`), and end with it.
 */
import {computed, reactive, watch} from 'vue';
import {ReactivePredicate, reactivePredicate} from '@/client/components/presentation/reactivityWitness';
import {FlowScope, ScopeEnd} from '@/client/console/kernel/flowScope';
import {traceFlow} from '@/client/console/kernel/flowTrace';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

export type AnimationHoldScope = 'blocking' | 'notification-only';

export type AnimationHoldOptions = {
  /** Default 'blocking' — see the scope contract above. */
  scope?: AnimationHoldScope,
  /** Leak-net ceiling; keep it ABOVE the flow's own safety timer. */
  maxHoldMs?: number,
  /**
   * Optional leak-diagnosis hook. Called ONCE, the instant the safety ceiling
   * force-releases this hold, and its return value is appended to the warn —
   * so a leaked hold prints WHY it was still held (which flights / flags were
   * stuck), never a bare "leaked hold?". Must not throw (guarded) and must be
   * cheap (it runs on the ceiling path only). Reuse for any hold that can leak.
   */
  diagnose?: () => unknown,
  /**
   * THE OWNER'S HONEST RECOVERY, run when the ceiling fires (and when the
   * foreground watchdog expires the hold). The ceiling used to only MASK a
   * leaked supplier — exclude it from the counts while the owning module's
   * state stayed wedged: the input gates, busy conjunctions and close gates
   * reading that state directly stayed stuck long past the "release" (field
   * log 2026-09-10: «tile-placement-remote» and «hydro-marker» each held
   * 35 s, were "force-released", and their flows stayed frozen regardless).
   * A supplier whose module HAS an abort/recall registers it here; the
   * ceiling then ends the WEDGE, not just the hold. Guarded (a throw is
   * warned, never propagated); called once per rising edge.
   */
  expire?: () => void,
  /**
   * WHAT THE HOLD WAITS FOR when it is not an animation (the wait graph's target — `waitGraphSources.ts`): `player` —
   * its release is the player's (a press, a reading); `server` — another seat's / the server's event. Undeclared = a
   * VISIBLE motion: a blocking hold standing with nothing moving on the page is then a dead end, ended through `expire`
   * (`motionWitness.ts`). Declare it on any hold that may honestly stand STILL.
   */
  waitsFor?: 'player' | 'server',
};

/**
 * Idempotent release token — safe to call from every exit path, twice over. `scope` is the hold's run in the flow
 * tree: it lives exactly as long as the hold stands (released, expired, or its session gone), so a timer or a wait
 * opened in it can never outlive the beat it serves.
 */
export type AnimationHold = {release: () => void, readonly scope: FlowScope<'scene'>};

/** Above every per-flow safety timer (largest today: the deck-draw 30 s). */
export const DEFAULT_MAX_HOLD_MS = 35_000;

type SupplierEntry = {
  scope: AnimationHoldScope,
  waitsFor: 'player' | 'server' | undefined,
  maxHoldMs: number,
  /** The flow's predicate, DECLARED through the reactivity witness (see `registerAnimationHoldSupplier`). */
  supplier: ReactivePredicate<boolean>,
  diagnose: (() => unknown) | undefined,
  expire: (() => void) | undefined,
  stop: () => void,
  /** The hold's run while it stands and is bounded (the ceiling is a timer owned by it). `undefined` = not holding,
   *  or past its ceiling (masked until an honest false). */
  run: FlowScope<'scene'> | undefined,
  /** Epoch ms of the current rising edge (undefined = not holding). */
  heldSince: number | undefined,
};

/** A hold's run: a `scene` scope in the session that stands NOW (the game's; the lobby's when no game screen is up). */
function openHoldRun(label: string): FlowScope<'scene'> {
  return consoleSessionScope().open('scene', `hold:${label}`);
}

/** The ceiling's name in the wait table (`⟵ waits «the hold's ceiling» 1.2s/35s`). */
const CEILING = 'the hold\'s ceiling';

/** Run a hold's owner recovery safely — its failure is warned, never thrown
 *  into the ceiling timer / the watchdog. */
function safeExpireRecovery(label: string, expire: (() => void) | undefined): void {
  if (expire === undefined) {
    return;
  }
  try {
    expire();
  } catch (e) {
    console.warn(`[animation-hold] the "${label}" owner recovery threw`, e);
  }
}

/** Run a hold's diagnose hook safely — a throwing/absent hook degrades to ''. */
function safeDiagnose(diagnose: (() => unknown) | undefined): string {
  if (diagnose === undefined) {
    return '';
  }
  try {
    const info = diagnose();
    return info === undefined ? '' : ` — ${typeof info === 'string' ? info : JSON.stringify(info)}`;
  } catch (e) {
    return ` — (diagnose threw: ${String(e)})`;
  }
}

/** Registered flow predicates (functions — kept OUTSIDE the reactive store). */
const suppliers = new Map<string, SupplierEntry>();
/**
 * A MANUAL hold's diagnosis and owner recovery (kept off the reactive store — functions, not state). The options'
 * contract is the supplier's: «run when the ceiling fires (and when the foreground watchdog expires the hold)» — a
 * manual hold that dropped its handle at the ceiling while its owner stayed wedged was the sitting's freeze of
 * 2026-10-26 (the director's run kept waiting on a beat nobody would finish; only an unmount ended it).
 */
const manualRecovery = new Map<number, {diagnose: (() => unknown) | undefined, expire: (() => void) | undefined}>();
/** A manual hold's run in the flow tree (kept off the reactive store — a scope, not state). */
const manualRuns = new Map<number, FlowScope<'scene'>>();

const store = reactive({
  /** Bumped on (un)register so the counts computed re-scans the Map. */
  version: 0,
  /** Live imperative holds (beginAnimationHold). */
  manual: new Map<number, {label: string, scope: AnimationHoldScope, since: number, maxHoldMs: number, waitsFor?: 'player' | 'server'}>(),
  /** Supplier labels past the safety ceiling — excluded until they go false. */
  expired: new Set<string>(),
  /**
   * Labels excluded for the REST OF THE SESSION — a recurring leak the console
   * foreground watchdog gave up on. Unlike `expired` this is never lifted by a
   * falling edge, and it covers MANUAL holds by label too: a source that
   * re-creates `beginAnimationHold('x')` in a loop defeats any expiry that only
   * deletes the current handle. Quarantining costs that one animation its
   * serialization; leaving it costs the player a frozen event queue.
   */
  quarantined: new Set<string>(),
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

const counts = computed((prev: {all: number, blocking: number} | undefined) => {
  void store.version;
  let all = 0;
  let blocking = 0;
  for (const [label, entry] of suppliers) {
    if (store.expired.has(label) || store.quarantined.has(label) || !safeRead(label, entry.supplier)) {
      continue;
    }
    all++;
    if (entry.scope === 'blocking') {
      blocking++;
    }
  }
  for (const hold of store.manual.values()) {
    if (store.quarantined.has(hold.label)) {
      continue;
    }
    all++;
    if (hold.scope === 'blocking') {
      blocking++;
    }
  }
  // IDENTITY-STABLE when nothing changed. The console watchdog bumps
  // `store.version` every second (the phantom-hold net — see
  // refreshAnimationHolds), and a fresh {all, blocking} object every bump made
  // every dependent — the admission signals, the idle flags, presentationFlow —
  // re-derive once a second on a perfectly quiet board. Returning the previous
  // object keeps Vue's value-change check false, so the re-poll of the supplier
  // predicates (the net itself, cheap) is where the tick now ENDS.
  if (prev !== undefined && prev.all === all && prev.blocking === blocking) {
    return prev;
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
    waitsFor: options?.waitsFor,
    maxHoldMs: options?.maxHoldMs ?? DEFAULT_MAX_HOLD_MS,
    // EVERY SUPPLIER IS WITNESSED (`reactivityWitness.ts`): the counts and the ceiling's watch below are caches over
    // a predicate the registry does not own, so a non-reactive term in it is a latch — the witness names it and
    // heals both caches through the predicate's own epoch. The sweep (`refreshAnimationHolds`) stays the net.
    supplier: reactivePredicate(`hold:${label}`, supplier),
    diagnose: options?.diagnose,
    expire: options?.expire,
    stop: () => {},
    run: undefined,
    heldSince: undefined,
  };
  // The ceiling: a supplier stuck true past maxHoldMs is EXPIRED (excluded
  // from the counts, with a warn) until it honestly goes false again — and
  // its OWNER RECOVERY runs, so the wedge behind the hold ends too, not just
  // the hold's own count. The watch is the FAST PATH; the sweep in
  // `refreshAnimationHolds` is the truth (see armCeiling/disarmCeiling).
  entry.stop = watch(() => safeRead(label, supplier), (holding) => {
    if (holding) {
      armCeiling(label, entry);
    } else {
      disarmCeiling(label, entry);
    }
  }, {immediate: true});
  suppliers.set(label, entry);
  store.version++;
}

/** Take a supplier's run off the entry and end it (idempotent) — the registry's own endings all go through here, so
 *  the run's end listener can tell them from the one ending it does not make: its session going. */
function endSupplierRun(entry: SupplierEntry, end: ScopeEnd): void {
  const run = entry.run;
  entry.run = undefined;
  run?.end(end);
}

/** Arm the ceiling for a supplier's rising edge (idempotent): the hold's run opens, bounded. */
function armCeiling(label: string, entry: SupplierEntry): void {
  if (entry.run !== undefined || store.expired.has(label) || store.quarantined.has(label)) {
    return;
  }
  entry.heldSince = entry.heldSince ?? Date.now();
  const run = openHoldRun(label);
  entry.run = run;
  run.after(entry.maxHoldMs, CEILING, () => {
    if (entry.run !== run) {
      return;
    }
    entry.run = undefined;
    store.expired.add(label);
    console.warn(`[animation-hold] "${label}" held for over ${entry.maxHoldMs}ms — force-released by the safety ceiling (leaked hold?)${safeDiagnose(entry.diagnose)}`);
    safeExpireRecovery(label, entry.expire);
    run.end({how: 'expired', bound: `the ${entry.maxHoldMs} ms ceiling`});
  });
  run.onEnd(() => {
    if (entry.run !== run) {
      return; // ended by the registry — the falling edge, the ceiling, a net, an unregister
    }
    // ITS SESSION ENDED UNDER IT. The flow still says it owns the foreground of a game screen that is gone: that is the
    // ceiling's case, met NOW instead of 35 s into the next game — masked until an honest false, and the owner's
    // recovery ends the wedge behind it.
    entry.run = undefined;
    if (suppliers.get(label) === entry && !store.expired.has(label) && !store.quarantined.has(label) && safeRead(label, entry.supplier)) {
      store.expired.add(label);
      traceFlow(Date.now(), 'cancel', run.id, 'still held when its session ended — ended through its owner\'s recovery');
      safeExpireRecovery(label, entry.expire);
    }
  });
}

/** Disarm the ceiling on a supplier's falling edge (idempotent): the hold's run is done. */
function disarmCeiling(label: string, entry: SupplierEntry): void {
  endSupplierRun(entry, {how: 'done'});
  entry.heldSince = undefined;
  store.expired.delete(label);
}

/** Remove a registered supplier (per-instance flows / test cleanup). */
export function unregisterAnimationHoldSupplier(label: string): void {
  const entry = suppliers.get(label);
  if (entry === undefined) {
    return;
  }
  entry.stop();
  entry.supplier.dispose();
  endSupplierRun(entry, {how: 'cancelled', reason: 'its supplier was unregistered'});
  suppliers.delete(label);
  store.expired.delete(label);
  store.version++;
}

/**
 * Take a manual hold out of the registry and end its run (idempotent — `undefined` when it is already gone). Every
 * ending of a manual hold goes through here: the registry forgets it FIRST, so the run's own end listener — which
 * exists for the one ending the registry does not make, its session going — finds nothing left to do.
 */
function dropManualHold(id: number, end: ScopeEnd): {label: string, diagnose: (() => unknown) | undefined, expire: (() => void) | undefined} | undefined {
  const hold = store.manual.get(id);
  if (hold === undefined) {
    return undefined;
  }
  store.manual.delete(id);
  const recovery = manualRecovery.get(id);
  manualRecovery.delete(id);
  const run = manualRuns.get(id);
  manualRuns.delete(id);
  run?.end(end);
  return {label: hold.label, diagnose: recovery?.diagnose, expire: recovery?.expire};
}

/**
 * Begin an imperative hold (component beats / one-off animations). The
 * returned release is idempotent; the ceiling auto-releases a leaked handle.
 */
export function beginAnimationHold(label: string, options?: AnimationHoldOptions): AnimationHold {
  const id = nextHoldId++;
  const maxHoldMs = options?.maxHoldMs ?? DEFAULT_MAX_HOLD_MS;
  store.manual.set(id, {label, scope: options?.scope ?? 'blocking', since: Date.now(), maxHoldMs, waitsFor: options?.waitsFor});
  if (options?.diagnose !== undefined || options?.expire !== undefined) {
    manualRecovery.set(id, {diagnose: options.diagnose, expire: options.expire});
  }
  const run = openHoldRun(label);
  manualRuns.set(id, run);
  run.after(maxHoldMs, CEILING, () => {
    const dropped = dropManualHold(id, {how: 'expired', bound: `the ${maxHoldMs} ms ceiling`});
    if (dropped !== undefined) {
      console.warn(`[animation-hold] "${label}" held for over ${maxHoldMs}ms — force-released by the safety ceiling (leaked hold?)${safeDiagnose(dropped.diagnose)}`);
      // The ceiling ends the WEDGE, not just the count: the owner's recovery runs (the supplier's contract).
      safeExpireRecovery(label, dropped.expire);
    }
  });
  run.onEnd((end) => {
    // Still in the registry = nobody released it and no net ended it: ITS SESSION ENDED UNDER IT. A handle cannot stand
    // into the next game — it goes with the game screen that raised it, through its owner's recovery (the wedge behind
    // it — a director's run awaiting a beat nobody will finish — ends too).
    const dropped = dropManualHold(id, end);
    if (dropped !== undefined) {
      traceFlow(Date.now(), 'cancel', run.id, 'still held when its session ended — released with it');
      safeExpireRecovery(label, dropped.expire);
    }
  });
  return {
    scope: run,
    release: () => {
      dropManualHold(id, {how: 'done'});
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

/**
 * Force the counts to re-derive, whatever the suppliers read.
 *
 * THE HAZARD THIS CLOSES. `counts` is a Vue `computed` over predicates the
 * registry does not own, and the ceiling is a `watch` over the same predicates.
 * Both silently assume every supplier reads REACTIVE state — and a supplier
 * that reads a plain module `let` invalidates neither. The cached count then
 * sticks at whatever it last was: `foregroundBlockReason()` reports 'animation'
 * with nothing holding, the ceiling never arms, and an expiry finds nothing to
 * expire (reading the predicate directly correctly says false), so it can never
 * be cured. That shipped as a dead game — `hand-delivery`'s `activeRuns`.
 *
 * The predicate contract still stands and is still the fix at the source; this
 * is the net under it. The console's 1 s tick calls it, so the registry can
 * never be more than one second stale for ANY supplier, present or future.
 *
 * …AND THE CEILING GETS THE SAME NET (2026-09-12). The ceiling used to live
 * ONLY in the per-supplier `watch`, which fires on REACTIVE edges — and both
 * of its failure modes shipped in one field log:
 *  · a MISSED FALLING edge (the remote-placement queue drains through its
 *    degrade path, touching no reactive field) leaves a stale ceiling timer
 *    that fires at 35 s over an honestly idle module — a false
 *    «force-released» alarm, and `oldestAnimationHoldAgeMs` (the watchdog's
 *    leak-vs-slow discriminator) lies for the whole window;
 *  · a MISSED RISING edge is the dangerous direction — the counts (this
 *    sweep) DO see the hold, so it blocks notifications and mandatory
 *    surfaces, while the ceiling that would bound it NEVER ARMS: an
 *    unbounded freeze with no safety and no owner recovery.
 * So the same sweep that re-derives the counts now RECONCILES every
 * supplier's ceiling against a fresh predicate read: predicate true with no
 * timer → arm (the hold is bounded from at most one tick late); predicate
 * false with a timer → disarm quietly (the routine case for a non-reactive
 * term — never a warn). The watch stays as the zero-latency fast path.
 */
export function refreshAnimationHolds(): void {
  store.version++;
  for (const [label, entry] of suppliers) {
    if (store.quarantined.has(label)) {
      disarmCeiling(label, entry); // a quarantined label needs no ceiling
      continue;
    }
    if (safeRead(label, entry.supplier)) {
      armCeiling(label, entry); // no-op while expired — the mask holds until an honest false
    } else {
      disarmCeiling(label, entry);
    }
  }
}

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

/**
 * Force the CEILING right now, for every hold that is currently live — the
 * console foreground watchdog has PROVEN that nothing is rendered behind them.
 * Returns the labels expired, for the recovery warn.
 *
 * Same semantics as the timed ceiling: a supplier is EXPIRED (excluded from the
 * counts until it goes honestly false again), a manual handle is dropped (it has
 * no falling edge, exactly as the ceiling treats it). Without this the watchdog
 * could clear every lease and admission signal and STILL leave the notification
 * queue blocked — `foregroundBlockReason()` returns 'animation' first — for the
 * remainder of the 35 s ceiling, which is the freeze it exists to end.
 */
export function expireActiveAnimationHolds(permanent = false): ReadonlyArray<string> {
  const expired: Array<string> = [];
  for (const [label, entry] of suppliers) {
    if (!store.expired.has(label) && !store.quarantined.has(label) && safeRead(label, entry.supplier)) {
      store.expired.add(label);
      if (permanent) {
        store.quarantined.add(label);
      }
      // Its run ends HERE: the ceiling's timer goes with it, so the owner's recovery runs once — not again at 35 s.
      endSupplierRun(entry, {how: 'expired', bound: 'the foreground watchdog'});
      safeExpireRecovery(label, entry.expire);
      expired.push(`animation:${label}${permanent ? ' (quarantined)' : ''}`);
    }
  }
  for (const [id, hold] of [...store.manual]) {
    const dropped = dropManualHold(id, {how: 'expired', bound: 'the foreground watchdog'});
    safeExpireRecovery(hold.label, dropped?.expire);
    if (permanent) {
      store.quarantined.add(hold.label);
    }
    expired.push(`animation:${hold.label}${permanent ? ' (quarantined)' : ''}`);
  }
  return expired;
}

/**
 * How long the LONGEST-running live hold has been up (0 when nothing holds).
 *
 * WHY THE CONSUMER NEEDS THIS. An animation hold is self-bounded BY CONTRACT
 * (its flow's own completion or safety timer releases it), and some legitimately
 * run with NOTHING on screen — `planet-focus` deliberately keeps a blocking hold
 * through its owed scale beat, up to its own 15 s safety, while the board looks
 * perfectly idle. To a DOM-evidence stall check that is indistinguishable from a
 * leak, so the console watchdog cried "the screen was stuck" over a working
 * cinematic. Age is the discriminator: past every flow's own safety, a hold is
 * a leak; before it, it is just slow.
 */
export function oldestAnimationHoldAgeMs(): number {
  const now = Date.now();
  let oldest = 0;
  for (const [label, entry] of suppliers) {
    if (store.expired.has(label) || store.quarantined.has(label) || entry.heldSince === undefined) {
      continue;
    }
    if (safeRead(label, entry.supplier)) {
      oldest = Math.max(oldest, now - entry.heldSince);
    }
  }
  for (const hold of store.manual.values()) {
    if (!store.quarantined.has(hold.label)) {
      oldest = Math.max(oldest, now - hold.since);
    }
  }
  return oldest;
}

/** Diagnostics (?gpDebug / dev): what is holding right now. */
export function activeAnimationHoldLabels(): Array<string> {
  void store.version;
  const labels: Array<string> = [];
  for (const [label, entry] of suppliers) {
    if (!store.expired.has(label) && !store.quarantined.has(label) && safeRead(label, entry.supplier)) {
      labels.push(`${label}[${entry.scope}]`);
    }
  }
  for (const hold of store.manual.values()) {
    if (!store.quarantined.has(hold.label)) {
      labels.push(`${hold.label}[${hold.scope}]`);
    }
  }
  return labels;
}

/**
 * THE HOLDS AS WAITS (the wait graph, Э4 — a mechanism enters the graph BY CONSTRUCTION): every hold standing now, with
 * its scope, since when it holds and its ceiling. Read by the graph's hold source once a tick (never reactive).
 */
export function activeAnimationHoldWaits(): Array<{label: string, scope: AnimationHoldScope, since: number, maxHoldMs: number, waitsFor?: 'player' | 'server'}> {
  const out: Array<{label: string, scope: AnimationHoldScope, since: number, maxHoldMs: number, waitsFor?: 'player' | 'server'}> = [];
  for (const [label, entry] of suppliers) {
    if (entry.heldSince !== undefined && !store.expired.has(label) && !store.quarantined.has(label)) {
      out.push({label, scope: entry.scope, since: entry.heldSince, maxHoldMs: entry.maxHoldMs, waitsFor: entry.waitsFor});
    }
  }
  for (const hold of store.manual.values()) {
    if (!store.quarantined.has(hold.label)) {
      out.push({label: hold.label, scope: hold.scope, since: hold.since, maxHoldMs: hold.maxHoldMs, waitsFor: hold.waitsFor});
    }
  }
  return out;
}

/**
 * END ONE HOLD through its owner's recovery NOW (the wait graph's door for a hold that yields in a cycle, Э3): the same
 * path the ceiling runs — the supplier is excluded until it falls and its `expire` runs; a manual handle is dropped and
 * its `expire` runs. `false` when nothing of that label holds.
 */
export function expireAnimationHoldNow(label: string): boolean {
  let did = false;
  const entry = suppliers.get(label);
  if (entry !== undefined && entry.heldSince !== undefined && !store.expired.has(label)) {
    store.expired.add(label);
    store.version++;
    endSupplierRun(entry, {how: 'expired', bound: 'the wait graph'});
    safeExpireRecovery(label, entry.expire);
    did = true;
  }
  for (const [id, hold] of [...store.manual.entries()]) {
    if (hold.label === label) {
      const dropped = dropManualHold(id, {how: 'expired', bound: 'the wait graph'});
      safeExpireRecovery(label, dropped?.expire);
      did = true;
    }
  }
  return did;
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
  for (const id of [...store.manual.keys()]) {
    dropManualHold(id, {how: 'cancelled', reason: 'test reset'});
  }
  manualRecovery.clear();
  manualRuns.clear();
  store.expired.clear();
  store.quarantined.clear();
}
