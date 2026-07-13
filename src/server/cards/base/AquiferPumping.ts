import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {CardRenderer} from '../render/CardRenderer';
import {TITLES} from '../../inputs/titles';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export const OCEAN_COST = 8;
export class AquiferPumping extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.AQUIFER_PUMPING,
      tags: [Tag.BUILDING],
      cost: 18,

      metadata: {
        cardNumber: '187',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 8 M€ to place 1 ocean tile. STEEL MAY BE USED as if you were playing a building card.',
            (eb) => eb.megacredits(8).super((b) => b.steel(1)).startAction.oceans(1));
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    const canAct = player.canAfford({cost: OCEAN_COST, steel: true, tr: {oceans: 1}});
    if (!player.game.canAddOcean()) {
      this.addWarning('maxoceans');
    }
    return canAct;
  }
  // Co-located with canAct so the reason can't drift when the gate changes.
  public actionUnavailableReason() {
    return actionReason.notEnoughMC();
  }
  // Spend 8 M€ (steel usable) then place an ocean. When steel is usable the
  // payment is an INTERACTIVE step dialed INSIDE the confirm modal (no separate
  // SelectPayment follow-up); otherwise a flat M€ cost chip. The ocean placement
  // is an after-submit SelectSpace shown as a board-placement note.
  public actionPreview(player: IPlayer) {
    const pay = actionPreviews.paymentStep(player, OCEAN_COST, {canUseSteel: true, title: TITLES.payForCardAction(this.name)});
    const place = actionPreviews.boardPlacementStep('ocean');
    if (pay !== undefined) {
      return actionPreviews.singleBranch(this, player, [pay, place]);
    }
    return actionPreviews.singleBranch(this, player, [place], [
      actionPreviews.stockCost(player, Resource.MEGACREDITS, OCEAN_COST),
    ]);
  }
  public action(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, 8, {canUseSteel: true, title: TITLES.payForCardAction(this.name)}))
      .andThen(() => player.game.defer(new PlaceOceanTile(player)));
    return undefined;
  }
}
