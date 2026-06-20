import {IProjectCard} from '../IProjectCard';
import {IActionCard, ICard} from '../ICard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {SelectCard} from '../../inputs/SelectCard';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {MAX_TEMPERATURE} from '../../../common/constants';
import {LogHelper} from '../../LogHelper';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardRenderer} from '../render/CardRenderer';
import {TITLES} from '../../inputs/titles';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class DirectedImpactors extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DIRECTED_IMPACTORS,
      tags: [Tag.SPACE],
      cost: 8,
      resourceType: CardResource.ASTEROID,

      metadata: {
        cardNumber: 'X19',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 6 M€ to add 1 asteroid to ANY CARD (titanium may be used to pay for this).', (eb) => {
            eb.megacredits(6).super((b) => b.titanium(1)).startAction.resource(CardResource.ASTEROID).asterix();
          }).br;
          b.or().br;
          b.action('Remove 1 asteroid here to raise temperature 1 step.', (eb) => {
            eb.resource(CardResource.ASTEROID).startAction.temperature(1);
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    const cardHasResources = this.resourceCount > 0;
    const canPayForAsteroid = player.canAfford({cost: 6, titanium: true});

    if (player.game.getTemperature() === MAX_TEMPERATURE && cardHasResources) {
      return true;
    }
    if (canPayForAsteroid) {
      return true;
    }

    return player.canAfford({cost: 0, tr: {temperature: 1}}) && cardHasResources;
  }

  public actionUnavailableReason() {
    return actionReason.ruleReason('Cannot pay for an asteroid right now');
  }

  // Branch order MUST match action(): remove-asteroid (raise temperature)
  // pushed first, pay-to-add-asteroid second.
  public actionPreview(player: IPlayer) {
    const temperatureIsMaxed = player.game.getTemperature() === MAX_TEMPERATURE;
    return actionPreviews.orBranches(this, [
      {
        // MUST mirror canAct's disjuncts: with an asteroid you may always remove it
        // when temperature is MAXED (the step is a capped no-op but the action is
        // legal — action() falls through to spendResource), else when you can afford
        // the Reds tax. (A stray `!temperatureIsMaxed` here made canAct=true while
        // BOTH branches read unavailable — which wrongly blocked the action in the
        // normal overlay AND the reuse pick-mode.)
        available: this.resourceCount > 0 && (temperatureIsMaxed || player.canAfford({cost: 0, tr: {temperature: 1}})),
        title: 'Remove 1 asteroid to raise temperature 1 step',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.globalGain(player, 'temperature', 1)],
        unavailableReason: this.resourceCount === 0 ?
          actionReason.ruleReason('No asteroid on this card') :
          actionReason.ruleReason('Can\'t afford the Reds tax'),
      },
      {
        // The payment (titanium may be used) + asteroid target ride the follow-up routing.
        available: player.canAfford({cost: 6, titanium: true}),
        title: 'Pay 6 M€ to add 1 asteroid to a card',
        effects: [actionPreviews.stockCost(player, Resource.MEGACREDITS, 6), actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)],
        unavailableReason: actionReason.needMoreMC(player, 6),
      },
    ]);
  }

  public action(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    const opts = [];

    const addResource = new SelectOption('Pay 6 M€ to add 1 asteroid to a card', 'Pay').andThen(() => this.addResource(player, asteroidCards));
    const spendResource = new SelectOption('Remove 1 asteroid to raise temperature 1 step', 'Remove asteroid').andThen(() => this.spendResource(player));
    const temperatureIsMaxed = player.game.getTemperature() === MAX_TEMPERATURE;

    if (this.resourceCount > 0) {
      if (!temperatureIsMaxed && player.canAfford({cost: 0, tr: {temperature: 1}})) {
        opts.push(spendResource);
      }
    } else {
      return this.addResource(player, asteroidCards);
    }

    if (player.canAfford({cost: 6, titanium: true})) {
      opts.push(addResource);
    } else {
      return this.spendResource(player);
    }

    return new OrOptions(...opts);
  }

  private addResource(player: IPlayer, asteroidCards: ICard[]) {
    player.game.defer(new SelectPaymentDeferred(player, 6, {canUseTitanium: true, title: TITLES.payForCardAction(this.name)}));

    if (asteroidCards.length === 1) {
      player.addResourceTo(this, {log: true});
      return undefined;
    }

    return new SelectCard(
      'Select card to add 1 asteroid',
      'Add asteroid',
      asteroidCards)
      .andThen(([card]) => {
        player.addResourceTo(card, {log: true});
        return undefined;
      });
  }

  private spendResource(player: IPlayer) {
    this.resourceCount--;
    LogHelper.logRemoveResource(player, this, 1, 'raise temperature 1 step');
    player.game.increaseTemperature(player, 1);
    return undefined;
  }
}
