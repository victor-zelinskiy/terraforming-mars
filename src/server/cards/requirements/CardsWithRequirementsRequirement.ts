import {RequirementType} from '../../../common/cards/RequirementType';
import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {IProjectCard} from '../IProjectCard';
import {ICard} from '../ICard';
import {InequalityRequirement} from './InequalityRequirement';

/**
 * «A CARD WITH A REQUIREMENT» — ONE reading of the phrase: the card prints at
 * least one requirement of ANY kind (a global parameter, a tag, production, a
 * party, the chairman, a rating, …) — its descriptor list is not empty. Whether
 * the player could MEET it right now is not part of the question: the card HAS
 * one or it does not. `hasPartyRequirement` is its subset (the `party` kind).
 *
 * Readers: the count below, P54 Nobel Prize's named search
 * (`Behavior.DrawCard.requirement`), Strategic Shift's candidates, the
 * Tactician milestones, the Forecaster award, the discounts of Cutting Edge
 * Technology and Xavier, the chairman quests' requirement report, and MarsBot
 * (the Forecaster helper, Inventrix's effect and dividend, Mons Insurance's
 * goal). A new reader asks this, never a second inline
 * `requirements.length > 0` — `tests/cards/hasRequirementGuard.spec.ts`.
 */
export function hasRequirement(card: Pick<ICard, 'requirements'>): boolean {
  return card.requirements.length > 0;
}

/**
 * The ONE count of «cards with requirements you have PLAYED» — the requirement
 * below reads it, and so does every surface that explains it (the reason's
 * «now», the composer's requirement row, the inspector).
 *
 * A card counts when it is in the player's `playedCards` and prints a
 * requirement (`hasRequirement` — the descriptor list, the very test
 * Tactician and Forecaster read). EVENTS COUNT: the rule says «played»,
 * and an event that has been played lies in the events pile of the same
 * tableau — never «in play» (the milestone's / award's own wording, which is
 * why THEIR semantics stay theirs and this function is not theirs). Preludes
 * and corporations print no requirement, so they never count. `except` names
 * the card asking («5 OTHER cards with requirements»): before its own play it
 * is not on the table anyway, after it the explanation stays honest.
 */
export function playedCardsWithRequirements(player: IPlayer, except?: CardName): number {
  let count = 0;
  for (const card of player.playedCards) {
    if (card.name !== except && hasRequirement(card)) {
      count++;
    }
  }
  return count;
}

/**
 * «Requires that you have played N other cards with requirements.» (Turmoil
 * Redux — TR68 Political Recognition is the first card to print it: a small
 * card with its own gold MIN plate inside the MIN plate.)
 *
 * The score is `playedCardsWithRequirements(player, card.name)`. The `max`
 * form («no more than N») is the same comparison turned around; no card
 * prints it yet.
 */
export class CardsWithRequirementsRequirement extends InequalityRequirement {
  public readonly type = RequirementType.CARDS_WITH_REQUIREMENTS;
  public getScore(player: IPlayer, card: IProjectCard): number {
    return playedCardsWithRequirements(player, card?.name);
  }
}
