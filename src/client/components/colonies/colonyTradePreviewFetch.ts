import {paths} from '@/common/app/paths';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {apiUrl} from '@/client/utils/runtimeConfig';

/**
 * Fetch the read-only colony-trade preview for the viewer's own seat — the
 * shared data source behind the desktop trade modal, the console trade
 * composer and the console colony inspect. Resolves to `undefined` on any
 * failure (offline / JSDOM / stale id): every consumer degrades gracefully
 * to manifest-only rendering, so a failed fetch never blocks the trade.
 */
export async function fetchColonyTradePreview(
  playerId: string,
  colony: ColonyName,
): Promise<ColonyTradePreviewModel | undefined> {
  if (typeof fetch !== 'function' || playerId === '') {
    return undefined;
  }
  try {
    const url = `${apiUrl(paths.API_GAME_COLONY_TRADE_PREVIEW)}?id=${encodeURIComponent(playerId)}&colony=${encodeURIComponent(colony)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return undefined;
    }
    return await response.json() as ColonyTradePreviewModel;
  } catch (err) {
    return undefined;
  }
}
