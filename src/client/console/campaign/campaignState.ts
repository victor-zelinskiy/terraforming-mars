// Campaign mode — the client campaign store (module reactive, the
// journalState pattern). ONE source for every campaign surface: the
// standalone Campaign Map screen, the endgame map scene, the lobby grouping
// details and the carryover scene all read this.
//
// NOT a game-state derived cache: the campaign document carries its own
// monotonic `rev` and this store refetches on demand + on a bounded poll —
// there is no per-`gameStateVersion` memo here (listed in the derived-cache
// guard's NOT_A_CACHE set, like adminRollbackState).

import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {CampaignId, PlayerId} from '@/common/Types';
import {CardName} from '@/common/cards/CardName';
import {CampaignModel} from '@/common/campaign/CampaignModel';
import {apiUrl, wsBaseUrl} from '@/client/utils/runtimeConfig';
import {CampaignChannelHandle, campaignChannelHealthy, openCampaignChannel} from '@/client/console/campaign/campaignChannel';
import {ensureIdentityLoaded, identityState} from '@/client/components/mainMenu/identity/identityState';

export type CampaignLoadStatus = 'idle' | 'loading' | 'ok' | 'error';

export const campaignState = reactive<{
  id: CampaignId | undefined,
  model: CampaignModel | undefined,
  status: CampaignLoadStatus,
  /** English i18n source for the inline error, or ''. */
  error: string,
  /** True while a launch POST is in flight (absorbs double presses). */
  launching: boolean,
  /** True while a carryover POST is in flight. */
  submittingCarryover: boolean,
}>({
  id: undefined,
  model: undefined,
  status: 'idle',
  error: '',
  launching: false,
  submittingCarryover: false,
});

let pollTimer: number | undefined;

/**
 * In-game hosts (the endgame workspace) resolve the viewer from THE GAME
 * (thisPlayer.name) rather than the menu identity — a LAN joiner's local
 * profile may differ from their seat name.
 */
let viewerOverride: string | undefined;

export function setCampaignViewerName(name: string | undefined): void {
  viewerOverride = name;
}

export function viewerNameForCampaign(): string {
  if (viewerOverride !== undefined && viewerOverride !== '') {
    return viewerOverride;
  }
  ensureIdentityLoaded();
  return identityState.identity?.displayName ?? '';
}

function campaignUrl(id: CampaignId): string {
  const name = viewerNameForCampaign();
  return apiUrl(paths.API_CAMPAIGN) + `?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
}

/** Bind the store to a campaign and load it. Idempotent per id. */
export async function openCampaign(id: CampaignId): Promise<void> {
  if (campaignState.id !== id) {
    campaignState.id = id;
    campaignState.model = undefined;
    campaignState.status = 'idle';
    campaignState.error = '';
    if (watching) {
      // A live watch follows the re-bind onto the new campaign's room.
      ensureChannel();
    }
  }
  await refreshCampaign();
}

export async function refreshCampaign(): Promise<void> {
  const id = campaignState.id;
  if (id === undefined) {
    return;
  }
  if (campaignState.model === undefined) {
    campaignState.status = 'loading';
  }
  try {
    const res = await fetch(campaignUrl(id));
    if (!res.ok) {
      throw new Error(`campaign fetch failed: ${res.status}`);
    }
    const model = await res.json() as CampaignModel;
    // A stale response (older rev) never regresses the store.
    if (campaignState.model === undefined || model.rev >= campaignState.model.rev) {
      campaignState.model = model;
    }
    campaignState.status = 'ok';
    campaignState.error = '';
  } catch (err) {
    // A failed refresh keeps its rows (lobby rule): only the STATUS flips.
    campaignState.status = campaignState.model === undefined ? 'error' : 'ok';
    campaignState.error = campaignState.model === undefined ? 'Could not load the campaign. Please try again.' : '';
  }
}

// ── The push channel (primary) + the bounded poll (fallback) ────────────────
//
// PUSH FIRST, POLL AS A FLOOR — the lobby/transport shape. The campaign's own
// WS room (`campaignChannel`) broadcasts the document's revision on every
// mutation; while it is healthy the poll stretches to the long interval, and
// against an older server (no room) it degrades to exactly the old cadence.

let channelHandle: CampaignChannelHandle | undefined;
let channelKey: string | undefined;

function ensureChannel(): void {
  const id = campaignState.id;
  if (id === undefined) {
    closeChannel();
    return;
  }
  const wsBase = wsBaseUrl();
  const key = wsBase + '::' + id;
  if (channelKey === key && channelHandle !== undefined) {
    return;
  }
  closeChannel();
  channelKey = key;
  channelHandle = openCampaignChannel(wsBase, id, () => {
    // The push says «newer rev exists» — the guarded fetch is the authority.
    void refreshCampaign();
  }, () => rearmPoll(0));
}

function closeChannel(): void {
  channelHandle?.close();
  channelHandle = undefined;
  channelKey = undefined;
}

function channelHealthy(): boolean {
  const id = campaignState.id;
  return id !== undefined && campaignChannelHealthy(wsBaseUrl(), id);
}

function pollDelayMs(): number {
  if (channelHealthy()) {
    // The channel carries every change; the poll is a safety floor only.
    return 30_000;
  }
  const phase = campaignState.model?.phase;
  const busy = phase === 'missionActive' || phase === 'interlude' || phase === 'generated';
  return busy ? 5_000 : 30_000;
}

let watching = false;

function rearmPoll(delayMs?: number): void {
  if (!watching) {
    return;
  }
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
  }
  pollTimer = window.setTimeout(() => {
    void refreshCampaign().finally(() => rearmPoll());
  }, delayMs ?? pollDelayMs());
}

/**
 * Watch the bound campaign while a surface is open: subscribe its push
 * channel and keep the bounded poll floor (5 s busy / 30 s quiet; 30 s flat
 * while the channel is healthy).
 */
export function startCampaignWatch(): void {
  stopCampaignWatch();
  watching = true;
  ensureChannel();
  rearmPoll();
}

export function stopCampaignWatch(): void {
  watching = false;
  closeChannel();
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }
}

export function resetCampaignState(): void {
  stopCampaignWatch();
  campaignState.id = undefined;
  campaignState.model = undefined;
  campaignState.status = 'idle';
  campaignState.error = '';
  campaignState.launching = false;
  campaignState.submittingCarryover = false;
}

/**
 * Launch the next mission (creator-only; the server is the gate). Returns the
 * creator's PlayerId in the new mission on success — the caller navigates.
 * Idempotent server-side: a double press converges on the same game.
 */
export async function launchCampaignMission(): Promise<{gameId: string, yourPlayerId?: PlayerId} | undefined> {
  const id = campaignState.id;
  if (id === undefined || campaignState.launching) {
    return undefined;
  }
  campaignState.launching = true;
  campaignState.error = '';
  try {
    const name = viewerNameForCampaign();
    const res = await fetch(apiUrl(paths.API_CAMPAIGN_LAUNCH) + `?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, {method: 'POST'});
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || 'launch failed');
    }
    const json = JSON.parse(text) as {gameId: string, yourPlayerId?: PlayerId, model?: CampaignModel};
    if (json.model !== undefined) {
      campaignState.model = json.model;
    }
    return {gameId: json.gameId, yourPlayerId: json.yourPlayerId};
  } catch (err) {
    campaignState.error = 'Could not launch the mission. Please try again.';
    return undefined;
  } finally {
    campaignState.launching = false;
  }
}

/**
 * Submit / revise the viewer's project carryover selection («Наследие
 * проектов»). `playerId` is the OWNER's seat in the source mission — the
 * bearer credential the server validates against.
 */
export async function submitCampaignCarryover(playerId: PlayerId, cards: ReadonlyArray<CardName>): Promise<boolean> {
  const id = campaignState.id;
  if (id === undefined || campaignState.submittingCarryover) {
    return false;
  }
  campaignState.submittingCarryover = true;
  try {
    const res = await fetch(apiUrl(paths.API_CAMPAIGN_CARRYOVER) + `?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({playerId, cards}),
      headers: {'Content-Type': 'application/json'},
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || 'carryover failed');
    }
    const model = JSON.parse(text) as CampaignModel;
    if (campaignState.model === undefined || model.rev >= campaignState.model.rev) {
      campaignState.model = model;
    }
    return true;
  } catch (err) {
    campaignState.error = 'Could not save the project selection. Please try again.';
    return false;
  } finally {
    campaignState.submittingCarryover = false;
  }
}
