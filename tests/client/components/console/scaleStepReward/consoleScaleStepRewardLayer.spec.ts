/*
 * ConsoleScaleStepRewardLayer — the shell-level stage of «ШАГ ШКАЛЫ ПЛАТИТ» (the tokens condensing on a scale marker's
 * rim). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and nothing
 * exposed: it paints the coins of the module's scene (`scaleStepRewardState`), carries the scene's state on its root for
 * the probes, and pays every owed hold when it leaves (`abortScaleStepRewards` — the scene goes with its stage).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleScaleStepRewardLayer from '@/client/components/console/scaleStepReward/ConsoleScaleStepRewardLayer.vue';
import {resetScaleStepRewards, scaleStepRewardState} from '@/client/console/scaleStepReward/scaleStepRewardBeat';
import {OCEAN_COIN_SPARKS} from '@/client/console/tilePlacement/tilePlacementModel';

function mountLayer() {
  return mount(ConsoleScaleStepRewardLayer, {global: {config: globalConfig.global.config}});
}

describe('ConsoleScaleStepRewardLayer — the stage of a scale step that pays', () => {
  afterEach(() => {
    // The scene is module state, shared by the whole bundle.
    resetScaleStepRewards();
  });

  it('renders nothing while the scene is idle; a scene on stage carries its state on the root for the probes', async () => {
    const wrapper = mountLayer();
    expect(wrapper.find('.con-scalepay').exists(), 'idle — no stage').to.eq(false);

    scaleStepRewardState.phase = 'paying';
    scaleStepRewardState.seq = 7;
    scaleStepRewardState.landed = 2;
    await nextTick();
    const root = wrapper.find('.con-scalepay');
    expect(root.classes()).to.deep.eq(['con-scalepay', 'con-flight-to-board']);
    expect(root.attributes('data-flight-lands')).to.eq('board');
    expect(root.attributes('aria-hidden')).to.eq('true');
    expect(root.attributes('data-scale-reward')).to.eq('paying');
    expect(root.attributes('data-scale-reward-seq')).to.eq('7');
    expect(root.attributes('data-scale-reward-landed')).to.eq('2');
    expect(root.attributes('data-scale-reward-degraded'), 'a state that has nothing to say renders no attribute').to.eq(undefined);

    // An honest degrade stands on the root even after the scene went idle (the probe's witness).
    scaleStepRewardState.phase = 'idle';
    scaleStepRewardState.degraded = true;
    await nextTick();
    const degraded = wrapper.find('.con-scalepay');
    expect(degraded.exists()).to.eq(true);
    expect(degraded.attributes('data-scale-reward')).to.eq('idle');
    expect(degraded.attributes('data-scale-reward-degraded')).to.eq('1');
  });

  it('one token per coin of the scene — at its rounded point, its face by kind, its amount, the ocean coin\'s anatomy', async () => {
    const wrapper = mountLayer();
    scaleStepRewardState.phase = 'paying';
    scaleStepRewardState.coins = [
      {id: 11, at: {x: 120.4, y: 64.6}, kind: 'data', amount: 1},
      {id: 12, at: {x: 300, y: 80}, kind: 'megacredits', amount: 3},
    ];
    await nextTick();

    const tokens = wrapper.findAll('.con-scalepay > .con-scalepay__token');
    expect(tokens.map((t) => t.attributes('data-scale-token'))).to.deep.eq(['11', '12']);
    expect(tokens.map((t) => t.classes('con-tileplace__oceancoin'))).to.deep.eq([true, true]);
    expect(tokens.map((t) => t.classes('con-tileplace__oceancoin--data')), 'the data token\'s face only on a data coin').to.deep.eq([true, false]);
    expect(tokens.map((t) => (t.element as HTMLElement).style.left)).to.deep.eq(['120px', '300px']);
    expect(tokens.map((t) => (t.element as HTMLElement).style.top)).to.deep.eq(['65px', '80px']);
    expect(tokens.map((t) => t.find('.con-tileplace__coin-value').text())).to.deep.eq(['+1', '+3']);
    for (const token of tokens) {
      expect(token.findAll('.con-tileplace__coin-spark')).to.have.length(OCEAN_COIN_SPARKS);
      expect(token.find('.con-tileplace__coin-ring').exists()).to.eq(true);
      expect(token.find('.con-tileplace__coin-body > .con-tileplace__coin-sheen').exists()).to.eq(true);
    }

    // A coin that handed off leaves the stage; the one still condensing keeps its node.
    const kept = tokens[1].element;
    scaleStepRewardState.coins = [scaleStepRewardState.coins[1]];
    await nextTick();
    const left = wrapper.findAll('.con-scalepay__token');
    expect(left.map((t) => t.attributes('data-scale-token'))).to.deep.eq(['12']);
    expect(left[0].element).to.eq(kept);
  });

  it('the scene goes with its stage: leaving mid-scene pays what was owed — no coin, no phase left behind', async () => {
    const wrapper = mountLayer();
    scaleStepRewardState.phase = 'paying';
    scaleStepRewardState.seq = 3;
    scaleStepRewardState.tokens = 1;
    scaleStepRewardState.coins = [{id: 1, at: {x: 10, y: 10}, kind: 'megacredits', amount: 2}];
    await nextTick();
    expect(wrapper.findAll('.con-scalepay__token')).to.have.length(1);

    wrapper.unmount();
    expect(scaleStepRewardState.phase).to.eq('idle');
    expect(scaleStepRewardState.coins).to.deep.eq([]);
    expect(scaleStepRewardState.seq).to.eq(undefined);
    expect(scaleStepRewardState.tokens).to.eq(0);
  });
});
