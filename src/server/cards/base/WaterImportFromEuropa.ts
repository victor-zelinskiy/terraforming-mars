import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardRenderer} from '../render/CardRenderer';
import {TITLES} from '../../inputs/titles';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

const ACTION_COST = 12;
export class WaterImportFromEuropa extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.WATER_IMPORT_FROM_EUROPA,
      tags: [Tag.JOVIAN, Tag.SPACE],
      cost: 25,

      victoryPoints: {tag: Tag.JOVIAN},

      metadata: {
        cardNumber: '012',
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 12 M€ to place an ocean tile. TITANIUM MAY BE USED as if playing a space card.', (eb) => {
            eb.megacredits(12).super((b) => b.titanium(1)).startAction.oceans(1);
          }).br;
          b.vpText('1 VP for each Jovian tag you have.');
        }),
      },
    });
  }
  public canAct(player: IPlayer): boolean {
    return player.canAfford({cost: ACTION_COST, titanium: true, tr: {oceans: 1}});
  }
  public actionUnavailableReason() {
    return actionReason.notEnoughMC();
  }
  // Pay 12 M€ (titanium usable) then place an ocean. When titanium is usable the
  // payment is an INTERACTIVE step (the player dials M€/titanium INSIDE the
  // confirm modal — no separate SelectPayment follow-up); otherwise it's a flat
  // M€ cost chip. The ocean placement is an after-submit SelectSpace shown as a
  // board-placement note.
  public actionPreview(player: IPlayer) {
    const pay = actionPreviews.paymentStep(player, ACTION_COST, {canUseTitanium: true, title: TITLES.action});
    const place = actionPreviews.boardPlacementStep('ocean');
    if (pay !== undefined) {
      return actionPreviews.singleBranch(this, player, [pay, place]);
    }
    return actionPreviews.singleBranch(this, player, [place], [
      actionPreviews.stockCost(player, Resource.MEGACREDITS, ACTION_COST),
    ]);
  }
  public action(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, ACTION_COST, {canUseTitanium: true, title: TITLES.action}))
      .andThen(() => player.game.defer(new PlaceOceanTile(player)));
    return undefined;
  }
}
