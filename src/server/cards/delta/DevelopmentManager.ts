import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';

export class DevelopmentManager extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DEVELOPMENT_MANAGER,
      tags: [Tag.EARTH],
      cost: 8,

      metadata: {
        cardNumber: 'DP05',
        renderData: CardRenderer.builder((b) => {
          b.effect('Each time you increase a type of production 2 or more steps, or advance 2 or more steps on the Hydronetwork track, gain 2 M€.', (eb) => {
            eb.production((pb) => pb.text('+2').wild(1)).slash().text('+2').plate('Hydronetwork').startEffect.megacredits(2);
          });
        }),
      },
    });
  }

  /**
   * Both triggers ride the game's ONE authoritative boundary for their event
   * class, so the card never re-derives rules and never depends on how a
   * source happens to be implemented:
   *
   *  - Production: `Production.add` is the single commit point for every
   *    production change in the game (the declarative `behavior` DSL, bespoke
   *    plays, preludes, corporations, colony bonuses, copied production boxes,
   *    standard projects, Turmoil and track rewards all end there), and
   *    `adjust(units)` decomposes into ONE `add` per resource carrying that
   *    resource's FULL amount — so `amount` here IS one semantic change of one
   *    production type. Positive amounts are never clamped, so the requested
   *    amount equals the committed delta. Deserialization, undo restoration
   *    and game setup go through `override()`, and previews are arithmetic
   *    (never executed), so none of them can reach this hook.
   *
   *  - The track: `DeltaProjectExpansion.advance` is the single commit point
   *    for every human advance (standard action, DP04's card action, DP03's
   *    bonus move), and it reports the full logical distance of ONE committed
   *    move. Two separate 1-step moves are two events and never accumulate.
   *
   * The threshold is a gate, not a multiplier: +2, +3 or +4 of one type is
   * still one trigger; each production TYPE meeting it in the same resolution
   * triggers separately (Production dispatches per resource). The 2 M€ goes
   * through `stock.add` inside the already-open lazy effect scope, so the
   * journal/event stream records «Development Manager → +2 M€» as a passive
   * effect of this card — and an M€ STOCK gain can never re-enter the
   * production pipeline.
   */
  private grantBonus(player: IPlayer): void {
    player.stock.add(Resource.MEGACREDITS, 2, {log: true, from: {card: this}});
  }

  public onProductionGain(player: IPlayer, _resource: Resource, amount: number): void {
    if (amount >= 2) {
      this.grantBonus(player);
    }
  }

  public onDeltaTrackAdvance(player: IPlayer, steps: number): void {
    if (steps >= 2) {
      this.grantBonus(player);
    }
  }
}
