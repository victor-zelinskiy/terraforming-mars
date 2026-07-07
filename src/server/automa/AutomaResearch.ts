import {inplaceShuffle} from '../utils/shuffle';
import {IGame} from '../IGame';
import {AutomaActionCard, AutomaState} from './AutomaState';

/**
 * MarsBot's Research Phase (generation 2+), non-draft variant (rulebook p.4):
 * 3 project cards + 1 bonus card (reshuffling the bonus discard — never the
 * destroyed cards — when the bonus deck is empty) + every recurring card
 * (Government Intervention each generation; Shipping Lines later), shuffled.
 * Brutal: 4 project cards ("keeps all 4 cards it acquires during each Research
 * Phase" — owner-confirmed reading for the non-draft variant too).
 *
 * The draft variant + the Venus floater-spend step arrive in Automa Phase 2.
 */
export class AutomaResearch {
  /** Bonus deck empty → reshuffle the discard pile face down. Destroyed cards live elsewhere. */
  public static reshuffleBonusDeckIfEmpty(game: IGame, automa: AutomaState): void {
    if (automa.bonusDeck.length === 0 && automa.bonusDiscard.length > 0) {
      automa.bonusDeck = automa.bonusDiscard;
      automa.bonusDiscard = [];
      inplaceShuffle(automa.bonusDeck, game.rng);
    }
  }

  public static buildActionDeck(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const projectCount = automa.difficulty === 'brutal' ? 4 : 3;
    const actionDeck: Array<AutomaActionCard> =
      game.projectDeck.drawN(game, projectCount).map((card) => ({kind: 'project' as const, name: card.name}));

    AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
    const topBonus = automa.bonusDeck.shift();
    if (topBonus !== undefined) {
      actionDeck.push({kind: 'bonus', id: topBonus});
    }
    for (const recurring of automa.recurringBonusCards) {
      actionDeck.push({kind: 'bonus', id: recurring});
    }
    inplaceShuffle(actionDeck, game.rng);
    automa.actionDeck = actionDeck;
  }
}
