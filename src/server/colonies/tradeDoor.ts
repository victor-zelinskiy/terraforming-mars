import {Message} from '../../common/logs/Message';
import {IPlayer} from '../IPlayer';
import {InputError} from '../inputs/InputError';
import {SelectColony} from '../inputs/SelectColony';
import {ColoniesHandler} from './ColoniesHandler';
import {fleetDockOfferModels, fleetDockOffers} from './FleetDock';
import {FleetDockDestination} from './FleetDockDestination';
import {TradeTerms} from './IColony';
import {IColonyTrader} from './IColonyTrader';
import {ITradeDestination} from './ITradeDestination';

/**
 * THE DOORS OF THE TRADE ACTION — what every way INTO a trade shares: the pick
 * of its destination and the scope its paid trade runs in. The trade action
 * itself (`Colonies.tradeWithColony`) and each card whose action is «trade for
 * free» (Titan Floating Launch-Pad, Automated Convoys) are doors; they differ
 * in who pays and in the headline, never in these two.
 *
 * (A module of its own, beside `ColoniesHandler`, for a load-order reason:
 * the dock destination reports the trade to the Parliament, and
 * `ColoniesHandler` is read by `Counter` before any card class exists.)
 */

/**
 * A «WHERE DOES THIS TRADE GO» pick — the sister of
 * `ColoniesHandler.tradeColonyPick`: the colony tiles exactly as that pick
 * offers them, PLUS the player's fleet-dock cards (`FleetDock.ts`) as the
 * `fleetDocks` marker. One answer, one destination: a colony tile
 * (`{colonyName}`) or a dock card (`{fleetDock}`), and either reaches
 * `onDestination` as an `ITradeDestination` — the door never learns which.
 *
 * The pick is legal with NO colony in it: a free dock alone keeps the trade
 * on offer (`Colonies.tradeBlockedReason`).
 *
 * A dock is judged twice, like a colony: by the OFFER (the marker — an
 * unavailable dock is listed with its reason and never accepted) and again
 * LIVE at the answer, before the door's handler runs — so a dock that filled
 * between the two is a named rejection, never a fee paid into nothing.
 */
export function tradeDestinationPick(
  player: IPlayer,
  title: string | Message,
  buttonLabel: string,
  terms: number | TradeTerms,
  onDestination: (destination: ITradeDestination) => void,
): SelectColony {
  const select = ColoniesHandler.tradeColonyPick(player, title, buttonLabel, terms)
    .andThen((colony) => {
      onDestination(colony);
      return undefined;
    });
  const offers = fleetDockOffers(player);
  select.fleetDocks = fleetDockOfferModels(offers);
  select.onFleetDock = (name) => {
    const card = offers.find((offer) => offer.card.name === name)?.card;
    if (card === undefined) {
      throw new InputError(`Fleet dock ${name} not found`);
    }
    const destination = new FleetDockDestination(card);
    const refusal = destination.tradeBlockedReason(player);
    if (refusal !== undefined) {
      throw new InputError(refusal);
    }
    onDestination(destination);
    return undefined;
  };
  return select;
}

/**
 * ONE TRADE THROUGH ONE DOOR — the scope every door opens around its paid
 * trade: the chain ROOTS at the destination (a colony tile, or the dock card
 * the fleet is sent to), so the fee, the reward and everything the trade
 * triggers group under it; then the path takes its fee and hands the trade
 * over.
 *
 * `headline` is the trade ACTION's own first line («traded with …» / «sent a
 * trade fleet to …»); a card's door has none — its path's own line («spent
 * 1 mech to trade with …») heads the group, as it always has.
 */
export function tradeThrough(player: IPlayer, trader: IColonyTrader, destination: ITradeDestination, opts: {headline?: boolean} = {}): void {
  const events = player.game?.events;
  const source = destination.tradeSource;
  events?.beginAction(player, source.kind === 'colony' ? source : {...source, owner: player.color}, {category: 'colony'});
  try {
    if (opts.headline === true) {
      player.game.log(
        source.kind === 'colony' ? '${0} traded with ${1}' : '${0} sent a trade fleet to ${1}',
        (b) => b.player(player).tradeDestination(destination));
    }
    trader.trade(destination);
  } finally {
    events?.endScope();
  }
}
