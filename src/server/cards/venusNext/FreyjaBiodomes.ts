import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {SelectCard} from '../../inputs/SelectCard';
import {ICard} from '../ICard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IProjectCard} from '../IProjectCard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class FreyjaBiodomes extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.FREYJA_BIODOMES,
      type: CardType.AUTOMATED,
      tags: [Tag.PLANT, Tag.VENUS],
      cost: 14,

      requirements: {venus: 10},
      victoryPoints: 2,

      behavior: {
        production: {energy: -1, megacredits: 2},
      },

      metadata: {

        infoText: [

          {text: 'Add 2 microbes or 2 animals to another Venus card.', tokens: ['res-microbe']},

          {text: 'Decrease your energy production 1 step and increase your M€ production 2 steps.', tokens: ['production(']},

        ],
        cardNumber: '227',
        renderData: CardRenderer.builder((b) => {
          b.resource(CardResource.MICROBE, {amount: 2, secondaryTag: Tag.VENUS}).or().resource(CardResource.ANIMAL, {amount: 2, secondaryTag: Tag.VENUS}).br;
          b.production((pb) => pb.minus().energy(1).nbsp.plus().megacredits(2));
        }),
        description: {
          text: 'Requires 10% on the Venus track. Add 2 microbes or 2 animals to another Venus card. Production: energy -1, M€ +2.',
          align: 'left',
        },
      },
    });
  }
  public getResCards(player: IPlayer): ICard[] {
    let resourceCards = player.getResourceCards(CardResource.ANIMAL);
    resourceCards = resourceCards.concat(player.getResourceCards(CardResource.MICROBE));
    return resourceCards.filter((card) => card.tags.includes(Tag.VENUS));
  }

  public override bespokePlay(player: IPlayer) {
    const cards = this.getResCards(player);

    if (cards.length === 0) {
      return undefined;
    }

    // Per the fork's no-autoselect principle, ALWAYS ask which card receives the
    // 2 resources — even when only one Venus card is eligible.
    return new SelectCard(
      'Select card to add 2 resources',
      'Add resources',
      cards)
      .andThen(([card]) => {
        player.addResourceTo(card, {qty: 2, log: true});
        return undefined;
      });
  }

  // The declarative production chips + the SAME target picker `bespokePlay` builds,
  // so the 2 resources' destination is chosen inside the play modal. Per the
  // no-autoselect principle the picker shows whenever there's at least one
  // eligible card (even a single candidate). With NO eligible Venus card the 2
  // microbes/animals are silently lost — so the modal WARNS (the no-silent-loss
  // rule; the card is still played for its production). The resource is
  // intentionally unnamed (microbe OR animal — ambiguous here).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.getResCards(player);
    const step = cards.length >= 1 ?
      actionPreviews.selectCardStep(player, 'Select card to add 2 resources', 'Add resources', cards, {amount: 2}) :
      actionPreviews.warningNote('No eligible card — this resource is not added.',
        // No chip: the resources are microbes OR animals (the player's choice of
        // card decides), so no single icon is honest — the label names the effect.
        {skipped: {label: actionPreviews.SKIPPED_LABEL.addToCard}});
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
