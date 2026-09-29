import {Colony} from './Colony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {IPlayer} from '../IPlayer';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {colonyCardResources} from '../../common/colonies/ColonyMetadata';

/**
 * The refusal — an English i18n key. A real disjunction («or»): the player
 * needs a card that can hold ANY ONE of the three kinds.
 */
export const VESTA_NO_HOLDER_REASON = 'No card of yours can hold the mechs, asteroids or fighters this trade pays';

/**
 * VESTA — the Turmoil Redux ADDITION tile (rulebook, «Vesta»): no base twin,
 * dealt with the expansion beside the base tiles.
 *
 *   Placement bonus: «Gain 5 steel.»
 *   Colony bonus:    «Gain 1 steel.»
 *   Trade income:    «Add the indicated number of mech, asteroid, or fighter
 *                     resources to any card. You can only pick one resource
 *                     type per trade.»
 *   «Vesta starts active and any player can place a colony on it, but only
 *    players with a card that can accept mech, asteroid, or fighter
 *    resources can trade with it.»
 *
 * Read off the printed tile (Colonies/Vesta.png): the track prints
 * 0 · 1 · 1 · 1 · 2 · 2 · 3, each cell over the three resource icons.
 *
 * THE ONE THING PLUTO AND VENUS DID NOT HAVE: the income is N units of ONE
 * of SEVERAL kinds, onto ONE card. It is not a second question — the kind is
 * the CHOSEN card's own (Medical Database's law): the payout is the shared
 * `AddResourcesToCard` over the LIST (`cardResources`, read through
 * `colonyCardResources`), its candidates are the holders of ANY of the
 * three kinds (the WARE wildcard included), and «one resource type per
 * trade» holds BY CONSTRUCTION, since a card holds one kind. A one-kind tile
 * keeps `cardResource`; this tile declares the list, never both.
 *
 * THE REFUSAL IS UNCONDITIONAL — a rule about the TILE, not about a position.
 * Pluto and Venus refuse only where their printed rule says («at its lower
 * positions», «at position 3–5»); Vesta's sentence is «only players with a
 * card that can accept … can trade with it», so a player with no holder is
 * refused at EVERY landing, the zero-income 1st position included (a project
 * reading of the printed rule — one line and one spec change if the owner
 * prefers a plain skip where nothing would be paid). The candidate set is
 * the SAME one the payout uses. The offset arithmetic is the engine's own
 * (`Colony.tradeTrackPlan`): every reachable landing is refused alike, so
 * no advance can lift it.
 *
 * `shouldIncreaseTrack: 'yes'` — one kind of income, more of it higher up.
 *
 * MARSBOT: this tile has no Shipping Board area (an ADDITION has no base
 * twin to borrow one from), so `ColonyDealer` keeps every such tile off a
 * MarsBot table until MarsBot support for Turmoil Redux lands — a refusal to
 * deal what the bot cannot use, not a mechanic.
 */
export class Vesta extends Colony {
  constructor() {
    super({
      name: ColonyName.VESTA,
      // The printed flavour line, word for word.
      lore: 'Vesta was initially used as a mining outpost for surrounding asteroids. Then the idea came to use the material on-site rather than spend extra money hauling it to distant factories.',
      // SEVERAL kinds — the list, in the tile's printed order (see the class doc).
      cardResources: [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER],
      build: {
        description: 'Gain 5 steel',
        type: ColonyBenefit.GAIN_RESOURCES,
        resource: Resource.STEEL,
        quantity: [5, 5, 5],
      },
      trade: {
        description: 'Add n mechs, asteroids or fighters to ANY card',
        type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
        quantity: [0, 1, 1, 1, 2, 2, 3],
      },
      colony: {
        description: 'Gain 1 steel',
        type: ColonyBenefit.GAIN_RESOURCES,
        resource: Resource.STEEL,
      },
      shouldIncreaseTrack: 'yes',
    });
  }

  // «Vesta starts active and any player can place a colony on it» — the base
  // class's default (Titan and Kuiper, the other resource tiles, sleep until
  // a card of their kind is played); stated here so the difference is
  // deliberate.
  public override isActive = true;

  /**
   * «…but only players with a card that can accept mech, asteroid, or
   * fighter resources can trade with it» — at EVERY position (see the class
   * doc), judged over the SAME candidate set the payout uses: the holders of
   * any of the three kinds, the WARE wildcard included.
   */
  public override tradeIncomeBlockedReason(player: IPlayer, _position: number): string | undefined {
    const holders = new AddResourcesToCard(player, colonyCardResources(this.metadata), {count: 1}).getCards();
    return holders.length > 0 ? undefined : VESTA_NO_HOLDER_REASON;
  }
}
