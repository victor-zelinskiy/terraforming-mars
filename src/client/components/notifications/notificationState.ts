import {reactive} from 'vue';
import {NotificationModel, LiveNotification, NotificationKind, MAX_VISIBLE_TRANSIENT, NOTIFICATION_PRIORITY, NOTIFICATION_TTL} from './notificationTypes';

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
  /** Whether the initial seed (no-spam-on-load) has run. */
  seeded: boolean;
  /** Last generation observed — drives the "new generation" highlight. */
  lastGeneration: number | undefined;
  /** Colours already announced as passed this generation. */
  passedSeen: Set<string>;
  settings: NotificationSettings;
};

export const notificationState = reactive<NotificationStore>({
  turn: undefined,
  transient: [],
  queue: [],
  dismissedTurnId: undefined,
  seenRootIds: new Set<number>(),
  seeded: false,
  lastGeneration: undefined,
  passedSeen: new Set<string>(),
  settings: {
    enabled: true,
    showNormal: true,
    showImportant: true,
    showTurn: true,
  },
});

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
  case 'important':
    return s.showImportant;
  case 'warning':
    return true; // warnings are always allowed when enabled
  case 'normal':
  default:
    return s.showNormal;
  }
}

function knownId(id: string): boolean {
  return notificationState.turn?.id === id ||
    notificationState.transient.some((n) => n.id === id) ||
    notificationState.queue.some((n) => n.id === id);
}

/** Promote one queued model into a freed transient slot, if any. */
function promoteFromQueue(): void {
  while (notificationState.transient.length < MAX_VISIBLE_TRANSIENT && notificationState.queue.length > 0) {
    const next = notificationState.queue.shift();
    if (next !== undefined) {
      notificationState.transient.push({...next, expanded: false});
    }
  }
}

/** Push one transient (normal/important/warning) card. De-duped by id. */
export function pushTransient(model: NotificationModel): void {
  if (!settingAllows(model.kind) || knownId(model.id)) {
    return;
  }
  if (notificationState.transient.length < MAX_VISIBLE_TRANSIENT) {
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
}

/** Full reset (game end / layer teardown for a different game). */
export function resetNotifications(): void {
  notificationState.turn = undefined;
  notificationState.dismissedTurnId = undefined;
  notificationState.transient = [];
  notificationState.queue = [];
  notificationState.seenRootIds = new Set<number>();
  notificationState.seeded = false;
  notificationState.lastGeneration = undefined;
  notificationState.passedSeen = new Set<string>();
}
