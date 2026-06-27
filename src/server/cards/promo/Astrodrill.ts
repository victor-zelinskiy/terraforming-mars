import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {IActionCard} from '../ICard';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCard} from '../../inputs/SelectCard';
import {OrOptions} from '../../inputs/OrOptions';
import {LogHelper} from '../../LogHelper';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class Astrodrill extends CorporationCard implements ICorporationCard, IActionCard {
  constructor() {
    super({
      name: CardName.ASTRODRILL,
      tags: [Tag.SPACE],
      startingMegaCredits: 35,
      resourceType: CardResource.ASTEROID,

      behavior: {
        addResources: 3,
      },

      metadata: {
        cardNumber: 'R21',
        description: 'You start with 35 M€ and 3 asteroid resources.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(35).nbsp.resource(CardResource.ASTEROID, {amount: 3, digit});
          b.corpBox('action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.action(undefined, (eb) => {
              eb.empty().startAction.resource(CardResource.ASTEROID).asterix().slash().wild(1).or();
            });
            ce.vSpace();
            ce.action('Add an asteroid resource to ANY card OR gain any standard resource, OR remove an asteroid resource from this card to gain 3 titanium.', (eb) => {
              eb.resource(CardResource.ASTEROID).startAction.titanium(3, {digit});
            });
          });
        }),
      },
    });
  }

  public canAct(): boolean {
    return true;
  }

  // Branch order MUST match action(): remove-asteroid (when one is here) pushed
  // first, add-asteroid second, gain-standard-resource third. action() always
  // returns an OrOptions (add + gain are always offered), so disable auto-resolve.
  public actionPreview(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    // action() ALWAYS builds a SelectCard for the target (even one candidate, this
    // card) — pre-collect it whenever there's a candidate; never auto-add silently.
    const pickTarget = asteroidCards.length >= 1;
    return actionPreviews.orBranches(this, [
      {
        available: this.resourceCount > 0,
        title: 'Remove 1 asteroid on this card to gain 3 titanium',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.stockGain(player, Resource.TITANIUM, 3)],
        unavailableReason: actionReason.noResourcesHere(),
      },
      {
        // Target card pre-collected via optionInput (always — even a single candidate).
        available: true,
        title: 'Add 1 asteroid to a card',
        effects: [actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)],
        optionInput: pickTarget ? actionPreviews.cardInput(player, 'Select card to add 1 asteroid', 'Add asteroid', asteroidCards) : undefined,
      },
      {
        // Picking WHICH standard resource is a nested OrOptions that rides the
        // follow-up routing after submit.
        available: true,
        title: 'Gain a standard resource',
      },
    ], {autoResolveSingle: false});
  }

  public action(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    const opts = [];

    const gainStandardResource = new SelectOption('Gain a standard resource', 'Gain').andThen(() => {
      return new OrOptions(
        new SelectOption('Gain 1 titanium', 'Gain titanium').andThen(() => {
          player.stock.add(Resource.TITANIUM, 1, {log: true});
          return undefined;
        }),
        new SelectOption('Gain 1 steel', 'Gain steel').andThen(() => {
          player.stock.add(Resource.STEEL, 1, {log: true});
          return undefined;
        }),
        new SelectOption('Gain 1 plant', 'Gain plant').andThen(() => {
          player.stock.add(Resource.PLANTS, 1, {log: true});
          return undefined;
        }),
        new SelectOption('Gain 1 energy', 'Gain energy').andThen(() => {
          player.stock.add(Resource.ENERGY, 1, {log: true});
          return undefined;
        }),
        new SelectOption('Gain 1 heat', 'Gain heat').andThen(() => {
          player.stock.add(Resource.HEAT, 1, {log: true});
          return undefined;
        }),
        new SelectOption('Gain 1 M€', 'Gain M€').andThen(() => {
          player.stock.add(Resource.MEGACREDITS, 1, {log: true});
          return undefined;
        }),
      );
    });

    const addResource = new SelectCard(
      'Select card to add 1 asteroid',
      'Add asteroid',
      asteroidCards)
      .andThen(([card]) => {
        player.addResourceTo(card, {log: true});
        return undefined;
      });

    const spendResource = new SelectOption('Remove 1 asteroid on this card to gain 3 titanium', 'Remove asteroid').andThen(() => {
      // removeResourceFrom + stock.add (NOT raw `resourceCount--` / `titanium +=`) so
      // BOTH the asteroid spend AND the titanium gain are recorded as GameEvents and
      // show in the journal. log:false — LogHelper logs the single combined message.
      player.removeResourceFrom(this, 1, {log: false});
      player.stock.add(Resource.TITANIUM, 3);
      LogHelper.logRemoveResource(player, this, 1, 'gain 3 titanium');

      return undefined;
    });

    if (this.resourceCount > 0) {
      opts.push(spendResource);
    }
    // ALWAYS a SelectCard for the asteroid target — even a single candidate (this
    // card) — so the player SEES where it goes (no silent auto-add-to-self).
    opts.push(addResource);
    opts.push(gainStandardResource);

    return new OrOptions(...opts);
  }
}
