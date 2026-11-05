import {Tag} from '../../common/cards/Tag';
import {CardType} from '../../common/cards/CardType';
import {ICard} from './ICard';

/**
 * «A CARD THAT HAS NO TAG» AS A SEARCH RULE — ONE reading of the phrase for the deck search that names it (PC03
 * Sagitta Frontier Services: «Draw a card that has no tag»; `Behavior.DrawCard.noTags`).
 *
 * The search keeps a card with NO PRINTED TAG AT ALL that is not an event: an event's own tag is a tag, and a printed
 * wild tag is a printed tag (the upstream filter `c.tags.length === 0 && c.type !== EVENT`, pinned by the upstream
 * spec «the drawn card's tags have length 0»).
 *
 * ⚠ NOT the same reading as the COUNT of «cards with no tags» (`Tags.numberOfCardsWithNoTags` — Community Services,
 * the rail's «без меток» cell) and Sagitta's own EFFECT (`SagittaFrontierServices.tagsCounted`): there a wild tag is
 * IGNORED («more cards without tags is better»). The two part on exactly one card shape — a card whose only tag is a
 * wild one: the search throws it away, the effect pays it as a card with no tags. Both are upstream rules; neither is
 * folded into the other.
 */
export function hasNoPrintedTags(card: Pick<ICard, 'tags' | 'type'>): boolean {
  return tagsBarringNoTagsSearch(card).length === 0;
}

/**
 * WHY the search threw a card away — the tags it carries, in the order the reveal names them: the event's own tag
 * first (an event is never «a card with no tag»), then every printed tag, the wild one included. Empty = the card is
 * kept. Read by the search's own filter (`DrawCards`), so the verdict and the decision cannot disagree.
 */
export function tagsBarringNoTagsSearch(card: Pick<ICard, 'tags' | 'type'>): Array<Tag> {
  const out: Array<Tag> = card.type === CardType.EVENT ? [Tag.EVENT] : [];
  for (const tag of card.tags) {
    if (!out.includes(tag)) {
      out.push(tag);
    }
  }
  return out;
}
