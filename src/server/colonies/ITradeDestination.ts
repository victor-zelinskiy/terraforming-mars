import {CardName} from '../../common/cards/CardName';
import {ColonyName} from '../../common/colonies/ColonyName';
import {IPlayer} from '../IPlayer';
import {TradeOptions, TradeTerms} from './IColony';

/**
 * WHO a trade is made with, as the event stream names it: a colony tile, or a
 * CARD that receives the trade fleet instead of a colony (a fleet dock —
 * `FleetDock.ts`). Both are `EventSource` shapes on purpose: the scope a trade
 * roots at IS its destination, so the journal groups the fee and the reward
 * under the tile / the card without a second mapping.
 */
export type TradeDestinationSource =
  | {kind: 'colony'; name: ColonyName}
  | {kind: 'card'; card: CardName};

/**
 * WHAT A TRADE IS MADE WITH — the one thing a payment path (`IColonyTrader`)
 * needs to know about where the fleet goes: what to call it in its journal
 * line (`MessageBuilder.tradeDestination`), what a trade-discount saving is
 * recorded against, and the `trade()` door it hands the paid trade to.
 *
 * A colony tile is one (`IColony` extends this — its behaviour is unchanged),
 * and a fleet-dock card is the other (`FleetDockDestination` — Turmoil Redux
 * TR06 Water Hauling and its sisters TR26 / TR27: «when you trade, you can
 * send the trade fleet to this card»). The paths are written against THIS
 * interface so that none of them ever learns the word «dock»: a new kind of
 * destination is a new implementation here, never a branch in nine paths.
 */
export interface ITradeDestination {
  readonly tradeSource: TradeDestinationSource;
  /**
   * Why THIS player may not trade here right now, or `undefined` when they
   * may — the destination's OWN gate (a colony's rule about the player, judged
   * with what the paying path brings; a dock's occupied berth or its reward's
   * blocker). The trade action re-asks it with the CHOSEN path's terms before
   * anything is paid: a named rejection, never a fee paid into nothing.
   */
  tradeBlockedReason(player: IPlayer, terms?: number | TradeTerms): string | undefined;
  /**
   * The paid trade arrives. `tradeOptions` / `bonusTradeOffset` are the
   * colony's terms (a fleetless or selfish trade, the Unity action's extra
   * track step); a destination with no track ignores them.
   */
  trade(player: IPlayer, tradeOptions?: TradeOptions, bonusTradeOffset?: number): void;
}
