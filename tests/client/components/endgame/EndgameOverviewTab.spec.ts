import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import EndgameOverviewTab from '@/client/components/endgame/tabs/EndgameOverviewTab.vue';
import EndgameResultsOverlay from '@/client/components/endgame/EndgameResultsOverlay.vue';
import {buildEndgameModel, EndgamePlayerInput, EndgameModel} from '@/client/components/endgame/endgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {RecursivePartial} from '@/common/utils/utils';

function breakdown(p: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  const b: VictoryPointsBreakdown = {
    terraformRating: 25, terraformRatingBreakdown: {base: 20, temperature: 2, oxygen: 1, oceans: 2, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: 25,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
  const merged = {...b, ...p};
  if (p.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery + merged.city + merged.victoryPoints;
  }
  return merged;
}

import {StrategyInput} from '@/client/components/endgame/strategyArchetypes';
import {CARD_VP_SOURCES, CardVpSource} from '@/client/components/endgame/cardScoreContribution';

function emptyCardVp() {
  const base = {} as Record<CardVpSource, number>;
  for (const s of CARD_VP_SOURCES) {
    base[s] = 0;
  }
  return {...base, total: 0, penalties: 0, confidence: 'high' as const};
}
function strategyInput(): StrategyInput {
  return {tags: {}, coloniesOwned: [], cardVp: emptyCardVp(), resourceTotals: {animals: 0, microbes: 0, floaters: 0, animalCards: 0, microbeCards: 0, floaterCards: 0}};
}
function input(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, mc = 0, si?: StrategyInput): EndgamePlayerInput {
  return {color, name, corporations: ['Helion'], megacredits: mc, breakdown: breakdown(b), vpByGeneration: [10, 20, 30], globalSteps: {}, strategyInput: si};
}

function model(inputs: Array<EndgamePlayerInput>): EndgameModel {
  return buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 3});
}

describe('EndgameOverviewTab', () => {
  it('renders the duel head-to-head for two players', () => {
    // Winner runs cities & greenery (board scoring), runner-up the global parameters —
    // a real two-plan game so the Iteration-15 directed-story layer produces episodes.
    const m = model([
      input('red', 'Victor', {terraformRating: 35, greenery: 18, city: 8}, 0, strategyInput()),
      input('blue', 'Nastya', {terraformRating: 44}, 0, strategyInput()),
    ]);
    const wrapper = mount(EndgameOverviewTab, {...globalConfig, props: {model: m, viewerColor: 'red' as Color}});
    const html = wrapper.html();
    // Rework §2 — the premium duel result block (no category bars, §1).
    expect(wrapper.find('.eg-rhduel').exists()).to.eq(true);
    expect(wrapper.find('.eg-catwin').exists(), 'category bars removed from the overview').to.eq(false);
    expect(html).to.include('Victor');
    expect(html).to.include('Nastya');
    // The winner (Victor) is placed on the left.
    expect(wrapper.find('.eg-rhduel__player--left').text()).to.include('Victor');
    // A short thesis (the composed hero thesis) sits under the result block (§16).
    expect(wrapper.find('.eg-rhduel__thesis').exists(), 'result thesis').to.eq(true);
    // Iteration 15 — the directed story layer: the 30-second story + the editorial
    // "what defined this game" replace the old storyhead chips (§8/§13).
    expect(wrapper.find('.eg-storyhead').exists(), 'old storyhead removed').to.eq(false);
    expect(wrapper.find('.eg-story30').exists(), '30-second story').to.eq(true);
    expect(wrapper.find('.eg-defined').exists(), 'what-defined editorial').to.eq(true);
    // Iteration 17 — full-width editorial recap (§3) rendered through the rich-text layer (§4).
    expect(wrapper.find('.eg-story30__prose').exists(), 'full-width story prose').to.eq(true);
    expect(wrapper.find('.eg-richtext').exists(), 'rich-text renderer').to.eq(true);
    // §4/§6 — player names are coloured tokens; a strategy is an interactive (hoverable) term.
    expect(wrapper.find('.eg-term--player').exists(), 'coloured player token').to.eq(true);
    expect(wrapper.find('.eg-xbadge.eg-term').exists(), 'interactive strategy term').to.eq(true);
    // Iteration 10: the player-arcs section renders both players' arcs in a duel.
    expect(wrapper.find('.eg-storysec--arcs').exists(), 'player arcs section').to.eq(true);
    expect(wrapper.findAll('.eg-arc').length, 'an arc card per player').to.eq(2);
    // Iteration 12: the style chip is an EXPLAINABLE badge (hover/focus detail), with the
    // "?" affordance + a focusable role — no native title.
    const styleBadge = wrapper.find('.eg-arc .eg-xbadge--interactive');
    expect(styleBadge.exists(), 'style chip is explainable').to.eq(true);
    expect(styleBadge.attributes('role')).to.eq('button');
    expect(styleBadge.attributes('tabindex')).to.eq('0');
    expect(wrapper.find('.eg-arc .eg-xbadge__mark').exists(), 'has the ? affordance').to.eq(true);
  });

  it('renders the podium + leaderboard for three players', () => {
    const m = model([
      input('red', 'Victor', {terraformRating: 35}),
      input('blue', 'Nastya', {terraformRating: 30}),
      input('green', 'Igor', {terraformRating: 22}),
    ]);
    const wrapper = mount(EndgameOverviewTab, {...globalConfig, props: {model: m, viewerColor: 'green' as Color}});
    // Rework §2.2 — the multiplayer result block (winner + top-3 board), not a duel.
    expect(wrapper.find('.eg-rhmulti').exists()).to.eq(true);
    expect(wrapper.findAll('.eg-rhmulti__row').length).to.eq(3);
    expect(wrapper.find('.eg-rhduel').exists()).to.eq(false);
    expect(wrapper.find('.eg-catchip').exists(), 'category chips removed from the overview').to.eq(false);
  });
});

describe('EndgameResultsOverlay', () => {
  function view(): ViewModel {
    const v: RecursivePartial<ViewModel> = {
      id: 'p-test',
      game: {
        name: 'Test Game', generation: 3, moon: undefined, pathfinders: undefined,
        gameOptions: {expansions: {}, escapeVelocity: undefined, colonies: false},
        globalsPerGeneration: [],
      },
      players: [],
    };
    return v as ViewModel;
  }

  it('renders the shell with tabs and the winner chip', () => {
    const m = model([
      input('red', 'Victor', {terraformRating: 35}),
      input('blue', 'Nastya', {terraformRating: 30}),
    ]);
    const wrapper = mount(EndgameResultsOverlay, {...globalConfig, props: {model: m, view: view(), viewerColor: 'red' as Color}});
    expect(wrapper.find('.eg-results').exists()).to.eq(true);
    // Six tabs.
    expect(wrapper.findAll('.eg-results__tab').length).to.eq(6);
    // Winner chip shows the winner.
    expect(wrapper.find('.eg-results__winner-chip').text()).to.include('Victor');
    // The default tab is Overview, so the duel result block renders.
    expect(wrapper.find('.eg-rhduel').exists()).to.eq(true);
  });
});
