import {CardName} from '../../../common/cards/CardName';
import {ICard} from '../ICard';
import {IGame} from '../../IGame';
import {PartyName} from '../../../common/turmoil/PartyName';

/**
 * «A CARD WITH A PARTY REQUIREMENT» — ONE reading of the phrase, for every
 * rule that names it.
 *
 * The printed phrase means a requirement of the `party` kind — «Requires that
 * Mars First is ruling or that you have 2 delegates there» — for ANY party.
 * Nothing else the political engine can require is one: being the chairman
 * (`chairman`, TR12), party leaders (`partyLeader`), delegates on resolutions
 * (`delegatesOnResolutions`, TR02) and influence (`influence`, TR04) are their
 * own kinds. Whether the player could MEET the requirement right now is not
 * part of the question either: the card HAS one or it does not. Event cards
 * count like any other (the Redux rulebook's Politologist award spells that
 * out: «cards with a party requirement (Event cards count)»).
 *
 * Readers: High Circles (draw a card with a party requirement), Turmoil Redux
 * TR13 Political Think Tank (keep the revealed card if it has one), and the
 * future Politologist award — never a second inline lambda.
 */
export function hasPartyRequirement(card: Pick<ICard, 'requirements'>): boolean {
  return card.requirements.some((r) => r.party !== undefined);
}

/** The party the card requires (its first `party` requirement), if it requires one. */
export function requiredPartyOf(card: Pick<ICard, 'requirements'>): PartyName | undefined {
  return card.requirements.find((r) => r.party !== undefined)?.party;
}

/**
 * HOW MANY CARDS WITH A PARTY REQUIREMENT THIS GAME HOLDS — the composition of
 * the game's project cards, wherever each one stands right now: the deck, the
 * discard pile, every hand (and every research / draft pool), every tableau.
 *
 * OPEN INFORMATION ABOUT THE SET, never a hint about the hidden deck: the
 * number answers «can this check ever succeed in this game?» and deliberately
 * NOT «how many are still in the draw pile» — that second number would be a
 * peek at the deck's order the rules never grant. Counted by NAME, so a card
 * that two pools momentarily share (a draft hand and a dealt list) is one card.
 *
 * Pure read: nothing here touches the game.
 */
export function partyRequirementCardsInGame(game: IGame): number {
  const seen = new Set<CardName>();
  const visit = (card: ICard) => {
    if (hasPartyRequirement(card)) {
      seen.add(card.name);
    }
  };
  game.projectDeck.drawPile.forEach(visit);
  game.projectDeck.discardPile.forEach(visit);
  for (const player of game.players) {
    player.cardsInHand.forEach(visit);
    player.dealtProjectCards.forEach(visit);
    player.draftedCards.forEach(visit);
    player.draftHand.forEach(visit);
    player.removedFromPlayCards.forEach(visit);
    player.tableau.asArray().forEach(visit);
  }
  return seen.size;
}
