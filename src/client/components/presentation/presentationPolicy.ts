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
 * Every reason currently RAISED, in priority order — the order mirrors how the
 * surfaces stack temporally: the motion that is LIVE on screen right now, then
 * the player's own result, then the theater they opened, then a mandatory
 * prompt, then ceremonies.
 *
 * A LIST, not a single winner: the two questions asked below want different
 * answers out of the same snapshot ("what is the foreground?" takes the top one,
 * "is the feed silenced?" looks for a silencing one ANYWHERE in it). Collapsing
 * to the winner first is how a ceremony hidden behind a mandatory lease would
 * have gone unnoticed by the feed.
 */
function raisedReasons(flags: PresentationFlags): ReadonlyArray<PresentationBlockReason> {
  const raised: Array<PresentationBlockReason> = [];
  if (flags.animationHolds > 0) {
    raised.push('animation');
  }
  if (flags.resultModalOpen) {
    raised.push('result-modal');
  }
  if (flags.theaterOpen) {
    raised.push('turn-theater');
  }
  if (flags.mandatoryLeases > 0) {
    raised.push('mandatory-choice');
  }
  if (flags.ceremonyLeases > 0) {
    raised.push('ceremony');
  }
  return raised;
}

/** The single blocking-foreground resolution — the highest-priority raised reason. */
export function foregroundBlockReason(flags: PresentationFlags): PresentationBlockReason | undefined {
  return raisedReasons(flags)[0];
}

/**
 * The block reasons that SILENCE the feed — the ones that own the SCREEN.
 *
 * A notification is a corner card in the journal's own zone; it never covers a
 * working surface, its command bar or the player rail. So "is the player busy?"
 * is the wrong question — the right one is "is the screen currently telling a
 * story of its own?": a live cinematic, a full-bleed reveal, the turn review,
 * a ceremony. Those are the four.
 *
 * `'mandatory-choice'` is deliberately NOT among them. That lease means the
 * player is WORKING — a decision surface / a workspace is up (the start flow,
 * the draft, a payment) — and silencing the feed for it meant the events of the
 * game piled up as «СОБЫТИЯ В ОЧЕРЕДИ +N» for the entire time a player spent in
 * a workspace, which is most of a turn. The bot's moves are exactly what the
 * player must keep hearing while they work; they cost nothing to read and
 * nothing to dismiss (a toast inside a workspace expires by its own TTL and
 * never steals that screen's B — see the shell's toast input branch).
 */
const SILENCING_REASONS: ReadonlySet<PresentationBlockReason> = new Set<PresentationBlockReason>([
  'animation', 'result-modal', 'turn-theater', 'ceremony',
]);

/**
 * WHY the feed is silenced right now, or undefined when it may flow. Checks
 * every raised reason, not just the winning one — a ceremony standing behind a
 * mandatory lease still owns the screen.
 */
export function notificationSilencingReason(flags: PresentationFlags): PresentationBlockReason | undefined {
  return raisedReasons(flags).find((reason) => SILENCING_REASONS.has(reason));
}

/**
 * Is delivering a NEW transient notification allowed right now? Blocked only
 * while something OWNS THE SCREEN (see {@link SILENCING_REASONS}) — never
 * merely because the player has a decision surface open. A visible flow-holding
 * card does NOT block delivery by itself either: serialization of the single
 * visible slot handles it.
 */
export function notificationDeliveryBlocked(flags: PresentationFlags): boolean {
  return notificationSilencingReason(flags) !== undefined;
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
  if (flags.theaterOpen || flags.blockingAnimationHolds > 0) {
    return true;
  }
  // A flow-holding card asks the NEXT prompt to WAIT; it may never RETRACT a
  // decision surface the player already has open. That distinction used to be
  // free: while a mandatory surface stood, its lease silenced the feed, so such
  // a card could not be delivered in the first place. Now that the feed keeps
  // flowing inside a workspace (a player must hear the bot's moves while they
  // work), the guard has to be stated: without it a bot-turn card arriving over
  // a live payment / composer would unmount it for the card's whole TTL.
  //
  // No feedback loop: with a surface up the hold is off and the surface stays
  // (a fixed point), with none up the hold is on and none mounts (also a fixed
  // point) — neither state can flip itself.
  return flags.flowHoldingNotificationVisible && flags.mandatoryLeases === 0;
}

/**
 * The observations behind "the foreground is LYING" (the stall rule below).
 * Deliberately three plain booleans: the DOM evidence is gathered by the console
 * leak detector, which already does exactly one querySelector pass per tick.
 */
export type PresentationStallInput = {
  /**
   * The orchestrator reports the foreground occupied — a block reason is up
   * and/or mandatory prompts are held.
   */
  claimed: boolean;
  /**
   * ≥1 surface that could justify the claim is actually RENDERED (has client
   * rects). This is the only honest discriminator between "a modal the player
   * is reading" and "a claim whose surface never mounted": a claim can be
   * legitimately held for minutes, so a pure time ceiling would be wrong here.
   */
  surfaceRendered: boolean;
  /**
   * Something is genuinely waiting on the claim: a queued event that cannot be
   * delivered, and/or a live server prompt. Without this a claim held over an
   * idle board is nobody's problem and must not be disturbed.
   */
  waiting: boolean;
};

/**
 * IS THE PRESENTATION STALLED? The invariant: a hold on the player's progress
 * must be backed by something actually on screen. When the foreground claims to
 * be occupied, nothing is rendered to justify it, and the player has events
 * queued / a prompt pending, the claim is stale — the queue can never drain and
 * no mandatory surface can mount, which is a frozen game, not a busy one.
 *
 * PURE. The caller debounces it over consecutive passes (a working hand-off can
 * momentarily satisfy all three) before acting on it.
 */
export function presentationStalled(input: PresentationStallInput): boolean {
  return input.claimed && !input.surfaceRendered && input.waiting;
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
