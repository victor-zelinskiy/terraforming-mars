import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {IPlayer} from '../IPlayer';
import {TradeTerms} from './IColony';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {tradeBenefitAt} from '../../common/colonies/ColonyMetadata';

/** The M€ the 1st position TAKES on top of the trade fee — the tile's printed «−4». */
export const VENUS_REDUX_FIRST_POSITION_LEVY = 4;

/**
 * The two refusals — English i18n keys, each naming WHAT is missing (never a
 * shared «cannot trade»): the first is a solvency question, the second a
 * storage question, and the player must read which one stopped them.
 */
export const VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON = 'Not enough M€ for the 4 M€ the 1st position takes on top of the trade fee';
export const VENUS_REDUX_NO_FLOATER_HOLDER_REASON = 'No card of yours can hold the floaters this trade pays';

/**
 * VENUS — the Turmoil Redux tile (rulebook, «Venus»). An ADDITION, not a
 * replacement: the community tile of that name was retired with it (see
 * `ColonyName`), so this one simply joins the pool when the expansion is on.
 *
 *   Placement bonus: «Add 2 delegates to a resolution.»
 *   Colony bonus:    «Draw a card. Then discard a card.»
 *   Trade income:    «Terraform Venus 1 step, and gain the bonus indicated by
 *                     the colony marker. If it is at its 1st position and you
 *                     do not have the extra 4 M€, you cannot trade with Venus.
 *                     If it is at position 3-5 and you do not have a card that
 *                     can accept floater resources, you cannot trade with
 *                     Venus either. (Remember to consider marker-advancing
 *                     effects.)»
 *   «Venus starts active and any player can place a colony on it.»
 *
 * Read off the printed tile (Colonies/Venus.png): the build berths print two
 * delegates each; the track prints −4 M€ · nothing · 1 floater · 1 floater ·
 * 2 floaters · 1 delegate · 2 delegates; the TRADE INCOME line prints
 * «[Venus] + X» — a CONSTANT beside the marker's bonus.
 *
 * THE THREE THINGS PLUTO DID NOT HAVE, and where each lives:
 *
 *  1. THE INCOME IS COMPOSITE. «Terraform Venus 1 step, AND gain the bonus»
 *     is a fixed part plus the marker's part, on every position — the empty
 *     2nd and the levying 1st included. It is declared as DATA
 *     (`trade.fixed`, `ColonyMetadata`), not as a per-colony hook: the server
 *     pays it first (`Colony.handleTrade`), the manifest carries it
 *     (`tradeIncomeFixed`), and the tile, the dossier and the reward package
 *     draw it from the same field. A hook would have made the client guess.
 *     The 2nd position is a `LOSE_RESOURCES` of ZERO — nothing is taken and
 *     nothing is journaled — so an empty position is a zero income, never a
 *     refusal; only the fixed step is paid there.
 *
 *  2. DELEGATES GO TO A RESOLUTION, never to a classic Turmoil party:
 *     `PLACE_DELEGATES_ON_RESOLUTION` → `PlaceDelegatesOnResolution` (the
 *     Parliament's own step — the player picks the resolution, the delegates
 *     leave the reserve, and a table without a vote or a reserve without a
 *     delegate is a NAMED skip in the journal).
 *
 *  3. TWO REFUSALS OF DIFFERENT NATURES, both this tile's own rule about the
 *     player (`tradeIncomeBlockedReason`, co-located — never a central table):
 *     · the 1st position takes 4 M€ ON TOP of the trade fee, so the question
 *       is «fee + 4 ≤ M€» — judged with the paying path's fee
 *       (`TradeTerms.feeMegacredits`: the whole M€ fee for the M€ path, 0 for
 *       energy / titanium / a card, 0 once the fee is paid). A path that
 *       leaves the player short is refused BEFORE it takes anything;
 *     · positions 3–5 pay floaters into a card, so the player needs one that
 *       can hold them — the SAME candidate set the payout itself would use
 *       (`AddResourcesToCard.getCards`, the wildcard holders included).
 *     Positions 2, 6 and 7 never refuse. The marker-advancing arithmetic is
 *     the engine's own (`Colony.tradeTrackPlan` asks every reachable landing),
 *     so «consider marker-advancing effects» falls out of it: +1 from the 2nd
 *     lands on the 3rd and needs a floater card; +1 from the 5th lands on the
 *     6th and needs nothing.
 *
 * `shouldIncreaseTrack: 'ask'` — the track pays DIFFERENT things along the
 * way (a levy, nothing, floaters, delegates), so a player whose offset spans
 * a boundary chooses; the plan already refuses the landings the tile refuses.
 *
 * VENUS NEXT IS REQUIRED (a project decision — the rulebook is silent): the
 * fixed income terraforms Venus, and without the expansion there is no scale
 * to move, so every trade would silently lose its main effect. `ColonyDealer`
 * keeps the tile out of a game without Venus Next, as it did the retired tile.
 * WITH the expansion, a scale at its maximum is the one case the step pays
 * nothing — and the journal says so (`Colony.giveBonusImpl`).
 */
export class VenusRedux extends Colony {
  constructor() {
    super({
      name: ColonyName.VENUS_REDUX,
      // The printed flavour line, word for word.
      lore: 'Venus\' atmosphere makes it a pressure-cooker on the surface. But 50 km above that, the conditions are the most similar to Earth\'s in the entire solar system. So much so it is speculated to have life.',
      cardResource: CardResource.FLOATER,
      build: {
        description: 'Add 2 delegates to a resolution',
        type: ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION,
        quantity: [2, 2, 2],
      },
      trade: {
        description: 'Increase Venus 1 step and gain the bonus under the marker',
        // The KIND moves along the track, as Pluto's does: a levy at the 1st
        // (and a levy of NOTHING at the 2nd), floaters at 3–5, delegates at 6–7.
        type: [
          ColonyBenefit.LOSE_RESOURCES, ColonyBenefit.LOSE_RESOURCES,
          ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD,
          ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION, ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION,
        ],
        quantity: [VENUS_REDUX_FIRST_POSITION_LEVY, 0, 1, 1, 2, 1, 2],
        // Only the levy positions read it (a loss of M€).
        resource: Resource.MEGACREDITS,
        // «Terraform Venus 1 step, AND …» — the fixed part, every trade.
        fixed: {
          description: 'Increase Venus 1 step',
          type: ColonyBenefit.INCREASE_VENUS_SCALE,
          quantity: 1,
        },
      },
      colony: {
        description: 'Draw 1 card and then discard 1 card',
        type: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE,
      },
      shouldIncreaseTrack: 'ask',
      expansion: 'venus',
    });
  }

  // «Venus starts active and any player can place a colony on it» — the base
  // class's default (the retired community tile was `isActive = false` until
  // a Venus card with a resource was played); stated here so the difference
  // is deliberate.
  public override isActive = true;

  /**
   * The tile's two refusals, per landing (see the class doc, point 3). The
   * empty 2nd position and the delegate positions never refuse.
   */
  public override tradeIncomeBlockedReason(player: IPlayer, position: number, terms?: TradeTerms): string | undefined {
    const income = tradeBenefitAt(this.metadata, position);
    switch (income.type) {
    case ColonyBenefit.LOSE_RESOURCES: {
      if (income.quantity <= 0) {
        return undefined;
      }
      // «…and you do not have the EXTRA 4 M€»: over the fee the paying path
      // will take, never instead of it. Plain M€ — that is what the levy takes.
      const needed = income.quantity + (terms?.feeMegacredits ?? 0);
      return player.megaCredits >= needed ? undefined : VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON;
    }
    case ColonyBenefit.ADD_RESOURCES_TO_CARD: {
      if (income.quantity <= 0) {
        return undefined;
      }
      const holders = new AddResourcesToCard(player, CardResource.FLOATER, {count: income.quantity}).getCards();
      return holders.length > 0 ? undefined : VENUS_REDUX_NO_FLOATER_HOLDER_REASON;
    }
    default:
      return undefined;
    }
  }
}
