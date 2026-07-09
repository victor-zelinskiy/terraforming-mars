/*
 * MarsBot presentation — NOTIFICATION-FIRST delivery of the bot's turns.
 *
 * The server resolves a bot turn instantly and ships its typed script
 * (`automa.lastTurn` + the `turnHistory` tail). Instead of auto-playing a
 * fullscreen theater over whatever the player is doing (the old commit-hold
 * flow), each fresh turn becomes a compact TURN-EVENT NOTIFICATION:
 *
 *   «Бот завершил ход» + headline (the played card / pass) + impact pills
 *   + «Осмотреть» (open the «Разбор хода» review) + «В журнал».
 *
 * The card rides the ordinary notification queue, so it NEVER overlaps a
 * result modal / mandatory choice / another notification — it waits its FIFO
 * turn. While it is VISIBLE it HOLDS mandatory surfaces (`holdsFlow`, bounded
 * by its TTL) so a draft that arrived in the same response opens only after
 * the player has seen (or dismissed) what the bot did. «Осмотреть» opens the
 * «Разбор хода» review of the archived script; the journal keeps the turn
 * forever and can reopen the same review later.
 *
 * PRESENTATION MODE (architecture knob — no settings UI yet, mirrors the
 * motionTokens URL/localStorage pattern): 'notification' (default) shows the
 * compact card; 'theater' auto-expands the card into the full theater the
 * moment it is DELIVERED — so even auto-theater respects every gate/queue.
 */
import {watch} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel, PlayerViewModel} from '@/common/models/PlayerModel';
import {MarsBotImpact, MarsBotTurnVisual} from '@/common/automa/MarsBotTurn';
import {LogMessage} from '@/common/logs/LogMessage';
import {NotificationModel} from '@/client/components/notifications/notificationTypes';
import {notificationState, pushTransient, dismiss, notificationKnownId} from '@/client/components/notifications/notificationState';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {botTurnReviewState, flashBotReviewEdge, openBotTurnReview} from './botTurnReviewState';
import {ackBotTurn} from './botTurnAck';
import {
  beginBotStaging,
  botStagingPendingKeys,
  commitBotStagingNow,
  deliverBotTurnVisual,
  isBotStagingActive,
  updateBotStagingLatest,
} from './marsBotStagedCommits';
import {
  adjacentArchivedTurn,
  ArchivedBotTurn,
  archivedTurnByCorrelation,
  archivedTurnByKey,
  markBotTurnViewed,
  recordBotTurnsFromView,
} from './marsBotTurnArchive';

/** The compact card's lifetime — bounded, so a held draft can never stall. */
export const BOT_TURN_TTL = 5_000;
/** Presents ahead of ordinary important/normal cards (ties with 'negative'). */
export const BOT_TURN_PRIORITY = 2;
/** Outcome lines shown on the compact card; the rest lives in the inspect. */
export const BOT_TURN_SUMMARY_CAP = 3;

export type BotPresentationMode = 'notification' | 'theater';

const MODE_STORAGE_KEY = 'tm_bot_presentation';

function storage(): Storage | undefined {
  try {
    // Prefer window.localStorage — a JSDOM env exposes it on window but not
    // always as a bare global.
    if (typeof window !== 'undefined' && window.localStorage !== undefined) {
      return window.localStorage;
    }
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch (e) {
    return undefined;
  }
}

function searchString(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

/** In-session override — set by `setMarsBotPresentationMode`, wins over the
 *  stored value so the knob works even where localStorage is unavailable. */
let modeOverride: BotPresentationMode | undefined;

/**
 * How a fresh bot turn presents: compact notification (default) or an
 * auto-expanded theater. URL `?botTheater=1|0` wins over the stored
 * preference — the future settings surface writes the same key.
 */
export function marsBotPresentationMode(): BotPresentationMode {
  const fromUrl = /[?&]botTheater=([01])/.exec(searchString())?.[1];
  if (fromUrl !== undefined) {
    return fromUrl === '1' ? 'theater' : 'notification';
  }
  if (modeOverride !== undefined) {
    return modeOverride;
  }
  const stored = storage()?.getItem(MODE_STORAGE_KEY);
  return stored === 'theater' ? 'theater' : 'notification';
}

export function setMarsBotPresentationMode(mode: BotPresentationMode): void {
  modeOverride = mode;
  storage()?.setItem(MODE_STORAGE_KEY, mode);
}

function chipText(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

function chipsOfImpact(impact: MarsBotImpact, limit: number): Array<JournalImpactChip> {
  const chips: Array<JournalImpactChip> = [];
  for (const change of impact.changes) {
    if (chips.length >= limit) {
      break;
    }
    const delta = change.after - change.before;
    if (delta === 0) {
      continue;
    }
    chips.push({
      icon: change.resource === 'tr' ? 'tr' : change.resource,
      text: chipText(delta),
      ...(change.scope === 'production' ? {production: true} : {}),
    });
  }
  return chips;
}

/**
 * Headline impact pills: the VIEWER's own changes first (the thing they must
 * not miss), else the bot's own headline changes. Capped — the theater has
 * the full breakdown.
 */
function summaryPills(entry: ArchivedBotTurn, viewerColor: Color | undefined): Array<JournalImpactChip> {
  const impacts = entry.turn.steps
    .filter((s): s is Extract<typeof s, {kind: 'impact'}> => s.kind === 'impact')
    .map((s) => s.impact);
  const viewer = viewerColor !== undefined ? impacts.find((i) => i.target === viewerColor) : undefined;
  if (viewer !== undefined) {
    const chips = chipsOfImpact(viewer, 4);
    if (chips.length > 0) {
      return chips;
    }
  }
  const own = impacts.find((i) => i.targetIsBot);
  return own !== undefined ? chipsOfImpact(own, 3) : [];
}

/** The turn's own headline log line (the reveal / pass / failed message). */
function headlineOf(entry: ArchivedBotTurn): LogMessage | undefined {
  for (const kind of ['reveal', 'pass', 'failed'] as const) {
    for (const step of entry.turn.steps) {
      if (step.kind === kind && step.message !== undefined) {
        return step.message;
      }
    }
  }
  const firstLog = entry.turn.steps.find((s) => s.kind === 'log');
  return firstLog?.kind === 'log' ? firstLog.message : undefined;
}

/**
 * The compact OUTCOME lines: the turn's own key log lines — placements,
 * parameter raises, milestone claims, attack losses, failed-action money —
 * in script order, minus the headline (never duplicated). Internal automa
 * bookkeeping (tag processing, track advances) is deliberately NOT here —
 * that detail belongs to the inspect, not the toast.
 */
function summaryLinesOf(entry: ArchivedBotTurn, headline: LogMessage | undefined): {lines: Array<LogMessage>, overflow: number} {
  const all: Array<LogMessage> = [];
  for (const step of entry.turn.steps) {
    // 'hazard' is in: the Ares-hazard consequence must be visible on the
    // compact card too, not only inside the inspect (the player must never
    // miss WHY a bot track regressed).
    if (step.kind !== 'log' && step.kind !== 'attack' && step.kind !== 'failed' && step.kind !== 'pass' && step.kind !== 'hazard') {
      continue;
    }
    const message = step.message;
    if (message !== undefined && message !== headline) {
      all.push(message);
    }
  }
  return {
    lines: all.slice(0, BOT_TURN_SUMMARY_CAP),
    overflow: Math.max(0, all.length - BOT_TURN_SUMMARY_CAP),
  };
}

/**
 * Global-parameter before → after chips from THIS turn's own footprint
 * (`turn.visual`, snapshot-diffed on the server) — exact per turn, so a
 * multi-turn batch attributes each raise to its own card.
 */
export function paramChipsOfVisual(visual: MarsBotTurnVisual | undefined): Array<JournalImpactChip> | undefined {
  if (visual === undefined) {
    return undefined;
  }
  const chips: Array<JournalImpactChip> = [];
  if (visual.temperature !== undefined) {
    chips.push({icon: 'temperature', text: `${visual.temperature.before}°→${visual.temperature.after}°`, neutral: true});
  }
  if (visual.oxygenLevel !== undefined) {
    chips.push({icon: 'oxygen', text: `${visual.oxygenLevel.before}%→${visual.oxygenLevel.after}%`, neutral: true});
  }
  if (visual.oceans !== undefined) {
    chips.push({icon: 'ocean', text: `${visual.oceans.before}→${visual.oceans.after}`, neutral: true});
  }
  if (visual.venusScaleLevel !== undefined) {
    chips.push({icon: 'venus', text: `${visual.venusScaleLevel.before}%→${visual.venusScaleLevel.after}%`, neutral: true});
  }
  return chips.length > 0 ? chips : undefined;
}

/**
 * Fallback for turns recorded before `turn.visual` existed: the prev → next
 * view diff — only attributable when exactly ONE fresh turn rides the
 * response (the summary lines still name each raise otherwise).
 */
export function globalParamChips(prev: ViewModel | undefined, next: ViewModel): Array<JournalImpactChip> {
  if (prev === undefined) {
    return [];
  }
  const chips: Array<JournalImpactChip> = [];
  const p = prev.game;
  const n = next.game;
  if (p.temperature !== n.temperature) {
    chips.push({icon: 'temperature', text: `${p.temperature}°→${n.temperature}°`, neutral: true});
  }
  if (p.oxygenLevel !== n.oxygenLevel) {
    chips.push({icon: 'oxygen', text: `${p.oxygenLevel}%→${n.oxygenLevel}%`, neutral: true});
  }
  if (p.oceans !== n.oceans) {
    chips.push({icon: 'ocean', text: `${p.oceans}→${n.oceans}`, neutral: true});
  }
  if (p.venusScaleLevel !== n.venusScaleLevel) {
    chips.push({icon: 'venus', text: `${p.venusScaleLevel}%→${n.venusScaleLevel}%`, neutral: true});
  }
  return chips;
}

/** The de-dup / dismiss id of the compact card for an archived turn. */
export function botTurnNotificationId(key: string): string {
  return `bot:${key}`;
}

/** Build the compact turn-event notification for one archived bot turn. */
export function buildBotTurnNotification(entry: ArchivedBotTurn, opts: {viewerColor?: Color, createdAt: number, autoExpand: boolean, paramChips?: ReadonlyArray<JournalImpactChip>}): NotificationModel {
  const header = headlineOf(entry);
  const summary = summaryLinesOf(entry, header);
  return {
    id: botTurnNotificationId(entry.key),
    kind: 'important',
    variant: 'bot-turn',
    priority: BOT_TURN_PRIORITY,
    typeLabelKey: 'MarsBot finished its turn',
    actor: entry.botColor === '' ? undefined : entry.botColor,
    ...(header !== undefined ? {header} : {}),
    ...(summary.lines.length > 0 ? {summaryLines: summary.lines} : {}),
    ...(summary.overflow > 0 ? {summaryOverflow: summary.overflow} : {}),
    // Global-parameter before → after first (the planet-level outcome; exact
    // per-turn from the script's own footprint, the view diff as fallback),
    // then the viewer's own / the bot's headline resource deltas.
    pills: [...(paramChipsOfVisual(entry.turn.visual) ?? opts.paramChips ?? []), ...summaryPills(entry, opts.viewerColor)],
    detailCount: entry.turn.steps.length,
    ...(entry.correlationId !== undefined ? {correlationId: entry.correlationId} : {}),
    generation: entry.generation,
    ttl: BOT_TURN_TTL,
    persistent: false,
    cta: {labelKey: 'Watch turn', action: 'expand-theater'},
    ...(entry.correlationId !== undefined ?
      {secondaryCta: {labelKey: 'To journal', action: 'open-journal'}} : {}),
    holdsFlow: true,
    autoExpand: opts.autoExpand,
    botTurnKey: entry.key,
    createdAt: opts.createdAt,
  };
}

/**
 * The commit-path hook (App.update poll + WaitingFor.fetchPlayerInput):
 * archive the incoming view's bot turns and enqueue a compact notification
 * per FRESH one.
 *
 * STAGED VISUAL COMMITS: when the caller passes its `commitLatest` closure
 * and the response carries fresh bot turns, the latest view is NOT committed
 * — it is buffered, and each turn's visual footprint applies to the PRESENTED
 * view only when that turn's card is DELIVERED (the last pending turn's
 * delivery performs the full authoritative commit). Returns TRUE when the
 * staging window took ownership of the commit — the caller must NOT commit.
 * A response with no fresh turns while a window is open only refreshes the
 * buffered latest (also returns true). Without `commitLatest` (tests / legacy
 * call sites) the cards are enqueued and the caller commits as before.
 */
export function presentFreshBotTurns(prev: ViewModel | undefined, next: ViewModel | undefined, opts?: {commitLatest?: () => void}): boolean {
  const fresh = recordBotTurnsFromView(prev, next);
  if (fresh.length === 0 || next === undefined) {
    if (next !== undefined && opts?.commitLatest !== undefined && isBotStagingActive()) {
      // Never commit the latest view directly under a playing sequence —
      // refresh the buffered latest instead; the drain commits it in order.
      return updateBotStagingLatest(next, opts.commitLatest);
    }
    return false;
  }
  const autoExpand = marsBotPresentationMode() === 'theater';
  const viewerColor = (next as PlayerViewModel | undefined)?.thisPlayer?.color;
  // Fallback chips for pre-`visual` turns: the prev → next diff is
  // attributable only when exactly one fresh turn rides the response.
  const paramChips = fresh.length === 1 ? globalParamChips(prev, next) : [];
  const now = Date.now();
  for (const entry of fresh) {
    pushTransient(buildBotTurnNotification(entry, {viewerColor, createdAt: now, autoExpand, paramChips}));
  }
  if (opts?.commitLatest === undefined) {
    return false;
  }
  if (prev === undefined) {
    // Fresh session seed — nothing was enqueued; commit normally.
    return false;
  }
  beginBotStaging(prev, fresh.map((e) => ({key: e.key, turn: e.turn})), next, opts.commitLatest);
  // Self-heal: if NONE of the cards could enter the presentation (master
  // notification switch off / kind filtered), the sequence can never drain —
  // fall back to the immediate authoritative commit.
  if (!fresh.some((e) => notificationKnownId(botTurnNotificationId(e.key)))) {
    commitBotStagingNow();
  }
  return true;
}

/**
 * Liveness self-heal (called from NotificationLayer's poll): a staging window
 * whose pending cards are ALL gone from the presentation (dismissed from the
 * queue without ever showing) would never drain — commit the buffered latest.
 */
export function ensureBotPresentationLiveness(): void {
  if (!isBotStagingActive()) {
    return;
  }
  const pending = botStagingPendingKeys();
  if (!pending.some((key) => notificationKnownId(botTurnNotificationId(key)))) {
    commitBotStagingNow();
  }
}

/**
 * Open the «Разбор хода» review of an archived turn. The review flips OPEN
 * synchronously BEFORE the card is dismissed, so the freed visible slot can't
 * promote the next queued card under the opening review.
 */
export function openBotTurnReviewByKey(key: string | undefined): boolean {
  const entry = key !== undefined ? archivedTurnByKey(key) : undefined;
  if (entry === undefined) {
    return false;
  }
  openBotTurnReview({
    botColor: entry.botColor,
    botName: entry.botName,
    difficulty: entry.difficulty,
    ctx: entry.ctx,
    turn: entry.turn,
    trackTags: entry.trackTags,
    tracks: entry.tracks,
  });
  markBotTurnViewed(entry.key);
  // CONSUMING a turn via the review advances the staged-commit sequence: apply
  // THIS turn's visual footprint (catching up any skipped predecessors) so the
  // board behind the review matches the turn being reviewed (e.g. the L3 «show
  // on map» peek highlights a tile that is actually placed). The LAST pending
  // turn commits the full authoritative view. Idempotent (a re-open / a
  // non-staged journal replay is a no-op) — before this, RB/LB navigating past
  // the notification FEED dismissed queued cards WITHOUT ever delivering the
  // last turn, so the buffered view (with the between-generation draft) never
  // committed → the game deadlocked.
  deliverBotTurnVisual(entry.key);
  // Opening the review is one of the three "notification finished" signals —
  // soft-ack it so the server needn't extend the next paced bot turn on this
  // client (best-effort; never gates the turn).
  ackBotTurn(entry.key);
  dismiss(botTurnNotificationId(entry.key));
  return true;
}

/** Journal path: open the review of the turn whose journal group is `correlationId`. */
export function openBotTurnReviewByCorrelation(correlationId: number): boolean {
  return openBotTurnReviewByKey(archivedTurnByCorrelation(correlationId)?.key);
}

/**
 * Is there an archived turn before (`dir === -1`) / after (`dir === 1`) the one
 * the review currently shows? Drives the desktop prev/next buttons' enabled
 * state (reactive-safe — reads the archive Map + the review's anchor key).
 */
export function botReviewHasAdjacentTurn(dir: -1 | 1): boolean {
  return botTurnReviewState.open && adjacentArchivedTurn(botTurnReviewState.key, dir) !== undefined;
}

/**
 * LB / RB (or the desktop ◀ / ▶ / `[` `]`) turn navigation: re-open the review
 * on the adjacent archived turn. At a boundary NOTHING opens — it flashes the
 * review-local edge notice ('no-prev' = no earlier turn, 'no-next' = the next
 * turn has not been played yet) and returns which boundary was hit, so a caller
 * can add its own feedback (e.g. a disabled-button tooltip). Read-only: it only
 * swaps which archived script the review renders.
 */
export function stepBotTurnReview(dir: -1 | 1): 'ok' | 'no-prev' | 'no-next' {
  const boundary = dir < 0 ? 'no-prev' : 'no-next';
  if (!botTurnReviewState.open) {
    return boundary;
  }
  const neighbor = adjacentArchivedTurn(botTurnReviewState.key, dir);
  if (neighbor === undefined) {
    flashBotReviewEdge(boundary);
    return boundary;
  }
  openBotTurnReviewByKey(neighbor.key);
  return 'ok';
}

// The DELIVERY hook — the heart of the staged visual timeline. The moment a
// bot-turn card becomes VISIBLE (every gate/queue already let it through):
//  1. the presented view advances to THAT turn (its tiles / parameters /
//     resource deltas apply; the LAST pending turn performs the full
//     authoritative commit instead) — consequences appear exactly with their
//     explanation, never before;
//  2. in the 'theater' presentation mode the card then auto-expands into the
//     full turn theater instead of showing the compact card.
// The watch is pre-flush: the mutation lands in the same tick as the card's
// render, before paint.
watch(
  () => notificationState.transient.find((n) => n.botTurnKey !== undefined),
  (card) => {
    if (card?.botTurnKey === undefined) {
      return;
    }
    deliverBotTurnVisual(card.botTurnKey);
    if (card.autoExpand === true) {
      openBotTurnReviewByKey(card.botTurnKey);
    }
  },
);

// The LIVENESS backstop — the robust guarantee against a stranded staging
// window. `ensureBotPresentationLiveness()` used to run ONLY from
// `NotificationLayer.update()`, which fires on a `playerView` CHANGE — but a
// staging window SUPPRESSES that change (the authoritative view is buffered,
// the presented view is frozen), so the self-heal never ran while staging was
// active. That is exactly the deadlock: RB/LB-navigating past the notification
// feed dismisses the queued bot-turn cards WITHOUT delivering the last turn, so
// nothing commits the buffer and the between-generation draft never arrives.
// Watching the notification card SET (reactive) re-checks liveness the instant
// the last staged card leaves the presentation by ANY path — delivered,
// review-navigated, TTL-expired, evicted, or drained to the journal — and
// commits the buffered authoritative view. It never fires prematurely: Vue
// watchers are post-flush, so `beginBotStaging` + every `pushTransient` of the
// batch have already run when it evaluates, and `ensureBotPresentationLiveness`
// only commits when NO pending card remains known. No-op without a window.
watch(
  () => notificationState.transient.length + notificationState.queue.length,
  () => ensureBotPresentationLiveness(),
);
