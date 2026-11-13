/*
 * ConsoleDraftWorkspace — the between-generations draft and the research buy as ONE console workspace. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). The surface itself — the deal, the pass exit,
 * the rise, the completion beats — is its e2e specs' subject (none of them can stand in jsdom); this spec pins what a
 * conversion could break:
 *  · it mounts in an honest minimal state with no warning — a reload straight into the research buy, and one into a
 *    live packet (neither replays a cinematic);
 *  · a parent's ref reaches exactly `handleIntent` (the shell's pad router hands it the intent — R11);
 *  · the bar's verbs are published BEFORE the first render (the `immediate` watcher) and follow the pad;
 *  · the marks outlive the surface: the setup body reads the memory before anything resets it (§ 1's order — the
 *    watchers, then what `created` did);
 *  · the LT sub-stage and back, on the path that flies nothing (no measurable rect).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleDraftWorkspace from '@/client/components/console/draft/ConsoleDraftWorkspace.vue';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {draftWorkspaceState, observeDraftWorkspace, resetDraftWorkspace} from '@/client/console/draft/consoleDraftFlow';
import {consoleDraftUi, resetConsoleDraftUi} from '@/client/console/draft/consoleDraftUi';
import {resetDraftTray, resolveTraySlot} from '@/client/console/cardDeal/consoleDraftTray';

// The children are their own specs' subjects; this one reads what the workspace HANDS them. (Render functions, not
// template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, lightweight: Boolean},
  render() {
    return h('div', {class: 'card-stub'}, String((this.card as {name: string}).name));
  },
});
const HeadStub = defineComponent({
  name: 'ConsoleWsHead',
  props: {root: String, emblem: String, subject: String, stage: String, committed: Boolean},
  setup(_props, {slots}) {
    return () => h('header', {class: 'head-stub'}, [slots.flow?.(), slots.trailing?.()]);
  },
});
const RailStub = defineComponent({
  name: 'ConsoleJourneyRail',
  props: ['phases', 'presentation', 'compactContext', 'committing', 'terminalLabel'],
  render: () => h('i', {class: 'rail-stub'}),
});
const ReadingStub = defineComponent({
  name: 'ConsoleDraftReading',
  props: ['reading', 'wallet', 'idle'],
  render: () => h('i', {class: 'reading-stub'}),
});
const STUBS = {
  Card: CardStub,
  ConsoleWsHead: HeadStub,
  ConsoleJourneyRail: RailStub,
  ConsoleDraftReading: ReadingStub,
  ConsoleCardDealLayer: true,
  GamepadGlyph: true,
};

const ME = {color: 'red', name: 'Ada', cardCost: 3, megacredits: 40};
const NEIGHBOUR = {color: 'blue', name: 'Bo', cardCost: 3, megacredits: 30};
const BUY = [CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.DUST_SEALS];
const PACKET = [CardName.ANTS, CardName.BIRDS, CardName.COMET];

const cardsOf = (names: ReadonlyArray<CardName>) => names.map((name) => ({name}));
const cardInput = (over: Record<string, unknown>) => ({
  type: 'card', title: 'Select a card', buttonLabel: 'Save', min: 1, max: 1,
  showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, ...over,
});

/** A reload straight into the research buy that follows the draft: four cards on the table, nothing drafted left. */
function buyView(): PlayerViewModel {
  return {
    id: 'p-draft-spec-buy',
    game: {phase: Phase.RESEARCH, generation: 2, gameOptions: {draftVariant: true}},
    thisPlayer: ME,
    players: [ME, NEIGHBOUR],
    draftedCards: [],
    waitingFor: cardInput({buyMode: true, cards: cardsOf(BUY), min: 0, max: 4}),
  } as unknown as PlayerViewModel;
}

/** A reload straight into a live packet: the second pick of four, the rest goes to the next seat. */
function pickView(): PlayerViewModel {
  return {
    id: 'p-draft-spec-pick',
    game: {phase: Phase.DRAFTING, generation: 2, gameOptions: {draftVariant: true}},
    thisPlayer: ME,
    players: [ME, NEIGHBOUR],
    draftedCards: cardsOf([CardName.DUST_SEALS]),
    waitingFor: cardInput({
      cards: cardsOf(PACKET),
      draftPrompt: {draftType: 'standard', direction: 'after', givingTo: 'blue', takingFrom: 'blue', total: 4},
    }),
  } as unknown as PlayerViewModel;
}

function mountWorkspace(playerView: PlayerViewModel) {
  return mount(ConsoleDraftWorkspace, {
    ...globalConfig,
    props: {playerView},
    global: {...globalConfig.global, stubs: STUBS},
  });
}

type Pad = {handleIntent(intent: GamepadIntent): void};
const padOf = (wrapper: {vm: unknown}) => wrapper.vm as Pad;
const press = (button: 'confirm' | 'back' | 'triggerL'): GamepadIntent => ({kind: 'press', button});
const barLabels = () => consoleDraftUi.commands.map((c) => c.label);
const shown = (wrapper: ReturnType<typeof mountWorkspace>, stage: string) =>
  (wrapper.find(`.con-draftws__stage--${stage}`).element as HTMLElement).style.display !== 'none';

function resetDraftModules(): void {
  resetDraftWorkspace();
  resetDraftTray();
  resetConsoleDraftUi();
}

describe('ConsoleDraftWorkspace — the draft and the research buy as one workspace', () => {
  beforeEach(resetDraftModules);
  afterEach(resetDraftModules);

  it('a reload straight into the buy: the set on the table, nothing dealt, the bar\'s verbs published before the first render', () => {
    const wrapper = mountWorkspace(buyView());

    expect(wrapper.classes()).to.include.members(['con-draftws', 'con-ws']);
    expect(wrapper.classes(), 'the wait is a pose of the root, and this is not it').to.not.contain('con-draftws--waiting');
    expect(wrapper.attributes('data-motion-surface')).to.eq('draftws');
    expect(wrapper.attributes('data-draft-composition')).to.eq('stack');

    // ONE layer of the stage at a time — the buy's.
    expect(['pick', 'wait', 'buy', 'inspect', 'done'].filter((stage) => shown(wrapper, stage))).to.deep.eq(['buy']);
    const slots = wrapper.findAll('.con-draftws__stage--buy [data-draft-buy-slot]');
    expect(slots.map((s) => s.attributes('data-draft-buy-slot'))).to.deep.eq(BUY);
    expect(slots.map((s) => s.find('.card-stub').text()), 'each slot holds its own face').to.deep.eq(BUY);
    expect(slots.map((s) => s.classes().includes('con-cards__slot--focused')), 'the cursor').to.deep.eq([true, false, false, false]);
    expect(slots.some((s) => s.classes().includes('con-deal-hold')), 'a reload replays no deal — no slot is held').to.eq(false);
    expect(wrapper.find('[data-draft-bought]').exists()).to.eq(false);

    // The header is the workspace's ONE crumb; the purchase names no neighbour.
    const head = wrapper.findComponent(HeadStub);
    expect(head.classes()).to.contain('con-draftws__head');
    expect(head.props()).to.include({root: 'Draft', emblem: 'cards', subject: 'Purchase', stage: '', committed: false});
    expect(wrapper.find('.con-draftws__pass').exists()).to.eq(false);
    expect(wrapper.findComponent(RailStub).props('terminalLabel')).to.eq('Ready');

    // The reading row: the card under the cursor by its name, and the purchase's wallet at the SERVER's price.
    const reading = wrapper.findComponent(ReadingStub);
    expect(reading.props('reading')).to.include({name: CardName.ANTS});
    expect(reading.props('wallet')).to.deep.eq({count: 0, perCard: 3, total: 0, onHand: 40, after: 40, affordable: true, priceHint: ''});
    expect(reading.props('idle')).to.eq('');

    // The collection handed its cards over long ago: the shelf is not part of the buy.
    expect((wrapper.find('.con-draftws__shelf').element as HTMLElement).style.display).to.eq('none');

    expect(barLabels()).to.deep.eq(['Select', 'Inspect', 'Buy ${0}', 'Minimize']);
    expect(consoleDraftUi.commands[2]).to.include({control: 'triggerR', enabled: true, highlight: false});
    expect(consoleDraftUi.commands[2].labelParams, '«Купить 0» is the honest verb of buying nothing').to.deep.eq(['0']);
  });

  it('a parent\'s ref reaches exactly `handleIntent` — and the pad it hands over moves the cursor', async () => {
    const view = buyView();
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleDraftWorkspace, {ref: 'ws', playerView: view})]),
    });
    const host = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
    const ws = host.vm.$refs.ws as Pad;
    expect(Object.keys(ws), 'the shell\'s pad router is its one reader').to.deep.eq(['handleIntent']);

    const focused = () => host.findAll('[data-draft-buy-slot]').map((s) => s.classes().includes('con-cards__slot--focused'));
    ws.handleIntent({kind: 'nav', dir: 'right', repeat: false});
    await nextTick();
    expect(focused()).to.deep.eq([false, true, false, false]);

    // A wall is a wall: the cursor neither wraps nor leaves the row.
    ws.handleIntent({kind: 'nav', dir: 'left', repeat: false});
    ws.handleIntent({kind: 'nav', dir: 'left', repeat: false});
    await nextTick();
    expect(focused()).to.deep.eq([true, false, false, false]);
  });

  it('A marks the card under the cursor — the wallet and the bar follow, the mark outlives the surface, B asks the shell to minimize', async () => {
    const wrapper = mountWorkspace(buyView());

    padOf(wrapper).handleIntent(press('confirm'));
    await nextTick();

    const slots = () => wrapper.findAll('[data-draft-buy-slot]');
    expect(slots().map((s) => s.classes().includes('con-cards__slot--picked'))).to.deep.eq([true, false, false, false]);
    expect(slots()[0].find('[data-draft-bought]').exists()).to.eq(true);
    expect(wrapper.findComponent(ReadingStub).props('wallet')).to.include({count: 1, total: 3, after: 37, affordable: true});
    expect(barLabels(), 'A on a marked card takes the mark back').to.deep.eq(['Deselect', 'Inspect', 'Buy ${0}', 'Minimize']);
    expect(consoleDraftUi.commands[2]).to.include({enabled: true, highlight: true});
    expect(consoleDraftUi.commands[2].labelParams).to.deep.eq(['1']);
    expect([...draftWorkspaceState.picks], 'mirrored into module state on every change').to.deep.eq([CardName.ANTS]);

    padOf(wrapper).handleIntent(press('back'));
    expect(wrapper.emitted('defer'), 'B is «свернуть» — the shell\'s collapse').to.have.length(1);
    expect(wrapper.emitted('submit'), 'nothing was sent').to.eq(undefined);

    // «Свернуть» parks the stack and unmounts the surface: it takes its bar and its tray resolver with it…
    expect(resolveTraySlot(CardName.ANTS), 'no shelf seat for a card that is not on the shelf').to.eq(null);
    wrapper.unmount();
    expect(consoleDraftUi.commands).to.deep.eq([]);

    // …and the restore mounts a fresh one over the SAME set: the mark is the player's, read before anything resets it.
    const restored = mountWorkspace(buyView());
    expect(restored.findAll('[data-draft-buy-slot]').map((s) => s.classes().includes('con-cards__slot--picked')))
      .to.deep.eq([true, false, false, false]);
    expect(restored.findComponent(ReadingStub).props('wallet')).to.include({count: 1, after: 37});
    await nextTick();
    expect(barLabels()).to.deep.eq(['Deselect', 'Inspect', 'Buy ${0}', 'Minimize']);
  });

  it('a reload into a live packet: the packet, where it goes, the rack — and LT spreads the collection and brings it home', async () => {
    const view = pickView();
    observeDraftWorkspace(undefined, view); // the shell's observer latches the marker (the rack's size, the neighbours)
    const wrapper = mountWorkspace(view);

    expect(['pick', 'wait', 'buy', 'inspect', 'done'].filter((stage) => shown(wrapper, stage))).to.deep.eq(['pick']);
    const packet = wrapper.findAll('.con-draftws__stage--pick [data-zoom-slot]');
    expect(packet.map((s) => s.attributes('data-zoom-slot'))).to.deep.eq(PACKET);
    expect(packet.map((s) => s.classes().includes('con-cards__slot--focused'))).to.deep.eq([true, false, false]);
    expect(packet.some((s) => s.classes().includes('con-deal-hold')), 'a packet already on the table is never re-dealt').to.eq(false);

    const head = wrapper.findComponent(HeadStub);
    expect(head.props()).to.include({root: 'Draft', subject: 'Card selection', stage: '', committed: false});
    expect(wrapper.find('.con-draftws__pass-name').text(), 'the rest of the packet goes to the next seat').to.eq('Bo');
    expect(wrapper.find('.con-draftws__pass-dot').classes()).to.contain('player_bg_color_blue');
    expect(wrapper.find('.con-draftws__pass-arrow').text()).to.eq('⟶');

    // The rack is a constant: one card landed, three seats prepared up to the server's total.
    const shelf = wrapper.find('.con-draftws__shelf');
    expect((shelf.element as HTMLElement).style.display).to.not.eq('none');
    expect(shelf.findAll('[data-tray-slot]').map((s) => s.attributes('data-tray-slot'))).to.deep.eq([CardName.DUST_SEALS]);
    expect(shelf.findAll('[data-shelf-seat]').map((s) => s.attributes('data-shelf-seat'))).to.deep.eq(['2', '3', '4']);
    expect(shelf.find('.con-draftws__shelf-count').text().replace(/\s+/g, ' ')).to.eq('1 / 4');
    expect(resolveTraySlot(CardName.DUST_SEALS), 'the shelf IS the tray: a flight resolves its seat here')
      .to.eq(shelf.find('[data-tray-slot]').element);
    expect(barLabels()).to.deep.eq(['Take', 'Inspect', 'Drafted', 'Minimize']);

    // LT — the drafted cards take the stage (nothing measurable to fly in jsdom: the instant path).
    padOf(wrapper).handleIntent(press('triggerL'));
    await nextTick();
    expect(draftWorkspaceState.inspecting).to.eq(true);
    expect(['pick', 'wait', 'buy', 'inspect', 'done'].filter((stage) => shown(wrapper, stage))).to.deep.eq(['inspect']);
    const row = wrapper.findAll('.con-draftws__stage--inspect [data-inspect-slot]');
    expect(row.map((s) => s.attributes('data-inspect-slot'))).to.deep.eq([CardName.DUST_SEALS]);
    expect(row[0].classes()).to.contain('con-cards__slot--focused');
    expect(row[0].classes(), 'the card stands on the big row…').to.not.contain('con-deal-hold');
    expect(shelf.find('[data-tray-slot]').classes(), '…so its seat on the shelf holds empty — one physical set').to.contain('con-deal-hold');
    expect(head.props()).to.include({subject: 'Drafted', stage: 'Inspection'});
    expect(wrapper.find('.con-draftws__pass').exists(), 'the sub-stage passes nothing').to.eq(false);
    expect(barLabels()).to.deep.eq(['Inspect', 'Back']);

    // B is ONE level: out of the sub-stage, back to the packet — never the shell's collapse.
    padOf(wrapper).handleIntent(press('back'));
    await nextTick();
    expect(draftWorkspaceState.inspecting).to.eq(false);
    expect(wrapper.emitted('defer')).to.eq(undefined);
    expect(['pick', 'wait', 'buy', 'inspect', 'done'].filter((stage) => shown(wrapper, stage))).to.deep.eq(['pick']);
    expect(shelf.find('[data-tray-slot]').classes()).to.not.contain('con-deal-hold');
    expect(barLabels()).to.deep.eq(['Take', 'Inspect', 'Drafted', 'Minimize']);
  });
});
