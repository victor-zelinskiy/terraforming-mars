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
 */
import {CardName} from '../../../common/cards/CardName';
import {countCardsToward, ResolutionCountId, ResolutionCountModel, RESOLUTION_COUNT_IDS} from '../../../common/parliament/resolutionCounts';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import type {ResolutionCatalog} from './ResolutionCatalog';

function inPlay(card: ICard): boolean {
  return !(card.name === CardName.PHARMACY_UNION && card.isDisabled === true);
}

/** `player`'s count for `id`, with the cards that made it (in play order). */
export function resolutionCount(player: IPlayer, id: ResolutionCountId): ResolutionCountModel {
  return countCardsToward(id, player.tableau.filter(inPlay), {eventTagsInPlay: player.tags.eventTagsInPlay()});
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
