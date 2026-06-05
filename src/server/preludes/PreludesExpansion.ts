import {inplaceRemove} from '../../common/utils/utils';
import {Resource} from '../../common/Resource';
import {CardAction, IPlayer} from '../IPlayer';
import {IPreludeCard} from '../cards/prelude/IPreludeCard';
import {SelectCard} from '../inputs/SelectCard';

export class PreludesExpansion {
  public static fizzle(player: IPlayer, card: IPreludeCard): void {
    player.game.log('${0} fizzled. ${1} gains 15 M€.', (b) => b.card(card).player(player));
    player.stock.add(Resource.MEGACREDITS, 15);
    player.defer(() => {
      // This is deferred because it is possible for the parent card to
      // be moved from hand to play area. So, wait until this action finishes and
      // then follow up with cleanup.
      inplaceRemove(player.preludeCardsInHand, card);
      player.playedCards.remove(card);
      player.game.preludeDeck.discard(card);
    });
  }

  /**
   * Return a `SelectCard` that asks a `player` to choose one of the `cards` to play,
   * and then plays it.
   */
  public static selectPreludeToPlay(
    player: IPlayer,
    cards: Array<IPreludeCard>,
    remainders: undefined | 'discard' = undefined,
    cardAction: CardAction = 'add'): SelectCard<IPreludeCard> {
    // This preps the warning attribute in preludes.
    // All preludes can be presented. Unplayable ones just fizzle.
    for (const card of cards) {
      card.warnings.clear();
      if (!card.canPlay(player)) {
        card.warnings.add('preludeFizzle');
      }
      if (card.behavior?.addResources && player.game.inDoubleDown) {
        card.warnings.add('ineffectiveDoubleDown');
      }
    }

    // 'hand' = the player's own starting preludes (Player.takeAction plays them
    // one at a time); 'draw' = freshly drawn preludes where the player picks ONE
    // and the rest are discarded (New Partner / Valley Trust); 'copy' = pick one
    // ALREADY-PLAYED prelude to copy (Double Down, `cardAction === 'double-down'`)
    // — the source stays in play, nothing is discarded, so the premium modal must
    // NOT drop it from the grid. Authoritative on the server, so the modal never
    // has to guess (and `cardAction` is the only reliable signal for 'copy' —
    // Double Down's candidates are played preludes, but can include New Partner
    // from the hand, so a cards-vs-hand check would misclassify it).
    const preludeMode: 'hand' | 'draw' | 'copy' =
      cardAction === 'double-down' ?
        'copy' :
        (cards.every((c) => player.preludeCardsInHand.includes(c)) ? 'hand' : 'draw');
    return new SelectCard(
      'Select prelude card to play', 'Play', cards)
      .markStartGamePrompt({kind: 'preludeSelection', preludeMode})
      .andThen(([card]) => {
        if (card.canPlay?.(player) === false) {
          PreludesExpansion.fizzle(player, card);
        } else {
          if (cardAction === 'double-down') {
            player.game.doubleDownPrelude = card.name;
          }
          player.playCard(card, undefined, cardAction);
        }
        if (remainders === 'discard') {
          for (const c of cards) {
            if (c !== card) {
              player.game.preludeDeck.discard(c);
            }
          }
        }
        return undefined;
      });
  }
}
