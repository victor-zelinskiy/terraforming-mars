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

  /**
   * MODULAR FLOODGATES steel usable 1:1 in place of energy under THIS card's
   * substitution — a steel stored on that card «counts as on your player
   * board», so the printed «you may use a steel as energy» reaches it on the
   * same rule-correct basis as stock steel. Kept a SEPARATE pool on purpose:
   * it is deducted from the card (never `player.steel`), the wire carries it
   * as its own share (`cardSteel`), and the console offers it as its own,
   * explicitly chosen dial — a protected source is never auto-mixed. The
   * conversion RATE and the two-context restriction stay this card's own
   * (see the class doc): Modular Floodgates never restates either.
   *
   * ⚠️ KNOWN LIMITATION: consumed by the STANDARD Hydronetwork advance only
   * (`resolveAdvancePayment`'s `cardSteel` share). The colony-trade energy
   * family still spends stock steel only — its wire is ONE linked
   * `SelectAmount` dial, and widening it to a second, separately-protected
   * source means an `AndOptions` pair plus the trade composer's mix rework.
   * The trade affordability checks deliberately do NOT count this pool, so
   * nothing ever promises a payment path that cannot be taken.
   */
  public static floodgateSteelSubstituteAvailable(player: IPlayer): number {
    return player.tableau.has(CardName.DELTA_WORKS) ? player.getSpendable('floodgateSteel') : 0;
  }
}
