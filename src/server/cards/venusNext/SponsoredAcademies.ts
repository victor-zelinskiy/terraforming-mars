import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {Resource} from '../../../common/Resource';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {DiscardCards} from '../../deferredActions/DiscardCards';
import {CardRenderer} from '../render/CardRenderer';
import {DrawCards} from '../../deferredActions/DrawCards';
import {Card} from '../Card';
import {all, digit} from '../Options';
import {IProjectCard} from '../IProjectCard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class SponsoredAcademies extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SPONSORED_ACADEMIES,
      type: CardType.AUTOMATED,
      tags: [Tag.EARTH, Tag.SCIENCE],
      cost: 9,

      victoryPoints: 1,

      metadata: {

        infoText: [
          {text: 'Discard 1 card from your hand.', tokens: ['cards']},
          {text: 'Draw 3 cards.', tokens: ['cards']},
          {text: 'All opponents draw 1 card.', tokens: ['cards']},
        ],
        cardNumber: '247',
        renderData: CardRenderer.builder((b) => {
          b.minus().cards(1).br;
          b.plus().cards(3, {digit}).asterix().nbsp.plus().cards(1, {all}).asterix();
        }),
        description: 'Discard 1 card from your hand and THEN draw 3 cards. All OPPONENTS draw 1 card.',
      },
    });
  }
  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.cardsInHand.length >= 2;
  }

  // Needs a second card (besides this one) to discard before drawing 3.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.cardsInHand.length < 2) {
      return reason.ruleReason('No card in hand to discard');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new DiscardCards(player), Priority.SPONSORED_ACADEMIES).andThen(() => {});
    player.game.defer(DrawCards.keepAll(player, 3), Priority.SPONSORED_ACADEMIES);
    for (const p of player.opponents) {
      // Automa FAQ (rulebook p.11): "MarsBot gains 1 M€ instead of the free card draw."
      if (p.isMarsBot) {
        p.stock.add(Resource.MEGACREDITS, 1, {log: true});
        continue;
      }
      player.game.defer(DrawCards.keepAll(p));
    }
    return undefined;
  }

  // PRE-COLLECT the "discard 1 card" choice IN the play modal: a −1 card (discard)
  // + +3 cards (draw) RESULT, and the hand-card pick. The live DiscardCards reads
  // the hand AFTER this card has left it → exclude self; with only one card left it
  // AUTO-discards (no prompt), so emit the pick step only when ≥2 remain. The draw
  // of 3 is automatic (hidden cards), shown as the gain chip. Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const hand = player.cardsInHand.filter((c) => c.name !== this.name);
    const discardStep = hand.length > 1 ?
      actionPreviews.selectCardStep(player, 'Select 1 card to discard', 'Discard', hand, {
        // Self rides the disabled channel with the concrete reason, so a
        // picker showing the WHOLE hand never leaves it a mute grey card.
        disabled: [{card: this, reason: 'This card is being played'}],
      }) :
      undefined;
    return actionPreviews.playPreview(this, player, [
      {direction: 'cost', icon: 'cards', amount: 1},
      actionPreviews.drawGain(3),
    ], [discardStep]);
  }
}
