import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {Color} from '@/common/Color';
import {createGameState, saveCreateGameState} from './createGameState';
import {buildCreateGamePayloadFromPremiumState} from './buildCreateGamePayload';

type SimplePlayer = {id: string, color: Color};

/**
 * THE single premium create-game submit: build the payload from the shared
 * premium state, persist the setup, POST, and enter the creator's seat behind
 * the loading curtain. Shared by the desktop Mission Control screen AND the
 * console-native create flow so the two can never drift.
 *
 * On failure the shared state carries the inline error (`createGameState.error`)
 * and `creating` drops back to false; on success the page navigates away (the
 * deliberate reload at the game boundary), so `creating` stays raised.
 */
export async function submitPremiumCreateGame(): Promise<boolean> {
  createGameState.error = '';
  createGameState.creating = true;
  const creatorColor = createGameState.config.players[0].color;
  try {
    const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
    // Remember this setup so the create screen re-opens with it next time.
    saveCreateGameState();
    const res = await fetch(apiUrl(paths.API_CREATEGAME), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {'Content-Type': 'application/json'},
    });
    const text = await res.text();
    let json: {players?: Array<SimplePlayer>} | undefined;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (!res.ok || json === undefined || !Array.isArray(json.players) || json.players.length === 0) {
      throw new Error('create-failed');
    }
    const creator = json.players.find((p) => p.color === creatorColor) ?? json.players[0];
    // Deliberate reload at the game boundary — covered by the curtain (P10).
    navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(creator.id), 'expedition');
    return true;
  } catch {
    createGameState.creating = false;
    createGameState.error = 'Could not create the game. Please try again.';
    return false;
  }
}
