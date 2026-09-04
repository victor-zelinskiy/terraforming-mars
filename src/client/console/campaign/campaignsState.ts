// «Мои кампании» — the module reactive store behind the campaigns list.
//
// The list is PARTICIPANT-scoped by the active identity name (the campaign
// identity model — same as the lobby). The store follows the lobby's rules:
// a failed refresh keeps its rows and only flips STATUS when there is nothing
// to show; opening the screen is an unconditional refresh; the identity is an
// INPUT that can arrive late. Realtime: campaign mutations bump the LOBBY
// revision server-side, so the menu's lobby push/refresh cycle re-asks this
// store too; a slow poll while the overlay is open is the floor.
//
// The overlay's UI state (tab / cursor / confirm) lives HERE, not in the
// component: the menu's command bar reads it reactively, and a return from
// the Campaign Map (a full navigation) restores it through sessionStorage.

import {reactive} from 'vue';
import {paths} from '../../../common/app/paths';
import {CampaignId} from '../../../common/Types';
import {CampaignSummaryModel} from '../../../common/campaign/CampaignSummary';
import {apiUrl} from '../../utils/runtimeConfig';
import {ensureIdentityLoaded, identityState} from '../../components/mainMenu/identity/identityState';
import {CampaignsTab} from './campaignListModel';

export type CampaignsListStatus = 'idle' | 'loading' | 'ok' | 'error';

export const campaignsState = reactive({
  status: 'idle' as CampaignsListStatus,
  rows: [] as Array<CampaignSummaryModel>,
  refreshing: false,
  /** Which identity the current rows were loaded for (a switch reloads). */
  loadedForName: '',
  // ---- «Мои кампании» overlay UI state ----
  tab: 'active' as CampaignsTab,
  cursor: 0,
  /** The campaign the delete confirm is standing over (undefined = closed). */
  confirmId: undefined as CampaignId | undefined,
  deleting: false,
  /** English i18n key of the last delete failure ('' = none). */
  deleteError: '',
  /** Campaign to focus after the next successful load (return from the map). */
  pendingFocusId: undefined as CampaignId | undefined,
});

function viewerName(): string {
  ensureIdentityLoaded();
  return identityState.identity?.displayName ?? '';
}

let inFlight = false;
let askAgain = false;

/** The ONE refresh path — every trigger (open, push, poll, RT, delete) funnels here. */
export async function refreshCampaigns(): Promise<void> {
  const name = viewerName();
  if (name === '') {
    campaignsState.rows = [];
    campaignsState.status = 'idle';
    campaignsState.loadedForName = '';
    return;
  }
  if (inFlight) {
    askAgain = true;
    return;
  }
  inFlight = true;
  campaignsState.refreshing = true;
  if (campaignsState.status === 'idle' || campaignsState.loadedForName !== name) {
    campaignsState.status = 'loading';
  }
  try {
    const res = await fetch(apiUrl(paths.API_CAMPAIGNS) + '?name=' + encodeURIComponent(name));
    if (!res.ok) {
      throw new Error(`campaigns list failed (${res.status})`);
    }
    const rows = await res.json() as Array<CampaignSummaryModel>;
    campaignsState.rows = Array.isArray(rows) ? rows : [];
    campaignsState.status = 'ok';
    campaignsState.loadedForName = name;
  } catch (err) {
    // The lobby rule: rows survive a failed refresh; only STATUS may flip,
    // and only when there is nothing to show for this identity.
    if (campaignsState.status !== 'ok' || campaignsState.loadedForName !== name) {
      campaignsState.rows = [];
      campaignsState.status = 'error';
    }
  } finally {
    campaignsState.refreshing = false;
    inFlight = false;
    if (askAgain) {
      askAgain = false;
      void refreshCampaigns();
    }
  }
}

// Poll floor while the overlay is open (push via the lobby channel is primary).
const CAMPAIGNS_POLL_MS = 15_000;
let pollTimer: number | undefined;

export function startCampaignsWatch(): void {
  stopCampaignsWatch();
  const arm = () => {
    // window.setTimeout paired with window.clearTimeout (the jsdom rule).
    pollTimer = window.setTimeout(() => {
      void refreshCampaigns().finally(() => {
        if (pollTimer !== undefined) {
          arm();
        }
      });
    }, CAMPAIGNS_POLL_MS);
  };
  arm();
}

export function stopCampaignsWatch(): void {
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }
}

/**
 * CASCADE delete of one campaign (creator-only — the server enforces it).
 * Returns true on success; on refusal/failure sets `deleteError` to the
 * English key the confirm overlay renders.
 */
export async function deleteCampaignCascade(id: CampaignId): Promise<boolean> {
  if (campaignsState.deleting) {
    return false; // The pending guard — a repeat press has nowhere to land.
  }
  campaignsState.deleting = true;
  campaignsState.deleteError = '';
  try {
    const name = viewerName();
    const query = '?id=' + encodeURIComponent(id) + '&name=' + encodeURIComponent(name);
    const res = await fetch(apiUrl(paths.API_CAMPAIGN_DELETE) + query, {method: 'POST'});
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      campaignsState.deleteError = text.includes('creator') ?
        'Only the campaign creator can delete the campaign' :
        'Could not delete the campaign';
      return false;
    }
    await refreshCampaigns();
    return true;
  } catch (err) {
    campaignsState.deleteError = 'Could not delete the campaign';
    return false;
  } finally {
    campaignsState.deleting = false;
  }
}

// ---- Return-from-map restore (the map entry is a full navigation) ----------

const RETURN_KEY = 'tm_campaigns_return';

/** Called right before navigating into the Campaign Map from this list. */
export function rememberCampaignsReturn(id: CampaignId): void {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({tab: campaignsState.tab, id}));
  } catch (err) {
    // Storage may be unavailable — the restore is best-effort.
  }
}

/** One-shot: the menu consumes this on mount to reopen the list where it was. */
export function takeCampaignsReturn(): {tab: CampaignsTab, id: CampaignId} | undefined {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (raw === null) {
      return undefined;
    }
    sessionStorage.removeItem(RETURN_KEY);
    const parsed = JSON.parse(raw) as {tab?: unknown, id?: unknown};
    const tab: CampaignsTab = parsed.tab === 'completed' ? 'completed' : 'active';
    if (typeof parsed.id !== 'string' || parsed.id.charAt(0) !== 'c') {
      return undefined;
    }
    return {tab, id: parsed.id as CampaignId};
  } catch (err) {
    return undefined;
  }
}
