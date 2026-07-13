import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {MAX_VENUS_SCALE} from '../../../common/constants';
import {CardName} from '../../../common/cards/CardName';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {max} from '../Options';
import {TITLES} from '../../inputs/titles';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class RotatorImpacts extends Card implements IActionCard {
  constructor() {
    super({
      name: CardName.ROTATOR_IMPACTS,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE],
      cost: 6,
      resourceType: CardResource.ASTEROID,

      requirements: {venus: 14, max},
      metadata: {
        cardNumber: '243',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 6 M€ to add an asteroid resource to this card [TITANIUM MAY BE USED].', (eb) => {
            eb.megacredits(6).super((b) => b.titanium(1)).startAction.resource(CardResource.ASTEROID);
          }).br;
          b.action('Spend 1 resource from this card to increase Venus 1 step.', (eb) => {
            eb.or().resource(CardResource.ASTEROID).startAction.venus(1);
          });
        }),
        description: 'Venus must be 14% or lower',
      },
    });
  }

  private canAddResource(player: IPlayer) {
    return player.canAfford({cost: 6, titanium: true});
  }

  private canSpendResource(player: IPlayer) {
    return this.resourceCount > 0 && player.canAfford({cost: 0, tr: {venus: 1}});
  }

  public canAct(player: IPlayer): boolean {
    if (player.game.getVenusScaleLevel() === MAX_VENUS_SCALE) {
      this.addWarning('maxvenus');
    }
    return this.canAddResource(player) || this.canSpendResource(player);
  }
  public actionUnavailableReason(player: IPlayer) {
    // `canAct` is false ⇒ the ADD branch is unaffordable (else canAct would be
    // true), and the spend branch is moot without a resource — so the concrete
    // blocker is the M€ to add an asteroid (NO "or"-combined reason).
    return actionReason.needMoreMC(player, 6);
  }

  // Branch order MUST match action(): spend-asteroid pushed first, add-asteroid second.
  public actionPreview(player: IPlayer) {
    // The add-asteroid branch pays 6 M€ (titanium usable). When titanium is
    // usable the payment is dialed INSIDE the confirm modal as a step (no
    // separate SelectPayment follow-up); otherwise a flat M€ cost chip.
    const payAdd = actionPreviews.paymentStep(player, 6, {canUseTitanium: true, title: TITLES.payForCardAction(this.name)});
    return actionPreviews.orBranches(this, [
      {
        available: this.canSpendResource(player),
        title: 'Remove 1 asteroid to raise Venus 1 step',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.globalGain(player, 'venus', 1)],
        // SPLIT the combined reason into the SPECIFIC blocker — no "or" guessing.
        unavailableReason: this.resourceCount === 0 ?
          actionReason.ruleReason('No asteroid on this card') :
          actionReason.ruleReason('Can\'t afford the Reds tax'),
      },
      {
        available: this.canAddResource(player),
        title: 'Pay 6 M€ to add 1 asteroid to this card',
        effects: payAdd !== undefined ?
          [actionPreviews.cardGain(this, 1)] :
          [actionPreviews.stockCost(player, Resource.MEGACREDITS, 6), actionPreviews.cardGain(this, 1)],
        steps: payAdd !== undefined ? [payAdd] : [],
        unavailableReason: actionReason.needMoreMC(player, 6),
      },
    ]);
  }

  public action(player: IPlayer) {
    const opts = [];

    const addResource = new SelectOption('Pay 6 M€ to add 1 asteroid to this card', 'Pay').andThen(() => this.addResource(player));
    const spendResource = new SelectOption('Remove 1 asteroid to raise Venus 1 step', 'Remove asteroid').andThen(() => this.spendResource(player));

    if (this.canSpendResource(player)) {
      opts.push(spendResource);
    }

    if (this.canAddResource(player)) {
      opts.push(addResource);
    }

    if (opts.length === 1) {
      return opts[0].cb(undefined);
    }
    return new OrOptions(...opts);
  }

  private addResource(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, 6, {canUseTitanium: true, title: TITLES.payForCardAction(this.name)}));
    player.addResourceTo(this, {log: true});
    return undefined;
  }

  private spendResource(player: IPlayer) {
    player.removeResourceFrom(this);
    player.game.increaseVenusScaleLevel(player, 1);
    player.game.log('${0} removed an asteroid resource to increase Venus scale 1 step', (b) => b.player(player));
    return undefined;
  }
}
