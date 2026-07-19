import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IColony} from '../../colonies/IColony';
import {ColonyName} from '../../../common/colonies/ColonyName';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';
import {ColonyBenefit} from '../../../common/colonies/ColonyBenefit';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {ActionPreview, ActionEffect, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

const STANDARD_RESOURCES: ReadonlyArray<Resource> = [
  Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT,
];

export class ProductiveOutpost extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 0,
      name: CardName.PRODUCTIVE_OUTPOST,
      type: CardType.AUTOMATED,

      metadata: {

        infoText: [

          {text: 'Gain all your colony bonuses.', tokens: ['colonies']},

        ],
        cardNumber: 'C30',
        renderData: CardRenderer.builder((b) => {
          b.colonies().asterix();
        }),
      },
    });
  }

  // Order:
  // Titania
  // All colonies
  // Leavitt
  //
  // TODO(kberg): Make it possible for Leavitt to resolve before Titania.

  public override bespokePlay(player: IPlayer) {
    const value = (c: IColony): number => {
      if (c.name === ColonyName.TITANIA) {
        return 1;
      }
      if (c.name === ColonyName.LEAVITT) {
        return -1;
      }
      return 0;
    };
    const sorted = [...player.game.colonies].sort((a, b) => value(b) - value(a));

    sorted.forEach((colony) => {
      colony.colonies.filter((owner) => owner === player.id).forEach((owner) => {
        // Not using GiveColonyBonus deferred action because it's only for the active player
        player.defer(() => colony.giveColonyBonus(player.game.getPlayerById(owner)));
      });
    });
    return undefined;
  }

  // PRE-COMPUTE the result IN the play modal: "Gain all your colony bonuses" is a
  // VARIABLE multi-resource bundle, but at modal-open time every owned colony's
  // FIXED `metadata.colony` bonus is known. So the modal shows EXACTLY what the
  // player gets (aggregated resource / production / draw / TR / Venus / card-resource
  // chips) instead of forcing them to open the Colonies overlay and remember. The
  // few INTERACTIVE bonuses (a colony "add a resource to a card" pick, a
  // draw-and-discard, …) ride the post-confirm follow-up — the card-resource chip
  // still shows what's gained; a note flags any bonus that needs a later choice.
  // Built read-only (no mutation).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const game = player.game;
    const stock: Partial<Record<Resource, number>> = {};
    const production: Partial<Record<Resource, number>> = {};
    const cardRes: Partial<Record<CardResource, number>> = {};
    let draw = 0;
    let tr = 0;
    let venusSteps = 0;
    let hasInteractiveBonus = false;

    for (const colony of game.colonies) {
      const owned = colony.colonies.filter((owner) => owner === player.id).length;
      if (owned === 0) {
        continue;
      }
      const bonus = colony.metadata.colony;
      for (let i = 0; i < owned; i++) {
        switch (bonus.type) {
        case ColonyBenefit.GAIN_RESOURCES:
          if (bonus.resource !== undefined) {
            stock[bonus.resource] = (stock[bonus.resource] ?? 0) + bonus.quantity;
          }
          break;
        case ColonyBenefit.GAIN_PRODUCTION:
          if (bonus.resource !== undefined) {
            production[bonus.resource] = (production[bonus.resource] ?? 0) + bonus.quantity;
          }
          break;
        case ColonyBenefit.DRAW_CARDS:
        case ColonyBenefit.DRAW_EARTH_CARD:
          draw += bonus.quantity;
          break;
        case ColonyBenefit.GAIN_TR:
          tr += bonus.quantity;
          break;
        case ColonyBenefit.INCREASE_VENUS_SCALE:
          venusSteps += bonus.quantity;
          break;
        case ColonyBenefit.GAIN_MC_PER_HAZARD_TILE:
          stock[Resource.MEGACREDITS] = (stock[Resource.MEGACREDITS] ?? 0) + game.board.getHazards().length;
          break;
        case ColonyBenefit.ADD_RESOURCES_TO_CARD:
        case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD:
          if (colony.metadata.cardResource !== undefined) {
            cardRes[colony.metadata.cardResource] = (cardRes[colony.metadata.cardResource] ?? 0) + bonus.quantity;
          }
          break;
        default:
          // STEAL / OPPONENT_DISCARD / COPY_TRADE / PLACE_* / draw-and-choose / … —
          // interactive or board bonuses that arrive as a follow-up.
          hasInteractiveBonus = true;
          break;
        }
      }
    }

    const effects: Array<ActionEffect> = [];
    for (const resource of STANDARD_RESOURCES) {
      const amount = stock[resource];
      if (amount !== undefined && amount !== 0) {
        effects.push(actionPreviews.stockGain(player, resource, amount));
      }
    }
    for (const resource of STANDARD_RESOURCES) {
      const amount = production[resource];
      if (amount !== undefined && amount !== 0) {
        effects.push(actionPreviews.productionChange(player, resource, amount));
      }
    }
    if (draw > 0) {
      effects.push(actionPreviews.drawGain(draw));
    }
    if (tr > 0) {
      effects.push(actionPreviews.trGain(player, tr));
    }
    if (venusSteps > 0) {
      effects.push(actionPreviews.globalGain(player, 'venus', venusSteps));
    }

    const steps: Array<ActionPreviewStep | undefined> = [];
    for (const [resource, amount] of Object.entries(cardRes) as Array<[CardResource, number]>) {
      if (amount <= 0) {
        continue;
      }
      // No card can hold it → the resource is silently lost; warn instead of a fake
      // chip. Built via `warningNote` so the icon key is NORMALIZED (a raw
      // `CardResource` — 'Animal' — yields `card-resource-Animal`, which has no CSS
      // class, so no icon showed) and the skipped effect is NAMED: this card
      // aggregates MANY colony bonuses, so an anonymous warning is the worst case.
      if (new AddResourcesToCard(player, resource).getCards().length === 0) {
        steps.push(actionPreviews.warningNote('No eligible card — this resource is not added.', {
          resource,
          skipped: {
            label: actionPreviews.SKIPPED_LABEL.addToCard,
            effect: actionPreviews.cardResourceGain(resource, amount),
          },
        }));
      } else {
        effects.push(actionPreviews.cardResourceGain(resource, amount));
      }
    }
    if (hasInteractiveBonus) {
      steps.push(actionPreviews.noteStep('generic', 'Some colony bonuses are resolved after confirming.'));
    }
    return actionPreviews.playPreview(this, player, effects, steps);
  }
}
