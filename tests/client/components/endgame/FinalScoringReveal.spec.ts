import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import FinalScoringReveal from '@/client/components/endgame/FinalScoringReveal.vue';
import {buildEndgameModel, EndgamePlayerInput, EndgameModel} from '@/client/components/endgame/endgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';
import {endgameState, resetEndgameState} from '@/client/components/endgame/endgameState';

function breakdown(p: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  const b: VictoryPointsBreakdown = {
    terraformRating: 20, terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: 20,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
  const merged = {...b, ...p};
  if (p.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery + merged.city + merged.victoryPoints;
  }
  return merged;
}

function input(color: Color, name: string, b: Partial<VictoryPointsBreakdown>): EndgamePlayerInput {
  return {color, name, corporations: ['Helion'], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}};
}

function model(inputs: Array<EndgamePlayerInput>): EndgameModel {
  return buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 9});
}

function mountReveal(m: EndgameModel, order: ReadonlyArray<Color>) {
  return mount(FinalScoringReveal, {...globalConfig, props: {model: m, playerOrder: order}});
}

describe('FinalScoringReveal', () => {
  afterEach(() => resetEndgameState());

  it('renders one lane per player in neutral order and the controls', () => {
    const m = model([input('red', 'A', {terraformRating: 30, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    expect(wrapper.findAll('.fsr__lane')).to.have.length(2);
    expect(wrapper.findAll('.fsr__ctl').length).to.be.greaterThan(0);
    // Winner banner not shown yet.
    expect(wrapper.find('.fsr__finale').exists()).is.false;
  });

  it('does not leak the final total into the DOM before the winner step', () => {
    // A has 41 final; while revealing, the lane must never show 41 yet.
    const m = model([input('red', 'A', {terraformRating: 30, milestones: 5, awards: 6}), input('blue', 'B', {terraformRating: 20})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    expect(wrapper.text()).to.not.contain('41');
  });

  it('skip jumps to the winner with the correct final totals + CTA', async () => {
    const m = model([input('red', 'A', {terraformRating: 35, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as unknown as {phase: string}).phase).to.eq('winner');
    expect(wrapper.find('.fsr__finale').exists()).is.true;
    // 'A' winning lane shows 40 (35 + 5).
    const winnerLane = wrapper.find('.fsr__lane--winner');
    expect(winnerLane.exists()).is.true;
    expect(winnerLane.find('.fsr__lane-total-num').text()).to.eq('40');
  });

  it('the CTA opens the detailed results', async () => {
    const m = model([input('red', 'A', {terraformRating: 35}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    await wrapper.find('.fsr__cta').trigger('click');
    expect(endgameState.resultsOpen).is.true;
    expect(endgameState.revealActive).is.false;
  });
});
