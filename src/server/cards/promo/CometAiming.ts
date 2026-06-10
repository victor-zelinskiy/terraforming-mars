import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {SelectCard} from '../../inputs/SelectCard';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {LogHelper} from '../../LogHelper';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {CardRenderer} from '../render/CardRenderer';
import {Payment} from '../../../common/inputs/Payment';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class CometAiming extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.COMET_AIMING,
      tags: [Tag.SPACE],
      cost: 17,
      resourceType: CardResource.ASTEROID,

      metadata: {
        cardNumber: 'X16',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 1 titanium to add 1 asteroid resource to ANY CARD.', (eb) => {
            eb.titanium(1).startAction.resource(CardResource.ASTEROID).asterix();
          }).br;
          b.or().br;
          b.action('Remove 1 asteroid here to place an ocean.', (eb) => {
            eb.resource(CardResource.ASTEROID).startAction.oceans(1);
          });
        }),
      },
    });
  }

  private canAffordOcean(player: IPlayer) {
    return player.canAfford({cost: 0, tr: {oceans: 1}});
  }

  public canAct(player: IPlayer): boolean {
    if (player.titanium > 0) {
      return true;
    }
    if (this.resourceCount > 0 && this.canAffordOcean(player)) {
      return true;
    }
    return false;
  }

  public actionUnavailableReason() {
    return actionReason.ruleReason('No titanium or asteroid resource to spend');
  }

  // Branch order MUST match action(): place-ocean pushed first (when an
  // asteroid is here and the ocean is affordable), add-asteroid second.
  public actionPreview(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    // Several asteroid-holding cards → action() builds a SelectCard for the
    // target directly; pre-collect it. A single candidate auto-adds to it.
    const pickTarget = asteroidCards.length > 1;
    return actionPreviews.orBranches(this, [
      {
        // The ocean is placed on the board after submit (no pre-collectable step).
        available: this.resourceCount > 0 && this.canAffordOcean(player),
        title: 'Remove an asteroid resource to place an ocean',
        effects: [actionPreviews.cardCost(this, 1)],
        unavailableReason: actionReason.ruleReason('No asteroid here, or you can\'t afford the ocean'),
      },
      {
        // Titanium is paid immediately in the action; only the target card needs
        // pre-collecting (when several candidates) via optionInput.
        available: player.titanium > 0,
        title: 'Spend 1 titanium to add 1 asteroid resource to a card',
        effects: [actionPreviews.stockCost(player, Resource.TITANIUM, 1), actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)],
        optionInput: pickTarget ? actionPreviews.cardInput(player, 'Select card to add 1 asteroid', 'Add asteroid', asteroidCards) : undefined,
        unavailableReason: actionReason.notEnoughTitanium(),
      },
    ]);
  }

  public action(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);

    const addAsteroidToSelf = function() {
      player.pay(Payment.of({titanium: 1}));
      player.addResourceTo(asteroidCards[0], {log: true});
      return undefined;
    };

    const addAsteroidToCard = new SelectCard(
      'Select card to add 1 asteroid',
      'Add asteroid',
      asteroidCards)
      .andThen(([card]) => {
        player.pay(Payment.of({titanium: 1}));
        player.addResourceTo(card, {log: true});
        return undefined;
      });

    const spendAsteroidResource = () => {
      this.resourceCount--;
      LogHelper.logRemoveResource(player, this, 1, 'place an ocean');
      player.game.defer(new PlaceOceanTile(player));
      return undefined;
    };

    if (this.resourceCount === 0) {
      return asteroidCards.length === 1 ? addAsteroidToSelf() : addAsteroidToCard;
    }

    if (player.titanium === 0) {
      return spendAsteroidResource();
    }

    const availableActions = [];

    if (this.canAffordOcean(player)) {
      const placeOceanOption = new SelectOption('Remove an asteroid resource to place an ocean', 'Remove asteroid').andThen(spendAsteroidResource);
      if (!player.game.canAddOcean()) {
        placeOceanOption.warnings = ['maxoceans'];
      }
      availableActions.push(placeOceanOption);
    }

    if (asteroidCards.length === 1) {
      availableActions.push(new SelectOption('Spend 1 titanium to gain 1 asteroid resource', 'Spend titanium').andThen(addAsteroidToSelf));
    } else {
      availableActions.push(addAsteroidToCard);
    }

    if (availableActions.length === 1) {
      const action = availableActions[0];

      if (action instanceof SelectOption) {
        return action.cb(undefined);
      }
      return availableActions[0]; // SelectCard
    }

    return new OrOptions(...availableActions);
  }
}
