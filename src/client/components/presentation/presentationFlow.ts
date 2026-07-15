/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in DESKTOP_DEPRECATION_AUDIT.md.
 */
/*
 * Presentation Flow — the reactive ORCHESTRATOR singleton (module state, like
 * `journalState` / `notificationState`, so it survives the playerkey remount).
 *
 * It does NOT own the surfaces — every existing modal/overlay keeps its own
 * state machine. The orchestrator only answers three questions, from ONE set
 * of occupancy signals:
 *
 *   1. `currentBlockReason()`  — is a blocking foreground item up, and which?
 *   2. `isNotificationDeliveryBlocked()` — may a new transient notification
 *      be DELIVERED right now (else it waits in the FIFO queue)?
 *   3. `isMandatoryPromptsHeld()` — must mandatory surfaces (draft modal,
 *      mandatory input modal, console task host) hold off mounting while the
 *      player reads what just happened (AI-turn card / opened theater)?
 *
 * Occupancy sources:
 *   - DERIVED module states (imported): the drawn-cards result modal, the
 *     reveal-result overlay, the MarsBot theater. These are leaf modules that
 *     never import this one.
 *   - LEASES registered by mounted surfaces (`acquireForegroundLease`):
 *     MandatoryInputModal / DraftFlowOverlay / StartGameFlowOverlay /
 *     ConsoleShell's task surfaces. A lease is held only while the surface is
 *     EFFECTIVELY visible (not minimized / suppressed / deferred).
 *   - An injected flow-hold supplier (`registerFlowHoldSupplier`) — the
 *     notification store reports whether a flow-holding card (the compact
 *     AI-turn notification) is currently visible. Injection keeps the import
 *     graph acyclic (notificationState imports THIS module, not vice versa).
 *
 * Transitions are broadcast to subscribers (`onForegroundFreed` /
 * `onForegroundBlocked`) via a module-level watcher, so the notification
 * queue drains the moment the blocker clears and re-queues visible cards the
 * moment one opens. No component needs to know who else exists.
 */
import {computed, reactive, watch} from 'vue';
import {hasVisibleReveal} from '@/client/components/drawnCards/drawnCardsState';
import {revealResultState} from '@/client/components/actions/revealResultState';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {
  ForegroundLeaseKind,
  PresentationBlockReason,
  PresentationFlags,
  foregroundBlockReason,
  mandatoryPromptsHeld,
  notificationDeliveryBlocked,
} from './presentationPolicy';

const leaseCounts = reactive<Record<ForegroundLeaseKind, number>>({
  'mandatory-choice': 0,
  'ceremony': 0,
});

/** The injected "a flow-holding notification is visible" supplier. Reads
 *  reactive state (notificationState.transient), so computeds re-track it. */
let flowHoldSupplier: () => boolean = () => false;

export function registerFlowHoldSupplier(fn: () => boolean): void {
  flowHoldSupplier = fn;
}

/** The current occupancy snapshot (reads only reactive sources). */
function flags(): PresentationFlags {
  return {
    resultModalOpen: hasVisibleReveal() || revealResultState.active,
    mandatoryLeases: leaseCounts['mandatory-choice'],
    ceremonyLeases: leaseCounts['ceremony'],
    theaterOpen: botTurnReviewState.open,
    flowHoldingNotificationVisible: flowHoldSupplier(),
  };
}

/**
 * Register a visible blocking surface. Returns the release function —
 * idempotent, so calling it twice (watcher + beforeUnmount) is safe.
 */
export function acquireForegroundLease(kind: ForegroundLeaseKind): () => void {
  leaseCounts[kind]++;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      leaseCounts[kind] = Math.max(0, leaseCounts[kind] - 1);
    }
  };
}

/** The active blocking foreground item, if any. Reactive-safe (usable in computeds). */
export function currentBlockReason(): PresentationBlockReason | undefined {
  return foregroundBlockReason(flags());
}

/** May a NEW transient notification be delivered right now? */
export function isNotificationDeliveryBlocked(): boolean {
  return notificationDeliveryBlocked(flags());
}

/**
 * Must mandatory surfaces hold off mounting? True while the compact AI-turn
 * card is visible (bounded TTL) or the theater is open. Reactive-safe.
 */
export function isMandatoryPromptsHeld(): boolean {
  return mandatoryPromptsHeld(flags());
}

// ── transition broadcast ─────────────────────────────────────────────────────

type Subscriber = () => void;
const freedSubscribers: Array<Subscriber> = [];
const blockedSubscribers: Array<Subscriber> = [];

/** Subscribe to "the blocking foreground cleared" (drain the queue). */
export function onForegroundFreed(cb: Subscriber): void {
  freedSubscribers.push(cb);
}

/** Subscribe to "a blocking foreground opened" (re-queue visible cards). */
export function onForegroundBlocked(cb: Subscriber): void {
  blockedSubscribers.push(cb);
}

const blockReasonRef = computed(() => currentBlockReason());

watch(blockReasonRef, (now, prev) => {
  if (now === undefined && prev !== undefined) {
    for (const cb of freedSubscribers) {
      cb();
    }
  } else if (now !== undefined && prev === undefined) {
    for (const cb of blockedSubscribers) {
      cb();
    }
  }
});

/** Test-only reset (leases + suppliers; subscribers are module-permanent). */
export function resetPresentationLeases(): void {
  leaseCounts['mandatory-choice'] = 0;
  leaseCounts['ceremony'] = 0;
}
