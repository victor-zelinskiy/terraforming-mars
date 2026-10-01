import {paths} from '@/common/app/paths';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardName} from '@/common/cards/CardName';
import {ColonyTradePreviewModel, FleetDockPreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {fetchPreview} from '@/client/utils/previewFetch';

/**
 * Fetch the read-only colony-trade preview for the viewer's own seat — the
 * shared data source behind the desktop trade modal, the console trade
 * composer and the console colony inspect. Resolves to `undefined` on any
 * failure (offline / JSDOM / stale id) AND when the colony is not in the game
 * at all (the server's 204 — an add-a-tile catalog candidate has no track and
 * no trade): every consumer degrades gracefully to manifest-only rendering, so
 * a missing preview never blocks the trade.
 */
export function fetchColonyTradePreview(
  playerId: string,
  colony: ColonyName,
  /** The CHOSEN payment path's own track advance (`OptionMetadata.tradeOffset`, the Unity action's 1) — 0 = the default path. */
  pathOffset = 0,
): Promise<ColonyTradePreviewModel | undefined> {
  if (playerId === '') {
    return Promise.resolve(undefined);
  }
  const offset = pathOffset > 0 ? `&offset=${encodeURIComponent(String(pathOffset))}` : '';
  const url = `${apiUrl(paths.API_GAME_COLONY_TRADE_PREVIEW)}?id=${encodeURIComponent(playerId)}&colony=${encodeURIComponent(colony)}${offset}`;
  return fetchPreview<ColonyTradePreviewModel>(url);
}

/**
 * The same route asked about a trade whose destination is a fleet-dock CARD
 * of the viewer's own (`?dock=<card>` — the dock twin of the colony preview:
 * the fee's own prompts, the server's verdict, the reward's chips and what it
 * will ask). `undefined` on any failure and on the server's 204 (the card left
 * the tableau, or is no dock) — the stage then stands on the pick's marker.
 */
export function fetchFleetDockPreview(playerId: string, card: CardName): Promise<FleetDockPreviewModel | undefined> {
  if (playerId === '') {
    return Promise.resolve(undefined);
  }
  const url = `${apiUrl(paths.API_GAME_COLONY_TRADE_PREVIEW)}?id=${encodeURIComponent(playerId)}&dock=${encodeURIComponent(card)}`;
  return fetchPreview<FleetDockPreviewModel>(url);
}
