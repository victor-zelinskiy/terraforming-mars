/*
 * ConsoleCreateGame — the console-native creator, the «Mission Bridge»: the session-mode stage, then four decks
 * (crew · rules · expansions · map) with one cursor each, the launch briefing beside them and one overlay at a time.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no prop, no emit, and it EXPOSES NOTHING —
 * `App` mounts it and no parent stands a ref on it.
 *
 * Outside a game it is the pad's owner: it claims the console intent slot (`installMenuPad`) and routes every intent
 * itself — to the overlay on screen THROUGH THAT OVERLAY'S TEMPLATE REF (`this.$refs.x` before the conversion —
 * RECIPES § R11), so the spec presses through the product's own dispatch and reads what each stand-in was handed. The
 * cursored row it keeps in view is found through the creator's own ROOT ref (`this.$el` before — § R12); B on the mode
 * stage goes back to the main menu through the app root's port (the root reached through the instance before — § R26).
 *
 * A large surface: its journeys (a party assembled and launched, a campaign, the dev picker) are the e2e's. Here — the
 * minimal honest state, what it exposes, the port, the routing through the refs, and the refused row's shake.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {normalizePlayerName} from '@/common/utils/playerName';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {consoleNativeState} from '@/client/console/composables/consoleNativeSurface';
import {consoleCreateUi, crewRows, resetConsoleCreateUi} from '@/client/console/menu/consoleCreateModel';
import {resetDeckCompositionState, setDeckCompositionFetcher} from '@/client/console/menu/deckCompositionState';
import {clearSavedCreateGameState, createGameState, resetCreateGameState} from '@/client/components/create/premium/createGameState';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {profilesState} from '@/client/components/mainMenu/profilesState';
import {APP_ROOT, AppRoot} from '@/client/components/appRoot';
import ConsoleCreateGame from '@/client/components/console/menu/ConsoleCreateGame.vue';

/** A verb of the command bar, as the creator hands it over. */
type Command = {control: string, control2?: string, label: string, enabled?: boolean, highlight?: boolean};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The command bar's stand-in: the context and the verbs the creator hands it. */
const BarStub = defineComponent({
  name: 'ConsoleCommandBar',
  props: {context: String, commands: Array},
  render: () => h('div', {class: 'bar-stub'}),
});

const MapStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {mapId: String, random: Boolean, variant: String},
  render: () => h('i', {class: 'map-stub'}),
});

const BriefingStub = defineComponent({
  name: 'ConsoleLaunchPanel',
  render: () => h('aside', {class: 'briefing-stub'}),
});

/** Every element the creator asked its scroll area to keep in view — through its `deckScroll` ref. */
const kept: Array<Element | null> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  props: {fill: Boolean},
  methods: {
    ensureVisible(el: Element | null): void {
      kept.push(el);
    },
  },
  render() {
    return h('div', {class: 'scroll-stub'}, this.$slots.default?.());
  },
});

/** A deck's stand-in: one row per model row, the cursored one wearing the class the creator looks for in its root. */
function deckStub(name: string, deck: string) {
  return defineComponent({
    name,
    props: {rows: {type: Array, default: () => []}, cursor: {type: Number, default: 0}, shakeRow: {type: Number, default: -1}, wide: Boolean},
    emits: ['hover', 'activate', 'layout'],
    render() {
      return h('div', {'class': 'deck-stub', 'data-deck': deck},
        this.rows.map((_row, i) => h('div', {class: ['cm-row', {'cm-row--cursor': i === this.cursor}]})));
    },
  });
}
const CrewStub = deckStub('ConsoleCrewDeck', 'crew');
const RulesStub = deckStub('ConsoleRulesDeck', 'rules');
const ExpansionsStub = deckStub('ConsoleExpansionsDeck', 'expansions');
const MapDeckStub = deckStub('ConsoleMapDeck', 'map');

/** Every intent an overlay's stand-in was handed through the creator's ref to it, in order. */
const heard: Array<{surface: string, intent: GamepadIntent}> = [];
/** What a stand-in answers: `true` — it took the intent; `false` — the creator's own B applies. */
let surfaceTakes = true;

const EditorStub = defineComponent({
  name: 'ConsoleParticipantEditor',
  props: {target: Object, cursor: Number},
  emits: ['cursor', 'remove-request', 'close'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      heard.push({surface: 'editor', intent});
      return surfaceTakes;
    },
  },
  render: () => h('div', {'class': 'overlay-stub', 'data-overlay': 'editor'}),
});
const DevCardsStub = defineComponent({
  name: 'ConsoleDevCardPicker',
  emits: ['close'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      heard.push({surface: 'devCards', intent});
      return surfaceTakes;
    },
  },
  render: () => h('div', {'class': 'overlay-stub', 'data-overlay': 'devCards'}),
});
const TypePickerStub = defineComponent({
  name: 'ConsoleTypePicker',
  props: {options: Array, cursor: Number},
  emits: ['cursor', 'pick'],
  render: () => h('div', {'class': 'overlay-stub', 'data-overlay': 'typePicker'}),
});
const LaunchConfirmStub = defineComponent({
  name: 'ConsoleLaunchConfirm',
  emits: ['confirm', 'cancel'],
  render: () => h('div', {'class': 'overlay-stub', 'data-overlay': 'launch'}),
});

const STUBS = {
  GamepadGlyph: GlyphStub,
  ConsoleCommandBar: BarStub,
  PremiumMapFingerprint: MapStub,
  ConsoleLaunchPanel: BriefingStub,
  ConsoleScrollArea: ScrollStub,
  ConsoleCrewDeck: CrewStub,
  ConsoleRulesDeck: RulesStub,
  ConsoleExpansionsDeck: ExpansionsStub,
  ConsoleMapDeck: MapDeckStub,
  ConsoleParticipantEditor: EditorStub,
  ConsoleDevCardPicker: DevCardsStub,
  ConsoleTypePicker: TypePickerStub,
  ConsoleLaunchConfirm: LaunchConfirmStub,
};

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};
const LB: GamepadIntent = {kind: 'press', button: 'bumperL'};
const RB: GamepadIntent = {kind: 'press', button: 'bumperR'};

describe('ConsoleCreateGame — the console-native creator', () => {
  let restoreFetcher: () => void = () => {};

  async function mountCreator(root?: Partial<AppRoot>) {
    // Mounted under a host with a string ref — what a parent's ref to the creator would carry is read there.
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleCreateGame, {ref: 'creator'})]),
    });
    const wrapper = mount(Host, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: STUBS,
        provide: root === undefined ? {} : {[APP_ROOT as symbol]: root},
      },
    });
    // `onMounted` awaits the identity's prefill before it restores the setup and claims the pad.
    await flushPromises();
    const bar = () => wrapper.findComponent(BarStub);
    return {
      wrapper,
      tiles: () => wrapper.findAll('.cm-mode__tile'),
      modeCursor: () => wrapper.findAll('.cm-mode__tile').filter((tile) => tile.classes().includes('cm-mode__tile--cursor')).map((tile) => tile.attributes('data-mode')),
      decks: () => wrapper.findAll('[data-deck]').map((deck) => deck.attributes('data-deck')),
      activeTab: () => wrapper.findAll('.cm-tabs__tab--active').map((tab) => tab.text()),
      overlays: () => wrapper.findAll('[data-overlay]').map((overlay) => overlay.attributes('data-overlay')),
      context: () => bar().props('context') as string,
      commands: () => bar().props('commands') as ReadonlyArray<Command>,
      /** One press through the product's dispatch; the DOM it moved is rendered when this resolves. */
      press: async (intent: GamepadIntent): Promise<boolean> => {
        const taken = dispatchConsoleIntent(intent);
        await flushPromises();
        return taken;
      },
    };
  }

  /** Two seats, the second one still unnamed — a party that cannot launch, with its first issue on crew row 1. */
  function seatUnnamedSecond(): void {
    createGameState.config.players = [
      {slot: 0, name: 'Victor', color: 'blue', trBoost: 0, isCreator: true},
      {slot: 1, name: '', color: 'red', trBoost: 0, isCreator: false},
    ];
  }

  beforeEach(() => {
    // Module state is bundle-shared: the setup and the screen start from their own zero, no saved setup stands in the
    // storage, the identity and the roster are seeded as LOADED (the creator's own load then reads no storage), and
    // the decks' counts are answered here, never by a server.
    clearSavedCreateGameState();
    resetCreateGameState();
    resetConsoleCreateUi();
    resetDeckCompositionState();
    restoreFetcher = setDeckCompositionFetcher(async () => {
      throw new Error('no server in a unit mount');
    });
    identityState.identity = {displayName: 'Victor', normalizedName: normalizePlayerName('Victor'), cubeColor: 'blue', source: 'local-storage', temporary: false};
    identityState.loaded = true;
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = true;
    heard.length = 0;
    kept.length = 0;
    surfaceTakes = true;
  });

  afterEach(() => {
    restoreFetcher();
    setFlowClock(undefined);
    clearSavedCreateGameState();
    resetCreateGameState();
    resetConsoleCreateUi();
    resetDeckCompositionState();
    identityState.identity = undefined;
    identityState.loaded = false;
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = false;
  });

  it('mounts in its minimal honest state — the MODE stage of a named player with no saved setup — without a warning', async () => {
    // (`globalConfig` turns every Vue warning into a throw: a mount that returns is a mount without one.)
    const creator = await mountCreator();

    expect(creator.wrapper.find('.cm-create').exists()).to.eq(true);
    expect(creator.wrapper.find('.cm-create__kicker').text()).to.eq($t('Create new game'));
    expect(creator.wrapper.find('.cm-create__identity-name').text()).to.eq('Victor');
    expect(creator.wrapper.find('.cm-identity__cube').classes()).to.include('player_bg_color_blue');
    expect(creator.tiles().map((tile) => tile.attributes('data-mode'))).to.deep.eq(['single', 'campaign']);
    expect(creator.tiles().map((tile) => tile.find('.cm-mode__label').text())).to.deep.eq([$t('Single game'), $t('Campaign')]);
    expect(creator.modeCursor(), 'the cursor stands on the setup\'s own mode').to.deep.eq(['single']);
    expect(creator.tiles()[1].classes()).to.include('cm-mode__tile--campaign');

    // The illustrations: one base board for a single party, a route as long as the campaign for a campaign.
    const maps = creator.wrapper.findAllComponents(MapStub);
    expect([maps[0].props('mapId'), maps[0].props('variant')], 'the single party\'s tile comes first').to.deep.eq([BoardName.THARSIS, 'card']);
    const route = maps.slice(1);
    expect(route).to.have.length(createGameState.config.campaignMissionCount);
    expect(route.map((map) => map.props('variant'))).to.deep.eq(route.map(() => 'thumb'));
    expect(route[route.length - 1].props('mapId'), 'the route ends on its finale board').to.eq(BoardName.HELLAS);
    expect(creator.wrapper.findAll('.cm-mode__stop--final'), 'and only its last stop is the finale').to.have.length(1);

    // No deck, no overlay; the bar reads the stage.
    expect(creator.wrapper.find('.cm-tabs').exists()).to.eq(false);
    expect(creator.decks()).to.deep.eq([]);
    expect(creator.overlays()).to.deep.eq([]);
    expect(creator.context()).to.eq('Create new game');
    expect(creator.commands()).to.deep.eq([
      {control: 'dpadH', label: 'Choose'},
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Main menu'},
    ]);
    // What mounting did to the shared setup: defaults (nothing was saved), the creator seat carrying the identity.
    expect(consoleCreateUi.restored).to.eq(false);
    expect(createGameState.config.players[0].name).to.eq('Victor');
    expect(createGameState.config.players[0].color).to.eq('blue');
  });

  it('exposes nothing: what a parent\'s ref to it carries is an empty object', async () => {
    const creator = await mountCreator();
    const reach = creator.wrapper.vm.$refs.creator;
    expect(reach, 'the host holds a ref to the creator').to.not.eq(undefined);
    expect(Object.keys(reach as object), 'no parent stands a ref on it — no `defineExpose`').to.deep.eq([]);
  });

  it('owns the pad and the page\'s overflow lock for its lifetime — and gives both back', async () => {
    const pads = menuPadState.mountedCount;
    const surfaces = consoleNativeState.surfaces;
    const creator = await mountCreator();
    expect(menuPadState.mountedCount).to.eq(pads + 1);
    expect(consoleNativeState.surfaces).to.eq(surfaces + 1);
    expect(await creator.press(nav('up')), 'the creator consumes what it has no use for').to.eq(true);

    creator.wrapper.unmount();
    expect(menuPadState.mountedCount).to.eq(pads);
    expect(consoleNativeState.surfaces).to.eq(surfaces);
  });

  it('the MODE stage: ◄ ► walk the two tiles to a wall, B goes back to the main menu THROUGH THE APP ROOT\'S PORT, A enters the decks', async () => {
    const went: Array<string> = [];
    const creator = await mountCreator({navigateInApp: (path: string) => went.push(path)});

    expect(await creator.press(nav('right'))).to.eq(true);
    expect(creator.modeCursor()).to.deep.eq(['campaign']);
    await creator.press(nav('right'));
    expect(creator.modeCursor(), 'the last tile is a wall, never a wrap').to.deep.eq(['campaign']);
    await creator.press(nav('left'));
    expect(creator.modeCursor()).to.deep.eq(['single']);

    expect(await creator.press(B)).to.eq(true);
    expect(went, 'one navigation, to the menu').to.deep.eq(['/']);

    await creator.press(nav('right'));
    await creator.press(A);
    expect(createGameState.config.sessionMode, 'the cursored mode is the setup\'s').to.eq('campaign');
    expect(consoleCreateUi.stage).to.eq('decks');
    expect(creator.tiles()).to.have.length(0);
    expect(creator.decks(), 'the decks open on the crew').to.deep.eq(['crew']);
    expect(went, 'A navigated nowhere').to.deep.eq(['/']);
  });

  it('with NO app root above it (a unit mount, a stand) B on the mode stage is consumed and goes nowhere', async () => {
    const creator = await mountCreator();
    expect(await creator.press(B)).to.eq(true);
    expect(consoleCreateUi.stage, 'still the mode stage').to.eq('mode');
    expect(creator.tiles()).to.have.length(2);
  });

  it('the DECKS: the bumpers walk the section ring, ▼ moves the deck\'s cursor and the cursored row — found in the creator\'s own root — is kept in view through the scroll area\'s ref; B is one level back', async () => {
    const creator = await mountCreator();
    await creator.press(A);
    expect(creator.decks()).to.deep.eq(['crew']);
    expect(creator.activeTab()).to.deep.eq([$t('Crew')]);
    expect(creator.wrapper.find('.briefing-stub').exists(), 'the launch briefing stands beside the deck').to.eq(true);
    const crew = () => creator.wrapper.findComponent(CrewStub);
    expect(crew().props('rows')).to.deep.eq(crewRows());
    expect(crew().props('cursor')).to.eq(0);
    expect(crew().props('shakeRow')).to.eq(-1);
    expect(creator.context()).to.eq('Create new game');
    expect(creator.commands()[0]).to.deep.eq({control: 'bumperL', control2: 'bumperR', label: 'Section'});
    expect(creator.commands()[1], 'A on a seated player edits them').to.deep.eq({control: 'confirm', label: 'Edit', enabled: true});
    expect(creator.commands()[creator.commands().length - 1]).to.deep.eq({control: 'back', label: 'Game mode'});

    kept.length = 0;
    await creator.press(nav('down'));
    await nextTick();
    expect(consoleCreateUi.cursor.crew).to.eq(1);
    expect(crew().props('cursor')).to.eq(1);
    expect(kept).to.have.length(1);
    expect(kept[0], 'the cursored row of the deck on screen').to.eq(creator.wrapper.findAll('.cm-row')[1].element);

    await creator.press(RB);
    expect(creator.decks()).to.deep.eq(['rules']);
    expect(creator.activeTab()).to.deep.eq([$t('Game rules')]);
    await creator.press(LB);
    await creator.press(LB);
    expect(creator.decks(), 'the ring wraps').to.deep.eq(['map']);
    expect(creator.wrapper.findComponent(MapDeckStub).props('wide'), 'a narrow viewport — the one-column walk').to.eq(false);

    // A row the deck itself reports (a pointer over it, its measured columns) lands in the model.
    creator.wrapper.findComponent(MapDeckStub).vm.$emit('hover', 2);
    expect(consoleCreateUi.cursor.map).to.eq(2);

    await creator.press(B);
    expect(consoleCreateUi.stage, 'decks → the mode stage').to.eq('mode');
    expect(creator.decks()).to.deep.eq([]);
    expect(creator.tiles()).to.have.length(2);
  });

  it('an OVERLAY owns the pad through its ref: the participant editor and the dev picker are handed every intent, and B falls to the creator only when they decline it', async () => {
    const creator = await mountCreator();
    await creator.press(A);

    // A on a seated player opens their editor.
    await creator.press(A);
    expect(creator.overlays()).to.deep.eq(['editor']);
    const editor = creator.wrapper.findComponent(EditorStub);
    expect(editor.props('target')).to.deep.eq({kind: 'human', index: 0});
    expect(editor.props('cursor')).to.eq(0);
    expect(creator.context()).to.eq('Participant');

    await creator.press(nav('down'));
    await creator.press(B);
    expect(heard, 'the editor took both — the creator moved nothing').to.deep.eq([{surface: 'editor', intent: nav('down')}, {surface: 'editor', intent: B}]);
    expect(creator.overlays()).to.deep.eq(['editor']);
    expect(consoleCreateUi.cursor.crew).to.eq(0);
    surfaceTakes = false;
    await creator.press(B);
    expect(creator.overlays(), 'a B the editor declines closes it').to.deep.eq([]);

    // The dev picker — the model's overlay, mounted by the creator and reached through its own ref.
    heard.length = 0;
    surfaceTakes = true;
    consoleCreateUi.overlay = {kind: 'devCards'};
    await flushPromises();
    expect(creator.overlays()).to.deep.eq(['devCards']);
    expect(creator.context()).to.eq('Guaranteed cards');
    await creator.press(X);
    await creator.press(B);
    expect(heard, 'the picker owns the pad completely — X is its inspect, not the launch').to.deep.eq([{surface: 'devCards', intent: X}, {surface: 'devCards', intent: B}]);
    expect(creator.overlays()).to.deep.eq(['devCards']);
    surfaceTakes = false;
    await creator.press(B);
    expect(creator.overlays()).to.deep.eq([]);

    // The picker's own «close» does the same.
    consoleCreateUi.overlay = {kind: 'devCards'};
    await flushPromises();
    creator.wrapper.findComponent(DevCardsStub).vm.$emit('close');
    await flushPromises();
    expect(consoleCreateUi.overlay).to.eq(undefined);
  });

  it('X on a party that cannot launch lands ON the first issue and shakes that row — for one beat of the creator\'s own flow scope', async () => {
    const clock = createManualClock(0);
    setFlowClock(clock);
    const creator = await mountCreator();
    await creator.press(A);
    seatUnnamedSecond();
    await creator.press(RB);
    expect(creator.decks()).to.deep.eq(['rules']);

    await creator.press(X);
    expect(creator.overlays(), 'not ready — no launch ceremony').to.deep.eq([]);
    expect(creator.decks(), 'the issue\'s deck').to.deep.eq(['crew']);
    const crew = () => creator.wrapper.findComponent(CrewStub);
    expect(crew().props('cursor'), 'the unnamed seat').to.eq(1);
    expect(crew().props('shakeRow')).to.eq(1);
    expect(creator.commands().find((command) => command.control === 'secondary')).to.deep.eq({control: 'secondary', label: 'Go to the first issue', highlight: false});

    clock.advance(459);
    await nextTick();
    expect(crew().props('shakeRow'), 'the beat is not over').to.eq(1);
    clock.advance(1);
    await nextTick();
    expect(crew().props('shakeRow'), 'the shake ends by itself').to.eq(-1);

    // Named, the party is ready: X opens the launch ceremony and the bar says so.
    createGameState.config.players[1].name = 'Wanda';
    await creator.press(X);
    expect(creator.overlays()).to.deep.eq(['launch']);
    expect(creator.context()).to.eq('Launch the party');
    creator.wrapper.findComponent(LaunchConfirmStub).vm.$emit('cancel');
    await flushPromises();
    expect(creator.overlays()).to.deep.eq([]);
    expect(creator.commands().find((command) => command.control === 'secondary')).to.deep.eq({control: 'secondary', label: 'Launch the party', highlight: true});
  });
});
