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

function preludePrompt(cards: ReadonlyArray<CardName>, mode: 'hand' | 'draw' = 'hand'): any {
  return {
    type: 'card', title: 'Select prelude card to play', buttonLabel: 'Play',
    startGamePrompt: {kind: 'preludeSelection', preludeMode: mode},
    cards: cards.map((name) => ({name})), min: 1, max: 1,
  };
}
function corpPrompt(): any {
  return {
    type: 'or', title: '', buttonLabel: '',
    startGamePrompt: {kind: 'corporationInitialAction'},
    options: [
      {type: 'option', title: 'Take first action of Tharsis Republic corporation', buttonLabel: ''},
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
function harness(view: any) {
  const Harness = defineComponent({
    components: {StartGameFlowOverlay},
    data() {
      return {isServerSideRequestInProgress: false, screen: 'player-home', playerView: view, playerkey: 0};
    },
    methods: {showAlert(): void { /* noop */ }},
    template: '<StartGameFlowOverlay :player-view="playerView" :waiting-on-players="[]" />',
  });
  return mount(Harness, {...globalConfig, global: {...globalConfig.global, stubs: {Card: true}}});
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
    const apply = document.body.querySelector('[data-test="start-game-flow-apply"]');
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
