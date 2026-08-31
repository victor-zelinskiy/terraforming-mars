import {paths} from '@/common/app/paths';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
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
): Promise<ColonyTradePreviewModel | undefined> {
  if (playerId === '') {
    return Promise.resolve(undefined);
  }
  const url = `${apiUrl(paths.API_GAME_COLONY_TRADE_PREVIEW)}?id=${encodeURIComponent(playerId)}&colony=${encodeURIComponent(colony)}`;
  return fetchPreview<ColonyTradePreviewModel>(url);
}
