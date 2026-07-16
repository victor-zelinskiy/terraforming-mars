/*
 * Presentation Flow — the PURE policy vocabulary (unit-tested, no Vue/DOM).
 *
 * The client has ONE presentation timeline: at most one BLOCKING foreground
 * item is presented at a time, everything else waits in a FIFO queue. The
 * server stays authoritative (it may already know the next prompts) — this
 * layer only sequences the CLIENT-SIDE delivery so the player is never
 * spammed with overlapping modals / theaters / notifications.
 *
 * Item kinds (the structural classification every foreground surface maps to):
 *  - 'mandatory-choice'          — a prompt the game cannot continue without
 *    (draft pick, payment, target pick, the mandatory input modal, console
 *    task host). Blocks notification delivery; itself WAITS behind an active
 *    flow-holding item (the AI-turn card / theater) — bounded, never forever.
 *  - 'result-modal'              — the outcome of the player's OWN action
 *    ("Получены карты", the reveal ✓/✗ overlay). Blocks theater auto-open and
 *    notification delivery until closed.
 *  - 'turn-theater'              — the expanded MarsBot turn replay. Explicitly
 *    user-opened (or auto-opened in 'theater' mode) — while open, mandatory
 *    surfaces and new notification delivery wait.
 *  - 'turn-event-notification'   — a compact event card (the AI-turn card,
 *    generation / pass / hostile-loss cards). Delivered ONE at a time, FIFO.
 *  - 'passive-toast'             — low-priority status; may be coalesced but
 *    is never silently dropped while queued.
 *  - journal entries are NOT foreground items — the journal is the persistent
 *    memory every foreground presentation links back to.
 */

/** The structural classification of a foreground presentation. */
export type PresentationItemKind =
  | 'mandatory-choice'
  | 'result-modal'
  | 'turn-theater'
  | 'turn-event-notification'
  | 'passive-toast';

/**
 * Lease kinds a mounted surface can hold. `mandatory-choice` is registered by
 * the mandatory input modal / draft overlay / start flow / console task host
 * while they are effectively visible (not minimized / suppressed / deferred).
 * `ceremony` is reserved for short celebratory beats that should delay toasts.
 */
export type ForegroundLeaseKind = 'mandatory-choice' | 'ceremony';

/** Why the presentation slot is currently occupied. */
export type PresentationBlockReason =
  | 'animation'
  | 'result-modal'
  | 'mandatory-choice'
  | 'turn-theater'
  | 'ceremony';

/** A snapshot of the occupancy signals (pure input for the policy functions). */
export type PresentationFlags = {
  /** A result modal ("Получены карты" / reveal result) is on screen. */
  resultModalOpen: boolean;
  /** ≥1 'mandatory-choice' lease is held by a visible mandatory surface. */
  mandatoryLeases: number;
  /** ≥1 'ceremony' lease is held. */
  ceremonyLeases: number;
  /** The MarsBot theater (replaying OR lingering un-dismissed) is on screen. */
  theaterOpen: boolean;
  /** A visible flow-holding notification (the compact AI-turn card). */
  flowHoldingNotificationVisible: boolean;
  /** Critical premium animations currently holding (ALL scopes) — the
   *  animation-hold registry (animationHold.ts). Blocks delivery. */
  animationHolds: number;
  /** The 'blocking'-scope subset — additionally holds MANDATORY surfaces
   *  (a 'notification-only' hold runs INSIDE a mandatory surface and must
   *  never unmount its own stage). */
  blockingAnimationHolds: number;
};

/**
 * The single blocking-foreground resolution — priority order mirrors how the
 * surfaces stack temporally: the motion that is LIVE on screen right now,
 * then the player's own result, then the theater they opened, then a
 * mandatory prompt, then ceremonies.
 */
export function foregroundBlockReason(flags: PresentationFlags): PresentationBlockReason | undefined {
  if (flags.animationHolds > 0) {
    return 'animation';
  }
  if (flags.resultModalOpen) {
    return 'result-modal';
  }
  if (flags.theaterOpen) {
    return 'turn-theater';
  }
  if (flags.mandatoryLeases > 0) {
    return 'mandatory-choice';
  }
  if (flags.ceremonyLeases > 0) {
    return 'ceremony';
  }
  return undefined;
}

/**
 * Is delivering a NEW transient notification allowed right now? Blocked while
 * any blocking foreground item is up (rule: notifications never spam over a
 * result modal / mandatory choice / theater). A visible flow-holding card does
 * NOT block delivery by itself — serialization of the visible slot handles it.
 */
export function notificationDeliveryBlocked(flags: PresentationFlags): boolean {
  return foregroundBlockReason(flags) !== undefined;
}

/**
 * Should MANDATORY surfaces (draft modal, mandatory input modal, console task
 * host) hold off mounting? True while the player is being shown what just
 * happened: the compact AI-turn card (bounded TTL) or the opened theater.
 * A result modal keeps them closed too — the commit that resolves it also
 * re-evaluates this predicate.
 *
 * Deliberately NOT true for ordinary corner toasts (a "colony traded" card
 * must never delay a draft) — only flow-holding items participate. A LIVE
 * critical animation of 'blocking' scope participates too: the next modal /
 * task host mounts only once the scene's real completion signal releases the
 * hold ('notification-only' holds — cinematics INSIDE a mandatory surface —
 * deliberately do not, else they would unmount their own stage).
 */
export function mandatoryPromptsHeld(flags: PresentationFlags): boolean {
  return flags.theaterOpen || flags.flowHoldingNotificationVisible || flags.blockingAnimationHolds > 0;
}

/** Summary of the waiting queue for the pending indicator. */
export type PendingQueueSummary = {
  count: number;
  /** True when the queue holds a gameplay-critical item (hostile loss /
   *  flow-holding AI turn) — the indicator gets the stronger accent. */
  critical: boolean;
};

/** Priorities at or below this value are "critical" for the indicator. */
export const CRITICAL_PRIORITY_THRESHOLD = 2;

export function pendingQueueSummary(
  queued: ReadonlyArray<{priority: number; holdsFlow?: boolean}>,
): PendingQueueSummary {
  return {
    count: queued.length,
    critical: queued.some((q) => q.priority <= CRITICAL_PRIORITY_THRESHOLD || q.holdsFlow === true),
  };
}
