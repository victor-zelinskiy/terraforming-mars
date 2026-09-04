// «Мои кампании» — the module reactive store behind the campaigns list.
//
// MULTI-SOURCE, the lobby way: the list is fed by the app's OWN server plus
// every LAN host the LOBBY model has verified (host-as-server — a guest sees
// the campaign they were seated into on another couch). The campaigns store
// deliberately runs NO probing engine of its own: LAN endpoints, liveness and
// host departure are owned by `lobbyState` (its sources live while a
// lobby-consuming screen is open — the campaigns screen opens the lobby list
// exactly like «Мои партии» does), and this store only fetches
// `api/campaigns` from endpoints the lobby has already resolved. Staleness is
// therefore a MIRROR of the lobby source's status, never a second opinion.
//
// The store follows the lobby's rules: a failed refresh keeps its rows and
// only flips STATUS when there is nothing to show; opening the screen is an
// unconditional refresh; the identity is an INPUT that can arrive late.
// Realtime: campaign mutations bump the LOBBY revision server-side, so the
// per-host lobby push channels re-ask this store too; a slow poll while the
// overlay is open is the floor.
//
// The overlay's UI state (tab / cursor / confirm) lives HERE, not in the
// component: the menu's command bar reads it reactively, and a return from
// the Campaign Map (a full navigation) restores it through sessionStorage.

import {reactive} from 'vue';
import {paths} from '../../../common/app/paths';
import {CampaignId} from '../../../common/Types';
import {CampaignSummaryModel} from '../../../common/campaign/CampaignSummary';
import {apiUrl} from '../../utils/runtimeConfig';
import {ServerEndpoint, pinServerEndpoint} from '../../utils/serverEndpoints';
import {ensureIdentityLoaded, identityState} from '../../components/mainMenu/identity/identityState';
import {LOCAL_SOURCE_ID, lobbyState} from '../../components/mainMenu/lobbyState';
import {CampaignSourceRow, CampaignSourceSlice, CampaignsTab, mergeCampaignSources} from './campaignListModel';

export type CampaignsListStatus = 'idle' | 'loading' | 'ok' | 'error';

/** LAN campaigns probe budget (the lobby already verified the endpoint, so
 *  this bounds only a host that died between the two asks). */
const LAN_CAMPAIGNS_TIMEOUT_MS = 6_000;

type SourceEntry = {
  hostLabel: string;
  endpoint?: ServerEndpoint;
  summaries: Array<CampaignSummaryModel>;
};

export const campaignsState = reactive({
  /** The LOCAL source's answer state (drives the loading/error/empty split). */
  status: 'idle' as CampaignsListStatus,
  /** The merged, deduped row set the screen shows (local first). */
  rows: [] as Array<CampaignSourceRow>,
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

/** Per-source answers, merged into `rows` by {@link rebuildRows}. */
const sourceRows = new Map<string, SourceEntry>();

function viewerName(): string {
  ensureIdentityLoaded();
  return identityState.identity?.displayName ?? '';
}

/** Per-source request generation — a late answer never overwrites a newer one. */
const seqs = new Map<string, number>();
function nextSeq(sourceId: string): number {
  const next = (seqs.get(sourceId) ?? 0) + 1;
  seqs.set(sourceId, next);
  return next;
}

function campaignsQuery(name: string): string {
  return `?name=${encodeURIComponent(name)}`;
}

async function refreshLocalCampaigns(name: string): Promise<void> {
  const seq = nextSeq(LOCAL_SOURCE_ID);
  if (campaignsState.status === 'idle' || campaignsState.loadedForName !== name) {
    campaignsState.status = 'loading';
  }
  try {
    const res = await fetch(apiUrl(paths.API_CAMPAIGNS) + campaignsQuery(name));
    if (!res.ok) {
      throw new Error(`campaigns list failed (${res.status})`);
    }
    const summaries = await res.json() as Array<CampaignSummaryModel>;
    if (seqs.get(LOCAL_SOURCE_ID) !== seq) {
      return;
    }
    sourceRows.set(LOCAL_SOURCE_ID, {hostLabel: '', endpoint: undefined, summaries: Array.isArray(summaries) ? summaries : []});
    campaignsState.status = 'ok';
    campaignsState.loadedForName = name;
  } catch (err) {
    if (seqs.get(LOCAL_SOURCE_ID) !== seq) {
      return;
    }
    // The lobby rule: rows survive a failed refresh; only STATUS may flip,
    // and only when there is nothing to show for this identity.
    if (campaignsState.status !== 'ok' || campaignsState.loadedForName !== name) {
      sourceRows.delete(LOCAL_SOURCE_ID);
      campaignsState.status = 'error';
    }
  }
}

/** One LAN host's campaigns, from the endpoint the LOBBY verified. */
async function refreshLanCampaigns(sourceId: string, hostLabel: string, endpoint: ServerEndpoint, name: string): Promise<void> {
  const seq = nextSeq(sourceId);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), LAN_CAMPAIGNS_TIMEOUT_MS);
  try {
    const res = await fetch(`${endpoint.apiBase}/${paths.API_CAMPAIGNS}${campaignsQuery(name)}`, {signal: controller.signal});
    if (res.status === 404) {
      // An older host build without the campaigns route — an honest empty
      // answer, never an error loop.
      if (seqs.get(sourceId) === seq) {
        sourceRows.set(sourceId, {hostLabel, endpoint, summaries: []});
      }
      return;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const summaries = await res.json() as Array<CampaignSummaryModel>;
    if (seqs.get(sourceId) !== seq) {
      return;
    }
    sourceRows.set(sourceId, {hostLabel, endpoint, summaries: Array.isArray(summaries) ? summaries : []});
  } catch (err) {
    // Keep what we last saw — the rebuild marks the rows stale off the LOBBY
    // source's status, and the lobby's staleness engine owns dropping the host.
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Merge the per-source answers against the lobby's CURRENT source set: a host
 * that left the network takes its campaigns with it (that is the lobby saying
 * so); a host that merely stopped answering keeps them, marked stale.
 */
function rebuildRows(): void {
  const slices: Array<CampaignSourceSlice> = [];
  const alive = new Set<string>([LOCAL_SOURCE_ID]);
  const local = sourceRows.get(LOCAL_SOURCE_ID);
  if (local !== undefined) {
    slices.push({sourceId: LOCAL_SOURCE_ID, hostLabel: '', endpoint: undefined, stale: false, summaries: local.summaries});
  }
  for (const source of lobbyState.sources) {
    if (source.kind !== 'lan') {
      continue;
    }
    alive.add(source.id);
    const entry = sourceRows.get(source.id);
    if (entry === undefined) {
      continue;
    }
    slices.push({
      sourceId: source.id,
      hostLabel: source.label,
      endpoint: entry.endpoint,
      stale: source.status === 'unreachable',
      summaries: entry.summaries,
    });
  }
  for (const id of [...sourceRows.keys()]) {
    if (!alive.has(id)) {
      sourceRows.delete(id);
    }
  }
  campaignsState.rows = mergeCampaignSources(slices);
}

let inFlight = false;
let askAgain = false;

/** The ONE refresh path — every trigger (open, push, poll, RT, delete) funnels here. */
export async function refreshCampaigns(): Promise<void> {
  const name = viewerName();
  if (name === '') {
    sourceRows.clear();
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
  try {
    // LAN endpoints come from the lobby model (verified there); a source the
    // lobby has not resolved yet is simply asked on the next trigger — the
    // lobby's own refresh completing is one of them (`lastRefreshAt` watcher).
    const lan = lobbyState.sources
      .filter((s) => s.kind === 'lan' && s.endpoint !== undefined)
      .map((s) => ({id: s.id, label: s.label, endpoint: s.endpoint as ServerEndpoint}));
    await Promise.all([
      refreshLocalCampaigns(name),
      ...lan.map((s) => refreshLanCampaigns(s.id, s.label, s.endpoint, name)),
    ]);
    rebuildRows();
  } finally {
    campaignsState.refreshing = false;
    inFlight = false;
    if (askAgain) {
      askAgain = false;
      void refreshCampaigns();
    }
  }
}

// Poll floor while the overlay is open (push via the lobby channels is primary).
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

/** The row the cursor/confirm names, resolved by campaign id. */
export function campaignRowById(id: CampaignId): CampaignSourceRow | undefined {
  return campaignsState.rows.find((r) => r.summary.id === id);
}

/**
 * Entering a row's Campaign Map must land on the SERVER the campaign lives on.
 * A LAN row pins its campaign id to the host's endpoint — `runtimeConfig`
 * consults the pin by the map page's own `?id=`, which transparently routes
 * the model fetch, the poll, the carryover submit and the launch. Also stamps
 * the return memory (tab + row) the menu restores on B.
 */
export function pinCampaignRow(row: CampaignSourceRow): void {
  rememberCampaignsReturn(row.summary.id);
  if (row.endpoint !== undefined) {
    pinServerEndpoint(row.summary.id, row.endpoint);
  }
}

/**
 * CASCADE delete of one campaign (creator-only — the server enforces it),
 * routed to the SERVER the campaign lives on (a creator may be sitting at
 * another machine of the same LAN under their own name).
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
    const endpoint = campaignRowById(id)?.endpoint;
    const path = paths.API_CAMPAIGN_DELETE;
    const base = endpoint !== undefined ? `${endpoint.apiBase}/${path}` : apiUrl(path);
    const query = '?id=' + encodeURIComponent(id) + '&name=' + encodeURIComponent(name);
    const res = await fetch(base + query, {method: 'POST'});
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

/** Tests: drop the module-private per-source memory (bundle-shared state). */
export function resetCampaignsSourcesForTesting(): void {
  sourceRows.clear();
  seqs.clear();
}
