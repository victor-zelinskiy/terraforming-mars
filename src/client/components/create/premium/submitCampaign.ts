// Campaign mode — THE campaign create submit (the submitPremiumCreateGame
// sibling). Reuses the exact same premium-state → NewGameConfig conversion,
// so a campaign's frozen settings can never drift from what a single game
// would have been created with.
//
// DURABLE IDEMPOTENCY: the client mints one idempotency key per creation
// attempt and keeps it in sessionStorage until the campaign is confirmed
// created — a lost response, a reload mid-request or a server restart all
// retry with the SAME key, and the server derives the CampaignId from it, so
// every path converges on one campaign.

import {paths} from '@/common/app/paths';
import {CampaignModel} from '@/common/campaign/CampaignModel';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {createGameState, saveCreateGameState} from './createGameState';
import {buildCreateGamePayloadFromPremiumState} from './buildCreateGamePayload';

const CREATE_KEY_STORAGE = 'tm_campaign_create_key';

function takeOrMintCreationKey(): string {
  try {
    const existing = window.sessionStorage.getItem(CREATE_KEY_STORAGE);
    if (existing !== null && existing.length >= 8) {
      return existing;
    }
    const minted = `ck-${Date.now()}-${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
    window.sessionStorage.setItem(CREATE_KEY_STORAGE, minted);
    return minted;
  } catch {
    return `ck-${Date.now()}-${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
  }
}

function clearCreationKey(): void {
  try {
    window.sessionStorage.removeItem(CREATE_KEY_STORAGE);
  } catch {
    // Storage unavailable — the key was ephemeral anyway.
  }
}

/**
 * Create the campaign and enter the Campaign Map behind the curtain.
 * On failure the shared creator state carries the inline error.
 */
export async function submitPremiumCreateCampaign(): Promise<boolean> {
  createGameState.error = '';
  createGameState.creating = true;
  try {
    const config = buildCreateGamePayloadFromPremiumState(createGameState.config);
    const key = takeOrMintCreationKey();
    saveCreateGameState();
    const res = await fetch(apiUrl(paths.API_CAMPAIGN_CREATE), {
      method: 'POST',
      body: JSON.stringify({key, name: createGameState.config.players[0]?.name ?? '', config}),
      headers: {'Content-Type': 'application/json'},
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || 'create-failed');
    }
    const model = JSON.parse(text) as CampaignModel;
    if (typeof model.id !== 'string') {
      throw new Error('create-failed');
    }
    clearCreationKey();
    // The generation ceremony plays ONCE, on the creator's first arrival —
    // handed to the next page the same way the boot curtain flags are.
    try {
      window.sessionStorage.setItem('tm_campaign_reveal', model.id);
    } catch {
      // Without the flag the map simply lands settled.
    }
    navigateWithCurtain(paths.CAMPAIGN + '?id=' + encodeURIComponent(model.id), 'expedition');
    return true;
  } catch (err) {
    createGameState.creating = false;
    const message = err instanceof Error ? err.message : '';
    // Server-side blockers arrive as English reason strings — surface the
    // specific one when it looks like one, else the generic retry line.
    createGameState.error = message.length > 0 && message.length < 120 && !message.includes('fetch') ?
      message : 'Could not create the campaign. Please try again.';
    return false;
  }
}
