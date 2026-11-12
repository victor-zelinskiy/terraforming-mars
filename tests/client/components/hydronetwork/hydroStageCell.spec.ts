/*
 * HydroStageCell — one stage of the Hydronetwork's track. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): one prop in (the stage's view-model), one event out (`select`, with its position).
 * The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import HydroStageCell from '@/client/components/hydronetwork/HydroStageCell.vue';
import {HydroStageVM} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';

// The reward's chips are `HydroReward`'s own subject; this spec reads what the cell HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const RewardStub = defineComponent({
  name: 'HydroReward',
  props: ['chips', 'compact'],
  render: () => h('i', {class: 'reward-stub'}),
});

/** The stage at `position`, as the track's model hands it — nothing planned, nothing visited. */
function at(position: number, over: Partial<HydroStageVM> = {}): HydroStageVM {
  return {
    stage: HYDRO_STAGES[position],
    position,
    state: 'future',
    markers: [],
    occupiedByOther: false,
    isSelected: false,
    rewardedByViewer: false,
    crossedByViewer: false,
    skippedByViewer: false,
    willSkipReward: false,
    routeRewarded: false,
    routeExcluded: false,
    targetLegal: false,
    targetAffordable: false,
    requiredTags: [],
    wildCoveredTags: [],
    missingTags: [],
    ...over,
  };
}

function cell(vm: HydroStageVM) {
  // No i18n plugin on purpose: the component imports its own `v-i18n`. Leaning on the global registration would be
  // a Vue warning here — and the warn handler fails the spec.
  return mount(HydroStageCell, {props: {vm}, global: {config: globalConfig.global.config, stubs: {HydroReward: RewardStub}}});
}

describe('HydroStageCell — one stage of the Hydronetwork\'s track', () => {
  it('a tag stage: its position, its tag, its name and its one reward — compact', () => {
    const w = cell(at(3, {state: 'reachable'}));
    expect(w.classes()).to.deep.eq(['hydro-stage', 'hydro-stage--reachable']);
    expect(w.attributes('role')).to.eq('listitem');
    expect(w.attributes('tabindex')).to.eq('0');
    expect(w.attributes('data-hydro-pos')).to.eq('3');
    expect(w.find('.hydro-stage__req > .hydro-stage__tag').classes()).to.include.members(['resource-tag', 'tag-' + HYDRO_STAGES[3].tag]);
    expect(w.find('.hydro-stage__index').text()).to.eq('3');
    expect(w.find('.hydro-stage__name').text()).to.eq('Terran Hydro Standards');
    const rewards = w.findAllComponents(RewardStub);
    expect(rewards).to.have.length(1);
    expect(rewards[0].props('chips')).to.deep.eq(HYDRO_STAGES[3].rewardOptions[0]);
    expect(rewards[0].props('compact')).to.eq(true);
    expect(w.find('.hydro-stage__or').exists()).to.eq(false);
    expect(w.find('.hydro-stage__badge').exists(), 'no history — no badge').to.eq(false);
    expect(w.find('.hydro-stage__skip-tag').exists()).to.eq(false);
    expect(w.findAll('.hydro-stage__marker')).to.have.length(0);
  });

  it('a choice stage offers both rewards around «or»; a finish stage prints its VP and no reward; the start its flag', () => {
    const choice = cell(at(1));
    expect(choice.findAllComponents(RewardStub).map((reward) => reward.props('chips')))
      .to.deep.eq([HYDRO_STAGES[1].rewardOptions[0], HYDRO_STAGES[1].rewardOptions[1]]);
    expect(choice.find('.hydro-stage__or').text()).to.eq('or');

    const finish = cell(at(10));
    expect(finish.classes()).to.deep.eq(['hydro-stage', 'hydro-stage--future', 'hydro-stage--vp']);
    expect(finish.find('.hydro-stage__vp-num').text()).to.eq('2');
    expect(finish.find('.hydro-stage__vp-unit').text()).to.eq('VP');
    expect(finish.find('.hydro-stage__tag').exists()).to.eq(false);
    expect(finish.findComponent(RewardStub).exists()).to.eq(false);
    expect(finish.find('.hydro-stage__no-reward').exists()).to.eq(true);

    const start = cell(at(0, {state: 'completed'}));
    expect(start.classes()).to.deep.eq(['hydro-stage', 'hydro-stage--completed', 'hydro-stage--start']);
    expect(start.find('.hydro-stage__start').exists()).to.eq(true);
    expect(start.find('.hydro-stage__index').text()).to.eq('0');
  });

  it('wears what its model says — the viewer\'s history, the plan\'s marks, the seats on it', () => {
    const w = cell(at(4, {
      state: 'target',
      targetLegal: false,
      occupiedByOther: true,
      rewardedByViewer: true,
      willSkipReward: true,
      isSelected: true,
      markers: [{color: 'red', isViewer: true}, {color: 'blue', isViewer: false}],
    }));
    expect(w.classes()).to.deep.eq([
      'hydro-stage', 'hydro-stage--target', 'hydro-stage--occupied', 'hydro-stage--illegal', 'hydro-stage--rewarded',
      'hydro-stage--skip-reward', 'hydro-stage--selected',
    ]);
    expect(w.find('.hydro-stage__badge').classes()).to.include('hydro-stage__badge--reward');
    expect(w.find('.hydro-stage__reward').classes()).to.include.members(['hydro-stage__reward--gain', 'hydro-stage__reward--skip']);
    expect(w.find('.hydro-stage__skip-tag').text()).to.eq('skipped');
    expect(w.findAll('.hydro-stage__marker').map((marker) => marker.classes())).to.deep.eq([
      ['hydro-stage__marker', 'player_bg_color_red', 'hydro-stage__marker--viewer'],
      ['hydro-stage__marker', 'player_bg_color_blue'],
    ]);

    const passed = cell(at(4, {state: 'completed', skippedByViewer: true}));
    expect(passed.classes()).to.deep.eq(['hydro-stage', 'hydro-stage--completed', 'hydro-stage--skipped']);
    expect(passed.find('.hydro-stage__badge').classes()).to.include('hydro-stage__badge--skip');

    expect(cell(at(4, {state: 'target', targetLegal: true})).classes(), 'a legal target').to.deep.eq(['hydro-stage', 'hydro-stage--target']);
  });

  it('emits `select` with its position — a click, Enter and Space alike, and no other key', async () => {
    const w = cell(at(5));
    await w.trigger('click');
    await w.trigger('keydown', {key: 'Enter'});
    await w.trigger('keydown', {key: ' '});
    await w.trigger('keydown', {key: 'a'});
    expect(w.emitted('select')).to.deep.eq([[5], [5], [5]]);
  });
});
