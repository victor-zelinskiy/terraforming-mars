import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Units} from '../../../common/Units';
import {Resource} from '../../../common/Resource';
import {digit} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

/**
 * X87 Shipment to Earth (promo; upstream b7848f3663, taken 2026-10-09 in the
 * fork's idiom).
 *
 * The printed order is the executed order: the shipment LEAVES first (3 plants
 * and 3 steel — `bespokePlayBefore`), then the declarative TR and the M€ per
 * Earth tag. Upstream takes the stock in `bespokePlay`, after the behavior; the
 * fork's information blocks and the journal read the printed order, so the loss
 * runs before the gains.
 *
 * The render spells the loss with the fork's `minus()`: upstream's `plants(-3)`
 * rides its negative-amount renderer (93b146c7d3 + d7886c307a), which is not
 * taken here (see `docs/UPSTREAM_DEFERRED_WORKLIST.md`).
 */
export class ShipmentToEarth extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.SHIPMENT_TO_EARTH,
      tags: [Tag.SPACE],
      cost: 17,

      behavior: {
        tr: 3,
        stock: {megacredits: {tag: Tag.EARTH, each: 2}},
      },

      metadata: {
        infoText: [
          {text: 'Lose 3 plants and 3 steel.', tokens: ['plants', 'steel']},
          {text: 'Raise your TR 3 steps.', tokens: ['tr']},
          {text: 'Gain 2 M€ for each Earth tag you have.', tokens: ['megacredits']},
        ],
        cardNumber: 'X87',
        renderData: CardRenderer.builder((b) => {
          b.minus().plants(3, {digit}).minus().steel(3, {digit}).br;
          b.tr(3, {digit}).br;
          b.megacredits(2).slash().tag(Tag.EARTH);
        }),
        description: 'Lose 3 plants and 3 steel. Raise TR 3 steps. Gain 2 M€ per Earth tag.',
      },
    });
  }

  /** The shipment the card sends to Earth — ONE reading for the gate, the cost and the preview. */
  private static readonly SHIPMENT: Units = Units.of({plants: 3, steel: 3});

  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.stock.has(ShipmentToEarth.SHIPMENT);
  }

  // The bespoke shipment isn't in `behavior`, so the generic explainer can't see
  // it. ONE blocker is named, in the printed order: plants first, then steel.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.plants < ShipmentToEarth.SHIPMENT.plants) {
      return reason.notEnoughPlants(player);
    }
    if (player.steel < ShipmentToEarth.SHIPMENT.steel) {
      return reason.notEnoughSteel(player);
    }
    return undefined;
  }

  public override bespokePlayBefore(player: IPlayer): void {
    // Unit by unit, in the PRINTED order (plants, then steel): `stock.adjust`
    // walks `Units.keys` (steel before plants) and the journal would read the
    // shipment backwards.
    for (const resource of [Resource.PLANTS, Resource.STEEL] as const) {
      player.stock.add(resource, -ShipmentToEarth.SHIPMENT[resource], {log: true, from: {card: this}});
    }
  }

  // The on-play preview: `playPreview` auto-includes the declarative chips (+3 TR,
  // the M€ per Earth tag); the bespoke shipment is added as COST chips so the
  // modal shows the whole trade — the player never ships blind. The shipment
  // reads FIRST (`extrasFirst`): it is printed first and it runs first.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [
      actionPreviews.stockCost(player, Resource.PLANTS, ShipmentToEarth.SHIPMENT.plants),
      actionPreviews.stockCost(player, Resource.STEEL, ShipmentToEarth.SHIPMENT.steel),
    ], [], {extrasFirst: true});
  }
}
