import {IPlayer} from '../IPlayer';
import {FleetDockCard, fleetDockBlockedReason, fleetDockRewardTarget} from './FleetDock';
import {ITradeDestination, TradeDestinationSource} from './ITradeDestination';
import {payTradeFlatBonuses, reportTrade} from './tradePerformed';
import {SimpleDeferredAction} from '../deferredActions/DeferredAction';

/**
 * THE FLEET LANDS ON THE CARD — the one writer of a dock's state.
 *
 * Under the card's own source: the generation stamp («busy until the end of
 * the generation»), the fleet spent (it returns with the others —
 * `Colonies.returnTradeFleets`), the typed `fleet-docked` fact (the journal's
 * row, the rival's notification), and only then the card's reward — so
 * whatever the reward defers (Water Hauling's ocean) is queued by a fleet that
 * has demonstrably landed.
 *
 * A reward with a CARD TARGET (TR27) is paid in its printed order: the
 * target's own step is queued first (the very object the preview read —
 * `fleetDockRewardTarget`), and the rest of the reward (`receive`) is queued
 * BEHIND it at the same priority, so it runs only once the target has been
 * answered — or auto-applied, or named lost. Nothing the card pays comes
 * before the question its row prints first. A dock without a target is
 * byte for byte the landing it always was (`receive` inline).
 */
export function dockFleet(player: IPlayer, card: FleetDockCard): void {
  const game = player.game;
  game.events.withSource({kind: 'card', card: card.name, owner: player.color}, () => {
    card.data = {dockedGeneration: game.generation};
    player.colonies.usedTradeFleets++;
    game.events.recordFleetDocked(player, card);
    const target = fleetDockRewardTarget(player, card);
    if (target === undefined) {
      card.fleetDock.receive(player);
      return;
    }
    game.defer(target);
    game.defer(new SimpleDeferredAction(player, () => {
      card.fleetDock.receive(player);
      return undefined;
    }, target.priority));
  });
}

/**
 * A fleet-dock card AS A TRADE DESTINATION — what a payment path hands the
 * paid trade to in place of a colony. Its `trade()` is the whole of «a trade
 * with a card»: the trade is a fact (the chairman quest counts it), the fleet
 * lands and the card pays (`dockFleet`), then the flat every-trade bonuses
 * (Venus Trade Hub) — the colony's own order. The track terms (`tradeOptions`,
 * `bonusTradeOffset` — the Unity action's extra step) do not apply: there is
 * no track.
 */
export class FleetDockDestination implements ITradeDestination {
  constructor(private readonly card: FleetDockCard) {}

  public get tradeSource(): TradeDestinationSource {
    return {kind: 'card', card: this.card.name};
  }

  /** The dock's own gate — the path's terms change nothing here (no track, no fee on top). */
  public tradeBlockedReason(player: IPlayer): string | undefined {
    return fleetDockBlockedReason(player, this.card);
  }

  public trade(player: IPlayer): void {
    reportTrade(player);
    dockFleet(player, this.card);
    payTradeFlatBonuses(player, {named: true});
  }
}
