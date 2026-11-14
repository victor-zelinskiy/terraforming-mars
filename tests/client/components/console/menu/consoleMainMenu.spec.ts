/*
 * ConsoleMainMenu — the pre-game «big plates» screen: the item column, the pregame SCREENS that unfold out of it
 * («Мои партии» / «Мои кампании») and the overlays it stands (profile · roster · friends · language · options ·
 * rollback · playground · the LAN keyboard). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no
 * prop, no emit, and it EXPOSES NOTHING — `App` mounts it and no parent stands a ref on it.
 *
 * Outside a game it is the pad's owner: it claims the console intent slot (`installMenuPad`) and routes every intent
 * to the surface on screen THROUGH THAT SURFACE'S TEMPLATE REF (`this.$refs.x` before the conversion — RECIPES § R11),
 * so the spec presses through the product's own dispatch and reads what each stand-in was handed. The item a screen
 * unfolds out of and the cursored card are found through the menu's own ROOT ref (`this.$el` before — § R12); «New
 * game» navigates through the app root's port (`vueRoot(this)` before — § R26).
 *
 * A large surface: its journeys (entering a game, the LAN, deletion, the scene curtain) are the e2e's. Here — the
 * minimal honest state, what it exposes, the routing through the refs, the port, and the reactions to module state.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {paths} from '@/common/app/paths';
import {BoardName} from '@/common/boards/BoardName';
import {Phase} from '@/common/Phase';
import {JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {normalizePlayerName} from '@/common/utils/playerName';
import {$t} from '@/client/directives/i18n';
import {apiEndpointIsLocal} from '@/client/utils/runtimeConfig';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {consoleNativeState} from '@/client/console/composables/consoleNativeSurface';
import {resetSceneTransitionForTest} from '@/client/console/loadingScreenState';
import {campaignsState, resetCampaignsSourcesForTesting} from '@/client/console/campaign/campaignsState';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {profilesState} from '@/client/components/mainMenu/profilesState';
import {lobbyState, resetLobbyStateForTesting} from '@/client/components/mainMenu/lobbyState';
import {resetLobbyChannelsForTesting} from '@/client/components/mainMenu/lobbyChannel';
import {resetLanStateForTesting} from '@/client/components/mainMenu/lanState';
import {steamShortcutState} from '@/client/components/desktop/steamShortcutState';
import {APP_ROOT, AppRoot} from '@/client/components/appRoot';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setDiagnosticsOverlayOpener} from '@/client/diagnostics/diagnosticsOverlayBridge';
import ConsoleMainMenu from '@/client/components/console/menu/ConsoleMainMenu.vue';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The command bar's stand-in: the context and the verbs the menu hands it. */
const BarStub = defineComponent({
  name: 'ConsoleCommandBar',
  props: {context: String, commands: Array},
  render: () => h('div', {class: 'bar-stub'}),
});

/** Every intent a stand-in was handed through the menu's ref to it, in order. */
const heard: Array<{surface: string, intent: GamepadIntent}> = [];
/** What a stand-in answers: `true` — it took the intent; `false` — the menu's own B applies. */
let surfaceTakes = true;

/** An overlay's stand-in: its emits, and `handleIntent` — the one member the menu reads through the ref. */
function overlayStub(name: string, surface: string, emits: Array<string> = ['close']) {
  return defineComponent({
    name,
    emits,
    methods: {
      handleIntent(intent: GamepadIntent): boolean {
        heard.push({surface, intent});
        return surfaceTakes;
      },
    },
    render: () => h('div', {'class': 'overlay-stub', 'data-overlay': surface}),
  });
}

const ProfileStub = overlayStub('ConsoleProfileEditor', 'profile', ['close', 'manage-friends', 'manage-profiles']);
const ProfilesStub = overlayStub('ConsoleProfilesEditor', 'profiles');
const FriendsStub = overlayStub('ConsoleFriendsEditor', 'friends');
const LanguageStub = overlayStub('ConsoleLanguagePicker', 'language');
const OptionsStub = overlayStub('ConsoleOptionsPanel', 'options');
const AdminStub = overlayStub('ConsoleAdminRollback', 'admin');
const PlaygroundStub = overlayStub('ConsolePlaygroundHub', 'playground');
const CampaignsStub = overlayStub('ConsoleCampaignsList', 'campaigns');

/** The on-screen keyboard's stand-in: its props, its three emits, the intents it was handed. */
const KeyboardStub = defineComponent({
  name: 'ConsoleVirtualKeyboard',
  props: {initial: String, title: String, issue: String},
  emits: ['update', 'commit', 'cancel'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      heard.push({surface: 'lankeyboard', intent});
      return surfaceTakes;
    },
  },
  render: () => h('div', {class: 'vk-stub'}),
});

/** The showcase screen's stand-in: its two slots, and a record of every element it was asked to keep in view. */
const kept: Array<Element | null> = [];
const ScreenStub = defineComponent({
  name: 'ConsoleLobbyScreen',
  props: {
    kind: String, titleKey: String, tabs: Array, tab: String, state: String, stateKey: String, stateHintKey: String,
    refreshing: Boolean, items: Number,
  },
  emits: ['tab', 'grid'],
  methods: {
    ensureVisible(el: Element | null): void {
      kept.push(el);
    },
  },
  render() {
    return h('section', {class: 'cm-screen screen-stub'}, [this.$slots.band?.(), this.$slots.default?.()]);
  },
});

const STUBS = {
  GamepadGlyph: GlyphStub,
  ConsoleCommandBar: BarStub,
  ConsoleProfileEditor: ProfileStub,
  ConsoleProfilesEditor: ProfilesStub,
  ConsoleFriendsEditor: FriendsStub,
  ConsoleLanguagePicker: LanguageStub,
  ConsoleOptionsPanel: OptionsStub,
  ConsoleAdminRollback: AdminStub,
  ConsolePlaygroundHub: PlaygroundStub,
  ConsoleCampaignsList: CampaignsStub,
  ConsoleVirtualKeyboard: KeyboardStub,
  ConsoleLobbyScreen: ScreenStub,
  // The lobby CARD renders for real (it wears the cursor class the menu looks for); its board miniature does not.
  PremiumMapFingerprint: true,
};

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const Y: GamepadIntent = {kind: 'press', button: 'inspect'};

/** A summary shaped like the joinable route's — the viewer's own seat, the viewer to move. */
function game(id: string, extra: Partial<JoinableGameSummary> = {}): JoinableGameSummary {
  return {
    id: `g${id}`,
    name: id,
    createdTimeMs: 1,
    phase: Phase.RESEARCH,
    generation: 3,
    boardName: BoardName.THARSIS,
    expansions: [],
    players: [{name: 'Victor', color: 'red', isYou: true}],
    maxPlayers: 1,
    activePlayer: 'red',
    finished: false,
    you: {id: `p${id}`, color: 'red'},
    ambiguous: false,
    ...extra,
  } as JoinableGameSummary;
}

type DesktopWindow = {desktopBridge?: unknown};

describe('ConsoleMainMenu — the pre-game menu', () => {
  let savedFetch: unknown;
  let savedSteam: typeof steamShortcutState;
  /** What the server answers the «active games» ask (the archive and the campaigns answer an empty list). */
  let games: Array<JoinableGameSummary>;
  /** Every URL asked, in order. */
  let asked: Array<string>;

  function seat(displayName: string): void {
    identityState.identity = {displayName, normalizedName: normalizePlayerName(displayName), cubeColor: 'blue', source: 'local-storage', temporary: false};
  }

  /** Both lists quiet: the lobby collapses an ask made mid-flight into one replay, so one awaited promise is not enough. */
  async function settled(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      await flushPromises();
      if (!lobbyState.refreshing && !campaignsState.refreshing) {
        return;
      }
    }
    throw new Error('the lobby never settled');
  }

  async function mountMenu(root?: Partial<AppRoot>) {
    // Mounted under a host with a string ref — what a parent's ref to the menu would carry is read there.
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleMainMenu, {ref: 'menu'})]),
    });
    const wrapper = mount(Host, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: STUBS,
        provide: root === undefined ? {} : {[APP_ROOT as symbol]: root},
      },
    });
    await settled();
    const plate = (id: string) => wrapper.find(`.cm-item[data-menu-item="${id}"]`);
    const bar = () => wrapper.findComponent(BarStub);
    return {
      wrapper,
      plate,
      plates: () => wrapper.findAll('.cm-item').map((item) => item.attributes('data-menu-item')),
      cursor: () => wrapper.findAll('.cm-item').filter((item) => item.classes().includes('cm-item--cursor')).map((item) => item.attributes('data-menu-item')),
      overlays: () => wrapper.findAll('[data-overlay]').map((overlay) => overlay.attributes('data-overlay')),
      barStands: () => bar().exists(),
      context: () => bar().props('context') as string,
      commands: () => bar().props('commands') as ReadonlyArray<ConsoleCommand>,
      /** One press through the product's dispatch; the DOM it moved is rendered when this resolves. */
      press: async (intent: GamepadIntent): Promise<boolean> => {
        const taken = dispatchConsoleIntent(intent);
        await settled();
        return taken;
      },
    };
  }

  /** The plates of a named player with an empty library on the web: no CONTINUE, no Steam plate, no EXIT. */
  function quietPlates(admin: boolean): Array<string> {
    return [
      'create', 'games', 'campaigns', 'profile', 'options', 'report',
      ...(admin || apiEndpointIsLocal() ? ['admin'] : []),
      ...(admin ? ['playground'] : []),
    ];
  }

  beforeEach(() => {
    // Module state is bundle-shared: the lobby, the campaigns and the curtain start from their own zero, the identity
    // and the roster are seeded as LOADED (the menu's own load then reads no storage).
    resetLobbyStateForTesting();
    resetLobbyChannelsForTesting();
    resetLanStateForTesting();
    resetCampaignsSourcesForTesting();
    resetSceneTransitionForTest();
    campaignsState.status = 'idle';
    campaignsState.rows = [];
    campaignsState.refreshing = false;
    campaignsState.confirmId = undefined;
    seat('Victor');
    identityState.loaded = true;
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = true;
    savedSteam = {...steamShortcutState};
    heard.length = 0;
    kept.length = 0;
    surfaceTakes = true;
    games = [];
    asked = [];
    savedFetch = (globalThis as {fetch?: unknown}).fetch;
    (globalThis as {fetch?: unknown}).fetch = async (url: string) => {
      const u = String(url);
      asked.push(u);
      const list = u.includes(paths.API_GAMES_JOINABLE) && !u.includes('status=finished') ? games : [];
      return {ok: true, status: 200, json: async () => list, text: async () => ''};
    };
  });

  afterEach(() => {
    (globalThis as {fetch?: unknown}).fetch = savedFetch;
    delete (window as unknown as DesktopWindow).desktopBridge;
    Object.assign(steamShortcutState, savedSteam);
    resetLobbyStateForTesting();
    resetLobbyChannelsForTesting();
    resetLanStateForTesting();
    resetCampaignsSourcesForTesting();
    campaignsState.status = 'idle';
    campaignsState.rows = [];
    campaignsState.refreshing = false;
    campaignsState.tab = 'active';
    campaignsState.cursor = 0;
    campaignsState.confirmId = undefined;
    campaignsState.deleteError = '';
    campaignsState.pendingFocusId = undefined;
    identityState.identity = undefined;
    identityState.loaded = false;
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = false;
    menuPadState.textEntry = false;
  });

  it('mounts in its minimal honest state — a named player, an empty library, no desktop shell — without a warning', async () => {
    // (`globalConfig` turns every Vue warning into a throw: a mount that returns is a mount without one.)
    const menu = await mountMenu();

    expect(menu.wrapper.find('.cm-menu').classes(), 'no overlay — neither dimmed nor receded').to.deep.eq(['cm-menu']);
    expect(menu.wrapper.find('.cm-identity__name').text()).to.eq('Victor');
    expect(menu.wrapper.find('.cm-identity__cube').classes()).to.include('player_bg_color_blue');
    expect(menu.plates()).to.deep.eq(quietPlates(false));
    expect(menu.cursor(), 'the cursor starts on the first plate').to.deep.eq(['create']);
    expect(menu.plate('create').classes(), 'with nothing to continue «New game» is the primary plate').to.include('cm-item--primary');
    expect(menu.plate('games').find('.cm-item__badge').exists(), 'an empty library wears no badge').to.eq(false);
    expect(menu.plate('profile').find('.cm-item__sub').text()).to.eq('Victor');
    expect(menu.overlays()).to.deep.eq([]);
    expect(menu.wrapper.find('.cm-overlay').exists()).to.eq(false);
    expect(menu.context()).to.eq('Main menu');
    expect(menu.commands()).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select'},
      {control: 'inspect', label: 'Language'},
    ]);
    // The lobby watch runs for the whole menu, under the player's name — and the campaigns were asked for the badge.
    expect(lobbyState.identity).to.eq('Victor');
    expect(asked.some((url) => url.includes(paths.API_GAMES_JOINABLE) && url.includes('name=Victor'))).to.eq(true);
    expect(asked.some((url) => url.includes(paths.API_CAMPAIGNS))).to.eq(true);
  });

  it('exposes nothing: what a parent\'s ref to it carries is an empty object', async () => {
    const menu = await mountMenu();
    const reach = menu.wrapper.vm.$refs.menu;
    expect(reach, 'the host holds a ref to the menu').to.not.eq(undefined);
    expect(Object.keys(reach as object), 'no parent stands a ref on it — no `defineExpose`').to.deep.eq([]);
  });

  it('owns the pad for its lifetime: the intent slot, the page\'s overflow lock and the lobby watch go with it', async () => {
    const pads = menuPadState.mountedCount;
    const surfaces = consoleNativeState.surfaces;
    const menu = await mountMenu();
    expect(menuPadState.mountedCount).to.eq(pads + 1);
    expect(consoleNativeState.surfaces).to.eq(surfaces + 1);

    // The d-pad walks the plates (no wrap — the edge is felt), and the menu swallows what it has no use for.
    expect(await menu.press(nav('down'))).to.eq(true);
    expect(menu.cursor()).to.deep.eq(['games']);
    expect(await menu.press(nav('up'))).to.eq(true);
    expect(await menu.press(nav('up'))).to.eq(true);
    expect(menu.cursor(), 'up from the first plate stays on it').to.deep.eq(['create']);
    expect(await menu.press(nav('left')), 'a sideways press moves nothing and goes no further').to.eq(true);
    expect(menu.cursor()).to.deep.eq(['create']);
    expect(await menu.press(B), 'nothing below this screen may react').to.eq(true);
    expect(menu.overlays()).to.deep.eq([]);

    menu.wrapper.unmount();
    expect(menuPadState.mountedCount).to.eq(pads);
    expect(consoleNativeState.surfaces).to.eq(surfaces);
    expect(dispatchConsoleIntent(nav('down')), 'the slot is free again').to.eq(false);
  });

  it('an overlay on screen receives the pad THROUGH ITS REF — eight overlays, each behind its own door', async () => {
    seat('admin'); // the dev door: the rollback and the playground plates stand
    const menu = await mountMenu();
    expect(menu.plates()).to.deep.eq(quietPlates(true));

    /** The overlay stands alone, the bar names it, and one intent reaches it — the very object, exactly once. */
    const expectRouted = async (surface: string, context: string | undefined) => {
      expect(menu.overlays(), `«${surface}» stands alone`).to.deep.eq([surface]);
      expect(menu.barStands() ? menu.context() : undefined, `the bar's context over «${surface}»`).to.eq(context);
      const intent = nav('down');
      const at = heard.length;
      expect(await menu.press(intent)).to.eq(true);
      expect(heard.slice(at).map((entry) => entry.surface)).to.deep.eq([surface]);
      expect(heard[at].intent, 'the intent itself is handed over').to.eq(intent);
    };

    // The identity plate → the profile; its two sub-panels are opened by ITS emits.
    await menu.wrapper.find('.cm-identity').trigger('click');
    await expectRouted('profile', 'Player profile');
    expect(menu.wrapper.find('.cm-menu').classes(), 'a dialog dims the column').to.include('cm-menu--dimmed');
    menu.wrapper.findComponent(ProfileStub).vm.$emit('manage-profiles');
    await nextTick();
    await expectRouted('profiles', 'Profiles');
    // B the roster did not take is the menu's: one level back, to the profile.
    surfaceTakes = false;
    await menu.press(B);
    expect(menu.overlays()).to.deep.eq(['profile']);
    surfaceTakes = true;
    menu.wrapper.findComponent(ProfileStub).vm.$emit('manage-friends');
    await nextTick();
    await expectRouted('friends', 'Friends');
    surfaceTakes = false;
    await menu.press(B);
    expect(menu.overlays()).to.deep.eq(['profile']);
    // …and B the profile did not take closes it.
    await menu.press(B);
    expect(menu.overlays()).to.deep.eq([]);
    surfaceTakes = true;

    // Y at the root → the language picker (it answers every intent itself; its `close` closes it).
    await menu.press(Y);
    await expectRouted('language', 'Main menu');
    menu.wrapper.findComponent(LanguageStub).vm.$emit('close');
    await nextTick();
    expect(menu.overlays()).to.deep.eq([]);

    // The plates. The settings console carries its own foot bar — the menu's is not drawn under it.
    const plates = [
      {surface: 'options', context: undefined, stub: OptionsStub},
      {surface: 'admin', context: 'Game rollback', stub: AdminStub},
      {surface: 'playground', context: 'Playground', stub: PlaygroundStub},
      {surface: 'campaigns', context: 'My campaigns', stub: CampaignsStub},
    ];
    for (const {surface, context, stub} of plates) {
      await menu.plate(surface).trigger('click');
      await settled();
      expect(menu.cursor(), 'a click moves the cursor onto its plate').to.deep.eq([surface]);
      await expectRouted(surface, context);
      menu.wrapper.findComponent(stub).vm.$emit('close');
      await nextTick();
      expect(menu.overlays()).to.deep.eq([]);
    }
    expect(heard.map((entry) => entry.surface)).to.deep.eq(
      ['profile', 'profiles', 'profiles', 'friends', 'friends', 'profile', 'language', 'options', 'admin', 'playground', 'campaigns']);
  });

  it('«Сообщить о проблеме» asks the diagnostics overlay for its REPORT — the menu mounts no surface of its own for it', async () => {
    const asked: Array<unknown> = [];
    setDiagnosticsOverlayOpener((target) => asked.push(target));
    try {
      const menu = await mountMenu();
      await menu.plate('report').trigger('click');
      await nextTick();
      expect(asked).to.deep.eq([{to: 'report'}]);
      expect(menu.overlays(), 'the report is the system overlay — nothing opens inside the menu').to.deep.eq([]);
    } finally {
      setDiagnosticsOverlayOpener(undefined);
    }
  });

  it('«Мои партии»: the lobby\'s rows as cards, newest first; the d-pad keeps the cursored card in view through the screen\'s ref', async () => {
    games = [game('older', {createdTimeMs: 1_000}), game('newer', {createdTimeMs: 2_000})];
    const menu = await mountMenu();
    expect(menu.plates()[0], 'a game with the viewer\'s seat leads the column').to.eq('continue');
    expect(menu.plate('continue').find('.cm-item__sub').text()).to.eq(`newer · ${$t('Generation')} 3 · ${$t('Your turn')}`);
    expect(menu.plate('games').find('.cm-item__badge').text()).to.eq('2');

    // The press measures the plate the screen unfolds out of (through the menu's root) and opens the screen.
    await menu.plate('games').trigger('click');
    await settled();
    expect(menu.wrapper.find('.cm-menu').classes(), 'a SCREEN recedes the column, it does not dim it').to.deep.eq(['cm-menu', 'cm-menu--screen']);
    const screen = menu.wrapper.findComponent(ScreenStub);
    expect(screen.props()).to.deep.include({kind: 'games', titleKey: 'My games', tab: 'active', state: 'list', items: 2});
    const cards = () => menu.wrapper.findAll('.cm-lcard.cm-game');
    expect(cards().map((card) => card.find('.cm-game__name').text())).to.deep.eq(['newer', 'older']);
    expect(cards().map((card) => card.classes().includes('cm-game--cursor'))).to.deep.eq([true, false]);
    expect(menu.context()).to.eq('My games');

    expect(await menu.press(nav('right'))).to.eq(true);
    expect(cards().map((card) => card.classes().includes('cm-game--cursor'))).to.deep.eq([false, true]);
    expect(kept, 'the screen was asked once').to.have.length(1);
    expect(kept[0], '…to keep the card under the cursor in view').to.eq(cards()[1].element);
    expect(menu.commands().find((command) => command.control === 'confirm')).to.deep.eq(
      {control: 'confirm', label: 'Enter game', enabled: true, highlight: true});

    await menu.press(B);
    expect(menu.wrapper.findComponent(ScreenStub).exists()).to.eq(false);
    expect(menu.wrapper.find('.cm-menu').classes()).to.deep.eq(['cm-menu']);
  });

  it('on a host the list ends with «add a host by address»: A opens the keyboard, which owns every intent through its ref', async () => {
    (window as unknown as DesktopWindow).desktopBridge = {
      getAppMode: async () => ({effective: 'host'}),
      getVersion: async () => '9.9.9',
      recheck: async () => undefined,
    };
    const menu = await mountMenu();
    expect(menu.wrapper.find('.cm-menu__foot-version-value').text(), 'the shell\'s own version leads the readout').to.eq('9.9.9');

    await menu.plate('games').trigger('click');
    await settled();
    // An empty library beside the tool: the statement stands on the stage, the cursor on the tool.
    expect(menu.wrapper.findComponent(ScreenStub).props()).to.deep.include({state: 'list', items: 2});
    expect(menu.wrapper.find('.cm-gamelist__empty > span:not(.cm-lcard__statement-glyph)').text()).to.eq($t('You have no unfinished games yet.'));
    expect(menu.wrapper.find('.cm-game--add').classes()).to.include('cm-game--cursor');
    expect(menu.commands().find((command) => command.control === 'confirm')?.label).to.eq('Add a host');

    await menu.press(A);
    const keyboard = () => menu.wrapper.findComponent(KeyboardStub);
    expect(keyboard().props()).to.deep.eq({initial: '', title: 'Host address', issue: ''});
    expect(menuPadState.textEntry, 'the key bridge goes silent — the keyboard owns input').to.eq(true);
    const intent = nav('left');
    expect(await menu.press(intent)).to.eq(true);
    expect(heard).to.deep.eq([{surface: 'lankeyboard', intent}]);

    // A rejected address keeps the keyboard open with the reason; `cancel` closes it.
    keyboard().vm.$emit('commit', '   ');
    await nextTick();
    expect(keyboard().props('issue')).to.eq('That is not a usable address');
    keyboard().vm.$emit('cancel');
    await nextTick();
    expect(keyboard().exists()).to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(menu.wrapper.findComponent(ScreenStub).exists(), 'the list it was opened from still stands').to.eq(true);
  });

  it('«New game» navigates through the app root\'s port — and with no root above the menu the press does nothing', async () => {
    const went: Array<string> = [];
    const inApp = await mountMenu({
      navigateInApp: (path: string) => {
        went.push(path);
      },
    });
    await inApp.press(A); // the cursor starts on «New game»
    expect(went).to.deep.eq([paths.NEW_GAME_PREMIUM]);
    inApp.wrapper.unmount();

    const bare = await mountMenu();
    await bare.plate('create').trigger('click');
    expect(went, 'nowhere to navigate').to.deep.eq([paths.NEW_GAME_PREMIUM]);
    expect(bare.cursor()).to.deep.eq(['create']);
    expect(bare.overlays()).to.deep.eq([]);
  });

  it('follows the module state it reads: a late identity re-asks both lists, a lobby refresh re-asks the campaigns', async () => {
    const menu = await mountMenu();

    // The identity is an INPUT, not a precondition: a profile switch renames the header and reloads the lobby.
    seat('Nastya');
    await settled();
    expect(menu.wrapper.find('.cm-identity__name').text()).to.eq('Nastya');
    expect(lobbyState.identity).to.eq('Nastya');
    expect(asked.some((url) => url.includes(paths.API_GAMES_JOINABLE) && url.includes('name=Nastya'))).to.eq(true);
    expect(asked.some((url) => url.includes(paths.API_CAMPAIGNS) && url.includes('name=Nastya'))).to.eq(true);

    // Campaign realtime rides the lobby: every completed lobby refresh stamps `lastRefreshAt`, and the stamp re-asks
    // the campaign list. (Stamped by hand: two real refreshes may complete inside one millisecond.)
    const campaignAsks = () => asked.filter((url) => url.includes(paths.API_CAMPAIGNS)).length;
    const before = campaignAsks();
    lobbyState.lastRefreshAt = (lobbyState.lastRefreshAt ?? 0) + 1;
    await settled();
    expect(campaignAsks()).to.eq(before + 1);
  });

  it('the first-run Steam prompt arrives with the shortcut state — and «Not now» is remembered', async () => {
    const menu = await mountMenu();
    expect(menu.wrapper.find('.cm-overlay').exists()).to.eq(false);

    // The state loads asynchronously (the main process answers): Windows, first run, not added, not dismissed.
    steamShortcutState.loaded = false;
    await nextTick();
    Object.assign(steamShortcutState, {available: true, firstRun: true, added: false, dismissed: false, loaded: true});
    await nextTick();
    expect(menu.wrapper.find('.cm-overlay .cm-overlay__title').text()).to.eq($t('Add to Steam?'));
    expect(menu.context()).to.eq('Add to Steam?');
    expect(menu.plates(), 'the explicit plate stands for as long as the shortcut is not added').to.include('steam');

    expect(await menu.press(B)).to.eq(true);
    expect(menu.wrapper.find('.cm-overlay').exists()).to.eq(false);
    expect(steamShortcutState.dismissed).to.eq(true);
  });
});
