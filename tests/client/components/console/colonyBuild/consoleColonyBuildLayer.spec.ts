/*
 * ConsoleColonyBuildLayer — the app-level stage of the colony build's cube. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is the build's MODULE state, so
 * the spec is what it renders for that state and that it FOLLOWS it. The cube is stubbed by name (the spec reads what
 * the layer hands it); the witness is the real one — it rides the layer as its second root.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {Color} from '@/common/Color';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {BuildRect} from '@/client/console/colonyBuild/colonyBuildModel';
import ConsoleColonyBuildLayer from '@/client/components/console/colonyBuild/ConsoleColonyBuildLayer.vue';

const PlayerCubeStub = defineComponent({
  name: 'PlayerCube',
  props: {
    color: {type: String, default: undefined},
    size: {type: Number, default: 0},
    glow: {type: Boolean, default: false},
    shadow: {type: Boolean, default: false},
  },
  render: () => h('i', {class: 'cube-stub'}),
});

function layer() {
  return mount(ConsoleColonyBuildLayer, {global: {...globalConfig.global, stubs: {PlayerCube: PlayerCubeStub}}});
}

function style(el: Element): {left: string, top: string, width: string, height: string} {
  const {left, top, width, height} = (el as HTMLElement).style;
  return {left, top, width, height};
}

describe('ConsoleColonyBuildLayer — the stage of the colony build\'s cube', () => {
  // Module state every spec of the bundle shares: what the spec moves is put back.
  let before: {active: boolean, color: Color | '', slotRect: BuildRect | undefined, cubeFactor: number, degraded: boolean};

  beforeEach(() => {
    const {active, color, slotRect, cubeFactor, degraded} = colonyBuildState;
    before = {active, color, slotRect, cubeFactor, degraded};
    Object.assign(colonyBuildState, {active: false, color: '', slotRect: undefined, cubeFactor: 0.5, degraded: false});
  });
  afterEach(() => {
    Object.assign(colonyBuildState, before);
  });

  it('is empty while nothing is building', () => {
    const w = layer();
    expect(w.find('.con-colonybuild').exists()).to.eq(false);
    expect(w.findComponent(PlayerCubeStub).exists()).to.eq(false);
  });

  it('stands the builder\'s cube in the captured slot rect, at the footprint the rect and its factor give', () => {
    Object.assign(colonyBuildState, {active: true, color: 'blue', slotRect: {x: 100.4, y: 50.6, w: 46.2, h: 40}});
    const w = layer();
    const stage = w.find('.con-colonybuild');
    expect(stage.attributes('aria-hidden')).to.eq('true');
    const wrap = stage.find('.con-colonybuild__cube');
    expect(style(wrap.element), 'the slot rect, in whole px').to.deep.eq({left: '100px', top: '51px', width: '46px', height: '40px'});
    const cube = w.findComponent(PlayerCubeStub);
    expect(cube.props()).to.deep.eq({color: 'blue', size: 20, glow: true, shadow: true});
    // The impact ring is seated at the cube's base line and sized off the cube's footprint (the style, as jsdom
    // serializes it: 0.34 / 1.5 / 0.56 of the 20 px cube).
    expect(style(wrap.find('.con-colonybuild__ring').element))
      .to.deep.eq({left: '50%', top: 'calc(50% + 6.8px)', width: '30px', height: '11.2px'});
  });

  it('follows the build: a cube seat, a build with no rect or no colour yet, the end of the transaction', async () => {
    Object.assign(colonyBuildState, {active: true, color: 'red', slotRect: {x: 0, y: 0, w: 30, h: 30}, cubeFactor: 1});
    const w = layer();
    expect(w.findComponent(PlayerCubeStub).props('size'), 'a cube seat IS the token\'s box').to.eq(30);

    colonyBuildState.slotRect = undefined;
    await nextTick();
    expect(w.find('.con-colonybuild').exists(), 'the stage stands for the whole transaction').to.eq(true);
    expect(w.find('.con-colonybuild__cube').exists()).to.eq(false);

    Object.assign(colonyBuildState, {color: '', slotRect: {x: 0, y: 0, w: 30, h: 30}});
    await nextTick();
    expect(w.find('.con-colonybuild__cube').exists(), 'no colour — no cube').to.eq(false);

    colonyBuildState.active = false;
    await nextTick();
    expect(w.find('.con-colonybuild').exists()).to.eq(false);
  });

  it('carries the transaction\'s witness beside the stage — it stands with no stage at all', async () => {
    const w = layer();
    expect(w.find('.con-colonybuild__witness').exists()).to.eq(false);
    colonyBuildState.degraded = true;
    await nextTick();
    expect(w.find('.con-colonybuild').exists()).to.eq(false);
    expect(w.find('.con-colonybuild__witness').attributes('data-colony-build-degraded')).to.eq('');
  });
});
