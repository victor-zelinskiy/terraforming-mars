/*
 * ConsoleGovernmentSupport — the decision briefing of World Government Terraforming (the pure tile model is
 * `consoleGovernmentSupport.spec.ts`'s subject; this is the COMPONENT's). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `playerView` (the 2×2 of tiles, the cursor, the briefing
 * line), the command contract it publishes to the shell's one bar, what it emits for a press — and what the shell's
 * pad router reaches through the surface registry: `handleIntent`, and nothing else. Mounted the way the shell mounts
 * it: under a host that holds a ref. The family's head and the glyph are stubbed by name. The unit runner renders the
 * English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowReactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {clearPanelCommands, consolePanelUi} from '@/client/console/consolePanelUi';
import ConsoleGovernmentSupport from '@/client/components/console/ConsoleGovernmentSupport.vue';

/** What the pad router reads through the registry — the panel's whole contract with the shell. */
type PanelReach = {handleIntent(intent: GamepadIntent): void};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const HeadStub = defineComponent({
  name: 'ConsolePromptHead',
  props: {
    tone: {type: String, required: true},
    kicker: {type: String, required: true},
    title: {type: String, required: true},
    promptKey: {type: String, default: ''},
  },
  render() {
    return h('header', {'class': 'head-stub', 'data-tone': this.tone, 'data-kicker': this.kicker, 'data-title': this.title, 'data-prompt-key': this.promptKey},
      this.$slots.default?.());
  },
});

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String, required: true}},
  render() {
    return h('i', {'class': 'glyph-stub', 'data-control': this.control});
  },
});

function leaf(title: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Increase'} as unknown as PlayerInputModel;
}
function space(title: string): PlayerInputModel {
  return {type: 'space', title, spaces: []} as unknown as PlayerInputModel;
}

const TEMP = 'Increase temperature';
const OXY = 'Increase oxygen';
const OCEAN = 'Add an ocean';
const VENUS = 'Increase Venus scale';

type GameState = {temperature: number, oxygenLevel: number, oceans: number, venusScaleLevel: number};

/** A WGT prompt over a Venus game on Tharsis: −24 °C · 7 % · 5 oceans · Venus 8 %. */
function viewOf(options: ReadonlyArray<PlayerInputModel>, state: Partial<GameState> = {}, promptId = 7): PlayerViewModel {
  return {
    waitingFor: {type: 'or', title: 'Select action for World Government Terraforming', buttonLabel: 'Confirm', promptId, options},
    game: {
      temperature: -24,
      oxygenLevel: 7,
      oceans: 5,
      venusScaleLevel: 8,
      ...state,
      gameOptions: {expansions: {venus: true}, boardName: BoardName.THARSIS},
    },
  } as unknown as PlayerViewModel;
}

const press = (button: SemanticButton): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const optionAnswer = (index: number) => ({type: 'or', index, response: {type: 'option'}});

function mountUnderHost(playerView: PlayerViewModel) {
  const props = shallowReactive<{playerView: PlayerViewModel}>({playerView});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleGovernmentSupport, {ref: 'govSupport', playerView: props.playerView})]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {ConsolePromptHead: HeadStub, GamepadGlyph: GlyphStub}}});
  const panel = () => wrapper.findComponent(ConsoleGovernmentSupport);
  return {
    wrapper,
    props,
    panel,
    reach: () => (wrapper.vm.$refs.govSupport ?? undefined) as PanelReach | undefined,
    cards: () => wrapper.findAll('.con-govsupport__card'),
    focused: () => wrapper.findAll('.con-govsupport__card').findIndex((c) => c.classes().includes('con-govsupport__card--focused')),
  };
}

describe('ConsoleGovernmentSupport — the briefing of World Government Terraforming', () => {
  afterEach(() => {
    clearPanelCommands('govSupport');
  });

  it('renders the family plate, its head and the 2×2 of tiles: the name, `current → resulting`, the honest type line', () => {
    const {wrapper, cards} = mountUnderHost(viewOf([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)]));
    const root = wrapper.find('div.con-govsupport.con-ws');
    expect(root.exists()).to.eq(true);
    expect(root.element, 'the template starts with its root — no comment node before it').to.eq((wrapper.element as Element).children[0]);
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq('Government Support');
    expect(root.attributes('data-motion-surface')).to.eq('gov-support');
    const panel = root.find('.con-govsupport__panel');
    expect(panel.classes()).to.include.members(['con-prompt', 'con-prompt--l', 'con-prompt--neutral']);
    for (const hook of ['data-motion-panel', 'data-prompt-panel', 'data-stick-scroll']) {
      expect(panel.attributes(hook), hook).to.not.eq(undefined);
    }

    const head = wrapper.findComponent(HeadStub);
    expect(head.classes()).to.include('con-govsupport__head');
    expect(head.props('tone')).to.eq('neutral');
    expect(head.props('kicker')).to.eq('Government Support');
    expect(head.props('title')).to.eq('A planetary initiative will raise one global parameter.');
    expect(head.props('promptKey'), 'the decision\'s identity in the sequence').to.eq('7|or|Select action for World Government Terraforming');
    expect(head.find('.con-govsupport__rule').text()).to.contain('Government action: TR and track bonuses are not awarded to players.');

    expect(wrapper.find('.con-govsupport__grid').classes(), 'four tiles — not the wide grid').to.deep.eq(['con-govsupport__grid']);
    expect(cards().map((c) => c.find('.con-govsupport__card-name').text())).to.deep.eq([TEMP, OXY, OCEAN, VENUS]);
    expect(cards().map((c) => c.classes().find((k) => /^con-govsupport__card--(temperature|oxygen|ocean|venus)$/.test(k))))
      .to.deep.eq(['con-govsupport__card--temperature', 'con-govsupport__card--oxygen', 'con-govsupport__card--ocean', 'con-govsupport__card--venus']);
    expect(cards().map((c) => c.find('.con-govsupport__pv-cur').text())).to.deep.eq(['-24°C', '7%', '5 / 9', '8%']);
    expect(cards().map((c) => c.find('.con-govsupport__pv-next').text())).to.deep.eq(['-22°C', '8%', '6 / 9', '10%']);
    expect(cards().map((c) => c.find('.con-govsupport__card-type').text()))
      .to.deep.eq(['Global parameter', 'Global parameter', '◈ Tile placement required', 'Global parameter']);
    expect(cards().map((c) => c.classes().includes('con-govsupport__card--space'))).to.deep.eq([false, false, true, false]);

    // The cursor: the first available tile, with A on it — and its briefing sentence under the grid.
    expect(cards().map((c) => c.classes().includes('con-govsupport__card--focused'))).to.deep.eq([true, false, false, false]);
    expect(cards().map((c) => c.find('.con-govsupport__card-a > .glyph-stub').exists())).to.deep.eq([true, false, false, false]);
    expect(wrapper.find('.con-govsupport__detail').text()).to.eq('The world government raises the planet temperature.');
  });

  it('a MAXED parameter is a disabled tile with its reason — and the cursor starts on the first tile that can be applied', async () => {
    const {wrapper, cards, reach, panel} = mountUnderHost(viewOf([leaf(OXY), space(OCEAN), leaf(VENUS)], {temperature: 8}));
    expect(cards().map((c) => c.classes().includes('con-govsupport__card--disabled'))).to.deep.eq([true, false, false, false]);
    expect(cards()[0].find('.con-govsupport__card-blocked').text()).to.eq('✕ Maximum reached');
    expect(cards()[0].find('.con-govsupport__pv-next').exists(), 'no «→ resulting» on a maxed scale').to.eq(false);
    expect(cards().map((c) => c.classes().includes('con-govsupport__card--focused')), 'the first AVAILABLE tile').to.deep.eq([false, true, false, false]);
    expect(wrapper.find('.con-govsupport__detail').text()).to.eq('The world government raises the atmospheric oxygen.');

    // The maxed tile is readable, never applied: no A on it, its reason in the briefing line, A emits nothing.
    reach()!.handleIntent(nav('left'));
    await nextTick();
    expect(cards()[0].classes()).to.include('con-govsupport__card--focused');
    expect(cards()[0].find('.con-govsupport__card-a').exists()).to.eq(false);
    expect(wrapper.find('.con-govsupport__detail').text()).to.eq('Maximum reached');
    expect(consolePanelUi.commands.find((c) => c.control === 'confirm')?.enabled).to.eq(false);
    reach()!.handleIntent(press('confirm'));
    expect(panel().emitted()).to.deep.eq({});
  });

  it('publishes its command contract to the shell\'s one bar — at mount, on every move of the cursor — and takes it back when it leaves', async () => {
    const {wrapper, reach} = mountUnderHost(viewOf([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)]));
    expect(consolePanelUi.owner).to.eq('govSupport');
    expect(consolePanelUi.commands).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Apply', enabled: true},
      {control: 'back', label: 'Minimize'},
    ]);

    reach()!.handleIntent(nav('down'));
    await nextTick();
    expect(consolePanelUi.commands.map((c) => c.label), 'the ocean tile: A goes to the board').to.deep.eq(['Navigate', 'Select ocean space', 'Minimize']);
    expect(wrapper.find('.con-govsupport__detail').text()).to.eq('Choose an available ocean space on the board.');

    wrapper.unmount();
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the d-pad walks the 2×2 and stops at its edges', async () => {
    const {reach, focused} = mountUnderHost(viewOf([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)]));
    const panel = reach();
    expect(panel, 'the shell\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(panel!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent']);
    for (const inner of ['onNav', 'apply', 'focusIdx', 'submitting', 'cards', 'footCommands', 'textOf', 'props', 'emit']) {
      expect((panel as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    const walk: Array<number> = [];
    for (const dir of ['right', 'right', 'down', 'down', 'left', 'left', 'up', 'up'] as const) {
      panel!.handleIntent(nav(dir));
      await nextTick();
      walk.push(focused());
    }
    // ←→ step by ONE card (so «right» from 1 lands on 2, the next row's first tile), ↑↓ by a ROW of two — and a step
    // that would leave the grid moves nothing: 0 → 1 → 2 → (no row below 2) 2 → 2 → 1 → 0 → (no row above 0) 0 → 0.
    expect(walk).to.deep.eq([1, 2, 2, 2, 1, 0, 0, 0]);
  });

  it('A on a scale tile hands the shell the choreographed confirm — once; the next server response re-arms it; B defers', async () => {
    const options = [leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)];
    const {reach, panel, props} = mountUnderHost(viewOf(options));

    reach()!.handleIntent(press('confirm'));
    reach()!.handleIntent(press('confirm'));
    reach()!.handleIntent(press('secondary'));
    expect(panel().emitted('gov-confirm'), 'a rapid second A and X are swallowed — no double submit').to.deep.eq([[{response: optionAnswer(0), param: 'temperature'}]]);
    expect(panel().emitted('submit')).to.eq(undefined);

    // The same prompt answered by the server with a new view (the root identity always changes): re-armed.
    props.playerView = viewOf(options, {temperature: -22});
    await nextTick();
    reach()!.handleIntent(press('secondary'));
    expect(panel().emitted('gov-confirm'), 'X mirrors A').to.have.length(2);

    reach()!.handleIntent(press('back'));
    expect(panel().emitted('defer')).to.deep.eq([[]]);
    reach()!.handleIntent({kind: 'release', button: 'confirm'});
    expect(panel().emitted('gov-confirm'), 'a release is nobody\'s').to.have.length(2);
  });

  it('A on the ocean tile hands the board its placement prompt; a leaf with no scale to accent submits at once', async () => {
    const ocean = space(OCEAN);
    const rate = leaf('Increase the Moon habitat rate');
    const {reach, panel, focused} = mountUnderHost(viewOf([leaf(TEMP), ocean, rate]));
    // Tiles: temperature · the ocean · (no oxygen / Venus option and neither maxed) · the trailing extra.
    reach()!.handleIntent(nav('right'));
    await nextTick();
    expect(focused()).to.eq(1);
    reach()!.handleIntent(press('confirm'));
    reach()!.handleIntent(press('confirm'));
    const picks = panel().emitted('space-pick');
    expect(picks, 'a board pick is not a submit — it is never latched').to.have.length(2);
    expect(picks![0]).to.deep.eq([{index: 1, spacePrompt: ocean}]);
    expect(panel().emitted('submit')).to.eq(undefined);

    reach()!.handleIntent(nav('right'));
    await nextTick();
    expect(focused()).to.eq(2);
    reach()!.handleIntent(press('confirm'));
    expect(panel().emitted('submit'), 'no arc scale to accent — the answer goes straight out').to.deep.eq([[optionAnswer(2)]]);
    expect(panel().emitted('gov-confirm')).to.eq(undefined);
  });

  it('a genuinely NEW prompt resets the cursor to its first available tile', async () => {
    const {reach, focused, props} = mountUnderHost(viewOf([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)]));
    reach()!.handleIntent(nav('down'));
    reach()!.handleIntent(nav('right'));
    await nextTick();
    expect(focused()).to.eq(3);

    // A response that keeps the prompt keeps the cursor …
    props.playerView = viewOf([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)], {oceans: 6});
    await nextTick();
    expect(focused()).to.eq(3);
    // … a prompt of another shape (the temperature reached its maximum — three options) starts over.
    props.playerView = viewOf([leaf(OXY), space(OCEAN), leaf(VENUS)], {temperature: 8}, 8);
    await nextTick();
    expect(focused(), 'the maxed temperature tile is skipped').to.eq(1);
  });
});
