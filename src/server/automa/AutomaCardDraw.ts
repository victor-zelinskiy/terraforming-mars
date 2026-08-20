import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {newProjectCard} from '../createCard';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {AutomaHumanTagReactions} from './AutomaHumanTagReactions';
import {AutomaResearch} from './AutomaResearch';
import {AutomaResolver} from './AutomaResolver';
import {resolveBonusCard, routeBonusCard} from './AutomaBonusCards';
import {AutomaTurnLog} from './AutomaTurnLog';
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
  const card = game.projectDeck.draw(game);
  if (card === undefined) {
    return false; // Draw + discard piles fully exhausted — nothing to resolve.
  }
  resolveProjectCardForBot(game, card);
  return true;
}

/**
 * Resolve a project card the bot ALREADY holds (it came off the project deck,
 * or out of the bonus deck a corporation seeded — C07). Carries the same two
 * dispatches and the same journal voice as a fresh draw.
 */
export function resolveProjectCardForBot(game: IGame, card: IProjectCard): void {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  // The bot PLAYS the card (its tags), it does not "show/reveal" it — reuse the
  // standard "played" log so the journal reads «Бот сыграл …», never «показал».
  game.log('${0} played ${1}', (b) => b.player(marsBotOf(game)).card(card, {tags: true}));
  AutomaCorporations.onProjectCardResolving(game, card);
  AutomaHumanTagReactions.onBotCardResolved(game, card);
  AutomaResolver.resolveProjectCard(game, card);
  automa.playedPile.push(card.name);
}

/**
 * «MarsBot draws and resolves a card from the BONUS deck» (C07 Phobolog's
 * white cubes) — the deck may hold PROJECT cards a corporation shuffled in, so
 * the drawn entry is resolved according to its own kind: a bonus card runs its
 * effect and is routed to its pile, a project card is played like any other.
 * Reshuffles the discard first, exactly like every other bonus-deck draw.
 *
 * Returns false only when the bonus deck and its discard are both empty.
 */
export function drawAndResolveBonusDeckCard(game: IGame): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
  const entry = automa.bonusDeck.shift();
  if (entry === undefined) {
    return false;
  }
  if (entry.kind === 'bonus') {
    AutomaTurnLog.setBonusSecondary(game, entry.id);
    const outcome = resolveBonusCard(game, entry.id);
    routeBonusCard(game, entry.id, outcome);
    return true;
  }
  const card = newProjectCard(entry.name);
  if (card === undefined) {
    return false; // A card this build no longer knows (a very old save).
  }
  resolveProjectCardForBot(game, card);
  return true;
}
