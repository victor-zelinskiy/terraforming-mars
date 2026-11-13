/*
 * ConsoleColonyCityLayer — the shell-level stage of «a city is laid on a colony tile». A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is the scene's MODULE
 * state, so the spec is what it renders for that state and that it FOLLOWS it. The tile proxy and the cube are stubbed
 * by name (the spec reads what the layer hands them).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {colonyCityState} from '@/client/console/colonyCity/consoleColonyCity';
import ConsoleColonyCityLayer from '@/client/components/console/colonyCity/ConsoleColonyCityLayer.vue';

const TileProxyStub = defineComponent({
  name: 'ConsoleTileProxy',
  props: {artClass: {type: String, default: ''}},
  render: () => h('div', {class: 'tile-stub'}),
});
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
  return mount(ConsoleColonyCityLayer, {
    global: {...globalConfig.global, stubs: {ConsoleTileProxy: TileProxyStub, PlayerCube: PlayerCubeStub}},
  });
}

function style(el: Element): {left: string, top: string, width: string, height: string} {
  const {left, top, width, height} = (el as HTMLElement).style;
  return {left, top, width, height};
}

/** The fields the layer reads — module state every spec of the bundle shares, so it is put back after each test. */
const FIELDS = ['live', 'beat', 'scale', 'landing', 'seatRect', 'cubeRect', 'cubeOn'] as const;

describe('ConsoleColonyCityLayer — the stage of a city laid on a colony tile', () => {
  let before: Record<string, unknown>;

  beforeEach(() => {
    before = Object.fromEntries(FIELDS.map((field) => [field, colonyCityState[field]]));
    Object.assign(colonyCityState, {live: false, beat: '', scale: 'stage', landing: undefined, seatRect: undefined, cubeRect: undefined, cubeOn: false});
  });
  afterEach(() => {
    Object.assign(colonyCityState, before);
  });

  it('is empty while nothing is landing', () => {
    const w = layer();
    expect(w.find('.con-colcityfx').exists()).to.eq(false);
  });

  it('stands the seat shadow and the city proxy once the seat is measured — the beat and the scale on its root', async () => {
    Object.assign(colonyCityState, {live: true, beat: 'materialize', scale: 'tile'});
    const w = layer();
    expect(w.classes()).to.deep.eq(['con-colcityfx']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('data-colony-city-beat')).to.eq('materialize');
    expect(w.attributes('data-colony-city-scale')).to.eq('tile');
    expect((w.element as Element).children.length, 'no seat measured — no piece yet').to.eq(0);

    colonyCityState.seatRect = {x: 10, y: 20, w: 51, h: 51};
    colonyCityState.beat = 'land';
    await nextTick();
    expect(w.attributes('data-colony-city-beat')).to.eq('land');
    expect(Array.from((w.element as Element).children).map((el) => el.className))
      .to.deep.eq(['con-colcityfx__shadow', 'tile-stub con-colcityfx__tile']);
    const proxy = w.findComponent(TileProxyStub);
    expect(proxy.props('artClass'), 'the board\'s own city art').to.eq('board-space-tile--city');
    expect(proxy.attributes('data-colony-city-proxy')).to.eq('');
    expect(w.findComponent(PlayerCubeStub).exists(), 'the cube is on stage for its own beat only').to.eq(false);
  });

  it('stands the owner\'s cube at its resting box for the cube beat, and takes it off again', async () => {
    Object.assign(colonyCityState, {
      live: true,
      beat: 'cube',
      cubeOn: true,
      cubeRect: {x: 30.4, y: 40.6, w: 21, h: 20},
      landing: {colony: 'Luna', tile: {color: 'green'}},
    });
    const w = layer();
    const wrap = w.find('.con-colcityfx__cube');
    expect(wrap.attributes('data-colony-city-cube-proxy')).to.eq('');
    expect(style(wrap.element), 'the cube\'s box, in whole px').to.deep.eq({left: '30px', top: '41px', width: '21px', height: '20px'});
    expect(w.findComponent(PlayerCubeStub).props()).to.deep.eq({color: 'green', size: 20, glow: true, shadow: true});
    // The build layer's own recipe for the impact ring (the style, as jsdom serializes it: 0.34 / 1.5 / 0.56 of the cube).
    expect(style(wrap.find('.con-colcityfx__ring').element))
      .to.deep.eq({left: '50%', top: 'calc(50% + 6.8px)', width: '30px', height: '11.2px'});

    colonyCityState.cubeOn = false;
    await nextTick();
    expect(w.find('.con-colcityfx__cube').exists()).to.eq(false);

    colonyCityState.live = false;
    await nextTick();
    expect(w.find('.con-colcityfx').exists()).to.eq(false);
  });
});
