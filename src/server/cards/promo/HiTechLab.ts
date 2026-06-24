import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CardRenderer} from '../render/CardRenderer';
import {canSpendEnergyForCards, energyForCardsUnavailableReason, spendEnergyForCards} from './energyForCards';
import * as actionPreviews from '../actionPreviews';

export class HiTechLab extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.HI_TECH_LAB,
      tags: [Tag.SCIENCE, Tag.BUILDING],
      cost: 17,
      victoryPoints: 1,

      metadata: {
        cardNumber: 'X04',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend any amount of energy to draw the same number of cards. TAKE 1 INTO HAND AND DISCARD THE REST.', (eb) => {
            eb.text('X').energy(1).startAction.text('X').cards(1).asterix();
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return canSpendEnergyForCards(player);
  }

  public actionUnavailableReason(player: IPlayer) {
    return energyForCardsUnavailableReason(player);
  }

  public actionPreview(player: IPlayer) {
    const max = Math.min(player.energy, player.game.projectDeck.size());
    return actionPreviews.singleBranch(this, player, [
      actionPreviews.amountStep('Select amount of energy to spend', 'OK', 1, max, {
        icon: 'energy', maxByDefault: false, result: {icon: 'cards', perUnit: 1, label: 'Cards drawn'},
      }),
    ], [
      actionPreviews.drawGain(1),
    ], {unavailableReason: energyForCardsUnavailableReason(player)});
  }

  public action(player: IPlayer) {
    return spendEnergyForCards(player);
  }
}
