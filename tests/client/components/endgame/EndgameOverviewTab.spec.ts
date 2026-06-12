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
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, victoryPoints: 0, total: 25,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
  const merged = {...b, ...p};
  if (p.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery + merged.city + merged.victoryPoints;
  }
  return merged;
}

function input(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, mc = 0): EndgamePlayerInput {
  return {color, name, corporations: ['Helion'], megacredits: mc, breakdown: breakdown(b), vpByGeneration: [10, 20, 30], globalSteps: {}};
}

function model(inputs: Array<EndgamePlayerInput>): EndgameModel {
  return buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 3});
}

describe('EndgameOverviewTab', () => {
  it('renders the duel head-to-head for two players', () => {
    const m = model([
      input('red', 'Victor', {terraformRating: 35, milestones: 5}),
      input('blue', 'Nastya', {terraformRating: 30, awards: 8}),
    ]);
    const wrapper = mount(EndgameOverviewTab, {...globalConfig, props: {model: m, viewerColor: 'red' as Color}});
    const html = wrapper.html();
    expect(wrapper.find('.eg-duel').exists()).to.eq(true);
    expect(html).to.include('Victor');
    expect(html).to.include('Nastya');
    // The winner (Victor) is placed on the left.
    expect(wrapper.find('.eg-duel__side--left').text()).to.include('Victor');
    // Category mirror rows render for each present category.
    expect(wrapper.findAll('.eg-catwin').length).to.be.greaterThan(0);
  });

  it('renders the podium + leaderboard for three players', () => {
    const m = model([
      input('red', 'Victor', {terraformRating: 35}),
      input('blue', 'Nastya', {terraformRating: 30}),
      input('green', 'Igor', {terraformRating: 22}),
    ]);
    const wrapper = mount(EndgameOverviewTab, {...globalConfig, props: {model: m, viewerColor: 'green' as Color}});
    expect(wrapper.find('.eg-podium').exists()).to.eq(true);
    expect(wrapper.findAll('.eg-lbrow').length).to.eq(3);
    expect(wrapper.find('.eg-duel').exists()).to.eq(false);
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
    // The default tab is Overview, so the duel renders.
    expect(wrapper.find('.eg-duel').exists()).to.eq(true);
  });
});
