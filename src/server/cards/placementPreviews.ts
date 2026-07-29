import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {Message} from '../../common/logs/Message';
import {BoardFact, BoardFactDelta, BoardFactRecipient} from '../../common/boards/BoardInformationFacts';
import {BASE_OCEAN_TILES} from '../../common/TileType';
import {PlacementPreviewContext} from '../boards/PlacementPreviewContext';
import {cardResourceIcon} from './actionPreviews';

/**
 * Thin, stable BUILDERS for the two co-located placement hooks
 * (`ICard.placementPreview` / `ICard.tilePlacedPreview`) — the analog of
 * `actionPreviews.ts` for the board.
 *
 * WHY a card hook at all. `BoardInformationEngine` explains the CELL: its printed
 * bonus, ocean adjacency, the tile's own scoring, Ares adjacency, the placement
 * cost. It cannot explain what the CARD does about the cell you picked — Solar
 * Farm's "+1 energy production per plant bonus on the chosen area", Mining Area's
 * "steel OR titanium production, whichever the area prints", Tharsis Republic's
 * "+3 M€ because you placed a city". Those live in the card, so their preview
 * lives in the card too (the fork's co-location rule: when upstream changes the
 * card, the hook is in the SAME diff and cannot silently rot).
 *
 * EVERY builder here is READ-ONLY. A hook may look at the player, the space and
 * the {@link PlacementPreviewContext}; it must never place, defer, log or mutate.
 *
 * Titles/descriptions are ENGLISH i18n keys (translated client-side, RU strings
 * in `src/locales/ru/board_info.json`). `source` names the CARD, which the UI
 * renders as a quiet attribution tag — so a gain is never anonymous.
 */

/** The card attribution tag the UI shows under a fact ("Solar Farm"). */
export function cardSource(card: ICard): BoardFact['source'] {
  return {type: 'card', id: card.name, label: card.name};
}

/**
 * The preview mirror of `Board.isUncoveredOceanSpace` — a PLAIN ocean tile, not
 * a composite laid over one (Ocean City / New Holland cover an ocean and do NOT
 * re-trigger "an ocean was placed"). Reads the same `BASE_OCEAN_TILES` set.
 */
export function placesUncoveredOcean(ctx: PlacementPreviewContext): boolean {
  return ctx.tileType !== undefined && BASE_OCEAN_TILES.has(ctx.tileType);
}

/** WHO a triggered effect pays out to — the viewer collapses to `current-player`. */
export function recipientOf(viewer: IPlayer, owner: IPlayer): BoardFactRecipient {
  return owner.id === viewer.id ? {kind: 'current-player'} : {kind: 'player', color: owner.color};
}

type FactOptions = {
  /** Overrides the auto id (`card-<name>-<n>`); use when a card emits several. */
  id?: string;
  description?: string | Message;
  params?: ReadonlyArray<string>;
  /** Defaults to the current player; a trigger on someone else's card passes theirs. */
  recipient?: BoardFactRecipient;
  severity?: BoardFact['severity'];
};

function baseFact(card: ICard, suffix: string, title: string | Message, options?: FactOptions): BoardFact {
  return {
    id: options?.id ?? `card-${card.name}-${suffix}`,
    category: 'card-trigger',
    timing: 'immediate',
    severity: options?.severity ?? 'positive',
    recipient: options?.recipient ?? {kind: 'current-player'},
    title,
    description: options?.description,
    params: options?.params,
    source: cardSource(card),
  };
}

/**
 * A STOCK gain/loss the card grants because of this placement, with the real
 * `current → resulting` so the player reads the resulting value, not a bare sign.
 */
export function stockChange(
  player: IPlayer,
  card: ICard,
  resource: Resource,
  amount: number,
  title: string | Message,
  options?: FactOptions): BoardFact {
  const current = player.stock.get(resource);
  return {
    ...baseFact(card, resource, title, options),
    severity: options?.severity ?? (amount >= 0 ? 'positive' : 'warning'),
    delta: {
      icon: resource,
      amount: Math.abs(amount),
      direction: amount >= 0 ? 'gain' : 'cost',
      current,
      resulting: current + amount,
    },
  };
}

/** A PRODUCTION change the card grants because of this placement. */
export function productionChange(
  player: IPlayer,
  card: ICard,
  resource: Resource,
  amount: number,
  title: string | Message,
  options?: FactOptions): BoardFact {
  const current = player.production.get(resource);
  return {
    ...baseFact(card, `${resource}-prod`, title, options),
    severity: options?.severity ?? (amount >= 0 ? 'positive' : 'warning'),
    delta: {
      icon: resource,
      amount: Math.abs(amount),
      direction: amount >= 0 ? 'gain' : 'cost',
      current,
      resulting: current + amount,
      production: true,
    },
  };
}

/** Resources added to a CARD (animals on Pets, microbes, …) — no single pool, so no arrow. */
export function cardResourceGain(
  card: ICard,
  resource: CardResource,
  amount: number,
  title: string | Message,
  options?: FactOptions): BoardFact {
  return {
    ...baseFact(card, resource, title, options),
    delta: {icon: cardResourceIcon(resource), amount, direction: 'gain'},
  };
}

/** A free-form gain chip when the pool isn't a plain `Resource` (TR, cards, …). */
export function gain(
  card: ICard,
  delta: BoardFactDelta,
  title: string | Message,
  options?: FactOptions): BoardFact {
  return {...baseFact(card, delta.icon, title, options), delta};
}

/**
 * The card will ASK something after the placement (Mining Area's steel-or-titanium
 * pick, Neptunian Power Consultants' pay-or-decline). Shown so the player knows a
 * prompt is coming and what it is about — never a silent follow-up modal.
 */
export function upcomingChoice(
  card: ICard,
  title: string | Message,
  options?: FactOptions): BoardFact {
  return {
    ...baseFact(card, 'choice', title, options),
    timing: 'on-confirm',
    severity: options?.severity ?? 'info',
  };
}

/**
 * A RULE / note about what this card's tile will do once it sits on the board
 * (an Ares adjacency bonus it hands to future neighbours, a surcharge it imposes).
 * Not a gain to anyone right now, so it lands in the "Field rules" block.
 */
export function tileRule(
  card: ICard,
  title: string | Message,
  options?: FactOptions & {delta?: BoardFactDelta}): BoardFact {
  return {
    ...baseFact(card, 'rule', title, options),
    timing: 'rule',
    severity: options?.severity ?? 'info',
    recipient: options?.recipient ?? {kind: 'neutral'},
    delta: options?.delta,
  };
}

/** Endgame VP this placement creates for the card's owner. */
export function victoryPoints(
  card: ICard,
  amount: number,
  title: string | Message,
  options?: FactOptions): BoardFact {
  return {
    ...baseFact(card, 'vp', title, options),
    category: 'future-scoring',
    timing: 'endgame',
    severity: options?.severity ?? 'positive',
    vp: {from: 0, to: amount},
  };
}

/**
 * The card's effect does NOT fire on this cell (Mining Guild's bonus needs a
 * steel/titanium neighbourhood; Solar Farm on a plantless area). Stated
 * explicitly — the fork's "no silent loss" rule: a player must never wonder
 * whether the card did nothing or the UI just didn't say.
 */
export function noEffectHere(
  card: ICard,
  title: string | Message,
  options?: FactOptions): BoardFact {
  return {
    ...baseFact(card, 'noop', title, options),
    timing: 'rule',
    severity: 'info',
    recipient: options?.recipient ?? {kind: 'current-player'},
  };
}
