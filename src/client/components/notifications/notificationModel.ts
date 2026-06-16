import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GameEvent, JournalActionCategory} from '@/common/events/GameEvent';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {buildJournalView} from '@/client/components/journal/journalView';
import {buildEventChildren, JournalChildVM, JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {NotificationKind, NotificationModel, NOTIFICATION_PRIORITY, NOTIFICATION_TTL, COALESCE_THRESHOLD} from './notificationTypes';

/**
 * PURE notification mappers — turn the structured journal stream + the client's
 * `waitingFor` state into {@link NotificationModel}s. No Vue / DOM / i18n / clock
 * (the caller passes `createdAt`), so this is unit-testable under the server
 * runner (mirrors `journalView.ts` / `victoryPointsModel.ts`).
 *
 * The data SOURCE is exactly the journal's: root events are keyed by
 * `correlationId` (the universal stable id — a childful group OR a childless
 * single-message correlation), children come from the same `GameEvent`s, and
 * the headline impact pills are the merged net deltas. Nothing is parsed from
 * the UI or guessed from text.
 */

// ── Action-menu titles ──────────────────────────────────────────────────────
// Mirrors WaitingFor.vue's ACTION_MENU_TITLES (the ONE inline `or` that is NOT a
// mandatory sub-prompt). Kept in sync deliberately: when the action menu is the
// prompt it's the viewer's TURN; any other prompt is an ACTION REQUIRED. These
// are stable English template strings (never localised in waitingFor).
const ACTION_MENU_TITLES: ReadonlySet<string> = new Set([
  'Take your first action',
  'Take your next action',
]);

const UNIT_RANK = new Map<string, number>([
  ['tr', 0],
  ['cards', 1],
]);

// ── Actor / classification ──────────────────────────────────────────────────

/** The acting player of a root event — first PLAYER token, else the event's player. */
function rootActor(header: LogMessage, chain: ReadonlyArray<GameEvent>): Color | undefined {
  for (const tok of header.data) {
    if (tok.type === LogMessageDataType.PLAYER) {
      return tok.value;
    }
  }
  return chain.find((e) => e.player !== undefined)?.player;
}

function categoryTypeLabel(category: JournalActionCategory | undefined): string {
  switch (category) {
  case 'card-play': return 'Card played';
  case 'card-action': return 'Card action';
  case 'corporation-action': return 'Corporation action';
  case 'ceo-action': return 'CEO action';
  case 'standard-project': return 'Standard project';
  case 'colony': return 'Colony';
  case 'copied-action': return 'Copied action';
  default: return 'Event';
  }
}

// ── Impact pill summary ─────────────────────────────────────────────────────

function signed(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Parse a pre-formatted chip amount ('+2' / '−2', with a real minus sign). */
function chipValue(text: string): number {
  const normalized = text.replace(/−/g, '-');
  const n = Number.parseInt(normalized, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Merge chips that share icon + production + saved, summing their amounts. */
export function mergeChips(chips: ReadonlyArray<JournalImpactChip>): Array<JournalImpactChip> {
  const order: Array<string> = [];
  const byKey = new Map<string, JournalImpactChip & {sum: number}>();
  for (const c of chips) {
    const key = `${c.icon}|${c.production === true ? 1 : 0}|${c.saved === true ? 1 : 0}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {...c, sum: chipValue(c.text)});
      order.push(key);
    } else {
      existing.sum += chipValue(c.text);
    }
  }
  const out: Array<JournalImpactChip> = [];
  for (const key of order) {
    const m = byKey.get(key);
    if (m === undefined || m.sum === 0) {
      continue;
    }
    out.push({icon: m.icon, text: m.saved === true ? `−${Math.abs(m.sum)}` : signed(m.sum), production: m.production, saved: m.saved});
  }
  return out;
}

/**
 * Salience rank for the compact headline (lower = shown first). GAINS lead,
 * the cost trails — what the player GOT before what they paid:
 *   0–3 positive (TR, cards, resource gains, production gains),
 *   5–6 losses (stock loss / payment, production loss),
 *   7   a discount (a saving, but cost-related).
 */
function chipRank(chip: JournalImpactChip): number {
  if (chip.saved === true) {
    return 7;
  }
  const positive = chip.text.startsWith('+');
  if (positive) {
    const unit = UNIT_RANK.get(chip.icon);
    if (unit !== undefined) {
      return unit; // TR (0) / cards (1)
    }
    return chip.production === true ? 3 : 2;
  }
  // Negatives — losses / payment — last.
  return chip.production === true ? 6 : 5;
}

/**
 * Reduce a chain's breakdown rows to the headline pills (top few merged net
 * deltas) + the count of breakdown rows behind "+N details".
 */
export function summarizeImpact(vms: ReadonlyArray<JournalChildVM>, maxPills = 3): {pills: Array<JournalImpactChip>; detailCount: number} {
  const all: Array<JournalImpactChip> = [];
  for (const vm of vms) {
    all.push(...vm.chips);
  }
  const merged = mergeChips(all).sort((a, b) => chipRank(a) - chipRank(b));
  return {pills: merged.slice(0, maxPills), detailCount: vms.length};
}

// ── Root-event notification ─────────────────────────────────────────────────

type RootBuildInput = {
  correlationId: number;
  header: LogMessage;
  children: ReadonlyArray<LogMessage>;
  chain: ReadonlyArray<GameEvent>;
  viewerColor: Color;
  generation: number;
  createdAt: number;
};

/**
 * Build the notification for ONE journal root event, or `undefined` when it
 * should be SUPPRESSED (the viewer's OWN ordinary action — they just did it).
 * Milestone / award highlights are shown regardless of actor.
 */
function buildRootNotification(input: RootBuildInput): NotificationModel | undefined {
  const {header, chain, viewerColor} = input;
  const actor = rootActor(header, chain);
  const isMilestone = chain.some((e) => e.type === 'milestone-claimed');
  const isAward = chain.some((e) => e.type === 'award-funded');
  const important = isMilestone || isAward;
  const kind: NotificationKind = important ? 'important' : 'normal';

  // Suppress the viewer's own ordinary actions — no self-spam for a card you
  // just played. Highlights (milestone/award) are worth a card even when yours.
  if (kind === 'normal' && actor !== undefined && actor === viewerColor) {
    return undefined;
  }

  const vms = buildEventChildren(chain, input.correlationId, actor);
  const {pills, detailCount} = summarizeImpact(vms);
  const typeLabelKey = isMilestone ? 'Milestone claimed' : isAward ? 'Award funded' : categoryTypeLabel(header.category);

  return {
    id: `g${input.correlationId}`,
    kind,
    priority: NOTIFICATION_PRIORITY[kind],
    typeLabelKey,
    category: header.category,
    actor,
    header,
    childVMs: vms,
    pills,
    detailCount,
    correlationId: input.correlationId,
    generation: input.generation,
    ttl: NOTIFICATION_TTL[kind],
    persistent: false,
    cta: {labelKey: 'Show in journal', action: 'open-journal'},
    createdAt: input.createdAt,
  };
}

function eventsByCorrelation(events: ReadonlyArray<GameEvent>): Map<number, Array<GameEvent>> {
  const map = new Map<number, Array<GameEvent>>();
  for (const e of events) {
    const arr = map.get(e.correlationId);
    if (arr === undefined) {
      map.set(e.correlationId, [e]);
    } else {
      arr.push(e);
    }
  }
  return map;
}

export type DiffInput = {
  messages: ReadonlyArray<LogMessage>;
  events: ReadonlyArray<GameEvent>;
  seen: ReadonlySet<number>;
  viewerColor: Color;
  generation: number;
  createdAt: number;
};

/**
 * Diff the current generation's journal stream against the already-seen root
 * `correlationId`s. Returns the NEW notification models to show (own ordinary
 * actions filtered out) AND every correlationId encountered (the caller seeds
 * its seen-set with ALL of them, so suppressed events never pop later).
 */
export function diffRootNotifications(input: DiffInput): {models: Array<NotificationModel>; encounteredIds: Array<number>} {
  const byCorr = eventsByCorrelation(input.events);
  const models: Array<NotificationModel> = [];
  const encounteredIds: Array<number> = [];
  for (const node of buildJournalView(input.messages)) {
    const correlationId = node.kind === 'group' ? node.correlationId : node.message.correlationId;
    if (correlationId === undefined) {
      continue; // system line / generation divider / legacy log — not a root event
    }
    encounteredIds.push(correlationId);
    if (input.seen.has(correlationId)) {
      continue;
    }
    const header = node.kind === 'group' ? node.header : node.message;
    const children = node.kind === 'group' ? node.children : [];
    const model = buildRootNotification({
      correlationId, header, children,
      chain: byCorr.get(correlationId) ?? [],
      viewerColor: input.viewerColor,
      generation: input.generation,
      createdAt: input.createdAt,
    });
    if (model !== undefined) {
      models.push(model);
    }
  }
  return {models, encounteredIds};
}

/**
 * Burst control: when a single diff yields more than {@link COALESCE_THRESHOLD}
 * fresh ORDINARY events (an opponent ran a whole turn while we were idle),
 * collapse the normal ones into ONE per-actor summary card. Highlights
 * (important) always stay individual.
 */
export function coalesceBurst(models: ReadonlyArray<NotificationModel>): Array<NotificationModel> {
  const normal = models.filter((m) => m.kind === 'normal');
  const rest = models.filter((m) => m.kind !== 'normal');
  if (normal.length <= COALESCE_THRESHOLD) {
    return [...models];
  }
  const byActor = new Map<string, Array<NotificationModel>>();
  const actorOrder: Array<string> = [];
  for (const m of normal) {
    const key = m.actor ?? '';
    const arr = byActor.get(key);
    if (arr === undefined) {
      byActor.set(key, [m]);
      actorOrder.push(key);
    } else {
      arr.push(m);
    }
  }
  const summaries: Array<NotificationModel> = [];
  for (const key of actorOrder) {
    const group = byActor.get(key) ?? [];
    if (group.length === 1) {
      summaries.push(group[0]);
      continue;
    }
    const last = group[group.length - 1];
    const pills = mergeChips(group.flatMap((m) => m.pills)).sort((a, b) => chipRank(a) - chipRank(b)).slice(0, 3);
    summaries.push({
      ...last,
      id: `gsum:${last.generation}:${key}:${last.correlationId}`,
      typeLabelKey: 'Multiple events',
      header: undefined,
      childVMs: undefined,
      pills,
      detailCount: 0,
      correlationId: last.correlationId,
      groupCount: group.length,
      cta: {labelKey: 'Show in journal', action: 'open-journal'},
    });
  }
  return [...rest, ...summaries];
}

// ── Turn notification (your-turn / action-required) ─────────────────────────

function titleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) {
    return undefined;
  }
  return typeof title === 'string' ? title : title.message;
}

/**
 * Derive the singleton "turn" notification from `waitingFor`:
 *  - undefined / optional → none (not the viewer's forced move);
 *  - the inline action menu → YOUR TURN;
 *  - anything else (a mandatory sub-prompt) → ACTION REQUIRED.
 */
export function buildTurnNotification(
  waitingFor: PlayerInputModel | undefined,
  opts: {generation: number; createdAt: number},
): NotificationModel | undefined {
  if (waitingFor === undefined || waitingFor.optional === true) {
    return undefined;
  }
  const title = titleText(waitingFor.title);
  const isActionMenu = waitingFor.type === 'or' && title !== undefined && ACTION_MENU_TITLES.has(title);

  if (isActionMenu) {
    return {
      id: 'turn:your-turn',
      kind: 'your-turn',
      priority: NOTIFICATION_PRIORITY['your-turn'],
      typeLabelKey: 'Your turn',
      pills: [],
      detailCount: 0,
      bodyKey: 'Choose an action',
      generation: opts.generation,
      ttl: NOTIFICATION_TTL['your-turn'],
      persistent: true,
      // YOUR TURN's button just acknowledges + closes the card — the action UI is
      // already in front of the player (the inline action menu / dedicated buttons).
      cta: {labelKey: 'Got it', action: 'dismiss'},
      createdAt: opts.createdAt,
    };
  }

  return {
    id: 'turn:action-required',
    kind: 'action-required',
    priority: NOTIFICATION_PRIORITY['action-required'],
    typeLabelKey: 'Action required',
    pills: [],
    detailCount: 0,
    prompt: waitingFor.title,
    bodyKey: waitingFor.warning !== undefined ? undefined : undefined,
    generation: opts.generation,
    ttl: NOTIFICATION_TTL['action-required'],
    persistent: true,
    cta: {labelKey: 'Go to action', action: 'go-to-action'},
    createdAt: opts.createdAt,
  };
}

/** A "new generation" highlight (driven by the game.generation diff). */
export function buildGenerationNotification(generation: number, createdAt: number): NotificationModel {
  return {
    id: `gen:${generation}`,
    kind: 'important',
    priority: NOTIFICATION_PRIORITY['important'],
    typeLabelKey: 'New generation',
    pills: [],
    detailCount: 0,
    // The generation number itself reads as the body ("Поколение N") via the
    // card's metaLine — no redundant "a new generation begins" string.
    generation,
    ttl: NOTIFICATION_TTL['important'],
    persistent: false,
    cta: {labelKey: 'Show in journal', action: 'open-journal'},
    createdAt,
  };
}

/** A "player passed" highlight (driven by the game.passedPlayers diff). */
export function buildPassNotification(actor: Color, generation: number, createdAt: number): NotificationModel {
  return {
    id: `pass:${generation}:${actor}`,
    kind: 'important',
    priority: NOTIFICATION_PRIORITY['important'],
    typeLabelKey: 'Player passed',
    actor,
    pills: [],
    detailCount: 0,
    bodyKey: 'has passed for this generation',
    generation,
    ttl: NOTIFICATION_TTL['important'],
    persistent: false,
    createdAt,
  };
}
