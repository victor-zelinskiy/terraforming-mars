import {inplaceRemove} from '../../common/utils/utils';
import {Draft} from '../Draft';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {AutomaResearch} from './AutomaResearch';
import {marsBotOf} from './AutomaUtil';

/**
 * The official Automa research draft (rulebook p.4): two piles of 4 cards, the
 * human picks 1 to keep, MarsBot is given 1 from its pile AT RANDOM, the piles
 * swap; repeat until both kept 4. The pile swap is exactly the two-player
 * hand-pass of the standard draft, so this subclasses the engine's Draft and
 * only intercepts MarsBot's picks — the bot answers instantly and randomly
 * (seeded rng), it never receives a prompt.
 *
 * Afterwards: MarsBot's drafted cards are shuffled, 1 is discarded (Brutal
 * keeps all 4; the floater spend keeps the 4th too), a bonus card + the
 * recurring cards are shuffled in — that becomes the action deck. The human
 * chooses which cards to buy, as usual (the standard research flow).
 */
export class AutomaDraft extends Draft {
  constructor(game: IGame) {
    super('standard', game);
  }

  override draw(_player: IPlayer): Array<IProjectCard> {
    // "Draw two piles of 4 cards from the project deck." The in-scope POC
    // modules have no hand-size modifiers for the human (Luna Project Office /
    // Mars Maths are out of scope), so both piles are always 4.
    return this.game.projectDeck.drawN(this.game, 4, 'bottom');
  }

  override cardsToKeep(_player: IPlayer): number {
    return 1;
  }

  override passDirection(): 'before' | 'after' {
    // With exactly two participants "before" and "after" are the same swap.
    return 'after';
  }

  protected override askPlayerToDraft(player: IPlayer, repick: boolean): void {
    if (player.isMarsBot) {
      // A bot pick is final — no repick prompt to refresh.
      if (repick) {
        return;
      }
      const hand = player.draftHand;
      const card = hand[this.game.rng.nextInt(hand.length)];
      player.draftedCards.push(card);
      inplaceRemove(hand, card);
      this.onCardDrafted(player);
      return;
    }
    super.askPlayerToDraft(player, repick);
  }

  override endRound(): void {
    const bot = marsBotOf(this.game);
    const drafted = [...bot.draftedCards] as Array<IProjectCard>;
    bot.draftedCards = [];
    AutomaResearch.finishDraftedActionDeck(this.game, drafted);
    // The human proceeds to the buy step (their drafted cards ride
    // player.draftedCards through runResearchPhase, as in the standard draft).
    this.game.gotoResearchPhase();
  }
}

export function newAutomaDraft(game: IGame) {
  return new AutomaDraft(game);
}
