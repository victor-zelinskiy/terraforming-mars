/*
 * THE SERVER SIDE of a resolution's counted term (Turmoil Redux): one
 * player's count, read from the cards they have IN PLAY through the shared
 * predicate (`common/parliament/resolutionCounts.ts`). Read-only.
 *
 * «In play» is the player's tableau — corporations, preludes, CEOs, played
 * projects and events — minus a disabled Pharmacy Union (out of the game, the
 * same exception the tag counts make); the hand, the discard and cards hosted
 * elsewhere (Self-Replicating Robots) are not in the tableau at all. Whether a
 * played event's tags are in play is `Tags.eventTagsInPlay`.
 *
 * A TAG count takes its NUMBER from the project's canonical tag counter
 * (`Tags.count(tag, RESOLUTION_TAG_COUNTING_MODE)`) — one mechanism for every
 * source of a tag, including the permanent modifiers no card prints (Leavitt
 * Station's science, Underworld's plants, the Delta Project's jovian) — while
 * the shared predicate supplies the BREAKDOWN that explains it, card by card
 * with its own contribution. `tests/parliament/CentralPowerGrid.spec.ts` pins
 * the two against each other over the corpus, so the explanation can never
 * drift from the number.
 */
import {CardName} from '../../../common/cards/CardName';
import {
  cardCountUnits, countCardsToward, ResolutionCountId, ResolutionCountModel, resolutionCountKind,
  RESOLUTION_COUNT_IDS, RESOLUTION_TAG_COUNTING_MODE,
} from '../../../common/parliament/resolutionCounts';
import {Resource} from '../../../common/Resource';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import type {ResolutionCatalog} from './ResolutionCatalog';

function inPlay(card: ICard): boolean {
  return !(card.name === CardName.PHARMACY_UNION && card.isDisabled === true);
}

/** `player`'s count for `id`, with the cards that made it (in play order). */
export function resolutionCount(player: IPlayer, id: ResolutionCountId): ResolutionCountModel {
  const tableau = player.tableau.filter(inPlay);
  const breakdown = countCardsToward(id, tableau, {eventTagsInPlay: player.tags.eventTagsInPlay()});
  const kind = resolutionCountKind(id);
  if (kind.kind === 'cards') {
    return breakdown;
  }
  // THE CANONICAL NUMBER. The breakdown above is the same rule expressed per
  // card; the counter is the one that also sees a permanent modifier.
  return {...breakdown, count: player.tags.count(kind.tag, RESOLUTION_TAG_COUNTING_MODE)};
}

/** What ONE card of `player`'s tableau contributes to `id` (0 = it does not count). */
export function resolutionCountUnitsOf(player: IPlayer, id: ResolutionCountId, card: ICard): number {
  return inPlay(card) ? cardCountUnits(id, card, {eventTagsInPlay: player.tags.eventTagsInPlay()}) : 0;
}

/**
 * Every PRODUCTION a SEQUENTIAL effect of `catalog` divides («1 card for
 * every 3 steps of heat production»). The seat's model carries exactly these
 * — the inputs of the formulas that exist, and nothing else: a surface that
 * needs the second half of a chained effect reads the same number the server
 * divided by, never a production it happened to find elsewhere.
 */
export function declaredSequelProductions(catalog: ResolutionCatalog): Array<Resource> {
  const out: Array<Resource> = [];
  for (const definition of catalog.all()) {
    for (const effect of definition.scaled ?? []) {
      const total = effect.sequel?.total;
      if (total?.kind === 'production' && !out.includes(total.resource)) {
        out.push(total.resource);
      }
    }
  }
  return out;
}

/** Every count id some resolution of `catalog` declares — what a player's model carries. */
export function declaredCountIds(catalog: ResolutionCatalog): Array<ResolutionCountId> {
  const ids = new Set<ResolutionCountId>();
  for (const definition of catalog.all()) {
    for (const effect of definition.scaled ?? []) {
      if (effect.count !== undefined) {
        ids.add(effect.count.id);
      }
    }
  }
  return RESOLUTION_COUNT_IDS.filter((id) => ids.has(id));
}
