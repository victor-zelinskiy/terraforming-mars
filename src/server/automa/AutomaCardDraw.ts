import {IGame} from '../IGame';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {AutomaHumanTagReactions} from './AutomaHumanTagReactions';
import {AutomaResolver} from './AutomaResolver';
import {marsBotOf} from './AutomaUtil';

/**
 * «MarsBot draws 1 card from the project deck and resolves it immediately» —
 * the ONE implementation of that sentence, shared by every producer of it
 * (B03 Research & Development, the B07 Local Neural Instance fallback, and
 * the Helion white-cube effect). It carries the two dispatches every bot card
 * resolution owes: the active corporation's «when resolving a card» effect and
 * the RB-B-sanctioned human reactors.
 *
 * Returns false only when the project deck AND its discard are exhausted.
 */
export function drawAndResolveProjectCard(game: IGame): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const card = game.projectDeck.draw(game);
  if (card === undefined) {
    return false; // Draw + discard piles fully exhausted — nothing to resolve.
  }
  // The bot PLAYS the card (its tags), it does not "show/reveal" it — reuse the
  // standard "played" log so the journal reads «Бот сыграл …», never «показал».
  game.log('${0} played ${1}', (b) => b.player(marsBotOf(game)).card(card, {tags: true}));
  AutomaCorporations.onProjectCardResolving(game, card);
  AutomaHumanTagReactions.onBotCardResolved(game, card);
  AutomaResolver.resolveProjectCard(game, card);
  automa.playedPile.push(card.name);
  return true;
}
