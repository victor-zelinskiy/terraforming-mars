import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';

export class DeltaWorks extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DELTA_WORKS,
      tags: [Tag.BUILDING],
      cost: 4,

      metadata: {
        cardNumber: 'DP06',
        renderData: CardRenderer.builder((b) => {
          b.effect('When doing the Hydronetwork action or when you trade with a Colony, you may use a steel as energy.', (eb) => {
            eb.plate('Hydronetwork').slash().trade().startEffect.steel(1).equals().energy(1).asterix();
          });
        }),
      },
    });
  }

  /**
   * Steel usable 1:1 in place of energy by `player` RIGHT NOW — non-zero only
   * while Delta Works sits in their tableau (a copy in hand or an opponent's
   * copy grants nothing). This is payment SUBSTITUTION, never conversion: no
   * energy is ever added, the chosen steel is deducted directly.
   *
   * Exactly TWO payment contexts may ask this — the ordinary Hydronetwork
   * advance (`DeltaProjectExpansion.resolveAdvancePayment`) and the colony
   * trade's energy family (`TradeWithEnergy`). Nothing else may: the printed
   * effect never widens to other energy costs (the DP03/DP04 bonus-move tolls,
   * card actions, standard projects, requirements or production).
   */
  public static steelSubstituteAvailable(player: IPlayer): number {
    return player.tableau.has(CardName.DELTA_WORKS) ? player.steel : 0;
  }
}
