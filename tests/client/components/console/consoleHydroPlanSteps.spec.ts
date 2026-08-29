import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroPlanSteps from '@/client/components/console/hydroFlow/ConsoleHydroPlanSteps.vue';
import {Resource} from '@/common/Resource';
import {HydroPlanDecision, hydroPlanComplete, hydroPlanProgress} from '@/client/console/hydroFlow/hydroPlanSteps';

/**
 * THE DECISION STRIP — the movement plan's reward decisions as ONE surface
 * however many there are.
 *
 * Today's production plan is always length 1 (the stage-1/2 reward choice
 * renders through this strip), but the track's future explicitly holds moves
 * that grant SEVERAL stage rewards in one plan — so the shell must already
 * hold 1, 3 and 6 decisions without a new composition:
 *  - exactly ONE active options row whatever the count (height is bounded by
 *    construction — more decisions grow the chip rail, never a column);
 *  - the progress head exists ONLY when there is a plan to walk (a «1 из 1»
 *    over a single choice is noise);
 *  - every decision stays tied to its OWN stage (position + name on its chip);
 *  - made decisions read ✓ and stay reviewable, the active one is marked.
 */
function decision(pos: number, chosen: number | undefined = undefined): HydroPlanDecision {
  return {
    id: 'reward:' + pos,
    stagePosition: pos,
    stageNameKey: 'Retention dams',
    options: [
      {chips: [], line: {resource: Resource.STEEL, labelKey: 'Steel', before: 2, after: 4, delta: 2}},
      {chips: [], line: {resource: Resource.PLANTS, labelKey: 'Plants', before: 0, after: 2, delta: 2}},
    ],
    chosen,
  };
}

function mountStrip(steps: ReadonlyArray<HydroPlanDecision>, extra: Record<string, unknown> = {}) {
  return mount(ConsoleHydroPlanSteps, {
    props: {steps, ...extra},
    global: {stubs: {HydroReward: true}},
  });
}

describe('the Hydronetwork decision strip', () => {
  it('a plan of ONE renders the familiar step: no progress head, one options row', () => {
    const w = mountStrip([decision(1)]);
    expect(w.find('.con-hydro__plansteps-head').exists(), 'no progress over a single choice').is.false;
    expect(w.findAll('.con-hydro__choice-row')).to.have.length(1);
    expect(w.findAll('.con-hydro__choice-card'), 'both options stand').to.have.length(2);
    w.unmount();
  });

  it('a plan of THREE shows progress, chips per stage, and STILL one options row', () => {
    const w = mountStrip([decision(1, 0), decision(2), decision(9)]);
    expect(w.find('.con-hydro__plansteps-head').exists()).is.true;
    expect(w.findAll('.con-hydro__plansteps-chip'), 'one chip per decision').to.have.length(3);
    expect(w.findAll('.con-hydro__choice-row'), 'ONE active row — never a column of rows').to.have.length(1);
    // The made decision reads ✓ and stays reviewable; the active one is marked.
    const chips = w.findAll('.con-hydro__plansteps-chip');
    expect(chips[0].classes()).to.contain('con-hydro__plansteps-chip--done');
    expect(chips[1].classes()).to.contain('con-hydro__plansteps-chip--active');
    // Each chip names its OWN stage — a choice never loses its stop.
    expect(chips[2].find('.con-hydro__plansteps-chip-pos').text()).to.eq('9');
    w.unmount();
  });

  it('a plan of SIX stays one row of shrinkable chips + one options row', () => {
    const steps = [decision(1, 0), decision(2, 1), decision(3), decision(4), decision(7), decision(9)];
    const w = mountStrip(steps);
    expect(w.findAll('.con-hydro__plansteps-chip')).to.have.length(6);
    expect(w.findAll('.con-hydro__choice-row')).to.have.length(1);
    expect(w.find('.con-hydro__plansteps-progress').text()).to.contain('3');
    expect(w.find('.con-hydro__plansteps-progress').text()).to.contain('6');
    w.unmount();
  });

  it('the ACTIVE decision is the first open one; a completed plan reviews its last', () => {
    expect(hydroPlanProgress([decision(1, 0), decision(2), decision(3)]).activeIdx).to.eq(1);
    expect(hydroPlanProgress([decision(1, 0), decision(2, 1)]).activeIdx).to.eq(-1);
    const w = mountStrip([decision(1, 0), decision(2, 1)]);
    // The options row still renders — the last decision stays reviewable.
    expect(w.findAll('.con-hydro__choice-row')).to.have.length(1);
    w.unmount();
  });

  it('the commit gate: complete means EVERY decision is made', () => {
    expect(hydroPlanComplete([decision(1, 0)])).is.true;
    expect(hydroPlanComplete([decision(1, 0), decision(2)])).is.false;
    expect(hydroPlanComplete([])).is.true;
  });

  it('A on an option emits the pick; focus/selection classes follow the props', async () => {
    const w = mountStrip([decision(1)], {focus: 1, stage: 'options'});
    const cards = w.findAll('.con-hydro__choice-card');
    expect(cards[1].classes()).to.contain('con-hydro__choice-card--focused');
    await cards[0].trigger('click');
    expect(w.emitted('pick')?.[0]).to.deep.eq([0]);
    w.unmount();
  });

  it('a held option reads selected; the other settles back past the confirm', () => {
    const w = mountStrip([decision(1, 0)], {stage: 'confirm'});
    const cards = w.findAll('.con-hydro__choice-card');
    expect(cards[0].classes()).to.contain('con-hydro__choice-card--selected');
    expect(cards[1].classes()).to.contain('con-hydro__choice-card--muted');
    w.unmount();
  });
});
