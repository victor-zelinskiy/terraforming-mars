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
import {affectedPlayersOfBotTurn} from '@/client/components/notifications/notificationFeedPolicy';
import {notificationState, pushTransient, dismiss, notificationKnownId} from '@/client/components/notifications/notificationState';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {botTurnReviewState, flashBotReviewEdge, openBotTurnReview} from './botTurnReviewState';
import {ackBotTurn} from './botTurnAck';
import {noteBotTurnStage} from './marsBotTurnTiming';
import {workspaceStackActive} from '@/client/console/consoleWorkspaceStack';
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
    // Structured feed-filter metadata from the turn's own typed script: the
    // players its attacks / snapshot-diffed impacts touch. A turn that only
    // advanced the bot itself carries an empty list — «бот походил» is exactly
    // the noise the personal feed mode exists to hide.
    affects: affectedPlayersOfBotTurn(entry.turn),
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
  /*
   * SEQUENCING IS FOR A RUN OF TURNS, AND IT MAY NEVER COST THE PLAYER THEIR
   * OWN MOVE.
   *
   * Staging buffers the authoritative view so the bot's turns are revealed one
   * card at a time instead of landing as one jump. That is worth doing while
   * the bot is still playing — the player has nothing to do meanwhile — and it
   * is worth doing for a response that carries several turns at once (the
   * player passed and the server resolved the whole round before answering).
   *
   * It is NOT worth doing for the ordinary case: ONE turn, after which control
   * comes straight back. There is no order to keep — the turn's footprint IS
   * the authoritative view — and buffering withheld the player's own prompt
   * until the card had been DELIVERED, which waits behind the feed's silencing
   * gates (their own action cinematic, a reveal, a ceremony) and behind
   * whatever card is already on screen. THAT is the «MarsBot иногда думает
   * ~5 секунд» report: the server had answered in under a millisecond and the
   * client was sitting on the answer.
   *
   * So the test is structural, never a title: does this view hand the player a
   * prompt? If it does and it carries a single turn, commit NOW. Otherwise
   * sequence — and an open window always keeps its order.
   */
  const handsControlBack = (next as PlayerViewModel).waitingFor !== undefined;
  /*
   * ⚠️ AND PACING ONLY EXISTS TO BE WATCHED. While a WORKSPACE is standing the
   * board is behind it (`display: none` for a section, covered for the rest),
   * so a sequence walks a board nobody can see while holding the player's own
   * next prompt — which is «особенно когда я нахожусь в workspace во время его
   * хода», measured at 92 s for one five-turn run after a pass. A player who
   * went to work gets their game committed and the cards ride the feed.
   */
  const watchable = !workspaceStackActive();
  if (!watchable && isBotStagingActive()) {
    commitBotStagingNow(); // they walked away mid-run — stop holding their game
  }
  const sequence = watchable && (isBotStagingActive() || fresh.length > 1 || !handsControlBack);
  for (const entry of fresh) {
    noteBotTurnStage(entry.key, 'response', sequence ? 'sequenced' : 'single');
    pushTransient(buildBotTurnNotification(entry, {viewerColor, createdAt: now, autoExpand, paramChips}));
  }
  trimBotTurnBacklog();
  // A turn whose card could NOT enter the presentation (master switch off /
  // filtered by the feed mode) has no toast whose finish would ever ack it —
  // ack NOW, so the server needn't extend the next paced bot turn waiting on
  // a card that will never show. Admitted cards keep their three finish paths.
  for (const entry of fresh) {
    if (!notificationKnownId(botTurnNotificationId(entry.key))) {
      ackBotTurn(entry.key);
    }
  }
  if (opts?.commitLatest === undefined) {
    return false;
  }
  if (prev === undefined) {
    // Fresh session seed — nothing was enqueued; commit normally.
    return false;
  }
  if (!sequence) {
    // The caller commits on this same tick — stamp it here so the diagnostic
    // measures the path the player actually experienced.
    noteBotTurnStage(fresh[0].key, 'commit');
    return false;
  }
  beginBotStaging(prev, fresh.map((e) => ({key: e.key, turn: e.turn})), next, opts.commitLatest);
  // Self-heal + immediate advance: turns whose cards could not enter the
  // presentation (master switch off / kind filtered / filtered by the personal
  // feed mode) owe the toast timeline nothing — the liveness pass walks the
  // window from the FRONT, applying each unpresented leader's visuals in order
  // (a fully-filtered batch walks to the end, which IS the authoritative
  // commit). A pending turn whose card is still queued stops the walk, so a
  // later turn can never commit ahead of an earlier card's presentation.
  ensureBotPresentationLiveness();
  return true;
}

/**
 * Liveness self-heal (called from NotificationLayer's poll, the staging open,
 * and the reactive card-set watcher below): advance the staged timeline past
 * every LEADING pending turn that has no card in the presentation — filtered
 * by the feed mode, dropped by the master switch, or dismissed from the queue
 * without ever showing. Such a turn owes the toast timeline nothing, so its
 * visual footprint applies the moment the timeline's FRONT reaches it; when
 * the walk reaches the last pending turn that is the full authoritative
 * commit (the old "no pending card known → commit the buffer" self-heal is
 * the degenerate case of this walk).
 *
 * The walk STOPS at the first pending turn whose card IS still present
 * (visible or queued): everything behind it keeps waiting, so a later turn's
 * consequences can never appear ahead of an earlier card's presentation —
 * strict FIFO whatever mix of shown and filtered cards a batch carries.
 */
export function ensureBotPresentationLiveness(): void {
  if (!isBotStagingActive()) {
    return;
  }
  let head = botStagingPendingKeys()[0];
  while (head !== undefined && !notificationKnownId(botTurnNotificationId(head))) {
    if (deliverBotTurnVisual(head) === 'none') {
      break; // defensive: the window changed under us — never spin
    }
    head = botStagingPendingKeys()[0];
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
    ...(entry.corporation !== undefined ? {corporation: entry.corporation} : {}),
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

/**
 * HOW MANY AI-TURN CARDS MAY WAIT BEHIND THE VISIBLE ONE.
 *
 * ⚠️ A BACKLOG OF TOASTS IS A BACKLOG ON THE PLAYER. Only ONE transient card is
 * visible at a time and each lives its full {@link BOT_TURN_TTL}, so a run of
 * five bot turns is five lifetimes of «СОБЫТИЯ В ОЧЕРЕДИ» — and for all of it a
 * flow-holding card is up, which BLOCKS every prompt surface (`presentation`)
 * and keeps `notificationsSettled()` false, so the player's own next decision
 * (the research buy after a pass) is not even ANNOUNCED. Measured: the bot's
 * round ended after ~22 s of cards and the player's prompt waited behind all of
 * it.
 *
 * The card is a NOTIFICATION, not a queue of records — the journal is the queue
 * of records, and every turn stays replayable there. So the feed keeps the one
 * being read plus the newest one still coming, and everything older is drained
 * (visual applied, acked, dismissed) rather than stacked.
 */
export const MAX_QUEUED_BOT_CARDS = 1;

/**
 * Drain AI-turn cards that have piled up behind the visible one, oldest first.
 * Never touches ordinary notifications, and never the visible card.
 */
function trimBotTurnBacklog(): void {
  const queued = notificationState.queue
    .map((n) => n.botTurnKey)
    .filter((k): k is string => k !== undefined);
  // The cap counts cards waiting BEHIND the one being read. With nothing
  // visible (the feed is silenced by a cinematic) the queue is not a backlog —
  // it is the run itself, and its first card has not had its turn yet, so one
  // more is allowed through.
  const showing = notificationState.transient.some((n) => n.botTurnKey !== undefined);
  const excess = queued.length - MAX_QUEUED_BOT_CARDS - (showing ? 0 : 1);
  if (excess <= 0) {
    return;
  }
  for (let i = 0; i < excess; i++) {
    const key = queued[i];
    ackBotTurn(key);
    deliverBotTurnVisual(key);
    dismiss(botTurnNotificationId(key));
  }
  /*
   * …AND TELL THE SERVER TO STOP PACING ON OUR ACCOUNT. Its bounded idle before
   * the NEXT bot turn extends while a connected human has not acked the last
   * one (`BotTurnScheduler`), and the visible card is acked only when it is
   * dismissed — five turns of that is five extension budgets spent waiting for
   * a card nobody is reading card-by-card. Dropping a turn out of the queue IS
   * the client saying the run is arriving faster than it is being read, so the
   * visible one stops gating too. It keeps showing; only the pacing claim goes.
   */
  for (const visible of notificationState.transient) {
    ackBotTurn(visible.botTurnKey);
  }
}

/**
 * The player CLOSED a bot-turn card themselves (console B). That press means
 * «I have seen what the bot did, move on» — not «now show me the next one, and
 * hold my game for its five seconds too». So the whole AI-turn backlog
 * collapses in one gesture:
 *
 *  - the closed turn and every bot turn still QUEUED behind it are acked (the
 *    server stops pacing the next turn on this client — the console's B used to
 *    call a bare `dismiss`, so this ack was never sent at all);
 *  - each queued turn's visual footprint is DELIVERED before its card goes, so
 *    the board still advances through every turn — nothing is lost, and the
 *    journal keeps all of them replayable;
 *  - the staged buffer commits, which is what hands the player back their own
 *    prompt.
 *
 * Ordinary notifications are untouched — this is the AI-turn feed only.
 */
export function skipBotTurnPresentation(key: string): void {
  const queued = notificationState.queue
    .map((n) => n.botTurnKey)
    .filter((k): k is string => k !== undefined);
  ackBotTurn(key);
  dismiss(botTurnNotificationId(key));
  for (const other of queued) {
    ackBotTurn(other);
    deliverBotTurnVisual(other);
    dismiss(botTurnNotificationId(other));
  }
  // A window whose cards have all gone still owes its authoritative commit
  // (idempotent — `deliverBotTurnVisual` of the last turn already did it).
  commitBotStagingNow();
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
  (card, prevCard) => {
    // The PREVIOUS holder let go — from here nothing of that turn holds a
    // prompt surface, which is the diagnostic's terminal stage.
    if (prevCard?.botTurnKey !== undefined && prevCard.botTurnKey !== card?.botTurnKey) {
      noteBotTurnStage(prevCard.botTurnKey, 'released');
    }
    if (card?.botTurnKey === undefined) {
      return;
    }
    noteBotTurnStage(card.botTurnKey, 'visible');
    if (deliverBotTurnVisual(card.botTurnKey) === 'committed') {
      noteBotTurnStage(card.botTurnKey, 'commit', 'on delivery');
    }
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
