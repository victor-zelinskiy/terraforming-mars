import {Tag} from '../../common/cards/Tag';
import {CardType} from '../../common/cards/CardType';
import {CardResource} from '../../common/CardResource';
import {DrawSearchModel} from '../../common/models/CardDrawRevealModel';
import {DeckSearchFact} from '../../common/events/EventImpact';
import {ICard} from '../cards/ICard';
import {IPlayer} from '../IPlayer';

/**
 * The FILTERS a draw can carry, in the DSL's own names (`Behavior.DrawCard`;
 * `DrawOptions` spells the type `cardType` and maps onto this).
 */
export type DrawSearchFilter = {
  tag?: Tag,
  type?: CardType,
  resource?: CardResource,
  withoutTags?: ReadonlyArray<Tag>,
};

/**
 * THE SEARCH'S RULE as ONE descriptor (`DrawSearchModel`) — the only place a
 * filtered draw becomes data for a surface. Asked by the search that performs
 * it (`DrawCards` → the reveal), by the declarative preview (the composer's
 * draw chip) and by the structured-text generator, so the three cannot name
 * three rules.
 *
 * `undefined` for a plain draw — nothing is searched for. An opaque `include`
 * predicate is not a filter this can describe; its card names it in prose.
 */
export function drawSearchOf(count: number, filter: DrawSearchFilter | undefined): DrawSearchModel | undefined {
  if (filter === undefined) {
    return undefined;
  }
  const withoutTags = filter.withoutTags !== undefined && filter.withoutTags.length > 0 ? [...filter.withoutTags] : undefined;
  if (filter.tag === undefined && filter.type === undefined && filter.resource === undefined && withoutTags === undefined) {
    return undefined;
  }
  const search: DrawSearchModel = {count};
  if (filter.tag !== undefined) {
    search.tag = filter.tag;
  }
  if (filter.type !== undefined) {
    search.type = filter.type;
  }
  if (filter.resource !== undefined) {
    search.resource = filter.resource;
  }
  if (withoutTags !== undefined) {
    search.withoutTags = withoutTags;
  }
  return search;
}

/**
 * THE SEARCH AS A JOURNAL FACT (`deck-searched`, PL-033) — what the search
 * that just ran did, off its own lists: the rule (the same descriptor as
 * above, absent for an opaque `include`), every card it turned over, the
 * ones it kept, the ones it threw away BY NAME (in reveal order), and
 * whether the deck ran out. Nothing is re-derived: `revealed` is the
 * sequence's length, `discarded` its unmatched steps.
 */
export function deckSearchFactOf(
  rule: DrawSearchModel | undefined,
  sequence: ReadonlyArray<{card: ICard, matched: boolean}>,
  kept: number,
  exhausted: boolean,
): DeckSearchFact {
  const fact: DeckSearchFact = {
    revealed: sequence.length,
    kept,
    discarded: sequence.filter((step) => !step.matched).map((step) => step.card.name),
  };
  if (rule !== undefined) {
    fact.rule = rule;
  }
  if (exhausted) {
    fact.exhausted = true;
  }
  return fact;
}

/**
 * The tags of `withoutTags` this card carries — the ones that throw it away,
 * in the rule's order. ONE reader with the positive filter
 * (`Tags.cardHasTag`: the printed tags, Habitat Marte's Mars-as-Science, an
 * event's own tag; a printed WILD tag is none of them). Empty = the card is
 * clean.
 */
export function forbiddenTagsOn(player: IPlayer, card: ICard, withoutTags: ReadonlyArray<Tag> | undefined): Array<Tag> {
  if (withoutTags === undefined) {
    return [];
  }
  return withoutTags.filter((tag) => player.tags.cardHasTag(card, tag));
}
