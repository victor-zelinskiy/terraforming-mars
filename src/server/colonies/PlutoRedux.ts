import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {CardResource} from '../../common/CardResource';
import {IPlayer} from '../IPlayer';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {tradeBenefitAt} from '../../common/colonies/ColonyMetadata';

/** The refusal, an English i18n key — the reason every surface names. */
export const PLUTO_REDUX_NO_DATA_HOLDER_REASON = 'No card of yours can hold the data this trade pays';

/**
 * PLUTO — the Turmoil Redux REPLACEMENT tile (rulebook, «Pluto»): the same
 * placement bonus and colony bonus as the base tile, a different trade income.
 *
 *   «You now only get cards if the colony marker is at its 6th or 7th
 *    position, which nets you 2 cards and 3 cards, respectively. Trading at
 *    any other position nets you data resources instead, which you can add to
 *    any card. This new version of Pluto starts active, and any player can
 *    place a colony on it. But when the colony marker is at its lower
 *    positions, a player must have a card that can accept data resources if
 *    they want to trade with Pluto. Note: Any marker-advancing bonuses are
 *    factored into this restriction.»
 *
 * Read off the printed tile: the income is DATA ×[1, 1, 2, 2, 3] at positions
 * 1–5 and CARDS ×[2, 3] at 6–7 — the KIND of the income changes along the
 * track, which is why `trade.type` is per-position (`tradeBenefitAt`).
 *
 * The «must have a card that can accept data» rule is THIS colony's
 * `tradeIncomeBlockedReason` (co-located, never a central table): a data
 * position with no holder is refused BY NAME instead of paying into nothing
 * (`AddResourcesToCard` with no candidate returns silently — the one outcome
 * the project forbids). The offset arithmetic is the engine's own
 * (`Colony.tradeTrackPlan`): the rules' «+2 from the 4th position reaches the
 * 6th, so no data card is needed; +1 only reaches the 5th, so it is» falls out
 * of asking each reachable position, never of a second calculation here.
 *
 * `shouldIncreaseTrack: 'ask'` — like Mercury and Hygiea the track pays
 * DIFFERENT things at different positions, so a player whose offset spans the
 * data/cards boundary chooses (the offset is a «may»); the plan already
 * refuses the choices that would land on data with nowhere to put it.
 */
export class PlutoRedux extends Colony {
  constructor() {
    super({
      name: ColonyName.PLUTO_REDUX,
      // The Redux tile prints the base tile's flavour line word for word.
      lore: 'This dwarf planet and its companion Charon wander the space between Neptune and the Kuiper belt.',
      cardResource: CardResource.DATA,
      build: {
        description: 'Draw 2 cards',
        type: ColonyBenefit.DRAW_CARDS,
        quantity: [2, 2, 2],
      },
      trade: {
        description: 'Add n data to ANY card; at the last two positions draw 2 or 3 cards instead',
        type: [
          ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD,
          ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD,
          ColonyBenefit.DRAW_CARDS, ColonyBenefit.DRAW_CARDS,
        ],
        quantity: [1, 1, 2, 2, 3, 2, 3],
      },
      colony: {
        description: 'Draw 1 card and then discard 1 card',
        type: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE,
      },
      shouldIncreaseTrack: 'ask',
    });
  }

  // «This new version of Pluto starts active» — the base class's default;
  // stated here so the contrast with Iapetus II (`isActive = false`) is
  // deliberate, not an omission.
  public override isActive = true;

  /**
   * A DATA position pays into a card, so the player needs one that can hold
   * data (the same candidate set the payout itself would use — the WARE
   * wildcard included, exactly as `AddResourcesToCard.getCards` reads it).
   * The card positions (6–7) never refuse.
   */
  public override tradeIncomeBlockedReason(player: IPlayer, position: number): string | undefined {
    const income = tradeBenefitAt(this.metadata, position);
    if (income.type !== ColonyBenefit.ADD_RESOURCES_TO_CARD || income.quantity <= 0) {
      return undefined;
    }
    const holders = new AddResourcesToCard(player, CardResource.DATA, {count: income.quantity}).getCards();
    return holders.length > 0 ? undefined : PLUTO_REDUX_NO_DATA_HOLDER_REASON;
  }
}
