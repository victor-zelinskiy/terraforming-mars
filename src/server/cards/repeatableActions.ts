/*
 * «USE A CARD ACTION THAT HAS BEEN USED THIS GENERATION» — the ONE reading of
 * which played cards may have their action performed AGAIN, shared by every
 * copier in the game.
 *
 * Three consumers ask it today: Viron (the corporation's own action),
 * Project Inspection (the promo event) and the Turmoil Redux resolution R&D
 * Funding (RX26, the law's action). The first two carried a byte-identical
 * private copy of this loop, each headed «This matches Viron.getActionCards»
 * — a comment is not a contract: the day one copy learns a new exclusion the
 * other silently keeps offering the card. There is one loop now, and the two
 * cards' own specs are the proof the move changed nothing.
 *
 * THE FOUR CONDITIONS, in the order upstream wrote them:
 *   1. not the COPIER itself (a card may not copy its own action);
 *   2. the card HAS an action (`isIActionCard`);
 *   3. it is not a loop trap — a card that already stands 2 checks deep
 *      (`getCheckLoops() >= 2`) is excluded, which is how two copiers pointed
 *      at each other terminate;
 *   4. its action was ALREADY USED this generation (that is the whole point —
 *      this is a SECOND use, never a first) AND it can act right now.
 *
 * …AND «RIGHT NOW» IS THE HAND THE ACTION WILL HAVE (the engine fuzz, seed
 * 2078000753 — CI finding #99). A copier played FROM THE HAND (Project
 * Inspection) is still in `cardsInHand` while it is judged playable, while its
 * preview is built and while its own `play()` runs — `Player.playCard` takes
 * it out of the hand only after. An action that needs a card in hand (Ceres
 * Tech Market's discard, Focused Organization, Political Think Tank) then read
 * the copier itself as that card: the list offered an action whose question
 * — «discard 1 card of 0» — nobody can answer, and the engine refused it
 * (`UnanswerableInputError`); with no other candidate the event was playable
 * into a pick with nothing to pick. The hand is judged WITHOUT the copier.
 */
import {IPlayer} from '../IPlayer';
import {IActionCard, ICard, isIActionCard, isIHasCheckLoops} from './ICard';

/**
 * The played cards whose action `player` already used this generation and may
 * perform again. `copier` is the card doing the copying, excluded from its own
 * list; a copier that is not a card in the tableau (the Hydronetwork, a
 * resolution) passes nothing.
 */
export function repeatableActionCards(player: IPlayer, copier?: ICard): Array<IActionCard & ICard> {
  const result: Array<IActionCard & ICard> = [];
  // (The copier on its way out of the hand is set aside for the judgement and put back in its own place — `canAct`
  // takes the player and nothing else, and every reader of this list, the play itself included, sees the same hand.)
  const inHand = copier === undefined ? -1 : player.cardsInHand.findIndex((card) => card === copier);
  const held = inHand === -1 ? [] : player.cardsInHand.splice(inHand, 1);
  try {
    for (const playedCard of player.tableau) {
      if (playedCard === copier) {
        continue;
      }
      if (!isIActionCard(playedCard)) {
        continue;
      }
      if (isIHasCheckLoops(playedCard) && playedCard.getCheckLoops() >= 2) {
        continue;
      }
      if (player.actionsThisGeneration.has(playedCard.name) && playedCard.canAct(player)) {
        result.push(playedCard);
      }
    }
  } finally {
    if (inHand !== -1) {
      player.cardsInHand.splice(inHand, 0, ...held);
    }
  }
  return result;
}
