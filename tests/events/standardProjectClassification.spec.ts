import {expect} from 'chai';
import {FactStream} from './endgameFactFixtures';
import {buildEndgameFacts} from '@/common/events/endgameFacts';
import {CardName} from '@/common/cards/CardName';
import {GlobalParameter} from '@/common/GlobalParameter';

// Iteration 16 §13 — Convert Heat / Convert Plants share the 'standard-project' journal
// category, but they are resource CONVERSIONS, not standard projects. They must not inflate
// the standard-project count; their parameter steps still credit the planet (globalParameter).
describe('standard-project classification (rework Iteration 16 §13)', () => {
  function stream(): FactStream {
    const s = new FactStream();
    // A REAL standard project — Asteroid — raising temperature.
    const ast = s.root({gen: 3, player: 'red', source: {kind: 'standardProject', card: CardName.ASTEROID}, category: 'standard-project'});
    s.child({corr: ast, gen: 3, player: 'red', type: 'global-parameter-changed', impact: {globalParameter: {parameter: GlobalParameter.TEMPERATURE, steps: 1}}});
    // Heat conversion (also tagged 'standard-project') — a conversion, NOT a project.
    const heat = s.root({gen: 5, player: 'red', source: {kind: 'standardProject', card: CardName.CONVERT_HEAT}, category: 'standard-project'});
    s.child({corr: heat, gen: 5, player: 'red', type: 'global-parameter-changed', impact: {globalParameter: {parameter: GlobalParameter.TEMPERATURE, steps: 1}}});
    // Plant conversion (also tagged 'standard-project') — a conversion, NOT a project.
    const plants = s.root({gen: 6, player: 'red', source: {kind: 'standardProject', card: CardName.CONVERT_PLANTS}, category: 'standard-project'});
    s.child({corr: plants, gen: 6, player: 'red', type: 'global-parameter-changed', impact: {globalParameter: {parameter: GlobalParameter.OXYGEN, steps: 1}}});
    return s;
  }

  it('counts only genuine standard projects (conversions excluded)', () => {
    const facts = buildEndgameFacts(stream().events, {finalGeneration: 10});
    const sp = facts.find((f) => f.type === 'standardProject' && f.player === 'red');
    expect(sp, 'standard-project fact').to.not.be.undefined;
    expect(sp!.metrics.projects, 'only the asteroid counts').to.eq(1);
    expect(sp!.metrics.parameterSteps, 'only the asteroid temperature step').to.eq(1);
  });

  it('conversion parameter steps still credit the planet (globalParameter total)', () => {
    const facts = buildEndgameFacts(stream().events, {finalGeneration: 10});
    const gp = facts.find((f) => f.type === 'globalParameter' && f.player === 'red');
    expect(gp, 'global-parameter fact').to.not.be.undefined;
    // All three steps (asteroid temp + heat-conversion temp + plant-conversion oxygen) count.
    expect(gp!.metrics.totalSteps).to.eq(3);
    expect(gp!.metrics.temperature).to.eq(2);
    expect(gp!.metrics.oxygen).to.eq(1);
  });

  it('a card effect raising temperature is not a standard project', () => {
    const s = new FactStream();
    const r = s.root({gen: 4, player: 'blue', source: {kind: 'card', card: CardName.GIANT_ICE_ASTEROID, owner: 'blue'}, category: 'card-play'});
    s.child({corr: r, gen: 4, player: 'blue', type: 'global-parameter-changed', impact: {globalParameter: {parameter: GlobalParameter.TEMPERATURE, steps: 2}}});
    const facts = buildEndgameFacts(s.events, {finalGeneration: 8});
    expect(facts.some((f) => f.type === 'standardProject' && f.player === 'blue'), 'no SP fact for a card effect').to.be.false;
  });
});
