/*
 * ConsoleEffectDecision — the console's ONE screen for an optional game decision (what a prompt MEANS is the pure
 * adapter's, `effectDecisionModel.spec.ts`; this is the SCREEN's). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): its two dresses for one `vm` (the standalone plate of the prompt-modal family, the
 * embedded stage that hands its name UP to the hosting workspace), the command contract it publishes to the shell's
 * one bar, what it emits for a press — and what the shell's pad router reaches through the surface registry:
 * `handleIntent`, and nothing else. Mounted the way the shell mounts it: under a host that holds a ref. Its children
 * are stubbed by name; `<console-source-dock>` is the lazy binding of `asyncComponents.ts`, which answers to the
 * wrapper's name (RECIPES § 3). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType, ref, shallowReactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {EffectDecisionAction, EffectDecisionViewModel} from '@/client/console/effectDecision/effectDecisionModel';
import {effectDecisionState, resetDecisionFocus} from '@/client/console/effectDecision/effectDecisionState';
import {clearPanelCommands, consolePanelUi} from '@/client/console/consolePanelUi';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {setWorkspaceOutcomePhase, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import ConsoleEffectDecision from '@/client/components/console/ConsoleEffectDecision.vue';

/** What the pad router reads through the registry — the screen's whole contract with the shell. */
type DecisionReach = {handleIntent(intent: GamepadIntent): void};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const HeadStub = defineComponent({
  name: 'ConsolePromptHead',
  props: {
    tone: {type: String, required: true},
    kicker: {type: String, required: true},
    title: {type: String, required: true},
    trigger: {type: String, default: ''},
    promptKey: {type: String, default: ''},
    series: {type: Object, default: undefined},
  },
  render() {
    return h('header', {'class': 'head-stub'}, this.$slots.decline?.());
  },
});

const DeclineStub = defineComponent({
  name: 'ConsoleDeclinePlate',
  props: {
    label: {type: String, required: true},
    forgone: {type: Array as PropType<ReadonlyArray<ActionEffect>>, default: () => []},
  },
  render() {
    return h('i', {'class': 'decline-stub', 'data-label': this.label});
  },
});

/** The grammar of «choose one of these»: a tile per option, each carrying the host's `#body` for its index. */
const ChoiceStub = defineComponent({
  name: 'ConsoleVariantChoice',
  props: {
    layout: {type: String, default: 'compare'},
    exclusive: {type: Boolean, default: true},
    options: {type: Array as PropType<ReadonlyArray<VariantChoiceOption>>, required: true},
    label: {type: String, default: ''},
  },
  render() {
    return h('div', {'class': 'choice-stub', 'data-layout': this.layout},
      this.options.map((opt, index) => h('div', {'class': 'tile-stub', 'data-key': opt.key}, this.$slots.body?.({index}))));
  },
});

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String, required: true}},
  render() {
    return h('i', {'class': 'glyph-stub', 'data-control': this.control});
  },
});

const ChipStub = defineComponent({
  name: 'ActionEffectChip',
  props: {effect: {type: Object as PropType<ActionEffect>, required: true}},
  render() {
    return h('i', {'class': 'chip-stub', 'data-icon': this.effect.icon});
  },
});

/**
 * The dock stands a card face where the real one stands it — the node X hands the fullscreen viewer as its origin —
 * and, like the real one, exposes its root as `rootEl` (components/rootEl.ts): the screen finds the face under it.
 */
const DockStub = defineComponent({
  name: 'VaporAsyncComponentWrapper',
  props: {view: {type: Object, required: true}},
  setup(_, {expose}) {
    const root = ref<HTMLElement | null>(null);
    expose({rootEl: root});
    return () => h('aside', {'ref': root, 'class': 'dock-stub'}, [h('div', {'class': 'pcard'})]);
  },
});

const stubs = {
  ConsolePromptHead: HeadStub,
  ConsoleDeclinePlate: DeclineStub,
  ConsoleVariantChoice: ChoiceStub,
  GamepadGlyph: GlyphStub,
  ActionEffectChip: ChipStub,
  VaporAsyncComponentWrapper: DockStub,
};

const CARDS: ActionEffect = {direction: 'gain', icon: 'cards', amount: 1} as ActionEffect;
const TOKEN: ActionEffect = {direction: 'cost', icon: 'science', amount: 1} as ActionEffect;

function action(key: string, optionIndex: number, more: Partial<EffectDecisionAction> = {}): EffectDecisionAction {
  return {key, optionIndex, role: 'primary', title: 'Answer ' + key, chips: [], navigation: 'immediate', ...more};
}

/** «Олимпийская конференция»: take the token off and draw, or put one on — asked by a card the viewer can open. */
function decisionVm(more: Partial<EffectDecisionViewModel> = {}): EffectDecisionViewModel {
  return {
    eyebrowKey: 'Card effect',
    stageKey: 'Effect',
    headlineKey: 'Choose an effect',
    trigger: 'You played a science tag',
    source: {kind: 'card', card: CardName.OLYMPUS_CONFERENCE, inspectable: true},
    actions: [
      action('draw', 0, {description: 'Remove the token and draw', chips: [TOKEN, CARDS]}),
      action('store', 1, {tradeoff: 'No card now', notice: 'Already at maximum'}),
    ],
    unavailable: [],
    ...more,
  };
}

function viewOf(more: Record<string, unknown> = {}): PlayerViewModel {
  return {waitingFor: {type: 'or', title: 'Select one option', buttonLabel: 'Confirm', promptId: 5, options: [], ...more}} as unknown as PlayerViewModel;
}

const press = (button: SemanticButton): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const optionAnswer = (index: number) => ({type: 'or', index, response: {type: 'option'}});

type DecisionProps = {playerView: PlayerViewModel, vm: EffectDecisionViewModel, embedded?: boolean, promptOverride?: PlayerInputModel};

function mountUnderHost(initial: Partial<DecisionProps> = {}) {
  const props = shallowReactive<DecisionProps>({playerView: viewOf(), vm: decisionVm(), ...initial});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleEffectDecision, {ref: 'effectDecision', ...props})]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs}});
  const screen = () => wrapper.findComponent(ConsoleEffectDecision);
  return {
    wrapper,
    props,
    screen,
    reach: () => (wrapper.vm.$refs.effectDecision ?? undefined) as DecisionReach | undefined,
    /** The answers' group (the first choice stub — the second, when it stands, is the refused targets'). */
    choice: () => wrapper.findComponent(ChoiceStub),
    options: () => wrapper.findComponent(ChoiceStub).props('options') as ReadonlyArray<VariantChoiceOption>,
  };
}

describe('ConsoleEffectDecision — the screen of an optional decision', () => {
  beforeEach(() => {
    resetDecisionFocus();
    setWorkspaceOutcomePhase('');
  });
  afterEach(() => {
    clearPanelCommands('effectDecision');
    setWorkspaceOutcomePhase('');
    resetDecisionFocus();
    closeConsoleCardZoom();
  });

  it('STANDALONE: a plate of the prompt-modal family — the family head, the source dock, the answers with what each costs and gives', () => {
    const {wrapper, choice, options} = mountUnderHost();
    const root = wrapper.find('div.con-decision');
    expect(root.element, 'the template starts with its root — no comment node before it').to.eq((wrapper.element as Element).children[0]);
    expect(root.classes()).to.include('con-ws');
    expect(root.classes()).to.not.include('con-decision--embedded');
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq('Choose an effect');
    expect(root.attributes('data-motion-surface')).to.eq('effect-decision');

    const panel = root.find('.con-decision__panel');
    expect(panel.classes(), 'a full source card beside the answers is the `l` tier; a free choice is neutral')
      .to.include.members(['con-prompt', 'con-prompt--l', 'con-prompt--neutral']);
    expect(panel.attributes('data-motion-panel')).to.not.eq(undefined);
    expect(panel.attributes('data-prompt-panel')).to.eq('');

    const head = wrapper.findComponent(HeadStub);
    expect(head.exists()).to.eq(true);
    expect(head.classes()).to.include('con-decision__head');
    expect(head.props()).to.deep.include({
      tone: 'neutral', kicker: 'Card effect', title: 'Choose an effect', trigger: 'You played a science tag', promptKey: '5|or|Select one option', series: undefined,
    });
    expect(wrapper.find('.con-decision__ask').exists(), 'the embedded dress\'s own question line is not drawn').to.eq(false);

    const dock = wrapper.findComponent(DockStub);
    expect(dock.exists()).to.eq(true);
    expect(dock.classes()).to.include('con-decision__source');
    expect(dock.attributes('data-reaction-home')).to.eq(CardName.OLYMPUS_CONFERENCE);
    expect(dock.props('view')).to.deep.include({card: CardName.OLYMPUS_CONFERENCE, inspectable: true});
    expect(wrapper.find('.con-decision__main').classes()).to.not.include('con-decision__main--sourceless');

    expect(choice().classes()).to.include('con-decision__choices');
    expect(choice().props('layout'), 'results, not seats — stacked tiles').to.eq('column');
    expect(choice().props('exclusive'), 'a few exclusive results — «ИЛИ» between them').to.eq(true);
    expect(choice().props('label')).to.eq('Choose an effect');
    expect(options()).to.deep.eq([
      {
        key: 'draw', state: {focused: true, selected: false, off: false}, title: 'Answer draw', door: false, color: undefined,
        attrs: {'data-decision-action': 'draw', 'data-decision-role': 'primary'},
      },
      {
        key: 'store', state: {focused: false, selected: false, off: false}, title: 'Answer store', door: false, color: undefined,
        attrs: {'data-decision-action': 'store', 'data-decision-role': 'primary'},
      },
    ]);

    // What each tile carries in the host's body: its sub-line, its chips, its trade-off, the calm notice — and A on the cursor's tile only.
    const tiles = wrapper.findAll('.tile-stub');
    expect(tiles[0].find('.con-decision__opt-desc').text()).to.eq('Remove the token and draw');
    expect(tiles[0].findAll('.con-decision__opt-chips > .chip-stub').map((c) => c.attributes('data-icon'))).to.deep.eq(['science', 'cards']);
    expect(tiles[0].find('.con-decision__opt-tradeoff').exists()).to.eq(false);
    expect(tiles[0].find('.glyph-stub.con-decision__opt-a').attributes('data-control')).to.eq('confirm');
    expect(tiles[1].find('.con-decision__opt-a').exists()).to.eq(false);
    expect(tiles[1].find('.con-decision__opt-chips').exists()).to.eq(false);
    expect(tiles[1].find('.con-decision__opt-tradeoff').text()).to.eq('⚠ No card now');
    const notice = tiles[1].find('.con-decision__opt-notice');
    expect(notice.attributes('data-decision-notice')).to.eq('at-maximum');
    expect(notice.text()).to.eq('Already at maximum');
    expect(wrapper.find('.con-decision__unavailable').exists()).to.eq(false);
  });

  it('seats are a pick LIST; a door names where it leads; refused targets stand apart with their reason; a button decline rides the head', () => {
    const {wrapper, choice, options} = mountUnderHost({
      vm: decisionVm({
        source: undefined,
        actions: [
          action('red', 0, {playerColor: 'red', leadKey: 'Open cards in hand', navigation: 'handCards'}),
          action('blue', 1, {playerColor: 'blue'}),
        ],
        unavailable: [{title: 'Green', reason: 'Protected habitat', playerColor: 'green'}],
        decline: {optionIndex: 2, title: 'Do not attack', forgone: [CARDS]},
      }),
    });
    expect(choice().props('layout')).to.eq('list');
    expect(choice().props('exclusive'), 'never «ИЛИ» down a list of targets').to.eq(false);
    expect(options().map((o) => [o.color, o.door])).to.deep.eq([['red', true], ['blue', false]]);
    expect(wrapper.find('.tile-stub .con-decision__opt-lead').text()).to.eq('Open cards in hand');

    expect(wrapper.find('.con-decision__main').classes(), 'no source — no column at all').to.include('con-decision__main--sourceless');
    expect(wrapper.findComponent(DockStub).exists()).to.eq(false);
    expect(wrapper.find('.con-decision__panel').classes(), 'answers alone are the `m` tier').to.include('con-prompt--m');

    const decline = wrapper.findComponent(HeadStub).findComponent(DeclineStub);
    expect(decline.exists(), 'in the head\'s `decline` slot').to.eq(true);
    expect(decline.props('label')).to.eq('Do not attack');
    expect(decline.props('forgone')).to.deep.eq([CARDS]);

    const refused = wrapper.find('.con-decision__unavailable');
    expect(refused.find('.con-decision__unavailable-title').text()).to.eq('Unavailable targets');
    const groups = wrapper.findAllComponents(ChoiceStub);
    expect(groups).to.have.length(2);
    expect(groups[1].props('layout')).to.eq('list');
    expect(groups[1].props('exclusive')).to.eq(false);
    expect(groups[1].props('options')).to.deep.eq([
      {key: 'u0', state: {focused: false, selected: false, off: true}, title: 'Green', reason: 'Protected habitat', color: 'green'},
    ]);
  });

  it('EMBEDDED: the shell is stripped, the question line is its own, and the stage name is handed UP — taken back only while it is still ours', () => {
    const {wrapper} = mountUnderHost({embedded: true, vm: decisionVm({decline: {optionIndex: 2, title: 'Do not use the effect', forgone: []}})});
    const root = wrapper.find('div.con-decision');
    expect(root.classes()).to.include('con-decision--embedded');
    expect(root.classes()).to.not.include('con-ws');
    expect(root.attributes('role')).to.eq('group');
    expect(root.attributes('data-motion-surface'), 'a kept motion id would claim the shared shade and dim the host').to.eq(undefined);
    const panel = root.find('.con-decision__panel');
    expect(panel.classes()).to.deep.eq(['con-decision__panel']);
    expect(panel.attributes('data-prompt-panel')).to.eq(undefined);

    expect(wrapper.findComponent(HeadStub).exists(), 'no family head — no kicker inside someone else\'s frame').to.eq(false);
    const head = root.find('header.con-decision__head');
    expect(head.find('h2.con-decision__title.con-ws-stage-title').text()).to.eq('Choose an effect');
    expect(head.find('.con-decision__ask > .decline-stub').attributes('data-label')).to.eq('Do not use the effect');
    expect(head.find('p.con-decision__trigger').text(), 'WHY it appeared stays in both dresses').to.eq('You played a science tag');

    expect(workspaceOutcomeState.phaseKey, 'the crumb\'s tail, published at mount').to.eq('Effect');
    wrapper.unmount();
    expect(workspaceOutcomeState.phaseKey, 'our own name — taken back').to.eq('');
  });

  it('EMBEDDED: an answer that resolves on the press hands the tail ON to what follows — and leaving does not blank it', () => {
    const {wrapper, reach, screen} = mountUnderHost({embedded: true});
    reach()!.handleIntent(press('confirm'));
    expect(screen().emitted('submit')).to.deep.eq([[optionAnswer(0)]]);
    expect(workspaceOutcomeState.phaseKey, 'the chosen answer draws a card — the flow\'s next stage').to.eq('Card draw');
    wrapper.unmount();
    expect(workspaceOutcomeState.phaseKey, 'not our name any more — the flow only moves forward').to.eq('Card draw');
  });

  it('publishes its command contract to the shell\'s one bar — the commit speaks the decision\'s tone — and takes it back when it leaves', async () => {
    const {wrapper, reach, props} = mountUnderHost();
    expect(consolePanelUi.owner).to.eq('effectDecision');
    expect(consolePanelUi.commands).to.deep.eq([
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Confirm'},
      {control: 'secondary', label: 'Inspect the source'},
      {control: 'back', label: 'Minimize'},
    ]);

    // A LOSS the viewer suffers: the commit names it, in the danger tone …
    props.playerView = viewOf({botAttackPrompt: {}});
    await nextTick();
    expect(wrapper.find('.con-decision__panel').classes()).to.include('con-prompt--loss');
    expect(consolePanelUi.commands.find((c) => c.control === 'confirm')).to.deep.eq({control: 'confirm', label: 'Accept the loss', tone: 'danger'});
    // … a GAIN: the commit is lit …
    props.playerView = viewOf({choiceContext: {mode: 'reward'}});
    await nextTick();
    expect(consolePanelUi.commands.find((c) => c.control === 'confirm')).to.deep.eq({control: 'confirm', label: 'Confirm', highlight: true});
    // … and a DOOR is never a commit: «Select» keeps its own words in every tone.
    props.vm = decisionVm({actions: [action('door', 0, {leadKey: 'Open cards in hand'})]});
    await nextTick();
    expect(consolePanelUi.commands.find((c) => c.control === 'confirm')).to.deep.eq({control: 'confirm', label: 'Select'});
    expect(reach()).to.not.eq(undefined);

    wrapper.unmount();
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the d-pad walks the answers (and wraps), the module remembers the cursor', async () => {
    const {reach, options} = mountUnderHost();
    const decision = reach();
    expect(decision, 'the shell\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(decision!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent']);
    for (const inner of ['inspectSource', 'labelOf', 'textOf', 'focusIdx', 'armed', 'submitting', 'footCommands', 'sourceCard', 'props', 'emit']) {
      expect((decision as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    decision!.handleIntent(nav('down'));
    await nextTick();
    expect(options().map((o) => o.state.focused)).to.deep.eq([false, true]);
    expect(effectDecisionState.focusIdx, 'the cursor outlives the screen').to.eq(1);
    decision!.handleIntent(nav('right'));
    await nextTick();
    expect(options().map((o) => o.state.focused), 'past the last answer — the first').to.deep.eq([true, false]);
    decision!.handleIntent(nav('up'));
    await nextTick();
    expect(options().map((o) => o.state.focused), 'before the first — the last').to.deep.eq([false, true]);
    expect(effectDecisionState.focusIdx).to.eq(1);
  });

  it('A answers ONCE — the seal stands on the answered tile; the next server response re-arms; B defers, never declines', async () => {
    const {wrapper, reach, screen, options, props} = mountUnderHost();
    reach()!.handleIntent(nav('down'));
    reach()!.handleIntent(press('confirm'));
    reach()!.handleIntent(press('confirm'));
    expect(screen().emitted('submit'), 'a second A must not submit twice').to.deep.eq([[optionAnswer(1)]]);
    await nextTick();
    expect(options().map((o) => o.state.selected), 'the press\'s own acknowledgement').to.deep.eq([false, true]);
    expect(wrapper.find('.con-decision__opt-a').exists(), 'the seal took A\'s lane').to.eq(false);

    // The next decision of the same chain arrives in the very next response — this instance never unmounts.
    props.playerView = viewOf({promptId: 6});
    await nextTick();
    expect(options().map((o) => o.state.selected), 'a fresh prompt never paints a pressed row').to.deep.eq([false, false]);
    reach()!.handleIntent(press('confirm'));
    expect(screen().emitted('submit')).to.have.length(2);

    reach()!.handleIntent(press('back'));
    expect(screen().emitted('defer')).to.deep.eq([[]]);
    expect(screen().emitted('submit'), 'B is not a decline').to.have.length(2);
    reach()!.handleIntent(press('triggerR'));
    expect(screen().emitted('submit'), 'no decline in this decision — RT is nobody\'s').to.have.length(2);
  });

  it('RT is the deliberate refusal; A on a door hands the shell the pick with the decision\'s source, decline and next stage', () => {
    const nested = {type: 'card', title: 'Select a card to discard', cards: []} as unknown as SelectCardModel;
    const vm = decisionVm({
      actions: [action('discard', 0, {leadKey: 'Open cards in hand', navigation: 'handCards', nested, chips: [CARDS]})],
      decline: {optionIndex: 1, title: 'Do not discard', forgone: [CARDS]},
    });
    const {reach, screen} = mountUnderHost({vm});

    reach()!.handleIntent(press('confirm'));
    reach()!.handleIntent(press('confirm'));
    const picks = screen().emitted('hand-pick');
    expect(picks, 'a door is not a submit — it is never latched').to.have.length(2);
    expect(picks![0]).to.deep.eq([{
      index: 0,
      cardPrompt: nested,
      source: vm.source,
      decline: {index: 1, label: 'Do not discard', forgone: [CARDS]},
      nextStage: 'Card draw',
    }]);
    expect(screen().emitted('submit')).to.eq(undefined);

    reach()!.handleIntent(press('triggerR'));
    reach()!.handleIntent(press('triggerR'));
    expect(screen().emitted('submit'), 'the refusal — once').to.deep.eq([[optionAnswer(1)]]);
  });

  it('X opens the source in the ordinary viewer, from the dock\'s own card face (the dock is a component — its root is read through the ref)', () => {
    const {wrapper, reach} = mountUnderHost();
    reach()!.handleIntent(press('secondary'));
    expect(consoleCardZoom.card).to.deep.eq({name: CardName.OLYMPUS_CONFERENCE});
    expect(consoleCardZoom.statusLabel).to.eq('Source');
    expect(consoleCardZoom.origin.kind).to.eq('physical');
    expect(consoleCardZoom.origin.resolve?.(0), 'the face inside the dock').to.eq(wrapper.find('.dock-stub > .pcard').element);
  });

  it('the cursor is restored from the module at mount, and a genuinely NEW decision re-seeds it', async () => {
    effectDecisionState.focusIdx = 1;
    const {options, props} = mountUnderHost();
    await nextTick();
    expect(options().map((o) => o.state.focused), 'coming back from the hand lands on the answer that opened it').to.deep.eq([false, true]);

    // The shell resets the module's memory for a new decision; this instance — never remounted — follows it.
    resetDecisionFocus();
    props.vm = decisionVm({headlineKey: 'Use the effect?'});
    await nextTick();
    expect(options().map((o) => o.state.focused), 'never the previous decision\'s cursor').to.deep.eq([true, false]);
  });
});
