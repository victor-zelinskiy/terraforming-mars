import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {CardType} from '../../common/cards/CardType';
import {Tag} from '../../common/cards/Tag';
import {Message} from '../../common/logs/Message';
import {Priority} from '../deferredActions/Priority';
import {EventTrigger} from '../../common/events/GameEvent';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {
  EffectForecastAlternative,
  EffectForecastCertainty,
  EffectForecastCondition,
  EffectForecastFact,
  EffectForecastRecipient,
  EffectForecastSource,
  EffectForecastTiming,
} from '../../common/models/EffectForecastModel';
import {BASE_OCEAN_TILES} from '../../common/TileType';
import {EffectForecastTile} from './EffectForecastContext';

/**
 * Thin, stable BUILDERS for the co-located EFFECT FORECAST hooks
 * (`ICard.cardPlayedForecast` / `grantForecast` / `tilePlacedForecast`,
 * `MarsBotCorp.humanCardPlayedForecast`) — the analog of `placementPreviews.ts`
 * for «what will the table do when I play / activate this».
 *
 * WHY a card hook at all. The play preview knows the card's OWN result; it
 * cannot know that Carbon Nanosystems answers a science tag with a graphene,
 * that Olympus Conference will ASK (or silently add its first science), that
 * an opponent's Pharmacy Union takes a disease and loses 4 M€ off a microbe
 * tag. Those are card rules, so their forecast lives in the card — right
 * beside the live hook, reading the SAME predicates, so an upstream change to
 * the card lands in the same diff (the fork's co-location rule).
 *
 * EVERY builder here is READ-ONLY. A hook may look at the played card, the
 * reacting card's own state, the owner's stock and the context; it must never
 * defer, log, add, remove or mutate (guarded by the engine's purity spec).
 *
 * Reasons / conditions / notes are ENGLISH i18n keys (RU in
 * `src/locales/ru/effect_forecast.json`) or `Message`s. The chip vocabulary
 * is the shared `ActionEffect` — build chips with `actionPreviews.stockGain` /
 * `productionChange` / `cardGain` / `trGain` / `drawGain` / … against the
 * RECIPIENT (an opponent's pool is read from the opponent).
 */

/** WHO the fact pays out to — the viewer collapses to `you`. */
export function recipientOf(viewer: IPlayer, owner: IPlayer): EffectForecastRecipient {
  if (owner.id === viewer.id) {
    return {kind: 'you'};
  }
  return owner.isMarsBot ? {kind: 'bot', color: owner.color} : {kind: 'player', color: owner.color};
}

/** The reacting card as a forecast source — kind by the card's own type. */
export function sourceOf(card: ICard, owner: IPlayer, channel: EventTrigger): EffectForecastSource {
  return {
    kind: card.type === CardType.CORPORATION ? 'corporation' : 'card',
    name: card.name,
    owner: owner.color,
    channel,
  };
}

/** A tile the operation places is a PLAIN ocean (the survey / Arctic Algae
 *  mirror of `Board.isUncoveredOceanSpace` — a composite laid over an ocean
 *  does not re-trigger «an ocean was placed»). */
export function placesUncoveredOcean(tile: EffectForecastTile): boolean {
  return tile.tileType !== undefined && BASE_OCEAN_TILES.has(tile.tileType);
}

export type FactOptions = {
  /** Overrides the auto id suffix (`n`) — use when a hook emits several facts. */
  id?: string;
  /** Defaults to `you` (the card's owner IS the actor). A reaction on someone
   *  else's card passes `recipientOf(activePlayer, cardOwner)`. */
  recipient?: EffectForecastRecipient;
  /** Defaults per builder (`exact` → immediate, `asks` → after-card, …). */
  timing?: EffectForecastTiming;
  /** The live hook's declared deferred-queue priority (`Priority`). Only when
   *  the hook states it honestly — the «ПОРЯДОК» band renders on it. */
  sequence?: Priority;
  /** The tag the reason is about (rendered as its icon + name). */
  reasonTag?: Tag;
  condition?: EffectForecastCondition;
  note?: string | Message;
};

let autoId = 0;

function baseFact(
  source: EffectForecastSource,
  certainty: EffectForecastCertainty,
  effects: ReadonlyArray<ActionEffect>,
  reason: string | Message,
  timing: EffectForecastTiming,
  options?: FactOptions): EffectForecastFact {
  autoId = (autoId + 1) % 1_000_000;
  const fact: EffectForecastFact = {
    id: `${source.owner}-${source.name}-${options?.id ?? autoId}`,
    source,
    certainty,
    recipient: options?.recipient ?? {kind: 'you'},
    timing: options?.timing ?? timing,
    effects,
    reason,
  };
  if (options?.sequence !== undefined) {
    fact.sequence = options.sequence;
  }
  if (options?.reasonTag !== undefined) {
    fact.reasonTag = options.reasonTag;
  }
  if (options?.condition !== undefined) {
    fact.condition = options.condition;
  }
  if (options?.note !== undefined) {
    fact.note = options.note;
  }
  return fact;
}

/**
 * The effect FIRES and its result is determined: the chips are what the
 * recipient gets. Timing defaults to `immediate` (a synchronous hook); pass
 * `sequence` + `timing: 'after-card'` for a hook that defers its gain at
 * `Priority.DEFAULT` (after the card's own choices).
 */
export function exact(
  source: EffectForecastSource,
  effects: ReadonlyArray<ActionEffect>,
  reason: string | Message,
  options?: FactOptions): EffectForecastFact {
  return baseFact(source, 'exact', effects, reason, 'immediate', {
    condition: {text: reason, state: 'met'},
    ...options,
  });
}

/**
 * The effect FIRES and opens a QUESTION: `effects` is the FIRST outcome (the
 * one the compact row shows with its «?» badge), `alternatives` the others.
 * A hook that defers at a priority ahead of `Priority.DEFAULT` (Olympus
 * Conference, Pharmacy Union) passes it — the player is asked BEFORE the
 * card's own choices, and the «ПОРЯДОК» band says so.
 */
export function asks(
  source: EffectForecastSource,
  effects: ReadonlyArray<ActionEffect>,
  alternatives: ReadonlyArray<EffectForecastAlternative>,
  reason: string | Message,
  options?: FactOptions): EffectForecastFact {
  const sequence = options?.sequence;
  const timing: EffectForecastTiming = sequence !== undefined && sequence < Priority.DEFAULT ? 'before-card-choices' : 'after-card';
  const fact = baseFact(source, 'asks', effects, reason, timing, {
    condition: {text: reason, state: 'met'},
    note: 'Answer inside this play',
    ...options,
  });
  fact.alternatives = alternatives;
  return fact;
}

/**
 * The effect fires LATER — after the tile lands (`after-placement`), when the
 * cards are drawn (`on-draw`). Chips carry the exact numbers where they do not
 * depend on the cell; a cell-dependent hook passes no chips and a `note`
 * pointing at the cell dossier.
 */
export function deferred(
  source: EffectForecastSource,
  effects: ReadonlyArray<ActionEffect>,
  reason: string | Message,
  options?: FactOptions): EffectForecastFact {
  return baseFact(source, 'deferred', effects, reason, 'after-placement', {
    condition: {text: reason, state: 'met'},
    ...options,
  });
}

/**
 * The effect WOULD fire, but there is nowhere to apply it (Mars University
 * with no other card in hand, a Reds tax the owner cannot pay). The chips name
 * the magnitude that is lost; the reason says why.
 */
export function skipped(
  source: EffectForecastSource,
  effects: ReadonlyArray<ActionEffect>,
  reason: string | Message,
  options?: FactOptions): EffectForecastFact {
  return baseFact(source, 'skipped', effects, reason, 'immediate', {
    condition: {text: reason, state: 'unmet'},
    ...options,
  });
}

/**
 * An «ALMOST»: the tag matches but the condition does not (a space card that
 * is not an event for Optimal Aerobraking, a non-positive VP icon for Vitor),
 * or the non-firing sibling effect of a card that fires. Never emitted for a
 * card the play does not touch at all — the whole table is never enumerated.
 */
export function no(
  source: EffectForecastSource,
  reason: string | Message,
  options?: FactOptions): EffectForecastFact {
  return baseFact(source, 'no', [], reason, 'immediate', {
    condition: {text: reason, state: 'unmet'},
    ...options,
  });
}

/**
 * A fact that depends on WHICH branch the player picks in this composer
 * (emitted by the ENGINE into `byBranch`; a hook never decides the branch).
 */
export function conditional(
  source: EffectForecastSource,
  effects: ReadonlyArray<ActionEffect>,
  reason: string | Message,
  branchPos: number,
  options?: FactOptions): EffectForecastFact {
  return baseFact(source, 'conditional', effects, reason, 'immediate', {
    condition: {text: reason, state: 'depends', branchPos},
    ...options,
  });
}

/**
 * A card that HAS a live hook but no forecast for it — the honest «сработает,
 * результат не рассчитан». Emitted by the engine only; a card file never
 * says «unknown» about itself (it either forecasts or it does not exist).
 */
export function unknown(
  source: EffectForecastSource,
  reason: string | Message,
  options?: FactOptions): EffectForecastFact {
  return baseFact(source, 'unknown', [], reason, 'unknown', {
    note: 'Not calculated',
    ...options,
  });
}

/** «Sequence» convenience: the live hook deferred at `Priority.DEFAULT` after
 *  the card's own action — the fact lands AFTER the card's choices. */
export const AFTER_CARD: Pick<FactOptions, 'sequence' | 'timing'> = {sequence: Priority.DEFAULT, timing: 'after-card'};

/**
 * The priority a tile trigger's payout is deferred at: `Priority.OPPONENT_TRIGGER`
 * when it pays somebody OTHER than the acting player (the override every
 * tile hook passes to `game.defer`), else the deferred action's OWN priority —
 * `GainResourcesDeferred` / `GainProduction` / `AddResourcesToCard` all sit
 * at `Priority.GAIN_RESOURCE_OR_PRODUCTION`, so that is the default; a hook
 * that mutates synchronously passes `Priority.DEFAULT` (the placement's own
 * moment) itself.
 */
export function triggerSequence(cardOwner: IPlayer, activePlayer: IPlayer, own: Priority = Priority.GAIN_RESOURCE_OR_PRODUCTION): Priority {
  return cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : own;
}

/** A gain deferred through `GainResourcesDeferred` — it lands after the card's
 *  own choices AND after every `Priority.DEFAULT` prompt of the same play. */
export const AFTER_CARD_GAIN: Pick<FactOptions, 'sequence' | 'timing'> = {sequence: Priority.GAIN_RESOURCE_OR_PRODUCTION, timing: 'after-card'};

/**
 * THE REASON A TAG HOOK GIVES — one i18n key PER TAG, in the player's own
 * grammar («Вы играете карту с меткой науки»), never the machine-built
 * «с меткой Наука» a `${0}` parameter produced. The twelve tags of the
 * premium scope are named; a tag outside it (wild, clone, the Moon / Mars /
 * crime families) keeps the parameterised sentence, filled from `reasonTag`
 * on the client, so nothing ever renders blank.
 */
const OWN_TAG_REASON: Partial<Record<Tag, string>> = {
  [Tag.BUILDING]: 'You play a card with a building tag',
  [Tag.SPACE]: 'You play a card with a space tag',
  [Tag.SCIENCE]: 'You play a card with a science tag',
  [Tag.POWER]: 'You play a card with a power tag',
  [Tag.EARTH]: 'You play a card with an Earth tag',
  [Tag.JOVIAN]: 'You play a card with a Jovian tag',
  [Tag.VENUS]: 'You play a card with a Venus tag',
  [Tag.PLANT]: 'You play a card with a plant tag',
  [Tag.MICROBE]: 'You play a card with a microbe tag',
  [Tag.ANIMAL]: 'You play a card with an animal tag',
  [Tag.CITY]: 'You play a card with a city tag',
  [Tag.EVENT]: 'You play a card with an event tag',
};
const ANY_TAG_REASON: Partial<Record<Tag, string>> = {
  [Tag.BUILDING]: 'Any player plays a card with a building tag',
  [Tag.SPACE]: 'Any player plays a card with a space tag',
  [Tag.SCIENCE]: 'Any player plays a card with a science tag',
  [Tag.POWER]: 'Any player plays a card with a power tag',
  [Tag.EARTH]: 'Any player plays a card with an Earth tag',
  [Tag.JOVIAN]: 'Any player plays a card with a Jovian tag',
  [Tag.VENUS]: 'Any player plays a card with a Venus tag',
  [Tag.PLANT]: 'Any player plays a card with a plant tag',
  [Tag.MICROBE]: 'Any player plays a card with a microbe tag',
  [Tag.ANIMAL]: 'Any player plays a card with an animal tag',
  [Tag.CITY]: 'Any player plays a card with a city tag',
  [Tag.EVENT]: 'Any player plays a card with an event tag',
};

/** «You play a card with a <tag> tag» — the OWNER's own play. */
export function tagReason(tag: Tag): string {
  return OWN_TAG_REASON[tag] ?? 'You play a card with a ${0} tag';
}

/** «Any player plays a card with a <tag> tag» — a `card-played-by-any` hook. */
export function anyPlayerTagReason(tag: Tag): string {
  return ANY_TAG_REASON[tag] ?? 'Any player plays a card with a ${0} tag';
}
