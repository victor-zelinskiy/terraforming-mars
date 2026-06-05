import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent} from 'vue';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import StartGameFlowOverlay from '@/client/components/startGameFlow/StartGameFlowOverlay.vue';
import {startGameFlowState, resetStartGameFlow, markStartFlowActivated} from '@/client/components/startGameFlow/startGameFlowState';

const PRELUDE_A = CardName.ECOLOGY_EXPERTS;
const PRELUDE_B = CardName.SUPPLIER;
const CORP = CardName.THARSIS_REPUBLIC;

function preludePrompt(cards: ReadonlyArray<CardName>, mode: 'hand' | 'draw' | 'copy' = 'hand'): any {
  return {
    type: 'card', title: 'Select prelude card to play', buttonLabel: 'Play',
    startGamePrompt: {kind: 'preludeSelection', preludeMode: mode},
    cards: cards.map((name) => ({name})), min: 1, max: 1,
  };
}
function corpPrompt(corpName: CardName = CORP): any {
  return {
    type: 'or', title: '', buttonLabel: '',
    startGamePrompt: {kind: 'corporationInitialAction'},
    options: [
      // Real option title shape: a Message with a CARD token = the corp name
      // (the token value is what corpActionOptionIndexFor matches on).
      {type: 'option', buttonLabel: '', title: {message: 'Take first action of ${0} corporation', data: [{type: 3, value: corpName}]}},
      {type: 'option', title: 'Pass for this generation', buttonLabel: 'Pass', warnings: ['pass']},
    ],
  };
}
function corpSelectPrompt(cards: ReadonlyArray<any>): any {
  return {
    type: 'card', title: 'Choose corporation card to play', buttonLabel: 'Play',
    startGamePrompt: {kind: 'corporationSelection'}, cards,
  };
}
function multiCorpPrompt(corps: ReadonlyArray<CardName>): any {
  return {
    type: 'or', title: '', buttonLabel: '', startGamePrompt: {kind: 'corporationInitialAction'},
    options: [
      ...corps.map((name) => ({type: 'option', buttonLabel: '', title: {message: 'Take first action of ${0} corporation', data: [{type: 3, value: name}]}})),
      {type: 'option', title: 'Pass for this generation', buttonLabel: 'Pass', warnings: ['pass']},
    ],
  };
}

// Holds the body of the last POST so submit payloads can be asserted. fetch
// returns a never-settling promise so the overlay's response handling (which
// would mutate the root) never runs.
let lastBody: any;
function stubFetch(): void {
  lastBody = undefined;
  (global as any).fetch = (_url: string, opts: any) => {
    lastBody = JSON.parse(opts.body);
    return new Promise(() => {});
  };
}

// Root harness exposing the App-root fields vueRoot(this) reads, so the overlay
// never sets unknown props on a bare vm (which would trip the warn-as-error
// handler in getLocalVue).
function harness(view: any, extraStubs: Record<string, any> = {}) {
  const Harness = defineComponent({
    components: {StartGameFlowOverlay},
    data() {
      return {isServerSideRequestInProgress: false, screen: 'player-home', playerView: view, playerkey: 0};
    },
    methods: {showAlert(): void { /* noop */ }},
    template: '<StartGameFlowOverlay :player-view="playerView" :waiting-on-players="[]" />',
  });
  return mount(Harness, {...globalConfig, global: {...globalConfig.global, stubs: {Card: true, CardZoomModal: true, ...extraStubs}}});
}

describe('StartGameFlowOverlay', () => {
  beforeEach(() => {
    resetStartGameFlow();
    stubFetch();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a РАЗЫГРАТЬ button only on a playable prelude and submits {type:card}', async () => {
    harness(fakePlayerViewModel({
      preludeCardsInHand: [{name: PRELUDE_A}, {name: PRELUDE_B}] as any,
      waitingFor: preludePrompt([PRELUDE_A, PRELUDE_B]),
    }));
    const btn = document.body.querySelector(`[data-test="start-game-flow-play-${PRELUDE_A}"]`);
    expect(btn, 'play button should render for a playable prelude').to.not.eq(null);
    (btn as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.type).to.eq('card');
    expect(lastBody?.cards).to.deep.eq([PRELUDE_A]);
  });

  it('shows ПРИМЕНИТЬ ЭФФЕКТ on the corp prompt and submits the corp option (never Pass)', async () => {
    harness(fakePlayerViewModel({
      pendingInitialActions: [CORP],
      waitingFor: corpPrompt(),
      thisPlayer: {tableau: [{name: CORP}]} as any,
    }));
    const apply = document.body.querySelector(`[data-test="start-game-flow-apply-${CORP}"]`);
    expect(apply, 'apply button should render').to.not.eq(null);
    (apply as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.type).to.eq('or');
    // Corp action is option 0; the Pass option (index 1) must never be submitted.
    expect(lastBody?.index).to.eq(0);
    expect(lastBody?.response).to.deep.eq({type: 'option'});
  });

  it('collapses to the pill while a focused sub-action is the prompt', () => {
    markStartFlowActivated('p-blue-id');
    harness(fakePlayerViewModel({
      waitingFor: {type: 'space', title: 'Select space for city', buttonLabel: ''} as any,
    }));
    expect(document.body.querySelector('[data-test="start-game-flow-pill"]')).to.not.eq(null);
    expect(document.body.querySelector('[data-test="start-game-flow"]')).to.eq(null);
  });

  it('shows the waiting state when no prompt and work remains', () => {
    markStartFlowActivated('p-blue-id');
    harness(fakePlayerViewModel({
      preludeCardsInHand: [{name: PRELUDE_A}] as any,
      waitingFor: undefined,
    }));
    expect(document.body.querySelector('[data-test="start-game-flow-waiting"]')).to.not.eq(null);
  });

  it('shows НАЧАТЬ ПАРТИЮ only when everything is done, and completing sets completed (no fetch)', async () => {
    markStartFlowActivated('p-blue-id');
    harness(fakePlayerViewModel({})); // no preludes, no corp action → allDone
    const begin = document.body.querySelector('[data-test="start-game-flow-begin"]');
    expect(begin, 'begin button should render when all done').to.not.eq(null);
    (begin as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(startGameFlowState.completedPlayers).to.include('p-blue-id');
    expect(lastBody, 'begin must not POST').to.eq(undefined);
  });

  it('never renders a Pass option in the corp flow', () => {
    harness(fakePlayerViewModel({
      pendingInitialActions: [CORP],
      waitingFor: corpPrompt(),
      thisPlayer: {tableau: [{name: CORP}]} as any,
    }));
    const text = document.body.querySelector('[data-test="start-game-flow"]')?.textContent ?? '';
    expect(text.toLowerCase()).to.not.include('пас');
    expect(text.toLowerCase()).to.not.include('pass');
  });

  it('can play a prelude from the fullscreen viewer (playable gate + dispatch)', async () => {
    markStartFlowActivated('p-blue-id');
    const w = harness(fakePlayerViewModel({
      preludeCardsInHand: [{name: PRELUDE_A}] as any,
      waitingFor: preludePrompt([PRELUDE_A], 'hand'),
    }));
    const vm: any = w.findComponent(StartGameFlowOverlay).vm;
    // The fullscreen РАЗЫГРАТЬ is gated by this set and dispatches via playByName.
    expect(vm.playableZoomNames.has(PRELUDE_A)).to.eq(true);
    expect(vm.zoomNavCards.map((c: any) => c.name)).to.include(PRELUDE_A);
    vm.playByName(PRELUDE_A);
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.type).to.eq('card');
    expect(lastBody?.cards).to.deep.eq([PRELUDE_A]);
  });

  it('blocks Double Down РАЗЫГРАТЬ (fizzle) while another prelude is playable, with a hint', () => {
    markStartFlowActivated('p-blue-id');
    const DD = CardName.DOUBLE_DOWN;
    const w = harness(fakePlayerViewModel({
      preludeCardsInHand: [{name: DD}, {name: PRELUDE_A}] as any,
      waitingFor: {
        type: 'card', title: 'Select prelude card to play', buttonLabel: 'Play',
        startGamePrompt: {kind: 'preludeSelection', preludeMode: 'hand'},
        cards: [{name: DD, warnings: ['preludeFizzle']}, {name: PRELUDE_A}],
      } as any,
    }));
    // No РАЗЫГРАТЬ for the fizzling Double Down — a hint note instead.
    expect(document.body.querySelector(`[data-test="start-game-flow-play-${DD}"]`)).to.eq(null);
    expect(document.body.querySelector(`[data-test="start-game-flow-blocked-${DD}"]`)).to.not.eq(null);
    // The productive prelude is still playable.
    expect(document.body.querySelector(`[data-test="start-game-flow-play-${PRELUDE_A}"]`)).to.not.eq(null);
    // And it can't be played from fullscreen either.
    const vm: any = w.findComponent(StartGameFlowOverlay).vm;
    expect(vm.playableZoomNames.has(DD)).to.eq(false);
    expect(vm.playableZoomNames.has(PRELUDE_A)).to.eq(true);
  });

  it('Merger: renders the corp-selection block; unaffordable corp not selectable; select submits', async () => {
    markStartFlowActivated('p-blue-id');
    const HELION = CardName.HELION;
    harness(fakePlayerViewModel({
      waitingFor: corpSelectPrompt([{name: CORP}, {name: HELION, isDisabled: true}]),
    }));
    expect(document.body.querySelector('[data-test="start-game-flow-corp-select"]')).to.not.eq(null);
    const sel = document.body.querySelector(`[data-test="start-game-flow-corp-select-${CORP}"]`);
    expect(sel, 'affordable corp is selectable').to.not.eq(null);
    // Unaffordable corp: a hint, not a select button.
    expect(document.body.querySelector(`[data-test="start-game-flow-corp-select-${HELION}"]`)).to.eq(null);
    expect(document.body.querySelector(`[data-test="start-game-flow-corp-disabled-${HELION}"]`)).to.not.eq(null);
    (sel as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.type).to.eq('card');
    expect(lastBody?.cards).to.deep.eq([CORP]);
  });

  it('Merger: TWO corps owing actions each get their own ПРИМЕНИТЬ ЭФФЕКТ (under the card)', async () => {
    const HELION = CardName.HELION;
    harness(fakePlayerViewModel({
      pendingInitialActions: [CORP, HELION],
      waitingFor: multiCorpPrompt([CORP, HELION]),
      thisPlayer: {tableau: [{name: CORP}, {name: HELION}]} as any,
    }));
    const applyA = document.body.querySelector(`[data-test="start-game-flow-apply-${CORP}"]`);
    const applyB = document.body.querySelector(`[data-test="start-game-flow-apply-${HELION}"]`);
    expect(applyA, 'corp A apply').to.not.eq(null);
    expect(applyB, 'corp B apply').to.not.eq(null);
    // Applying corp B submits B's option index (1), not A's (0) nor Pass (2).
    (applyB as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.type).to.eq('or');
    expect(lastBody?.index).to.eq(1);
  });

  it('Double Down (copy): renders the copy block and submits WITHOUT recording a draw-choice', async () => {
    markStartFlowActivated('p-blue-id');
    const w = harness(fakePlayerViewModel({
      waitingFor: preludePrompt([PRELUDE_A], 'copy'),
      thisPlayer: {tableau: [{name: PRELUDE_A}]} as any,
    }));
    // The copy picker renders (and the source stays in the grid above it).
    expect(document.body.querySelector('[data-test="start-game-flow-copy"]')).to.not.eq(null);
    const vm: any = w.findComponent(StartGameFlowOverlay).vm;
    expect([...vm.copyCandidates]).to.deep.eq([PRELUDE_A]);
    vm.playByName(PRELUDE_A);
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.cards).to.deep.eq([PRELUDE_A]);
    // Crucially: a copy pick is NOT recorded as a draw-choice (no exclusion / no СБРОШЕНА).
    expect(startGameFlowState.drawChoices.length).to.eq(0);
  });

  it('dispatches a fullscreen play of a draw candidate through the draw recorder', async () => {
    markStartFlowActivated('p-blue-id');
    const w = harness(fakePlayerViewModel({
      waitingFor: preludePrompt([PRELUDE_A, PRELUDE_B], 'draw'),
    }));
    const vm: any = w.findComponent(StartGameFlowOverlay).vm;
    expect(vm.playableZoomNames.has(PRELUDE_A)).to.eq(true);
    vm.playByName(PRELUDE_A);
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.cards).to.deep.eq([PRELUDE_A]);
    expect(startGameFlowState.drawChoices.some((r) => r.chosen === PRELUDE_A)).to.eq(true);
  });

  it('renders the drew-N-choose-ONE block and submits the chosen prelude', async () => {
    markStartFlowActivated('p-blue-id');
    harness(fakePlayerViewModel({
      waitingFor: preludePrompt([PRELUDE_A, PRELUDE_B], 'draw'),
    }));
    expect(document.body.querySelector('[data-test="start-game-flow-draw"]')).to.not.eq(null);
    const playBtn = document.body.querySelector(`[data-test="start-game-flow-draw-play-${PRELUDE_A}"]`);
    expect(playBtn, 'a play button per drawn candidate').to.not.eq(null);
    (playBtn as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(lastBody?.type).to.eq('card');
    expect(lastBody?.cards).to.deep.eq([PRELUDE_A]);
    // The choice was recorded for the РАЗЫГРАНА / СБРОШЕНА display.
    expect(startGameFlowState.drawChoices.some((r) => r.chosen === PRELUDE_A)).to.eq(true);
  });
});
