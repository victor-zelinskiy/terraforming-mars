import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {SelectCard} from '../../inputs/SelectCard';
import {Resource} from '../../../common/Resource';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class SoilEnrichment extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.SOIL_ENRICHMENT,
      tags: [Tag.MICROBE, Tag.PLANT],
      cost: 6,

      metadata: {
        description: 'Spend 1 microbe from ANY of your cards to gain 5 plants',
        cardNumber: 'X67',
        renderData: CardRenderer.builder((b) => {
          b.minus().resource(CardResource.MICROBE).asterix().nbsp.plus().plants(5, {digit});
        }),
      },
    });
  }

  private eligibleCards(player: IPlayer) {
    return player.getCardsWithResources(CardResource.MICROBE);
  }

  public override bespokeCanPlay(player: IPlayer) {
    return this.eligibleCards(player).length > 0;
  }

  public override play(player: IPlayer) {
    const cards = this.eligibleCards(player);
    const input = new SelectCard('Select card to remove 1 microbe from', 'Select', cards)
      .andThen(([card]) => {
        player.removeResourceFrom(card);
        player.stock.add(Resource.PLANTS, 5);
        player.game.log('${0} removed 1 microbe from ${1} to gain 5 plants', (b) => b.player(player).card(card));
        return undefined;
      });

    if (cards.length === 1) {
      return input.cb(cards);
    }

    return input;
  }

  // The on-play preview: SoilEnrichment overrides `play()` directly (not
  // `behavior`/`bespokePlay`), so the modal needs an explicit hook. Show the fixed
  // +5 plants result AND the "which card to take a microbe from" target picker —
  // the SAME `SelectCard` `play()` builds, so the pre-collected pick lines up with
  // the live follow-up. A single eligible card auto-resolves in `play()` (no
  // prompt) → no step, exactly like the live path.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.eligibleCards(player);
    const step = cards.length > 1 ?
      actionPreviews.selectCardStep(player, 'Select card to remove 1 microbe from', 'Select', cards, {amount: -1}) :
      undefined;
    return actionPreviews.playPreview(this, player, [actionPreviews.stockGain(player, Resource.PLANTS, 5)], [step]);
  }
}
