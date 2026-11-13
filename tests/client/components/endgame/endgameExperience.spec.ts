/*
 * EndgameExperience — the root of the desktop end-of-game flow (reveal → results → pill), headless in console mode.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): three props (`view`, `viewerColor`,
 * `consoleNative`), no emits, nothing exposed — so the spec is which of its three children it stands for the module's
 * endgame state, and what it hands each. The children are their own specs' subjects and are stubbed by name.
 * Mounted WITHOUT the i18n plugin on purpose: the component imports `v-i18n` itself, and a Vue warning fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ViewModel} from '@/common/models/PlayerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import EndgameExperience from '@/client/components/endgame/EndgameExperience.vue';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {endgameState, minimizeEndgameResults, openEndgameResults, resetEndgameState} from '@/client/components/endgame/endgameState';
import {resetEndgameFactsCache} from '@/client/components/endgame/endgameFactsCache';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const WinnerRevealStub = defineComponent({name: 'EndgameWinnerReveal', props: ['model'], render: () => h('i', {class: 'winner-reveal-stub'})});
const ScoringRevealStub = defineComponent({name: 'FinalScoringReveal', props: ['model', 'playerOrder', 'cardResources'], render: () => h('i', {class: 'scoring-reveal-stub'})});
const ResultsStub = defineComponent({name: 'EndgameResultsOverlay', props: ['model', 'view', 'viewerColor'], render: () => h('i', {class: 'results-stub'})});

function breakdown(terraformRating: number): VictoryPointsBreakdown {
  return {
    terraformRating, terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: terraformRating,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
}

/** An ended two-player game as the experience reads it: the seats in seating order (the runner-up sits first). */
function endedView(showOtherPlayersVP: boolean): ViewModel {
  const seat = (color: Color, name: string, rating: number, tableau: Array<{name: CardName, resources?: number}>) => ({
    color, name, tableau, tags: {}, megacredits: 0,
    steel: 0, titanium: 0, heat: 0, plants: 0, energy: 0,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0, plantProduction: 0, energyProduction: 0, heatProduction: 0,
    victoryPointsBreakdown: breakdown(rating), victoryPointsByGeneration: [10, rating], globalParameterSteps: {},
  });
  const view = {
    id: 'p-ended',
    game: {
      name: 'Ended', generation: 9, moon: undefined, pathfinders: undefined, colonies: [],
      gameOptions: {expansions: {venus: false}, showOtherPlayersVP},
    },
    players: [
      seat('blue', 'Nastya', 30, []),
      seat('red', 'Victor', 42, [{name: CardName.PETS, resources: 3}, {name: CardName.MINE}]),
    ],
  };
  // Only what the experience and its model builder read — far from a whole view.
  return view as unknown as ViewModel;
}

function experience(props: {view: ViewModel, viewerColor?: Color, consoleNative?: boolean}) {
  return mount(EndgameExperience, {
    props,
    global: {
      config: globalConfig.global.config,
      stubs: {EndgameWinnerReveal: WinnerRevealStub, FinalScoringReveal: ScoringRevealStub, EndgameResultsOverlay: ResultsStub},
    },
  });
}

describe('EndgameExperience — the desktop end-of-game flow', () => {
  const realFetch = globalThis.fetch;
  let asked: Array<string> = [];

  beforeEach(() => {
    asked = [];
    // The shared endgame-facts fetch is the experience's one request: answered «nothing», so the base analyzers stay.
    globalThis.fetch = (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      asked.push(String(input));
      return Promise.resolve({ok: false} as Response);
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    resetEndgameState();
    resetEndgameFactsCache();
  });

  it('on mount it begins the reveal once and asks for the game\'s facts; an open-score game gets the winner cinematic with the model built from the view', async () => {
    const w = experience({view: endedView(true), viewerColor: 'red'});
    expect(endgameState.revealHandled).to.eq(true);
    expect(asked).to.have.lengthOf(1);
    expect(asked[0]).to.include('id=p-ended');
    await nextTick(); // the reveal begins in `onMounted` — the child stands on the next render

    expect(w.classes()).to.deep.eq(['eg-root']);
    const reveal = w.findComponent(WinnerRevealStub);
    expect(reveal.exists()).to.eq(true);
    const model = reveal.props('model') as EndgameModel;
    expect(model.winner?.name).to.eq('Victor');
    expect(model.players.map((p) => p.color), 'ranked, the winner first').to.deep.eq(['red', 'blue']);
    expect(w.findComponent(ScoringRevealStub).exists()).to.eq(false);
    expect(w.findComponent(ResultsStub).exists()).to.eq(false);
    expect(w.find('.eg-pill').exists()).to.eq(false);
  });

  it('a hidden-VP game with opponents gets the category-by-category reveal — the lanes in SEATING order, the cards\' resources beside them', async () => {
    const w = experience({view: endedView(false)});
    await nextTick();
    expect(w.findComponent(WinnerRevealStub).exists()).to.eq(false);
    const reveal = w.findComponent(ScoringRevealStub);
    expect(reveal.props('playerOrder'), 'never ranked — the order must not spoil the result').to.deep.eq(['blue', 'red']);
    expect(reveal.props('cardResources')).to.deep.eq({blue: {}, red: {[CardName.PETS]: 3}});
    expect((reveal.props('model') as EndgameModel).winner?.color).to.eq('red');
  });

  it('past the reveal the results overlay stands with the model, the view and the viewer; minimized, it is the pill — the winner on it — and a press brings the overlay back', async () => {
    const w = experience({view: endedView(true), viewerColor: 'blue'});
    openEndgameResults();
    await nextTick();
    expect(w.findComponent(WinnerRevealStub).exists()).to.eq(false);
    const results = w.findComponent(ResultsStub);
    expect((results.props('view') as ViewModel).id).to.eq('p-ended');
    expect(results.props('viewerColor')).to.eq('blue');
    expect((results.props('model') as EndgameModel).winner?.total).to.eq(42);

    minimizeEndgameResults();
    await nextTick();
    expect(w.findComponent(ResultsStub).exists()).to.eq(false);
    const pill = w.find('button.eg-pill');
    expect((pill.element as HTMLElement).style.getPropertyValue('--eg-pc')).to.eq(endgamePlayerHex('red'));
    expect(pill.find('.eg-pill__label').text()).to.eq($t('Game results'));
    expect(pill.find('.eg-pill__dot').classes()).to.include('player_bg_color_red');
    expect(pill.find('.eg-pill__winner').text()).to.eq('Victor · 42' + $t('VP'));

    await pill.trigger('click');
    expect(endgameState.minimized).to.eq(false);
    expect(w.find('.eg-pill').exists()).to.eq(false);
    expect(w.findComponent(ResultsStub).exists()).to.eq(true);
  });

  it('in console mode it is HEADLESS — no reveal begun, no child, no pill, whatever the state — and still asks for the facts', async () => {
    const w = experience({view: endedView(false), consoleNative: true});
    expect(endgameState.revealHandled, 'the console workspace owns the ceremony').to.eq(false);
    expect(asked).to.have.lengthOf(1);
    expect(w.element.children).to.have.lengthOf(0);

    openEndgameResults();
    await nextTick();
    expect(w.element.children, 'the desktop overlay never rises there').to.have.lengthOf(0);
    minimizeEndgameResults();
    await nextTick();
    expect(w.find('.eg-pill').exists()).to.eq(false);
  });
});
