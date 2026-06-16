import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GameEvent, JournalActionCategory} from '@/common/events/GameEvent';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {buildJournalView} from '@/client/components/journal/journalView';
import {buildEventChildren, impactChips, JournalChildVM, JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {NotificationKind, NotificationVariant, NotificationModel, NegativeScope, NOTIFICATION_PRIORITY, NOTIFICATION_TTL, COALESCE_THRESHOLD} from './notificationTypes';

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

/**
 * The VISUAL variant of a journal root event — derived from its `category` (the
 * server stamps it on the root-action log) plus the chain's event types. This
 * is what gives a milestone, a colony trade and a card play DISTINCT looks.
 */
function headerHasCard(header: LogMessage, card: CardName): boolean {
  return header.data.some((tok) => tok.type === LogMessageDataType.CARD && tok.value === card);
}

function rootVariant(header: LogMessage, chain: ReadonlyArray<GameEvent>): NotificationVariant {
  if (header.category === 'milestone' || chain.some((e) => e.type === 'milestone-claimed')) {
    return 'milestone';
  }
  if (header.category === 'award' || chain.some((e) => e.type === 'award-funded')) {
    return 'award';
  }
  // Vermin DAMAGE — the server stamps a 'vp-pressure' root the moment the card
  // reaches 10 animals (every player now loses 1 VP per city at scoring).
  if (header.category === 'vp-pressure') {
    return 'vp-loss';
  }
  // Vermin WARNING — the card was just PLAYED (a known special VP-pressure card;
  // recognised by its CardName, NOT by parsing text). No damage yet → a threat.
  if (header.category === 'card-play' && headerHasCard(header, CardName.VERMIN)) {
    return 'threat';
  }
  switch (header.category) {
  case 'card-play': return 'play-card';
  case 'card-action':
  case 'corporation-action':
  case 'ceo-action':
  case 'copied-action': return 'blue-action';
  case 'standard-project': return 'standard-project';
  case 'colony': return 'colony';
  default: break;
  }
  // A passive effect that surfaced as its OWN root chain (its trigger marker is
  // the root) — distinct from an action that triggered it as a child.
  const rootEvent = chain.find((e) => e.id === header.correlationId);
  if (rootEvent?.type === 'effect-triggered') {
    return 'passive-effect';
  }
  return 'event';
}

/** The behaviour KIND a variant implies (priority / TTL / persistence channel). */
function variantKind(variant: NotificationVariant): NotificationKind {
  switch (variant) {
  case 'vp-loss':
  case 'destroy':
  case 'steal':
  case 'production-reduction':
  case 'production-transfer':
    return 'negative';
  case 'milestone':
  case 'award':
  case 'threat':
    return 'important';
  default:
    return 'normal';
  }
}

/** The header label for a variant. */
function variantTypeLabel(variant: NotificationVariant, category: JournalActionCategory | undefined): string {
  switch (variant) {
  case 'milestone': return 'Achievement';
  case 'award': return 'Award';
  case 'passive-effect': return 'Effect triggered';
  case 'threat': return 'VP threat';
  case 'vp-loss': return 'VP loss';
  case 'destroy': return 'Resource lost';
  case 'steal': return 'Stolen';
  case 'production-reduction': return 'Income reduced';
  case 'production-transfer': return 'Income redirected';
  default: return categoryTypeLabel(category);
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
  const variant = rootVariant(header, chain);
  const kind = variantKind(variant);

  // Suppress the viewer's own ordinary actions — no self-spam for a card you
  // just played. Highlights / threats / VP-pressure are worth a card even when
  // yours (kind !== 'normal'), so only ordinary actions are dropped.
  if (kind === 'normal' && actor !== undefined && actor === viewerColor) {
    return undefined;
  }

  const vms = buildEventChildren(chain, input.correlationId, actor);
  const {pills, detailCount} = summarizeImpact(vms);

  return {
    id: `g${input.correlationId}`,
    kind,
    variant,
    priority: NOTIFICATION_PRIORITY[kind],
    typeLabelKey: variantTypeLabel(variant, header.category),
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
      variant: 'event',
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
 *  - the inline action menu → YOUR TURN, but ONLY on a real hand-off
 *    (`opts.freshTurn`): the turn just transitioned TO the player. NOT on a
 *    continuation of the same turn (the action menu reappears after a
 *    sub-prompt — still their two actions, the turn never left them) nor for
 *    the lone non-passed player repeating turns (control is never handed off);
 *  - anything else (a mandatory sub-prompt) → ACTION REQUIRED (always).
 */
export function buildTurnNotification(
  waitingFor: PlayerInputModel | undefined,
  opts: {generation: number; createdAt: number; freshTurn: boolean},
): NotificationModel | undefined {
  if (waitingFor === undefined || waitingFor.optional === true) {
    return undefined;
  }
  const title = titleText(waitingFor.title);
  const isActionMenu = waitingFor.type === 'or' && title !== undefined && ACTION_MENU_TITLES.has(title);

  if (isActionMenu) {
    if (!opts.freshTurn) {
      // Same turn continuing (after a sub-prompt) OR the lone player repeating
      // their turns — the turn was never handed off, so don't re-announce it.
      return undefined;
    }
    return {
      id: 'turn:your-turn',
      kind: 'your-turn',
      variant: 'your-turn',
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
    variant: 'action-required',
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
    variant: 'generation',
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

// ── Hostile / negative events (the VIEWER lost something to another player) ──

/** The attacker behind a viewer-loss event — the recipient (steal/transfer) or
 *  the source card's owner (destroy/reduction). `undefined` ⇒ not a player attack
 *  (a cost / global event / the viewer's own spend). */
function attackerOf(e: GameEvent, viewer: Color): Color | undefined {
  if (e.target?.player !== undefined && e.target.player !== viewer) {
    return e.target.player;
  }
  const s = e.source;
  if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation') && s.owner !== undefined && s.owner !== viewer) {
    return s.owner;
  }
  return undefined;
}

/** The card / corp / standard project behind a loss event. */
function negativeSourceCard(e: GameEvent): CardName | undefined {
  const s = e.source;
  if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation' || s.kind === 'standardProject')) {
    return s.card;
  }
  return undefined;
}

/** Only the LOSS chips of an event (negative; a discount saving is NOT a loss). */
function negativeChips(e: GameEvent): Array<JournalImpactChip> {
  return impactChips(e.impact).filter((c) => c.saved !== true && c.text.startsWith('−'));
}

/** A negative event the VIEWER suffered FROM ANOTHER PLAYER (not a cost/own-spend). */
function isViewerVictimEvent(e: GameEvent, viewer: Color): boolean {
  if (e.player !== viewer) {
    return false;
  }
  if (negativeChips(e).length === 0) {
    return false;
  }
  return attackerOf(e, viewer) !== undefined;
}

function buildNegativeNotification(correlationId: number, negs: ReadonlyArray<GameEvent>, viewer: Color, generation: number, createdAt: number): NotificationModel {
  const anyProduction = negs.some((e) => negativeChips(e).some((c) => c.production === true));
  const scope: NegativeScope = anyProduction ? 'production' : 'stock';
  // The resource MOVED to the attacker (a steal / production transfer) when the
  // victim event carries a `target.player` (set by the `stealing` flag).
  const transfer = negs.some((e) => e.target?.player !== undefined && e.target.player !== viewer);
  const attacker = attackerOf(negs[0], viewer);
  const sourceCard = negativeSourceCard(negs[0]);
  const variant: NotificationVariant = scope === 'production' ?
    (transfer ? 'production-transfer' : 'production-reduction') :
    (transfer ? 'steal' : 'destroy');
  const loss = mergeChips(negs.flatMap((e) => negativeChips(e)));
  const gain = transfer ? loss.map((c) => ({...c, text: c.text.replace('−', '+')})) : undefined;
  return {
    id: `neg${correlationId}`,
    kind: 'negative',
    variant,
    priority: NOTIFICATION_PRIORITY['negative'],
    typeLabelKey: variantTypeLabel(variant, undefined),
    actor: attacker,
    pills: loss,
    detailCount: 0,
    correlationId,
    generation,
    ttl: NOTIFICATION_TTL['negative'],
    persistent: false,
    cta: {labelKey: 'Show in journal', action: 'open-journal'},
    createdAt,
    negative: {attacker, sourceCard, scope, transfer, loss, gain},
  };
}

/**
 * Detect cross-player losses the VIEWER suffered this generation and emit a
 * dedicated HOSTILE notification per attacking action (grouped by correlationId,
 * all of the viewer's losses in that action merged). Built ENTIRELY from the
 * structured victim events — never from text. Returns every encountered id so
 * the caller can seed the seen-set (no spam on load).
 */
export function diffNegativeNotifications(input: {
  events: ReadonlyArray<GameEvent>;
  seen: ReadonlySet<number>;
  viewerColor: Color;
  generation: number;
  createdAt: number;
}): {models: Array<NotificationModel>; encounteredIds: Array<number>} {
  const byCorr = eventsByCorrelation(input.events);
  const models: Array<NotificationModel> = [];
  const encounteredIds: Array<number> = [];
  for (const [correlationId, chain] of byCorr) {
    const negs = chain.filter((e) => isViewerVictimEvent(e, input.viewerColor));
    if (negs.length === 0) {
      continue;
    }
    encounteredIds.push(correlationId);
    if (input.seen.has(correlationId)) {
      continue;
    }
    models.push(buildNegativeNotification(correlationId, negs, input.viewerColor, input.generation, input.createdAt));
  }
  return {models, encounteredIds};
}

// ── Public card reveals / shows ──────────────────────────────────────────────

function firstPlayerColor(m: LogMessage): Color | undefined {
  for (const tok of m.data) {
    if (tok.type === LogMessageDataType.PLAYER) {
      return tok.value;
    }
  }
  return undefined;
}

/** The card names a reveal log carries (CARD = one, CARDS = a list). */
function revealedCardNames(m: LogMessage): Array<CardName> {
  const names: Array<CardName> = [];
  for (const tok of m.data) {
    if (tok.type === LogMessageDataType.CARD) {
      names.push(tok.value);
    } else if (tok.type === LogMessageDataType.CARDS) {
      names.push(...tok.value);
    }
  }
  return names;
}

/**
 * Detect PUBLIC card reveals / shows (the server-stamped `reveal` marker) and
 * emit an info notification for players OTHER than the actor (the actor already
 * knows their own hand / has the self reveal-result overlay). Card names are
 * read from the public log tokens — no text parsing. De-duped by a string key
 * (a SEPARATE id space from the numeric root ids). Returns every encountered key
 * so the caller can seed the seen-set (no spam on load).
 */
export function diffRevealNotifications(input: {
  messages: ReadonlyArray<LogMessage>;
  seen: ReadonlySet<string>;
  viewerColor: Color;
  generation: number;
  createdAt: number;
}): {models: Array<NotificationModel>; encounteredIds: Array<string>} {
  const models: Array<NotificationModel> = [];
  const encounteredIds: Array<string> = [];
  for (const m of input.messages) {
    const meta = m.reveal;
    if (meta === undefined) {
      continue;
    }
    const cards = revealedCardNames(m);
    if (cards.length === 0) {
      continue;
    }
    const actor = firstPlayerColor(m);
    const key = `reveal:${m.correlationId ?? 'x'}:${input.generation}:${cards.join('|')}`;
    encounteredIds.push(key);
    if (input.seen.has(key)) {
      continue;
    }
    if (actor !== undefined && actor === input.viewerColor) {
      continue; // the actor already knows these cards (their hand / their reveal overlay)
    }
    const variant: NotificationVariant = meta.origin === 'hand' ? 'reveal-hand' : 'reveal-deck';
    const kind: NotificationKind = meta.origin === 'hand' ? 'important' : 'normal';
    models.push({
      id: key,
      kind,
      variant,
      priority: NOTIFICATION_PRIORITY[kind],
      typeLabelKey: meta.origin === 'hand' ? 'Cards shown' : (cards.length > 1 ? 'Cards revealed' : 'Card revealed'),
      actor,
      pills: [],
      detailCount: 0,
      correlationId: m.correlationId,
      generation: input.generation,
      ttl: NOTIFICATION_TTL[kind],
      persistent: false,
      cta: {labelKey: 'View', action: 'view-reveal'},
      createdAt: input.createdAt,
      reveal: {origin: meta.origin, result: meta.result, source: meta.source, actor, cards},
    });
  }
  return {models, encounteredIds};
}

/** A "player passed" highlight (driven by the game.passedPlayers diff). */
export function buildPassNotification(actor: Color, generation: number, createdAt: number): NotificationModel {
  return {
    id: `pass:${generation}:${actor}`,
    kind: 'important',
    variant: 'pass',
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
