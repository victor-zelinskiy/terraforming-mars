import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IActionCard} from '../ICard';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardResource} from '../../../common/CardResource';
import * as constants from '../../../common/constants';
import {Resource} from '../../../common/Resource';
import {cardSource} from '../../inputs/choiceContext';
import {TITLES} from '../../inputs/titles';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {futilityOf, parameterMaxed} from '../actionFutilities';

const PRINTED_ACTION_COST = 12;

export class VenusShuttles extends Card implements IActionCard {
  constructor() {
    super({
      name: CardName.VENUS_SHUTTLES,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS],
      cost: 9,

      behavior: {
        addResourcesToAnyCard: {
          count: 2,
          tag: Tag.VENUS,
          type: CardResource.FLOATER,
        },
      },

      metadata: {
        cardNumber: 'P89',
        description: 'Add 2 floaters to ANY VENUS CARD.',
        infoText: [{kind: 'action-short', text: 'Raise Venus 1 step: 12 M€, −1 per Venus tag'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 12 M€ to raise Venus 1 step. This cost is REDUCED BY 1 FOR EACH VENUS TAG you have.', (eb) =>
            eb.megacredits(12).text('(').megacredits(-1).slash().tag(Tag.VENUS).text(')').startAction.venus(1)).br;
          b.resource(CardResource.FLOATER, {amount: 2, secondaryTag: Tag.VENUS});
        }),
      },
    });
  }

  private actionCost(player: IPlayer) {
    return Math.max(PRINTED_ACTION_COST - player.tags.count(Tag.VENUS), 0);
  }

  public canAct(player: IPlayer) {
    if (player.game.getVenusScaleLevel() >= player.game.max.venus) {
      this.addWarning('maxvenus');
    }
    return player.canAfford({cost: this.actionCost(player), tr: {venus: 1}});
  }

  // WHY NOT: the M€ shortfall of the SAME request `canAct` checks — the Reds' levy on the step (and on the 16 % rating)
  // inside ONE number, as the standard projects say it.
  public actionUnavailableReason(player: IPlayer) {
    return actionReason.needMoreMCFor(player, {cost: this.actionCost(player), tr: {venus: 1}}) ?? actionReason.notEnoughMC();
  }

  // The action's preview: the payment (a STEP when the live `SelectPaymentDeferred` would ask — Helion's heat; the
  // discounted price chip otherwise: «12 → N» with the counted Venus tags as its basis — the SP1a grammar) and the
  // Venus step (`globalGain` clamps: «30 → 30» at the maximum; the step's rating is implied on the way out).
  public actionPreview(player: IPlayer) {
    const cost = this.actionCost(player);
    const pay = actionPreviews.paymentStep(player, cost, {title: TITLES.payForCardAction(this.name)});
    const venus = actionPreviews.globalGain(player, 'venus', 1);
    if (pay !== undefined) {
      return actionPreviews.singleBranch(this, player, [pay], [venus]);
    }
    const price = actionPreviews.discountedStockCost(player, Resource.MEGACREDITS, PRINTED_ACTION_COST, cost, [actionPreviews.ownTagBasis(player, Tag.VENUS)]);
    return actionPreviews.singleBranch(this, player, [], [price, venus]);
  }

  /** NO EFFECT (`models/actionFutility.ts`): the action's whole result is a Venus step — nothing once Venus is maxed. */
  public actionFutility(player: IPlayer) {
    return futilityOf(parameterMaxed(player, 'venus'));
  }

  public action(player: IPlayer) {
    // The payment's title and cause are the preview step's own: a pre-collected answer is addressed by them.
    player.game.defer(
      new SelectPaymentDeferred(player, this.actionCost(player), {title: TITLES.payForCardAction(this.name), cause: cardSource(this)}))
      .andThen(() => player.game.increaseVenusScaleLevel(player, 1));
    return undefined;
  }
}
