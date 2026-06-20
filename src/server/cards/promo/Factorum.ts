import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IActionCard} from '../ICard';
import {Resource} from '../../../common/Resource';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {TITLES} from '../../inputs/titles';
import {ICorporationCard} from '../corporation/ICorporationCard';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class Factorum extends CorporationCard implements ICorporationCard, IActionCard {
  constructor() {
    super({
      name: CardName.FACTORUM,
      tags: [Tag.POWER, Tag.BUILDING],
      startingMegaCredits: 37,

      behavior: {
        production: {steel: 1},
      },

      metadata: {
        cardNumber: 'R22',
        description: 'You start with 37 M€. Increase your steel production 1 step.',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(37).nbsp.production((pb) => pb.steel(1));
          // Two SEPARATE action() nodes (with an `or` divider) so the premium
          // Actions overlay splits this into two distinct, individually-activatable
          // rows — and the confirm modal opens directly on the chosen branch instead
          // of falling back to the in-modal branch picker. Mirrors RegolithEaters.
          b.corpBox('action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.action('Increase your energy production 1 step if you have no energy resources.', (eb) => {
              eb.empty().startAction.production((pb) => pb.energy(1)).asterix();
            }).br;
            ce.or().br;
            ce.action('Spend 3 M€ to draw a building card.', (eb) => {
              eb.megacredits(3).startAction.cards(1, {secondaryTag: Tag.BUILDING});
            });
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.energy === 0 || player.canAfford(3);
  }

  public actionUnavailableReason(player: IPlayer) {
    return actionReason.needMoreMC(player, 3);
  }

  // Branch order MUST match action(): increase-energy-production (only with no
  // energy resources) pushed first, draw-a-building-card second.
  public actionPreview(player: IPlayer) {
    return actionPreviews.orBranches(this, [
      {
        available: player.energy === 0,
        title: 'Increase your energy production 1 step',
        effects: [actionPreviews.productionChange(player, Resource.ENERGY, 1)],
        unavailableReason: actionReason.ruleReason('Only available when you have no energy'),
      },
      {
        // The payment for 3 M€ rides the follow-up routing after submit.
        available: player.canAfford(3),
        title: 'Spend 3 M€ to draw a building card',
        effects: [actionPreviews.stockCost(player, Resource.MEGACREDITS, 3), actionPreviews.drawGain(1)],
        unavailableReason: actionReason.needMoreMC(player, 3),
      },
    ]);
  }

  public action(player: IPlayer) {
    const increaseEnergy = new SelectOption(
      'Increase your energy production 1 step',
      'Increase production')
      .andThen(() => {
        player.production.add(Resource.ENERGY, 1, {log: true});
        return undefined;
      });

    const drawBuildingCard = new SelectOption('Spend 3 M€ to draw a building card', 'Draw card')
      .andThen(() => {
        player.game.defer(new SelectPaymentDeferred(player, 3, {title: TITLES.payForCardAction(this.name)}))
          .andThen(() => player.drawCard(1, {tag: Tag.BUILDING}));
        return undefined;
      });

    if (player.energy > 0) {
      return drawBuildingCard;
    }
    if (!player.canAfford(3)) {
      return increaseEnergy;
    }

    return new OrOptions(increaseEnergy, drawBuildingCard);
  }
}
