import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IPlayer} from '../../IPlayer';
import {SelectCard} from '../../inputs/SelectCard';
import {Resource} from '../../../common/Resource';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class PublicPlans extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.PUBLIC_PLANS,
      cost: 7,

      victoryPoints: 1,

      metadata: {

        infoText: [

          {text: 'Reveal any number of other cards from your hand (your opponents may inspect them). Gain 1 M€ for each revealed card.', tokens: ['text']},

        ],
        cardNumber: 'X77',
        renderData: CardRenderer.builder((b) => b.text(
          'REVEAL ANY NUMBER OF OTHER CARDS FROM YOUR HAND. (YOUR OPPONENTS MAY INSPECT THEM.) GAIN 1 M€ FOR EACH REVEALED CARD.',
        )),
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    if (player.cardsInHand.length === 0) {
      player.game.log('${0} has no cards to show', (b) => b.player(player));
      return undefined;
    }

    return new SelectCard('Select cards to reveal', 'Reveal', player.cardsInHand, {
      min: 0,
      max: player.cardsInHand.length,
      showSelectAll: true,
    }).andThen((cards) => {
      player.stock.add(Resource.MEGACREDITS, cards.length, {log: true, from: {card: this}});
      if (cards.length > 0) {
        // Mark the public hand-show so opponents get a premium "shown cards"
        // notification + read-only viewer (the names are already public here).
        player.game.log('${0} revealed ${1}', (b) => b.player(player).cards(cards),
          {reveal: {origin: 'hand', result: 'shown', source: this.name}});
        player.game.events?.recordCardReveal(player, this, {origin: 'hand', result: 'shown', count: cards.length});
      }
      return undefined;
    });
  }

  // PRE-COLLECT the "reveal ANY NUMBER of cards from hand" choice IN the play
  // modal. The pick can be large, so it rides a MULTI-select step: the modal hands
  // off to the КАРТЫ В РУКЕ overlay's multi-select mode and shows a COUNT summary
  // (NOT the card list) + a LIVE `+N M€` RESULT chip (1 M€ per revealed card), so
  // the player sees how their M€ changes before the single submit. Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    // The PREVIEW runs while this card is still in hand; the LIVE play reveals
    // from the hand AFTER this card has been removed, so exclude it from the
    // candidate set (otherwise the live SelectCard would reject a pick of itself).
    const hand = player.cardsInHand.filter((c) => c.name !== this.name);
    return actionPreviews.playPreview(this, player, [], [
      actionPreviews.selectCardStep(player, 'Select cards to reveal', 'Reveal', hand, {
        min: 0,
        max: hand.length,
        showSelectAll: true,
        multiSelect: {countLabel: 'Cards to reveal', revealGain: {resource: Resource.MEGACREDITS, amount: 1}},
      }),
    ]);
  }
}
