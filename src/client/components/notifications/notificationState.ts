/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
import {reactive, watch} from 'vue';
import {Color} from '@/common/Color';
import {NotificationModel, LiveNotification, NotificationKind, MAX_VISIBLE_TRANSIENT, NOTIFICATION_PRIORITY, NOTIFICATION_TTL} from './notificationTypes';
import {notificationFeedModeState} from './notificationFeedMode';
import {quickToastAllowed} from './notificationFeedPolicy';
import {
  currentBlockReason,
  isNotificationDeliveryBlocked,
  onForegroundBlocked,
  onForegroundFreed,
  registerFlowHoldSupplier,
} from '@/client/components/presentation/presentationFlow';
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';
import {PendingQueueSummary, pendingQueueSummary} from '@/client/components/presentation/presentationPolicy';
import {ackBotTurn} from '@/client/components/marsbot/botTurnAck';

/**
 * notificationState — the module-level reactive NotificationCenter store.
 *
 * WHY module scope (mirrors `journalState` / `playedCardsViewState`): the layer
 * is mounted at App level so the `:key="playerkey"` remount on every server
 * response can't tear it down, and the seen-set / queue / live cards must
 * survive that remount too. The Vue surface (`NotificationLayer.vue`) only
 * READS this store + drives the lifecycle through these functions; the pure
 * mappers (`notificationModel.ts`) produce the models.
 *
 * Two channels:
 *  - `turn` — the SINGLETON your-turn / action-required card (persistent until
 *    the prompt resolves). `waitingFor` is one thing, so only one is live.
 *  - `transient` — the feed of normal / important / warning cards (capped at
 *    {@link MAX_VISIBLE_TRANSIENT}; the overflow waits in `queue`).
 */

export type NotificationSettings = {
  /** Master switch. */
  enabled: boolean;
  /** Show ordinary root-event feed cards. */
  showNormal: boolean;
  /** Show important highlights (generation / pass / milestone / award). */
  showImportant: boolean;
  /** Show the your-turn / action-required card. */
  showTurn: boolean;
  /** Show hostile cards (the viewer lost something to another player). */
  showNegative: boolean;
};

type NotificationStore = {
  turn: LiveNotification | undefined;
  transient: Array<LiveNotification>;
  queue: Array<NotificationModel>;
  /**
   * A turn-card id the player explicitly acknowledged — kept hidden until the
   * prompt CHANGES (a new id), so a re-asserted same-turn card doesn't reappear.
   */
  dismissedTurnId: string | undefined;
  /** Root `correlationId`s already processed (so they never re-pop). */
  seenRootIds: Set<number>;
  /** Correlation ids whose VIEWER-LOSS was already surfaced (separate id space). */
  seenNegativeIds: Set<number>;
  /** String keys of public card reveals already surfaced (separate id space). */
  seenRevealIds: Set<string>;
  /** `<scale>-<step>` keys of scale-bonus claims already surfaced. */
  seenScaleClaims: Set<string>;
  /** Whether the initial seed (no-spam-on-load) has run. */
  seeded: boolean;
  /** Last generation observed — drives the "new generation" highlight. */
  lastGeneration: number | undefined;
  /** Colours already announced as passed this generation. */
  passedSeen: Set<string>;
  /**
   * Transient cards whose LEAVE animation is still playing. The card leaves
   * `transient` at dismiss time but its DOM exits over the next few hundred
   * ms — a consumer that must wait for the feed to FINISH (the mandatory-
   * action first presentation) waits on this too, so a plate can never rise
   * over a card that is still animating out. Maintained by the layer's
   * transition hooks (event-driven, never a timer).
   */
  leaving: number;
  settings: NotificationSettings;
  /**
   * The LOCAL (viewing) player's colour — what the feed-mode policy compares
   * `affects` against. Set by the layer from `playerView.thisPlayer` on every
   * update; NEVER the active player (during a bot's or an opponent's turn the
   * two differ, and filtering by the active player is exactly the bug the
   * policy forbids). `undefined` (pre-first-update) fails open.
   */
  viewerColor: Color | undefined;
};

export const notificationState = reactive<NotificationStore>({
  turn: undefined,
  transient: [],
  queue: [],
  dismissedTurnId: undefined,
  seenRootIds: new Set<number>(),
  seenNegativeIds: new Set<number>(),
  seenRevealIds: new Set<string>(),
  seenScaleClaims: new Set<string>(),
  seeded: false,
  lastGeneration: undefined,
  passedSeen: new Set<string>(),
  leaving: 0,
  settings: {
    enabled: true,
    showNormal: true,
    showImportant: true,
    showTurn: true,
    showNegative: true,
  },
  viewerColor: undefined,
});

/** Keep the feed-mode policy pointed at the LOCAL viewer (layer update path). */
export function setNotificationViewer(color: Color | undefined): void {
  notificationState.viewerColor = color;
}

let warningSeq = 0;

function settingAllows(kind: NotificationKind): boolean {
  const s = notificationState.settings;
  if (!s.enabled) {
    return false;
  }
  switch (kind) {
  case 'your-turn':
  case 'action-required':
    return s.showTurn;
  case 'negative':
    return s.showNegative;
  case 'important':
    return s.showImportant;
  case 'warning':
    return true; // warnings are always allowed when enabled
  case 'normal':
  default:
    return s.showNormal;
  }
}

/**
 * The feed-MODE gate — the ONE call site of the central filter policy
 * (`notificationFeedPolicy.quickToastAllowed`). Only the transient toast feed
 * asks it; the singleton turn card (`setTurn`) deliberately never does — a
 * mandatory prompt is not noise, whatever the mode.
 */
function feedModeAllows(model: NotificationModel): boolean {
  return quickToastAllowed(model, notificationFeedModeState.mode, notificationState.viewerColor);
}

function knownId(id: string): boolean {
  return notificationState.turn?.id === id ||
    notificationState.transient.some((n) => n.id === id) ||
    notificationState.queue.some((n) => n.id === id);
}

/** Is a notification with this id anywhere in the presentation (visible or
 *  queued)? Public for liveness checks (staged bot commits). */
export function notificationKnownId(id: string): boolean {
  return knownId(id);
}

/**
 * How long a NON-EMPTY queue may stay undelivered behind an ANIMATION block
 * before it is delivered anyway. Every real cinematic is a few seconds; twelve
 * is far past any of them and far short of the 35 s hold ceiling — which, as
 * production proved, does not help at all when the leaking flag is re-raised
 * faster than it expires.
 */
export const QUEUE_STARVATION_MS = 12_000;

/** When the current undelivered backlog started waiting (undefined = flowing). */
let queueBlockedSince: number | undefined;

let starvationWarned = false;

/**
 * Promote queued models into freed transient slots — HIGHEST priority first,
 * FIFO within a priority (`findIndex`-style stable pick). A no-op while the
 * presentation flow reports a blocking foreground (result modal / mandatory
 * choice / theater) — the queue drains the moment it clears.
 *
 * STARVATION ESCAPE. "The queue drains the moment it clears" is only true if
 * the blocker ever clears. A leaked animation hold froze it indefinitely — the
 * player watched «СОБЫТИЯ В ОЧЕРЕДИ» climb past +17 with nothing on screen — so
 * a backlog blocked by an `'animation'` reason for {@link QUEUE_STARVATION_MS}
 * is delivered ANYWAY, with a warn.
 *
 * Deliberately ONLY the animation reason: a result modal, a mandatory choice
 * and the theater all mean a PLAYER is looking at something and may legitimately
 * take minutes, and floating toasts over them would break the very serialization
 * this queue exists for. An animation has no player in the loop, so past a
 * bounded lifetime it is always a leak. A toast over a stuck scene is the honest
 * degraded mode; a permanently frozen queue is not.
 */
export function promoteFromQueue(): void {
  if (isNotificationDeliveryBlocked()) {
    if (notificationState.queue.length === 0) {
      queueBlockedSince = undefined;
      return;
    }
    const now = Date.now();
    if (queueBlockedSince === undefined) {
      queueBlockedSince = now;
      return;
    }
    if (now - queueBlockedSince < QUEUE_STARVATION_MS || currentBlockReason() !== 'animation') {
      return;
    }
    if (!starvationWarned) {
      starvationWarned = true;
      console.warn(
        `[notifications] ${notificationState.queue.length} queued event(s) held behind an ANIMATION ` +
        `hold for over ${QUEUE_STARVATION_MS}ms — delivering anyway (leaked hold: ` +
        `${activeAnimationHoldLabels().join(', ') || 'none named'})`);
    }
  }
  queueBlockedSince = undefined;
  while (notificationState.transient.length < MAX_VISIBLE_TRANSIENT && notificationState.queue.length > 0) {
    let bestIdx = 0;
    notificationState.queue.forEach((n, i) => {
      if (n.priority < notificationState.queue[bestIdx].priority) {
        bestIdx = i;
      }
    });
    const next = notificationState.queue.splice(bestIdx, 1)[0];
    notificationState.transient.push({...next, expanded: false});
  }
}

/**
 * Move every VISIBLE transient card back to the FRONT of the queue (order
 * preserved) — called when a blocking foreground item (result modal /
 * mandatory modal / theater) OPENS, so nothing floats over it and nothing is
 * lost: the cards re-present with a fresh lifetime once the blocker clears.
 */
export function holdVisibleTransient(): void {
  if (notificationState.transient.length === 0) {
    return;
  }
  const held: Array<NotificationModel> = notificationState.transient.map((n) => {
    const {expanded: _expanded, ...model} = n;
    return model;
  });
  notificationState.transient = [];
  notificationState.queue.unshift(...held);
}

/** The queue backlog, for the pending indicator (count + critical accent). */
export function pendingSummary(): PendingQueueSummary {
  return pendingQueueSummary(notificationState.queue);
}

/**
 * The player ACTED (submitted an input) — playing on implicitly acknowledges
 * any visible flow-holding card (the compact AI-turn notification): it is
 * dismissed so the follow-up prompt of the submit is never held behind it.
 * The journal keeps the turn replayable; queued (not yet shown) cards stay.
 */
export function acknowledgeFlowHoldingCards(): void {
  const holding = notificationState.transient.filter((n) => n.holdsFlow === true);
  for (const n of holding) {
    // Playing on IS one of the "notification finished" signals — soft-ack the
    // bot turn (mirrors NotificationLayer.onDismiss) BEFORE removing the card,
    // so the server doesn't keep extending the NEXT paced bot turn waiting on an
    // ack that would otherwise never arrive (the card is gone from the UI, but a
    // raw `dismiss` never told the server). `ackBotTurn` no-ops on a missing key.
    ackBotTurn(n.botTurnKey);
    dismiss(n.id);
  }
}

/**
 * The player opened the journal (the canonical event center) — the queued
 * ordinary cards are already fully visible there, so drop them instead of
 * replaying stale toasts afterwards. Gameplay-critical items are KEPT: hostile
 * losses and flow-holding AI-turn cards still present after the journal closes.
 */
export function drainQueueToJournal(): void {
  notificationState.queue = notificationState.queue.filter(
    (n) => n.kind === 'negative' || n.holdsFlow === true);
}

/**
 * Push one transient (negative/normal/important/warning) card. De-duped by id.
 * Delivery is GATED by the presentation flow: while a blocking foreground item
 * is up, the card waits in the FIFO queue (never dropped). When the visible
 * slot is taken, a higher-priority card (e.g. a hostile loss the viewer
 * suffered) EVICTS the lowest-priority visible card to the front of the queue
 * rather than waiting behind it.
 */
export function pushTransient(model: NotificationModel): void {
  if (!settingAllows(model.kind) || !feedModeAllows(model) || knownId(model.id)) {
    return;
  }
  if (isNotificationDeliveryBlocked()) {
    notificationState.queue.push(model);
    return;
  }
  if (notificationState.transient.length < MAX_VISIBLE_TRANSIENT) {
    notificationState.transient.push({...model, expanded: false});
    return;
  }
  let worstIdx = -1;
  let worstPriority = -Infinity;
  notificationState.transient.forEach((n, i) => {
    if (n.priority > worstPriority) {
      worstPriority = n.priority;
      worstIdx = i;
    }
  });
  if (worstIdx !== -1 && model.priority < worstPriority) {
    const evicted = notificationState.transient.splice(worstIdx, 1)[0];
    notificationState.queue.unshift({...evicted});
    notificationState.transient.push({...model, expanded: false});
  } else {
    notificationState.queue.push(model);
  }
}

export function pushMany(models: ReadonlyArray<NotificationModel>): void {
  for (const m of models) {
    pushTransient(m);
  }
}

/** Set / replace / clear the singleton turn card. */
export function setTurn(model: NotificationModel | undefined): void {
  if (model === undefined) {
    notificationState.turn = undefined;
    notificationState.dismissedTurnId = undefined; // no prompt → forget any ack
    return;
  }
  if (!settingAllows(model.kind)) {
    notificationState.turn = undefined;
    return;
  }
  // A DIFFERENT prompt than the one acknowledged → the ack no longer applies.
  if (notificationState.dismissedTurnId !== undefined && notificationState.dismissedTurnId !== model.id) {
    notificationState.dismissedTurnId = undefined;
  }
  if (notificationState.dismissedTurnId === model.id) {
    notificationState.turn = undefined; // acknowledged this turn — stay hidden
    return;
  }
  const current = notificationState.turn;
  if (current !== undefined && current.id === model.id) {
    // Same kind of prompt — update content in place WITHOUT re-triggering the
    // entrance animation (the keyed <Transition> only animates on id change).
    notificationState.turn = {...model, expanded: current.expanded};
  } else {
    notificationState.turn = {...model, expanded: false};
  }
}

/** Raise a transient warning card. */
export function pushWarning(text: string): void {
  warningSeq++;
  pushTransient({
    id: `warn:${warningSeq}`,
    kind: 'warning',
    variant: 'warning',
    priority: NOTIFICATION_PRIORITY['warning'],
    sign: 'neutral',
    importance: 'attention',
    typeLabelKey: 'Problem',
    prompt: text,
    pills: [],
    detailCount: 0,
    generation: notificationState.lastGeneration ?? 0,
    ttl: NOTIFICATION_TTL['warning'],
    persistent: false,
    createdAt: Date.now(),
  });
}

export function dismiss(id: string): void {
  if (notificationState.turn?.id === id) {
    // Acknowledge this turn card — hide it AND remember the id so the next
    // update's setTurn doesn't re-assert the same prompt. It returns naturally
    // when the prompt changes to a different id.
    notificationState.turn = undefined;
    notificationState.dismissedTurnId = id;
    return;
  }
  const idx = notificationState.transient.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notificationState.transient.splice(idx, 1);
    promoteFromQueue();
    return;
  }
  const qIdx = notificationState.queue.findIndex((n) => n.id === id);
  if (qIdx !== -1) {
    notificationState.queue.splice(qIdx, 1);
  }
}

export function toggleExpanded(id: string): void {
  if (notificationState.turn?.id === id) {
    notificationState.turn.expanded = !notificationState.turn.expanded;
    return;
  }
  const n = notificationState.transient.find((x) => x.id === id);
  if (n !== undefined) {
    n.expanded = !n.expanded;
  }
}

export function setExpanded(id: string, expanded: boolean): void {
  if (notificationState.turn?.id === id) {
    notificationState.turn.expanded = expanded;
    return;
  }
  const n = notificationState.transient.find((x) => x.id === id);
  if (n !== undefined) {
    n.expanded = expanded;
  }
}

/** Clear all transient + queued cards (keeps the turn card + seen-set). */
export function clearTransient(): void {
  notificationState.transient = [];
  notificationState.queue = [];
  notificationState.leaving = 0;
  queueBlockedSince = undefined;
  starvationWarned = false;
}

// ── The feed's SETTLED signal (the ordinary-notification boundary) ──────────

/**
 * Elements whose leave START was counted — the end hook decrements only a
 * counted element, so an unbalanced hook pair (or a reset racing a live leave)
 * can never drive `leaving` negative or double-count one card.
 */
const leaveTracked = new WeakSet<Element>();

/** A transient card's DOM exit began (the layer's @before-leave). */
export function noteNotificationLeaveStart(el: Element): void {
  if (!leaveTracked.has(el)) {
    leaveTracked.add(el);
    notificationState.leaving++;
  }
}

/** …and finished or was cancelled (@after-leave / @leave-cancelled). */
export function noteNotificationLeaveEnd(el: Element): void {
  if (leaveTracked.has(el)) {
    leaveTracked.delete(el);
    notificationState.leaving = Math.max(0, notificationState.leaving - 1);
  }
}

/**
 * THE ORDINARY-NOTIFICATION FEED IS COMPLETELY FINISHED: nothing on screen,
 * nothing queued behind a blocker, and no card still animating out. This is
 * the boundary a pending MANDATORY action's first presentation waits behind
 * (consoleMandatoryGate's pending → presented transition) — and the ONLY
 * coupling between the two: notifications never queue behind a pending
 * mandatory action, and a mandatory action never enters this feed.
 *
 * The singleton `turn` card is deliberately NOT part of the answer: it mirrors
 * `waitingFor` itself, so it stands exactly as long as the pending decision
 * does — waiting on it would deadlock the presentation forever.
 */
export function notificationsSettled(): boolean {
  return notificationState.transient.length === 0 &&
    notificationState.queue.length === 0 &&
    notificationState.leaving === 0;
}

// ── Presentation-flow wiring (module init) ──────────────────────────────────
// The orchestrator never imports this store (acyclic graph): it learns about
// the visible flow-holding card via the injected supplier, and this store
// reacts to foreground transitions via the subscriptions below.
/** The real supplier — exported so tests that override it can restore it. */
export function notificationFlowHoldSupplier(): boolean {
  return notificationState.transient.some((n) => n.holdsFlow === true);
}
registerFlowHoldSupplier(notificationFlowHoldSupplier);
onForegroundBlocked(() => holdVisibleTransient());
onForegroundFreed(() => promoteFromQueue());

/**
 * The feed mode CHANGED — re-check the QUEUED (not-yet-shown) models against
 * the new mode, so a card waiting behind a blocker never presents under a
 * setting the player has already left. VISIBLE cards are deliberately kept:
 * an on-screen toast finishes its own lifecycle instead of vanishing under
 * the player's eyes (the setting change usually happens from the settings
 * surface anyway). Switching back to 'all' replays nothing — a filtered
 * model never entered the presentation and its root id is already in the
 * seen-set, so it cannot re-pop.
 *
 * A DROPPED bot-turn card is soft-ACKED (there is no toast left whose finish
 * would ever ack it — mirrors the player's own skip gesture). Its half of the
 * staged-commit timeline is NOT delivered here: the queue mutation wakes the
 * staging module's own liveness watcher, which advances the timeline from the
 * FRONT only — delivering a dropped turn out of order from here could commit
 * a whole buffered batch ahead of a still-queued card's presentation.
 */
export function reconcileQueueWithFeedMode(): void {
  const kept: Array<NotificationModel> = [];
  for (const model of notificationState.queue) {
    if (feedModeAllows(model)) {
      kept.push(model);
      continue;
    }
    ackBotTurn(model.botTurnKey);
  }
  if (kept.length !== notificationState.queue.length) {
    notificationState.queue = kept;
  }
}

watch(() => notificationFeedModeState.mode, () => reconcileQueueWithFeedMode());

/** Full reset (game end / layer teardown for a different game). */
export function resetNotifications(): void {
  notificationState.viewerColor = undefined; // the next game's layer re-sets it
  notificationState.turn = undefined;
  notificationState.dismissedTurnId = undefined;
  notificationState.transient = [];
  notificationState.queue = [];
  notificationState.seenRootIds = new Set<number>();
  notificationState.seenNegativeIds = new Set<number>();
  notificationState.seenRevealIds = new Set<string>();
  notificationState.seenScaleClaims = new Set<string>();
  notificationState.seeded = false;
  notificationState.lastGeneration = undefined;
  notificationState.passedSeen = new Set<string>();
  // A layer torn down mid-leave never fires its @after-leave — zero the count
  // so a NEXT game's settled signal cannot inherit a phantom exit. (A late
  // hook for an already-reset element is absorbed by the WeakSet pairing.)
  notificationState.leaving = 0;
}
