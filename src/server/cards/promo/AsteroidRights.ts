import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {LogHelper} from '../../LogHelper';
import {SelectCard} from '../../inputs/SelectCard';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardRenderer} from '../render/CardRenderer';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class AsteroidRights extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ASTEROID_RIGHTS,
      tags: [Tag.EARTH, Tag.SPACE],
      cost: 10,
      resourceType: CardResource.ASTEROID,

      behavior: {
        addResources: 2,
      },

      metadata: {
        cardNumber: 'X34',
        description: 'Add 2 asteroids to this card.',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 1 M€ to add 1 asteroid to ANY card.', (eb) => {
            eb.megacredits(1).startAction.resource(CardResource.ASTEROID).asterix().nbsp.or();
          }).br;
          b.action('Spend 1 asteroid here to increase M€ production 1 step OR gain 2 titanium.', (eb) => {
            eb.resource(CardResource.ASTEROID)
              .startAction.production((pb) => pb.megacredits(1))
              .or()
              .titanium(2);
          }).br;
          b.resource(CardResource.ASTEROID, 2);
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.canAfford(1) || this.resourceCount > 0;
  }

  public actionUnavailableReason() {
    return actionReason.ruleReason('Need 1 M€ or an asteroid resource on this card');
  }

  // Branch order MUST match action(): gain-titanium, increase-M€-prod (both
  // gated on having an asteroid here), then add-asteroid (gated on M€).
  public actionPreview(player: IPlayer) {
    const hasAsteroids = this.resourceCount > 0;
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    // With several asteroid-holding cards, action() builds a SelectCard for the
    // target DIRECTLY (a bare return, or as the OrOptions option) — pre-collect it
    // as the branch's optionInput. A single candidate auto-adds to this card.
    const pickTarget = asteroidCards.length > 1;
    return actionPreviews.orBranches(this, [
      {
        available: hasAsteroids,
        title: 'Remove 1 asteroid on this card to gain 2 titanium',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.stockGain(player, Resource.TITANIUM, 2)],
        unavailableReason: actionReason.noResourcesHere(),
      },
      {
        available: hasAsteroids,
        title: 'Remove 1 asteroid on this card to increase M€ production 1 step',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.productionChange(player, Resource.MEGACREDITS, 1)],
        unavailableReason: actionReason.noResourcesHere(),
      },
      {
        // Target card pre-collected via optionInput (when several candidates);
        // the M€ payment rides the follow-up SelectPaymentDeferred after submit.
        available: player.canAfford(1),
        title: 'Add 1 asteroid to this card',
        effects: [actionPreviews.stockCost(player, Resource.MEGACREDITS, 1), actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)],
        optionInput: pickTarget ? actionPreviews.cardInput(player, 'Select card to add 1 asteroid', 'Add asteroid', asteroidCards) : undefined,
        unavailableReason: actionReason.needMoreMC(player, 1),
      },
    ]);
  }

  public action(player: IPlayer) {
    const canAddAsteroid = player.canAfford(1);
    const hasAsteroids = this.resourceCount > 0;
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);

    const gainTitaniumOption = new SelectOption('Remove 1 asteroid on this card to gain 2 titanium', 'Remove asteroid').andThen(() => {
      this.resourceCount--;
      player.titanium += 2;
      LogHelper.logRemoveResource(player, this, 1, 'gain 2 titanium');
      return undefined;
    });

    const increaseMcProdOption = new SelectOption('Remove 1 asteroid on this card to increase M€ production 1 step', 'Remove asteroid').andThen(() => {
      this.resourceCount--;
      player.production.add(Resource.MEGACREDITS, 1);
      LogHelper.logRemoveResource(player, this, 1, 'increase M€ production 1 step');
      return undefined;
    });

    const addAsteroidToSelf = new SelectOption('Add 1 asteroid to this card', 'Add asteroid').andThen(() => {
      player.game.defer(new SelectPaymentDeferred(player, 1, {title: 'Select how to pay for asteroid'}));
      player.addResourceTo(this, {log: true});

      return undefined;
    });

    const addAsteroidOption = new SelectCard('Select card to add 1 asteroid', 'Add asteroid', asteroidCards)
      .andThen(([card]) => {
        player.game.defer(new SelectPaymentDeferred(player, 1, {title: 'Select how to pay for asteroid'}));
        player.addResourceTo(card, {log: true});

        return undefined;
      });

    // Spend asteroid
    if (!canAddAsteroid) {
      return new OrOptions(gainTitaniumOption, increaseMcProdOption);
    }

    // Add asteroid to any card
    if (!hasAsteroids) {
      if (asteroidCards.length === 1) {
        return addAsteroidToSelf.cb(undefined);
      }
      return addAsteroidOption;
    }

    const opts = [];
    opts.push(gainTitaniumOption);
    opts.push(increaseMcProdOption);
    asteroidCards.length === 1 ? opts.push(addAsteroidToSelf) : opts.push(addAsteroidOption);

    return new OrOptions(...opts);
  }
}
