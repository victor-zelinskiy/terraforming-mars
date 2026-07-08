/*
 * «Разбор хода» — the PURE model of a completed MarsBot turn (unit-tested
 * under the server runner). Turns the server-authored `MarsBotTurn` script
 * into a STRUCTURED, cause→effect summary that both surfaces (desktop overlay
 * / console fullscreen) render statically — NOT a timed row-by-row playback.
 *
 * The turn already happened; this is a REVIEW. No bot rules are re-derived —
 * every fact comes straight from the script. Grouping into cause→effect chains
 * is done PHASE-A HEURISTICALLY, relying on the server writing steps strictly
 * in resolution order (guarded by tests/automa/AutomaTurnLog.spec.ts). Phase B
 * replaces the heuristic with explicit `cause`/`resolution`/`placement` fields.
 */
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {BonusCardId, DifficultyLevel, TrackAction} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {
  MarsBotAttack,
  MarsBotBonusFate,
  MarsBotImpactChange,
  MarsBotStepCause,
  MarsBotTurn,
  MarsBotTurnStep,
} from '@/common/automa/MarsBotTurn';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {tagOfTrack} from './marsBotTurnView';
import {trackActionGlyph} from './marsBotView';

/** A before → after resource/param chip (reuses the journal's chip shape). */
export type BotReviewChip = JournalImpactChip;

/** One printed tag of a played project card + the track it pushed. */
export type BotReviewTag = {tag: Tag, trackTag?: Tag, ignored: boolean};

/** A card the bot only FLIPPED for randomness (tie-break / colony pick) — never played. */
export type BotReviewTechnicalReveal = {name: CardName, reason: 'tiebreak' | 'pick', cost?: number};

/** The card MarsBot PLAYED this turn (never "revealed" — it executes it). */
export type BotReviewCard =
  | {kind: 'project', name: CardName, tags: Array<BotReviewTag>}
  | {kind: 'bonus', id: BonusCardId, fate?: MarsBotBonusFate, branch?: {key: string, params?: ReadonlyArray<string>}, secondaryCard?: BonusCardId};

/**
 * One cell of a track's mini-scale window. `state` drives the highlight:
 * where the bot came FROM, where it landed (TO), the cells it crossed, and a
 * few UPCOMING bonus cells so the player sees what the track offers next.
 */
export type BotReviewScaleCell = {index: number, action?: TrackAction, state: 'past' | 'from' | 'mid' | 'to' | 'future'};

/** A single line inside a cause→effect chain. `depth` drives the connector indent. */
export type BotReviewLine =
  | {kind: 'track', depth: number, capsule: ReadonlyArray<Tag>, from: number, to: number, action?: TrackAction, cells: ReadonlyArray<BotReviewScaleCell>}
  | {kind: 'log', depth: number, message: LogMessage, tone?: 'cost' | 'gain', labelKey?: string}
  | {kind: 'attack', depth: number, attack: MarsBotAttack}
  | {kind: 'note', depth: number, noteKey: string, tone: 'ignored' | 'skip' | 'info'}
  /** A chained fallback bonus card, its OWN effect lines nested — ONE flow. */
  | {kind: 'secondary-card', depth: number, id: BonusCardId, lines: Array<BotReviewLine>};

/** Why a chain of effects fired — the human-readable anchor of the chain. */
export type BotReviewChainCause =
  | {kind: 'tag', tag: Tag, trackTag?: Tag}
  | {kind: 'bonus', id: BonusCardId}
  | {kind: 'trade', id: BonusCardId}
  | {kind: 'failed', reason: string}
  | {kind: 'delta'}
  | {kind: 'effect'};

export type BotReviewChain = {
  cause: BotReviewChainCause;
  lines: Array<BotReviewLine>;
};

export type BotReviewTile = {spaceId: SpaceId, tileType: TileType, color?: Color};
export type BotReviewParam = {icon: 'temperature' | 'oxygen' | 'ocean' | 'venus', before: number, after: number};

/** One participant's net before → after changes this turn. */
export type BotReviewImpact = {target: Color, changes: ReadonlyArray<MarsBotImpactChange>};

/** The one-sentence verdict (an English i18n template + params). */
export type BotReviewVerdict = {key: string, params: Array<string>};

export type BotTurnReview = {
  generation: number;
  difficulty: DifficultyLevel;
  botColor: Color | '';
  botName: string;
  ctx: BonusCardContext;
  card?: BotReviewCard;
  verdict: BotReviewVerdict;
  headlineChips: Array<BotReviewChip>;
  chains: Array<BotReviewChain>;
  tiles: Array<BotReviewTile>;
  params: Array<BotReviewParam>;
  /** Hostile rows (a participant lost / was targeted). */
  attacks: Array<MarsBotAttack>;
  /** Non-bot participants' net changes. */
  playerImpacts: Array<BotReviewImpact>;
  /** The bot's own net changes. */
  botResult?: BotReviewImpact;
  /** Project cards REFERENCED by the review (played + genuine reveals) — X = Осмотреть карту. */
  cardNames: Array<CardName>;
  /** Cards flipped only for randomness (tie-break / pick) — shown as service reveals, never played. */
  technicalReveals: Array<BotReviewTechnicalReveal>;
  /** First placed tile — L3 = Показать на карте. */
  primarySpaceId?: SpaceId;
  /** Was this a pass / a failed action with no board effect. */
  quiet: boolean;
};

/** Everything the review needs, captured at archive time (view-independent). */
export type BotTurnReviewSource = {
  botColor: Color | '';
  botName: string;
  difficulty: DifficultyLevel;
  ctx: BonusCardContext;
  turn: MarsBotTurn;
  /** Track index → identity tag, captured when the turn was archived. */
  trackTags: ReadonlyArray<Tag | undefined>;
  /** Full track models — feed the mini-scales + composite capsules. */
  tracks: ReadonlyArray<MarsBotTrackModel>;
};

/** The Colonies "trade with a colony" bonus cards (their M€ deduct = trade cost). */
const TRADE_BONUS_CARDS: ReadonlyArray<BonusCardId> = [
  BonusCardId.B19_SHIPPING_LINES,
  BonusCardId.B20_EXTENDED_SHIPPING_LINES,
];

const MAX_DEPTH = 3;

function paramIcon(field: 'temperature' | 'oxygenLevel' | 'oceans' | 'venusScaleLevel'): BotReviewParam['icon'] {
  switch (field) {
  case 'temperature': return 'temperature';
  case 'oxygenLevel': return 'oxygen';
  case 'oceans': return 'ocean';
  case 'venusScaleLevel': return 'venus';
  }
}

function paramsOfVisual(turn: MarsBotTurn): Array<BotReviewParam> {
  const v = turn.visual;
  if (v === undefined) {
    return [];
  }
  const out: Array<BotReviewParam> = [];
  const fields = ['temperature', 'oxygenLevel', 'oceans', 'venusScaleLevel'] as const;
  for (const f of fields) {
    const change = v[f];
    if (change !== undefined) {
      out.push({icon: paramIcon(f), before: change.before, after: change.after});
    }
  }
  return out;
}

/**
 * Internal automa bookkeeping that adds noise, not information, to the review:
 * the random tie-break / colony-pick FLIPS, and the "placed tile at <space>"
 * lines (the tile + its «показать» affordance live in the board block, so the
 * chain never repeats the button).
 */
const NOISE_LOG_TEMPLATES: ReadonlySet<string> = new Set([
  '${0} flipped ${1} (cost ${2}) to break a placement tie',
  '${0} flipped ${1} (cost ${2}) to pick a colony tile',
]);

function isNoiseLog(message: LogMessage): boolean {
  if (NOISE_LOG_TEMPLATES.has(message.message)) {
    return true;
  }
  // A placement-location line — deduped against the board block's tile + show.
  return message.data.some((d) => d.type === LogMessageDataType.SPACE);
}

/** A track's capsule = ALL its tags (single icon, or a group for a composite track). */
function trackCapsule(source: BotTurnReviewSource, trackIndex: number): ReadonlyArray<Tag> {
  const t = source.tracks[trackIndex];
  if (t !== undefined && t.tags.length > 0) {
    return t.tags;
  }
  const tag = tagOfTrack(source.trackTags, trackIndex);
  return tag !== undefined ? [tag] : [];
}

const MINISCALE_MAX = 8;

/**
 * The mini-scale WINDOW around a movement: one cell before `from`, through
 * `to`, plus a few upcoming cells so the player sees what the track offers
 * next — never the whole (possibly 18-long) strip.
 */
function buildMiniScale(source: BotTurnReviewSource, trackIndex: number, from: number, to: number): ReadonlyArray<BotReviewScaleCell> {
  const t = source.tracks[trackIndex];
  if (t === undefined) {
    return [];
  }
  const end = Math.min(t.maxPosition, to + 3);
  let start = Math.max(0, from - 1);
  if (end - start + 1 > MINISCALE_MAX) {
    start = Math.max(0, end - MINISCALE_MAX + 1);
  }
  const cells: Array<BotReviewScaleCell> = [];
  for (let i = start; i <= end; i++) {
    const action = t.layout[i] ?? undefined;
    const state: BotReviewScaleCell['state'] = i < from ? 'past' : i === from ? 'from' : i < to ? 'mid' : i === to ? 'to' : 'future';
    cells.push({index: i, ...(action !== undefined ? {action} : {}), state});
  }
  return cells;
}

/** Build a track-movement line (capsule + mini-scale window). */
function trackMovementLine(source: BotTurnReviewSource, step: Extract<MarsBotTurnStep, {kind: 'advance'}>, depth: number): Extract<BotReviewLine, {kind: 'track'}> {
  return {
    kind: 'track',
    depth,
    capsule: trackCapsule(source, step.trackIndex),
    from: step.from,
    to: step.to,
    ...(step.action !== undefined ? {action: step.action} : {}),
    cells: buildMiniScale(source, step.trackIndex, step.from, step.to),
  };
}

/** Is this log line "the bot lost N of a resource" (the trade-fee deduct)? */
function isBotResourceLoss(message: LogMessage | undefined, botColor: Color | ''): boolean {
  // The English template is a stable constant (`StockBase.logUnitDelta`);
  // matching it — not the localized string — is robust across locales.
  if (message === undefined || message.message !== '${0} lost ${1} ${2}') {
    return false;
  }
  const player = message.data.find((d) => d.type === LogMessageDataType.PLAYER);
  return player !== undefined && player.value === botColor;
}

/** The next-line depth when appending under the current chain (cascade-aware). */
function nextDepth(chain: BotReviewChain, isTrack: boolean): number {
  // Base indent under the cause header is 1. A track/log that follows a track
  // whose action CASCADES (advance-again / advance-another-track) nests one
  // deeper — the visual "chain reaction". Bounded so a monster chain stays
  // readable.
  const lastTrack = [...chain.lines].reverse().find((l) => l.kind === 'track');
  if (lastTrack === undefined || lastTrack.kind !== 'track') {
    return 1;
  }
  if (lastTrack.action !== undefined) {
    const glyph = trackActionGlyph(lastTrack.action);
    const cascades = glyph.kind === 'advance' || glyph.kind === 'tag';
    // A board consequence (log) of an action nests under it; a further track
    // move that the action caused nests under it too (only when it cascades).
    if (!isTrack || cascades) {
      return Math.min(MAX_DEPTH, lastTrack.depth + 1);
    }
  }
  return Math.min(MAX_DEPTH, lastTrack.depth);
}

/** Dispatcher: prefer the server's `cause` markers (Phase B, robust); fall back
 *  to the order-heuristic for turns recorded before they existed (Phase A). */
function buildChains(steps: ReadonlyArray<MarsBotTurnStep>, source: BotTurnReviewSource, card: BotReviewCard | undefined): Array<BotReviewChain> {
  const hasCause = steps.some((s) => 'cause' in s && s.cause !== undefined);
  return hasCause ?
    buildChainsByCause(steps, source, card) :
    buildChainsByOrder(steps, source, card);
}

/** The chain identity of a cause (one chain per tag index / bonus / colony / delta). */
function chainCauseKey(cause: MarsBotStepCause): string {
  return cause.kind === 'tag' ? `tag:${cause.index}` : cause.kind;
}

/** The display depth of a log/attack line: nested under the last track in its chain. */
function logDepthOf(chain: BotReviewChain): number {
  const lastTrack = [...chain.lines].reverse().find((l) => l.kind === 'track');
  return lastTrack !== undefined && lastTrack.kind === 'track' ? Math.min(MAX_DEPTH, lastTrack.depth + 1) : 1;
}

/**
 * Phase B: build the chains from the server's `cause` markers — each step is
 * attributed authoritatively, so the review groups cause → effect from DATA
 * (no order heuristic) and nests cascades from the `advance.depth` field.
 */
function buildChainsByCause(steps: ReadonlyArray<MarsBotTurnStep>, source: BotTurnReviewSource, card: BotReviewCard | undefined): Array<BotReviewChain> {
  const chains: Array<BotReviewChain> = [];
  const byKey = new Map<string, BotReviewChain>();
  const isTradeCard = card?.kind === 'bonus' && TRADE_BONUS_CARDS.includes(card.id);
  const reviewCauseOf = (cause: MarsBotStepCause, tagStep?: Extract<MarsBotTurnStep, {kind: 'tag'}>): BotReviewChainCause => {
    switch (cause.kind) {
    case 'tag':
      return {kind: 'tag', tag: tagStep?.tag ?? Tag.WILD, trackTag: tagOfTrack(source.trackTags, tagStep?.trackIndex)};
    case 'colony':
      return card?.kind === 'bonus' ? {kind: 'trade', id: card.id} : {kind: 'effect'};
    case 'bonus':
    case 'secondary-bonus': // never a top-level chain — routed into the parent's sub-block
      return card?.kind === 'bonus' ? (isTradeCard ? {kind: 'trade', id: card.id} : {kind: 'bonus', id: card.id}) : {kind: 'effect'};
    case 'delta':
      return {kind: 'delta'};
    case 'failed':
      return {kind: 'failed', reason: 'no-tags'};
    }
  };
  const ensureChain = (cause: MarsBotStepCause, tagStep?: Extract<MarsBotTurnStep, {kind: 'tag'}>): BotReviewChain => {
    const key = chainCauseKey(cause);
    let chain = byKey.get(key);
    if (chain === undefined) {
      chain = {cause: reviewCauseOf(cause, tagStep), lines: []};
      byKey.set(key, chain);
      chains.push(chain);
    }
    return chain;
  };
  // A chained fallback card's steps nest INSIDE the parent bonus chain, as one
  // «Secondary card» sub-block — so parent → «drew another» → its effects reads
  // as a single flow, never a second event.
  const secondaryId = card?.kind === 'bonus' ? card.secondaryCard : undefined;
  const routeSecondary = (line: BotReviewLine): void => {
    const parent = ensureChain({kind: 'bonus'});
    const last = parent.lines[parent.lines.length - 1];
    const sub = last !== undefined && last.kind === 'secondary-card' ?
      last :
      (() => {
        const created: Extract<BotReviewLine, {kind: 'secondary-card'}> = {kind: 'secondary-card', depth: 1, id: secondaryId ?? BonusCardId.B01_METEOR_SHOWER, lines: []};
        parent.lines.push(created);
        return created;
      })();
    sub.lines.push(line);
  };
  const isSecondaryStep = (step: MarsBotTurnStep): boolean =>
    'cause' in step && step.cause?.kind === 'secondary-bonus' && secondaryId !== undefined;

  for (const step of steps) {
    switch (step.kind) {
    case 'reveal':
    case 'pass':
    case 'impact':
      break;
    case 'failed': {
      const chain: BotReviewChain = {cause: {kind: 'failed', reason: step.reason}, lines: []};
      chains.push(chain);
      if (step.message !== undefined) {
        chain.lines.push({kind: 'log', depth: 1, message: step.message});
      }
      break;
    }
    case 'tag': {
      if (step.cause === undefined) {
        break;
      }
      const chain = ensureChain(step.cause, step);
      if (step.trackIndex === undefined) {
        chain.lines.push({kind: 'note', depth: 1, noteKey: 'tag of an unused expansion — ignored', tone: 'ignored'});
      }
      break;
    }
    case 'advance': {
      if (step.cause === undefined) {
        break;
      }
      const line = trackMovementLine(source, step, Math.min(MAX_DEPTH, (step.depth ?? 0) + 1));
      if (isSecondaryStep(step)) {
        routeSecondary(line);
      } else {
        ensureChain(step.cause).lines.push(line);
      }
      break;
    }
    case 'attack': {
      if (isSecondaryStep(step)) {
        routeSecondary({kind: 'attack', depth: 1, attack: step.attack});
        break;
      }
      const chain = step.cause !== undefined ? ensureChain(step.cause) : ensureChain({kind: 'bonus'});
      chain.lines.push({kind: 'attack', depth: logDepthOf(chain), attack: step.attack});
      break;
    }
    case 'log': {
      if (isNoiseLog(step.message)) {
        break;
      }
      if (isSecondaryStep(step)) {
        routeSecondary({kind: 'log', depth: 1, message: step.message});
        break;
      }
      const chain = step.cause !== undefined ? ensureChain(step.cause) : ensureChain({kind: 'bonus'});
      const cost = chain.cause.kind === 'trade' && isBotResourceLoss(step.message, source.botColor);
      chain.lines.push({
        kind: 'log',
        depth: logDepthOf(chain),
        message: step.message,
        ...(cost ? {tone: 'cost' as const, labelKey: 'Trade cost'} : {}),
      });
      break;
    }
    }
  }
  return chains.filter((c) => c.lines.length > 0 || c.cause.kind === 'tag');
}

/** Phase A fallback: build the cause→effect chains from the ordered script. */
function buildChainsByOrder(steps: ReadonlyArray<MarsBotTurnStep>, source: BotTurnReviewSource, card: BotReviewCard | undefined): Array<BotReviewChain> {
  const chains: Array<BotReviewChain> = [];
  let current: BotReviewChain | undefined;
  // After a reveal we know what the FIRST loose (non-tag) chain represents:
  // a project's board effects vs a bonus card's own effect.
  let looseCause: BotReviewChainCause['kind'] = 'effect';
  const isTradeCard = card?.kind === 'bonus' && TRADE_BONUS_CARDS.includes(card.id);

  const ensureLoose = (): BotReviewChain => {
    if (current === undefined) {
      const cause: BotReviewChainCause =
        looseCause === 'bonus' && card?.kind === 'bonus' ?
          (isTradeCard ? {kind: 'trade', id: card.id} : {kind: 'bonus', id: card.id}) :
          {kind: 'effect'};
      current = {cause, lines: []};
      chains.push(current);
    }
    return current;
  };

  for (const step of steps) {
    switch (step.kind) {
    case 'reveal':
      looseCause = step.card.kind === 'project' ? 'effect' : 'bonus';
      current = undefined;
      break;
    case 'pass':
      break;
    case 'tag': {
      const trackTag = tagOfTrack(source.trackTags, step.trackIndex);
      current = {cause: {kind: 'tag', tag: step.tag, trackTag}, lines: []};
      chains.push(current);
      if (step.trackIndex === undefined) {
        current.lines.push({kind: 'note', depth: 1, noteKey: 'tag of an unused expansion — ignored', tone: 'ignored'});
      }
      break;
    }
    case 'advance': {
      const chain = current ?? ensureLoose();
      chain.lines.push(trackMovementLine(source, step, nextDepth(chain, true)));
      break;
    }
    case 'failed':
      current = {cause: {kind: 'failed', reason: step.reason}, lines: []};
      chains.push(current);
      if (step.message !== undefined) {
        current.lines.push({kind: 'log', depth: 1, message: step.message});
      }
      break;
    case 'attack': {
      const chain = current ?? ensureLoose();
      chain.lines.push({kind: 'attack', depth: nextDepth(chain, false), attack: step.attack});
      break;
    }
    case 'log': {
      if (isNoiseLog(step.message)) {
        break;
      }
      const chain = current ?? ensureLoose();
      const cost = chain.cause.kind === 'trade' && isBotResourceLoss(step.message, source.botColor);
      chain.lines.push({
        kind: 'log',
        depth: nextDepth(chain, false),
        message: step.message,
        ...(cost ? {tone: 'cost' as const, labelKey: 'Trade cost'} : {}),
      });
      break;
    }
    case 'impact':
      break;
    }
  }
  // Drop chains that carry no lines (e.g. a project tag that produced nothing
  // visible yet still belongs — keep tag chains, drop empty loose ones).
  return chains.filter((c) => c.lines.length > 0 || c.cause.kind === 'tag');
}

/** A full verdict sentence per placed tile type (no param-word to localize). */
function tileVerdictKey(tileType: TileType): string {
  switch (tileType) {
  case TileType.OCEAN: return 'Placed an ocean';
  case TileType.GREENERY: return 'Placed a greenery';
  case TileType.CITY: return 'Placed a city';
  default: return 'Placed a special tile';
  }
}

/**
 * The single most important consequence, as an i18n template + params. The
 * headline chips carry the numbers; the verdict names the beat.
 * Priority: tile › global parameter › milestone/award › attack › trade ›
 * track action (TR/floaters) › pass/failed › "advanced its tracks".
 */
function buildVerdict(turn: MarsBotTurn, card: BotReviewCard | undefined, tiles: Array<BotReviewTile>, params: Array<BotReviewParam>): BotReviewVerdict {
  if (turn.steps.some((s) => s.kind === 'pass')) {
    return {key: 'MarsBot passed this turn', params: []};
  }
  if (tiles.length > 0) {
    return {key: tileVerdictKey(tiles[0].tileType), params: []};
  }
  // Milestone / award (from the server's own log templates).
  const claimedMilestone = turn.steps.some((s) => 'message' in s && s.message?.message === '${0} claimed ${1} milestone');
  if (claimedMilestone) {
    return {key: 'Claimed a milestone', params: []};
  }
  if (params.length > 0) {
    return {key: 'Advanced a global parameter', params: []};
  }
  const attack = turn.steps.find((s): s is Extract<MarsBotTurnStep, {kind: 'attack'}> => s.kind === 'attack');
  if (attack !== undefined) {
    return {key: 'Attacked an opponent', params: []};
  }
  if (card?.kind === 'bonus' && TRADE_BONUS_CARDS.includes(card.id)) {
    return {key: 'Traded with a colony', params: []};
  }
  const failed = turn.steps.find((s): s is Extract<MarsBotTurnStep, {kind: 'failed'}> => s.kind === 'failed');
  if (failed !== undefined) {
    return {key: 'Failed action — gained ${0} M€', params: [String(failed.mc)]};
  }
  // A track action with a concrete reward (TR / floaters).
  for (const s of turn.steps) {
    if (s.kind === 'advance' && s.action !== undefined) {
      const glyph = trackActionGlyph(s.action);
      if (glyph.kind === 'tr') {
        return {key: 'Gained ${0} TR', params: [String(glyph.steps)]};
      }
      if (glyph.kind === 'floater') {
        return {key: 'Gained floaters', params: []};
      }
    }
  }
  return {key: 'Advanced its internal tracks', params: []};
}

function chipOfChange(change: MarsBotImpactChange): BotReviewChip | undefined {
  const delta = change.after - change.before;
  if (delta === 0) {
    return undefined;
  }
  return {
    icon: change.resource === 'tr' ? 'tr' : change.resource,
    text: delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`,
    ...(change.scope === 'production' ? {production: true} : {}),
  };
}

/**
 * Headline chips: the planet-level changes first (neutral param before→after),
 * then the bot's own key gains, then the biggest opponent loss. Capped — the
 * detail lives in the sections below.
 */
function buildHeadlineChips(params: Array<BotReviewParam>, botResult: BotReviewImpact | undefined, playerImpacts: Array<BotReviewImpact>): Array<BotReviewChip> {
  const chips: Array<BotReviewChip> = [];
  for (const p of params) {
    const suffix = p.icon === 'temperature' ? '°' : (p.icon === 'oxygen' || p.icon === 'venus') ? '%' : '';
    chips.push({icon: p.icon, text: `${p.before}${suffix}→${p.after}${suffix}`, neutral: true});
  }
  for (const change of botResult?.changes ?? []) {
    if (chips.length >= 6) {
      break;
    }
    const chip = chipOfChange(change);
    if (chip !== undefined) {
      chips.push(chip);
    }
  }
  // The single biggest opponent loss (a resource going down).
  let worst: {chip: BotReviewChip, magnitude: number} | undefined;
  for (const impact of playerImpacts) {
    for (const change of impact.changes) {
      const delta = change.after - change.before;
      if (delta < 0) {
        const chip = chipOfChange(change);
        if (chip !== undefined && (worst === undefined || -delta > worst.magnitude)) {
          worst = {chip, magnitude: -delta};
        }
      }
    }
  }
  if (worst !== undefined && chips.length < 6) {
    chips.push(worst.chip);
  }
  return chips;
}

/**
 * Split the turn's cards into REFERENCED (the played card + genuine reveals a
 * player would expect to inspect) and TECHNICAL (flipped only for a random
 * tie-break / colony pick). The X = «Осмотреть карту» browser shows only the
 * referenced set, so it never lists a card the review doesn't mention; the
 * technical flips get their own honest «служебное вскрытие» chip.
 */
function buildCardReferences(turn: MarsBotTurn, card: BotReviewCard | undefined): {cardNames: Array<CardName>, technicalReveals: Array<BotReviewTechnicalReveal>} {
  const referenced: Array<CardName> = [];
  const technicalReveals: Array<BotReviewTechnicalReveal> = [];
  const add = (name: CardName) => {
    if (!referenced.includes(name)) {
      referenced.push(name);
    }
  };
  if (card?.kind === 'project') {
    add(card.name);
  }
  for (const step of turn.steps) {
    if (step.kind === 'reveal' && step.card.kind === 'project') {
      add(step.card.name);
    }
    const message = 'message' in step ? step.message : undefined;
    if (message === undefined) {
      continue;
    }
    const cardTok = message.data.find((d) => d.type === LogMessageDataType.CARD);
    if (NOISE_LOG_TEMPLATES.has(message.message)) {
      // A random flip — never played; kept out of the inspect browser.
      if (cardTok !== undefined) {
        technicalReveals.push({name: cardTok.value as CardName, reason: message.message.includes('tie') ? 'tiebreak' : 'pick'});
      }
      continue;
    }
    // A genuine reveal (R&D draw-and-resolve) IS referenced.
    for (const d of message.data) {
      if (d.type === LogMessageDataType.CARD) {
        add(d.value as CardName);
      }
    }
  }
  return {cardNames: referenced, technicalReveals};
}

export function buildBotTurnReview(source: BotTurnReviewSource): BotTurnReview {
  const {turn} = source;
  let card: BotReviewCard | undefined;
  const tags: Array<BotReviewTag> = [];
  const attacks: Array<MarsBotAttack> = [];
  const playerImpacts: Array<BotReviewImpact> = [];
  let botResult: BotReviewImpact | undefined;

  for (const step of turn.steps) {
    switch (step.kind) {
    case 'reveal':
      card = step.card.kind === 'project' ?
        {kind: 'project', name: step.card.name, tags} :
        {
          kind: 'bonus',
          id: step.card.id,
          ...(step.resolution?.fate !== undefined ? {fate: step.resolution.fate} : {}),
          ...(step.resolution?.branch !== undefined ? {branch: step.resolution.branch} : {}),
          ...(step.resolution?.secondaryCard !== undefined ? {secondaryCard: step.resolution.secondaryCard} : {}),
        };
      break;
    case 'tag':
      tags.push({
        tag: step.tag,
        trackTag: tagOfTrack(source.trackTags, step.trackIndex),
        ignored: step.trackIndex === undefined,
      });
      break;
    case 'attack':
      attacks.push(step.attack);
      break;
    case 'impact':
      if (step.impact.targetIsBot) {
        botResult = {target: step.impact.target, changes: step.impact.changes};
      } else if (step.impact.changes.length > 0) {
        playerImpacts.push({target: step.impact.target, changes: step.impact.changes});
      }
      break;
    default:
      break;
    }
  }

  const tiles: Array<BotReviewTile> = (turn.visual?.tiles ?? []).map((t) => ({spaceId: t.spaceId, tileType: t.tileType, ...(t.color !== undefined ? {color: t.color} : {})}));
  const params = paramsOfVisual(turn);
  const chains = buildChains(turn.steps, source, card);
  const {cardNames, technicalReveals} = buildCardReferences(turn, card);
  const verdict = buildVerdict(turn, card, tiles, params);
  const headlineChips = buildHeadlineChips(params, botResult, playerImpacts);
  const quiet = turn.steps.some((s) => s.kind === 'pass') ||
    (tiles.length === 0 && params.length === 0 && attacks.length === 0 && playerImpacts.length === 0);

  return {
    generation: turn.generation,
    difficulty: source.difficulty,
    botColor: source.botColor,
    botName: source.botName,
    ctx: source.ctx,
    ...(card !== undefined ? {card} : {}),
    verdict,
    headlineChips,
    chains,
    tiles,
    params,
    attacks,
    playerImpacts,
    ...(botResult !== undefined ? {botResult} : {}),
    cardNames,
    technicalReveals,
    ...(tiles.length > 0 ? {primarySpaceId: tiles[0].spaceId} : {}),
    quiet,
  };
}
