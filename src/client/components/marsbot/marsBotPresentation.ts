/*
 * MarsBot presentation — NOTIFICATION-FIRST delivery of the bot's turns.
 *
 * The server resolves a bot turn instantly and ships its typed script
 * (`automa.lastTurn` + the `turnHistory` tail). Instead of auto-playing a
 * fullscreen theater over whatever the player is doing (the old commit-hold
 * flow), each fresh turn becomes a compact TURN-EVENT NOTIFICATION:
 *
 *   «ИИ завершил ход» + headline (the revealed card / pass) + impact pills
 *   + «Осмотреть» (expand into the full theater) + «В журнал».
 *
 * The card rides the ordinary notification queue, so it NEVER overlaps a
 * result modal / mandatory choice / another notification — it waits its FIFO
 * turn. While it is VISIBLE it HOLDS mandatory surfaces (`holdsFlow`, bounded
 * by its TTL) so a draft that arrived in the same response opens only after
 * the player has seen (or dismissed) what the bot did. Expanding opens the
 * theater as a REPLAY of the archived script; the journal keeps the turn
 * forever and can reopen the same replay later.
 *
 * PRESENTATION MODE (architecture knob — no settings UI yet, mirrors the
 * motionTokens URL/localStorage pattern): 'notification' (default) shows the
 * compact card; 'theater' auto-expands the card into the full theater the
 * moment it is DELIVERED — so even auto-theater respects every gate/queue.
 */
import {watch} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel, PlayerViewModel} from '@/common/models/PlayerModel';
import {MarsBotImpact} from '@/common/automa/MarsBotTurn';
import {LogMessage} from '@/common/logs/LogMessage';
import {NotificationModel} from '@/client/components/notifications/notificationTypes';
import {notificationState, pushTransient, dismiss} from '@/client/components/notifications/notificationState';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {runMarsBotTheaterReplay} from './marsBotTheaterState';
import {
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
    if (step.kind !== 'log' && step.kind !== 'attack' && step.kind !== 'failed' && step.kind !== 'pass') {
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
 * Global-parameter before → after chips (Температура −28°→−26°, Океаны 2→3) —
 * the changes a player must see WITHOUT opening the inspect. Derived from the
 * prev → next view diff, so they are only attached when exactly ONE fresh
 * turn rides the response (a multi-turn diff can't be attributed per turn —
 * the summary lines still name each raise).
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
    // Global-parameter before → after first (the planet-level outcome), then
    // the viewer's own / the bot's headline resource deltas.
    pills: [...(opts.paramChips ?? []), ...summaryPills(entry, opts.viewerColor)],
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
 * per FRESH one. Never holds the commit — the board updates immediately; the
 * cards ride the presentation queue.
 */
export function presentFreshBotTurns(prev: ViewModel | undefined, next: ViewModel | undefined): void {
  const fresh = recordBotTurnsFromView(prev, next);
  if (fresh.length === 0 || next === undefined) {
    return;
  }
  const autoExpand = marsBotPresentationMode() === 'theater';
  const viewerColor = (next as PlayerViewModel | undefined)?.thisPlayer?.color;
  // The prev → next global-parameter diff is attributable ONLY when exactly
  // one fresh turn rides the response; with several, each card's summary
  // lines still name the raises.
  const paramChips = fresh.length === 1 ? globalParamChips(prev, next) : [];
  const now = Date.now();
  for (const entry of fresh) {
    pushTransient(buildBotTurnNotification(entry, {viewerColor, createdAt: now, autoExpand, paramChips}));
  }
}

/**
 * Expand an archived turn into the theater replay. The theater flips ACTIVE
 * synchronously BEFORE the card is dismissed, so the freed visible slot can't
 * promote the next queued card under the opening theater.
 */
export function openMarsBotReplay(key: string | undefined): boolean {
  const entry = key !== undefined ? archivedTurnByKey(key) : undefined;
  if (entry === undefined) {
    return false;
  }
  runMarsBotTheaterReplay({
    botColor: entry.botColor,
    botName: entry.botName,
    ctx: entry.ctx,
    turn: entry.turn,
    trackTags: entry.trackTags,
  });
  markBotTurnViewed(entry.key);
  dismiss(botTurnNotificationId(entry.key));
  return true;
}

/** Journal path: open the replay of the turn whose journal group is `correlationId`. */
export function openMarsBotReplayByCorrelation(correlationId: number): boolean {
  return openMarsBotReplay(archivedTurnByCorrelation(correlationId)?.key);
}

// 'theater' presentation mode: the moment a bot-turn card is DELIVERED
// (visible — i.e. every gate/queue already let it through), it expands into
// the full theater instead of showing the compact card.
watch(
  () => notificationState.transient.find((n) => n.autoExpand === true && n.botTurnKey !== undefined),
  (card) => {
    if (card !== undefined) {
      openMarsBotReplay(card.botTurnKey);
    }
  },
);
