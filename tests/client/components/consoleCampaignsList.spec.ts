import {mount, flushPromises, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import ConsoleCampaignsList from '@/client/components/console/menu/ConsoleCampaignsList.vue';
import {
  campaignsState, refreshCampaigns, resetCampaignsSourcesForTesting, pinCampaignRow,
} from '@/client/console/campaign/campaignsState';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {lobbyState, stopLobbyWatch, LobbySource} from '@/client/components/mainMenu/lobbyState';
import {pinnedServerEndpoint} from '@/client/utils/serverEndpoints';
import {CampaignSummaryModel, CampaignViewerState} from '@/common/campaign/CampaignSummary';
import {CampaignPhase} from '@/common/campaign/CampaignTypes';
import {CampaignId} from '@/common/Types';
import {BoardName} from '@/common/boards/BoardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

let seq = 0;
function summary(overrides: Partial<CampaignSummaryModel> = {}): CampaignSummaryModel {
  seq++;
  return {
    id: `c${String(seq).padStart(12, '0')}` as CampaignId,
    rev: 1,
    name: `Campaign ${seq}`,
    createdTimeMs: 1000,
    lastActivityMs: 1000 + seq,
    phase: 'generated' as CampaignPhase,
    pointer: 0,
    missionCount: 4,
    completedMissions: 0,
    missionGamesCount: 0,
    currentBoard: BoardName.THARSIS,
    seats: [
      {seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0},
      {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
    ],
    you: {seat: 0},
    isCreator: true,
    state: 'launchReady' as CampaignViewerState,
    yourTitlePoints: 0,
    ...overrides,
  };
}

const LAN_BASE = 'http://192.168.1.7:17325';
const LAN_ENDPOINT = {apiBase: LAN_BASE, wsBase: 'ws://192.168.1.7:17325'};

function lanSource(overrides: Partial<LobbySource> = {}): LobbySource {
  return {
    id: 'lan:couch', kind: 'lan', label: 'КУШЕТКА', endpoint: LAN_ENDPOINT,
    status: 'ok', lastOkAt: 1, failures: 0, lastError: '', live: true, versionMismatch: false,
    ...overrides,
  };
}

// The list is fed through the store's ONE fetch path — a URL-aware stub with
// memory (a stubbed server must stay consistent with its own answers).
let localRows: Array<CampaignSummaryModel> = [];
let lanRows: Array<CampaignSummaryModel> = [];
let localFails = false;
let deletePosts: Array<string> = [];

function press(button: string): GamepadIntent {
  return {kind: 'press', button} as unknown as GamepadIntent;
}
function nav(dir: 'up' | 'down'): GamepadIntent {
  return {kind: 'nav', dir} as unknown as GamepadIntent;
}

const STUBS = {
  ConsoleScrollArea: {template: '<div class="scroll-stub"><slot/></div>', methods: {ensureVisible: () => {}}},
  PremiumMapFingerprint: true,
  GamepadGlyph: true,
};

describe('ConsoleCampaignsList', () => {
  let savedFetch: unknown;
  let savedIdentity: typeof identityState.identity;
  let savedLoaded: boolean;
  let savedSources: ReadonlyArray<LobbySource>;

  function resetStore(): void {
    resetCampaignsSourcesForTesting();
    campaignsState.status = 'idle';
    campaignsState.rows = [];
    campaignsState.refreshing = false;
    campaignsState.loadedForName = '';
    campaignsState.tab = 'active';
    campaignsState.cursor = 0;
    campaignsState.confirmId = undefined;
    campaignsState.deleting = false;
    campaignsState.deleteError = '';
    campaignsState.pendingFocusId = undefined;
  }

  beforeEach(() => {
    savedFetch = (globalThis as {fetch?: unknown}).fetch;
    savedIdentity = identityState.identity;
    savedLoaded = identityState.loaded;
    savedSources = lobbyState.sources;
    localRows = [];
    lanRows = [];
    localFails = false;
    deletePosts = [];
    (globalThis as {fetch?: unknown}).fetch = async (url: string, init?: {method?: string}) => {
      const u = String(url);
      if (init?.method === 'POST' && u.includes('campaign/delete')) {
        deletePosts.push(u);
        const id = new URL(u, 'http://x').searchParams.get('id');
        localRows = localRows.filter((r) => r.id !== id);
        lanRows = lanRows.filter((r) => r.id !== id);
        return {ok: true, status: 200, json: async () => ({}), text: async () => ''};
      }
      if (u.includes('api/campaigns')) {
        if (u.startsWith(LAN_BASE)) {
          return {ok: true, status: 200, json: async () => lanRows, text: async () => ''};
        }
        if (localFails) {
          throw new Error('network down');
        }
        return {ok: true, status: 200, json: async () => localRows, text: async () => ''};
      }
      // Anything else (joinable, archive) answers an empty list.
      return {ok: true, status: 200, json: async () => [], text: async () => ''};
    };
    identityState.identity = {displayName: 'Alice', normalizedName: 'alice', cubeColor: 'blue', source: 'local-storage', temporary: false} as typeof identityState.identity;
    identityState.loaded = true;
    lobbyState.sources = [];
    resetStore();
  });

  afterEach(() => {
    (globalThis as {fetch?: unknown}).fetch = savedFetch;
    identityState.identity = savedIdentity;
    identityState.loaded = savedLoaded;
    lobbyState.sources = savedSources;
    resetStore();
    // The delete path refreshes the lobby too — never leak its timers into
    // later specs (module state is bundle-shared under mochapack).
    stopLobbyWatch();
  });

  async function mountList(): Promise<VueWrapper> {
    const wrapper = mount(ConsoleCampaignsList, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: STUBS},
    });
    await flushPromises();
    return wrapper;
  }

  it('renders ONE row per campaign with tab counts; active is the default slice', async () => {
    localRows = [
      summary({state: 'launchReady'}),
      summary({phase: 'missionActive', state: 'missionActive'}),
      summary({phase: 'finished', state: 'finished'}),
    ];
    const wrapper = await mountList();
    expect(wrapper.findAll('.cm-camp')).has.length(2);
    const counts = wrapper.findAll('.cm-gametab__count').map((c) => c.text());
    expect(counts).deep.eq(['2', '1']);
  });

  it('sorts action-required campaigns first and marks them with the turn accent', async () => {
    const calm = summary({state: 'waitingLaunch', isCreator: false, lastActivityMs: 99999});
    const turn = summary({phase: 'missionActive', state: 'yourTurn', lastActivityMs: 10});
    localRows = [calm, turn];
    const wrapper = await mountList();
    const rows = wrapper.findAll('.cm-camp');
    expect(rows[0].text()).contains(turn.name);
    expect(rows[0].find('.cm-game__turn').exists()).is.true;
    expect(rows[1].find('.cm-game__turn').exists()).is.false;
  });

  it('L3 toggles the slice without wiping it; the cursor resets to the top row', async () => {
    localRows = [
      summary({state: 'launchReady'}),
      summary({phase: 'abandoned', state: 'abandoned'}),
    ];
    const wrapper = await mountList();
    (wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean}).handleIntent(nav('down'));
    (wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean}).handleIntent(press('stickL'));
    await flushPromises();
    expect(campaignsState.tab).eq('completed');
    expect(campaignsState.cursor).eq(0);
    const archived = wrapper.findAll('.cm-camp');
    expect(archived).has.length(1);
    // Abandoned is visually distinct from an ordinary completion.
    expect(archived[0].find('.cm-camp__state--abandoned').exists()).is.true;
  });

  it('X opens the cascade confirm for the creator; B cancels back to the SAME row', async () => {
    localRows = [summary({isCreator: true, missionGamesCount: 2})];
    const wrapper = await mountList();
    const vm = wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean};
    vm.handleIntent(press('secondary'));
    await flushPromises();
    expect(campaignsState.confirmId).eq(localRows[0].id);
    expect(wrapper.find('.cm-overlay--nested').exists()).is.true;
    expect(wrapper.find('.cm-overlay--nested').text()).contains('2');
    // While the confirm stands, navigation is swallowed (stale-focus guard).
    vm.handleIntent(nav('down'));
    expect(campaignsState.cursor).eq(0);
    vm.handleIntent(press('back'));
    await flushPromises();
    expect(campaignsState.confirmId).eq(undefined);
    expect(campaignsState.cursor).eq(0);
    expect(wrapper.find('.cm-overlay--nested').exists()).is.false;
  });

  it('a non-creator cannot even open the delete confirm', async () => {
    localRows = [summary({isCreator: false, state: 'waitingLaunch'})];
    const wrapper = await mountList();
    (wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean}).handleIntent(press('secondary'));
    await flushPromises();
    expect(campaignsState.confirmId).eq(undefined);
    expect(wrapper.find('.cm-overlay--nested').exists()).is.false;
  });

  it('confirm → delete: one POST even under key repeat; the row leaves; focus clamps', async () => {
    localRows = [summary({isCreator: true})];
    const wrapper = await mountList();
    const vm = wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean};
    vm.handleIntent(press('secondary'));
    await flushPromises();
    // Key repeat: three primaries land while the first POST is in flight.
    vm.handleIntent(press('confirm'));
    vm.handleIntent(press('confirm'));
    vm.handleIntent(press('confirm'));
    await flushPromises();
    expect(deletePosts).has.length(1);
    expect(campaignsState.confirmId).eq(undefined);
    expect(wrapper.findAll('.cm-camp')).has.length(0);
    expect(wrapper.find('.cm-gamelist__empty').exists()).is.true;
  });

  it('a failed load with nothing to show renders the ERROR state, never «пусто»', async () => {
    localFails = true;
    const wrapper = await mountList();
    expect(campaignsState.status).eq('error');
    expect(wrapper.find('.cm-gamelist__empty--error').exists()).is.true;
  });

  it('a realtime move active → completed re-slices without touching the tab', async () => {
    const c = summary({state: 'launchReady'});
    localRows = [c];
    const wrapper = await mountList();
    expect(wrapper.findAll('.cm-camp')).has.length(1);
    // The campaign finished server-side; the next (push-driven) refresh re-asks.
    localRows = [{...c, phase: 'finished' as CampaignPhase, state: 'finished' as CampaignViewerState}];
    await refreshCampaigns();
    await flushPromises();
    expect(campaignsState.tab).eq('active');
    expect(wrapper.findAll('.cm-camp')).has.length(0);
    const counts = wrapper.findAll('.cm-gametab__count').map((n) => n.text());
    expect(counts).deep.eq(['0', '1']);
  });

  // ── LAN (multi-source) ─────────────────────────────────────────────────────

  it('a campaign hosted on a LAN couch renders with its host chip beside the local ones', async () => {
    localRows = [summary({})];
    lanRows = [summary({state: 'waitingLaunch', isCreator: false})];
    lobbyState.sources = [lanSource()];
    const wrapper = await mountList();
    const rows = wrapper.findAll('.cm-camp');
    expect(rows).has.length(2);
    const hostRow = rows.find((r) => r.text().includes(lanRows[0].name));
    expect(hostRow, 'the LAN campaign row').is.not.undefined;
    expect(hostRow!.find('.cm-game__lanhost').text()).eq('КУШЕТКА');
    // The local row carries no host chip.
    const localRow = rows.find((r) => r.text().includes(localRows[0].name));
    expect(localRow!.find('.cm-game__lanhost').exists()).is.false;
  });

  it('entering a LAN row PINS the campaign id to the host endpoint (the map then routes there)', async () => {
    lanRows = [summary({state: 'waitingLaunch', isCreator: false})];
    lobbyState.sources = [lanSource()];
    await mountList();
    const row = campaignsState.rows.find((r) => r.summary.id === lanRows[0].id);
    expect(row, 'the LAN row reached the store').is.not.undefined;
    pinCampaignRow(row!);
    expect(pinnedServerEndpoint(lanRows[0].id)).deep.eq(LAN_ENDPOINT);
  });

  it('a quiet host keeps its rows, marked «не отвечает» and not enterable; delete stays closed', async () => {
    lanRows = [summary({isCreator: true})];
    lobbyState.sources = [lanSource()];
    const wrapper = await mountList();
    expect(wrapper.findAll('.cm-camp')).has.length(1);
    // The host stops answering: the LOBBY flips the source; rows survive, stale.
    lobbyState.sources = [lanSource({status: 'unreachable'})];
    await refreshCampaigns();
    await flushPromises();
    const row = wrapper.find('.cm-camp');
    expect(row.classes()).contains('cm-game--disabled');
    expect(row.find('.cm-game__note').exists()).is.true;
    const vm = wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean};
    vm.handleIntent(press('secondary'));
    await flushPromises();
    expect(campaignsState.confirmId).eq(undefined);
  });

  it('a host that LEFT the network takes its campaigns with it (the lobby said so)', async () => {
    lanRows = [summary({})];
    lobbyState.sources = [lanSource()];
    const wrapper = await mountList();
    expect(wrapper.findAll('.cm-camp')).has.length(1);
    lobbyState.sources = [];
    await refreshCampaigns();
    await flushPromises();
    expect(wrapper.findAll('.cm-camp')).has.length(0);
  });

  it('the cascade delete of a LAN campaign is routed to ITS host, never the local server', async () => {
    lanRows = [summary({isCreator: true})];
    lobbyState.sources = [lanSource()];
    const wrapper = await mountList();
    const vm = wrapper.vm as unknown as {handleIntent(i: GamepadIntent): boolean};
    vm.handleIntent(press('secondary'));
    await flushPromises();
    expect(campaignsState.confirmId).eq(lanRows[0].id);
    vm.handleIntent(press('confirm'));
    await flushPromises();
    expect(deletePosts).has.length(1);
    expect(deletePosts[0].startsWith(LAN_BASE), deletePosts[0]).is.true;
  });
});
