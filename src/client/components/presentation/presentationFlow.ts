/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
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
 *   - The ANIMATION-HOLD registry (`animationHold.ts`, a leaf like the module
 *     states) — every critical premium animation (hero scenes, deal/reveal
 *     cinematics, marker glides, ceremonies) holds the foreground for exactly
 *     its real lifetime; the release is the flow's own completion signal
 *     (GSAP onComplete → the flow's reactive flag drops), never a timer.
 *
 * Transitions are broadcast to subscribers (`onForegroundFreed` /
 * `onForegroundBlocked`) via a module-level watcher, so the notification
 * queue drains the moment the blocker clears and re-queues visible cards the
 * moment one opens. No component needs to know who else exists.
 */
import {computed, reactive, watch} from 'vue';
import {hasVisibleReveal} from '@/client/components/drawnCards/drawnCardsState';
import {revealResultState} from '@/client/components/actions/revealResultState';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {animationHoldCount, blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
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

/*
 * ── THE STALENESS NET ────────────────────────────────────────────────────────
 *
 * `animationHold` has a safety ceiling; NOTHING else here did. A lease is a
 * CLAIM that a surface is visible, and a derived signal is a claim that a modal
 * is on screen — but neither is ever checked against what is actually RENDERED.
 * Every desync between a claim's predicate and its surface's real `v-if` (the
 * console shell's lease is a strict superset of the task host's mount gate, and
 * two <Teleport>s silently drop their content on a stale selector) therefore
 * froze the player forever: the notification queue could not drain, mandatory
 * prompts could not mount, and the leak detector's own guard was disarmed.
 *
 * So claims become EXPIRABLE, with exactly `animationHold`'s semantics: the
 * console watchdog (which owns the DOM evidence) marks the current claims stale
 * when it proves nothing is rendered, and a claim un-stales the moment it goes
 * honestly false and is raised again. Expiring never touches the holder's own
 * bookkeeping — its release token stays valid and idempotent — so a recovered
 * surface that later closes normally still balances out.
 */

/** Per-kind count of leases EXCLUDED from the flags (expired by the watchdog). */
const staleLeaseCounts = reactive<Record<ForegroundLeaseKind, number>>({
  'mandatory-choice': 0,
  'ceremony': 0,
});

/** The derived (non-lease) signals the watchdog can expire, by flag name. */
export type StaleForegroundSignal = 'result-modal' | 'turn-theater' | 'flow-hold';

const staleSignals = reactive(new Set<StaleForegroundSignal>());

/** Live count of a lease kind, minus whatever the watchdog expired. */
function liveLeases(kind: ForegroundLeaseKind): number {
  return Math.max(0, leaseCounts[kind] - staleLeaseCounts[kind]);
}

/** A derived signal, masked while expired. */
function liveSignal(signal: StaleForegroundSignal, raw: boolean): boolean {
  return raw && !staleSignals.has(signal);
}

/** The injected "a flow-holding notification is visible" supplier. Reads
 *  reactive state (notificationState.transient), so computeds re-track it. */
let flowHoldSupplier: () => boolean = () => false;

export function registerFlowHoldSupplier(fn: () => boolean): void {
  flowHoldSupplier = fn;
}

/** The RAW occupancy of the derived signals, before the staleness mask. */
function rawSignal(signal: StaleForegroundSignal): boolean {
  switch (signal) {
  // Every FULL-BLEED reveal shape, so this signal alone can silence the feed:
  // the drawn-cards batch, the ✓/✗ result, and the read-only revealed-cards
  // viewer. The viewer used to be carried by the console's `mandatory-choice`
  // lease alone — which no longer silences anything, so a toast would have
  // floated over a fullscreen surface the moment the lease stopped speaking
  // for it. A derived signal is also strictly better here: it is true for
  // desktop and console alike, and the watchdog can expire it.
  case 'result-modal': return hasVisibleReveal() || revealResultState.active || revealViewerState.open;
  case 'turn-theater': return botTurnReviewState.open;
  case 'flow-hold': return flowHoldSupplier();
  }
}

/** The current occupancy snapshot (reads only reactive sources). */
function flags(): PresentationFlags {
  return {
    resultModalOpen: liveSignal('result-modal', rawSignal('result-modal')),
    mandatoryLeases: liveLeases('mandatory-choice'),
    ceremonyLeases: liveLeases('ceremony'),
    theaterOpen: liveSignal('turn-theater', rawSignal('turn-theater')),
    flowHoldingNotificationVisible: liveSignal('flow-hold', rawSignal('flow-hold')),
    animationHolds: animationHoldCount(),
    blockingAnimationHolds: blockingAnimationHoldCount(),
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
      // A release can only ever retire a lease that is still counted, so the
      // expired tally follows the total down — otherwise the LAST honest lease
      // of a kind would stay masked after the stale one it replaced went away.
      staleLeaseCounts[kind] = Math.min(staleLeaseCounts[kind], leaseCounts[kind]);
    }
  };
}

/**
 * The watchdog PROVED that nothing backing the current foreground is rendered:
 * expire every claim that is up right now. Returns the labels expired, for the
 * recovery warn (never a bare "something was stuck").
 *
 * Leases are expired by COUNT, not by token: the holder keeps its own release
 * function (still idempotent, still balanced), so a surface that recovers and
 * later closes normally cannot double-decrement. A claim raised AFTER this call
 * is honest by construction and counts again immediately.
 */
export function expireForegroundHolds(): ReadonlyArray<string> {
  const expired: Array<string> = [];
  for (const kind of ['mandatory-choice', 'ceremony'] as ReadonlyArray<ForegroundLeaseKind>) {
    if (liveLeases(kind) > 0) {
      expired.push(`lease:${kind}×${liveLeases(kind)}`);
      staleLeaseCounts[kind] = leaseCounts[kind];
    }
  }
  for (const signal of ['result-modal', 'turn-theater', 'flow-hold'] as ReadonlyArray<StaleForegroundSignal>) {
    if (liveSignal(signal, rawSignal(signal))) {
      expired.push(signal);
      staleSignals.add(signal);
    }
  }
  return expired;
}

/** What is claiming the foreground right now — for the recovery diagnostics. */
export function foregroundHoldLabels(): ReadonlyArray<string> {
  const labels: Array<string> = [];
  for (const kind of ['mandatory-choice', 'ceremony'] as ReadonlyArray<ForegroundLeaseKind>) {
    if (liveLeases(kind) > 0) {
      labels.push(`lease:${kind}×${liveLeases(kind)}`);
    }
  }
  for (const signal of ['result-modal', 'turn-theater', 'flow-hold'] as ReadonlyArray<StaleForegroundSignal>) {
    if (liveSignal(signal, rawSignal(signal))) {
      labels.push(signal);
    }
  }
  return labels;
}

// An expired signal un-stales the moment it goes honestly false, so the very
// next legitimate reveal / theater / holding card blocks normally again. Mirrors
// `animationHold`'s `store.expired.delete(label)` on the falling edge.
watch(() => ({
  'result-modal': rawSignal('result-modal'),
  'turn-theater': rawSignal('turn-theater'),
  'flow-hold': rawSignal('flow-hold'),
}), (raw) => {
  for (const signal of [...staleSignals]) {
    if (!raw[signal]) {
      staleSignals.delete(signal);
    }
  }
}, {deep: true});

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

/** Subscribe to "the feed is no longer silenced" (drain the queue). */
export function onForegroundFreed(cb: Subscriber): void {
  freedSubscribers.push(cb);
}

/** Subscribe to "something that silences the feed opened" (re-queue visible cards). */
export function onForegroundBlocked(cb: Subscriber): void {
  blockedSubscribers.push(cb);
}

/**
 * The broadcast rides the SILENCING predicate, not the raw block reason. Both
 * subscribers are the notification feed's own bookkeeping (drain / re-queue),
 * so they must fire on exactly the transitions that silence and un-silence it.
 * Keyed off `currentBlockReason()` instead, a mandatory lease — a workspace the
 * player merely opened — would pull the visible card back into the queue and
 * only release it on leaving, which is the pile-up this split removes.
 */
const silencedRef = computed(() => isNotificationDeliveryBlocked());

watch(silencedRef, (now, prev) => {
  if (!now && prev) {
    for (const cb of freedSubscribers) {
      cb();
    }
  } else if (now && !prev) {
    for (const cb of blockedSubscribers) {
      cb();
    }
  }
});

/** Test-only reset (leases + suppliers; subscribers are module-permanent). */
export function resetPresentationLeases(): void {
  leaseCounts['mandatory-choice'] = 0;
  leaseCounts['ceremony'] = 0;
  staleLeaseCounts['mandatory-choice'] = 0;
  staleLeaseCounts['ceremony'] = 0;
  staleSignals.clear();
}
