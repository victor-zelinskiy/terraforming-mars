import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {message} from '../../logs/MessageBuilder';
import {CardResource} from '../../../common/CardResource';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class IcyImpactors extends Card implements IActionCard {
  constructor() {
    super({
      name: CardName.ICY_IMPACTORS,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE],
      cost: 15,
      resourceType: CardResource.ASTEROID,

      metadata: {
        cardNumber: 'X47',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 10 M€ (titanium may be used) to add 2 asteroids here.', (ab) =>
            ab.megacredits(10).super((b) => b.titanium(1)).startAction.resource(CardResource.ASTEROID, 2));
          b.br;
          b.action('Spend 1 asteroid here to place an ocean tile. ' +
            'FIRST PLAYER CHOOSES WHERE YOU MUST PLACE IT.', (ab) =>
            ab.or().resource(CardResource.ASTEROID).startAction.oceans(1).asterix());
        }),
      },
    });
  }
  private canAffordToBuyAsteroids(player: IPlayer) {
    return player.canAfford({cost: 10, titanium: true});
  }
  private canAffordToPlaceOcean(player: IPlayer) {
    return this.resourceCount > 0 && player.canAfford({cost: 0, tr: {oceans: 1}});
  }

  canAct(player: IPlayer): boolean {
    if (this.canAffordToBuyAsteroids(player)) {
      return true;
    }
    if (this.canAffordToPlaceOcean(player)) {
      if (!player.game.canAddOcean()) {
        this.addWarning('maxoceans');
      }
      return true;
    }
    return false;
  }

  actionUnavailableReason() {
    return actionReason.ruleReason('Cannot pay for an asteroid right now');
  }

  // Branch order MUST match action(): place-ocean pushed first, buy-asteroids second.
  public actionPreview(player: IPlayer) {
    return actionPreviews.orBranches(this, [
      {
        // The first player places the ocean on the board after submit (no step).
        available: this.canAffordToPlaceOcean(player),
        title: 'Spend 1 asteroid here to place an ocean (first player chooses where to place it)',
        effects: [actionPreviews.cardCost(this, 1)],
        unavailableReason: this.resourceCount === 0 ?
          actionReason.ruleReason('No asteroid on this card') :
          actionReason.ruleReason('Can\'t afford to place the ocean'),
      },
      {
        // The payment (titanium may be used) rides the follow-up routing.
        available: this.canAffordToBuyAsteroids(player),
        title: 'Spend 10 M€ to add 2 asteroids here',
        effects: [actionPreviews.stockCost(player, Resource.MEGACREDITS, 10), actionPreviews.cardGain(this, 2)],
        unavailableReason: actionReason.needMoreMC(player, 10),
      },
    ]);
  }

  action(player: IPlayer) {
    const options = new OrOptions();

    if (this.canAffordToPlaceOcean(player)) {
      const placeOceanOption = new SelectOption('Spend 1 asteroid here to place an ocean (first player chooses where to place it)').andThen(() => {
        player.removeResourceFrom(this, 1, {log: true});
        player.game.defer(
          new PlaceOceanTile(player.game.first, {
            creditedPlayer: player,
            title: message('Select space for ${0} to place an ocean', (b) => b.player(player)),
          }));
        return undefined;
      });
      if (!player.game.canAddOcean()) {
        placeOceanOption.warnings = ['maxoceans'];
      }
      options.options.push(placeOceanOption);
    }

    if (this.canAffordToBuyAsteroids(player)) {
      options.options.push(
        new SelectOption('Spend 10 M€ to add 2 asteroids here').andThen(() => {
          player.game.defer(new SelectPaymentDeferred(player, 10, {canUseTitanium: true})).andThen(() => {
            player.addResourceTo(this, {qty: 2, log: true});
          });
          return undefined;
        }));
    }

    if (options.options.length === 0) {
      return undefined;
    }
    if (options.options.length === 1) {
      return options.options[0].cb();
    }
    return options;
  }
}
