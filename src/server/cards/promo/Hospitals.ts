import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {SelectCard} from '../../inputs/SelectCard';
import {ICard} from '../ICard';
import {all} from '../Options';
import {Size} from '../../../common/cards/render/Size';
import {ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class Hospitals extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.HOSPITALS,
      cost: 8,
      tags: [Tag.BUILDING],
      resourceType: CardResource.DISEASE,

      behavior: {
        production: {energy: -1},
      },

      victoryPoints: 1,
      metadata: {
        cardNumber: 'X69',
        renderData: CardRenderer.builder((b) => {
          b.effect('Each time a city is placed, gain a disease here.', (eb) => {
            eb.city({size: Size.SMALL, all}).startEffect.resource(CardResource.DISEASE);
          }).br;
          b.action('Remove a disease from ANY OF YOUR CARDS to gain 1 M€ per city in play.', (ab) => {
            ab.resource(CardResource.DISEASE).asterix().startAction.megacredits(1).slash().city({size: Size.SMALL, all});
          }).br;
          b.production((pb) => pb.minus().energy(1));
        }),
        description: {
          text: 'Decrease your energy production 1 step.',
          align: 'left',
        },
      },
    });
  }

  public canAct(player: IPlayer) {
    return player.getResourceCount(CardResource.DISEASE) > 0;
  }

  public onTilePlaced(cardowner: IPlayer, _activePlayer: IPlayer, space: Space) {
    if (Board.isCitySpace(space)) {
      cardowner.addResourceTo(this, {qty: 1, log: true});
    }
  }

  public actionUnavailableReason() {
    return actionReason.targetReason('No disease resources to remove');
  }

  private diseaseCards(player: IPlayer): ReadonlyArray<ICard> {
    return player.getCardsWithResources(CardResource.DISEASE);
  }

  // PRE-COLLECT which card the disease is removed from (the SAME `SelectCard`
  // `action()` builds) inside the confirmation modal; the gain is 1 M€ per city in
  // play. Per the fork's no-autoselect principle the picker shows whenever at least
  // one card holds a disease (even a single candidate), so the player always SEES
  // which card the disease is removed from.
  public actionPreview(player: IPlayer) {
    const cards = this.diseaseCards(player);
    const steps: ReadonlyArray<ActionPreviewStep> = cards.length >= 1 ?
      [actionPreviews.selectCardStep(player, 'Remove a disease from ANY OF YOUR CARD to gain 1M€ per city in play',
        'Choose a card to remove 1 disease.', cards, {amount: -1})] :
      [];
    return actionPreviews.singleBranch(this, player, steps, [
      actionPreviews.stockGain(player, Resource.MEGACREDITS, player.game.board.getCities().length),
    ]);
  }

  public action(player: IPlayer) {
    const diseaseCards = this.diseaseCards(player);
    const game = player.game;

    if (diseaseCards.length === 0) {
      return undefined;
    }

    // Per the no-autoselect principle, ALWAYS ask which card the disease is removed
    // from — even when only one card holds a disease.
    return new SelectCard('Remove a disease from ANY OF YOUR CARD to gain 1M€ per city in play',
      'Choose a card to remove 1 disease.',
      [...diseaseCards])
      .andThen(([card]) => {
        player.removeResourceFrom(card, 1);
        player.stock.add(Resource.MEGACREDITS, (game.board.getCities()).length, {log: true});
        return undefined;
      });
  }
}
