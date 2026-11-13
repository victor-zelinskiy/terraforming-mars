/*
 * ConsoleTilePlacementLayer — the app-level stage of «a tile physically lands on Mars»: the own landing's proxy set,
 * the remote one's, and the shared adjacency payout beats. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is the scenes' MODULE state and
 * its whole output, besides the DOM, is the element set it LENDS the directors (`registerTilePlacementStage` and the
 * two beat stages, taken back when it unmounts). The directors and the scenes have specs and e2e of their own; this
 * one is the layer: it mounts silent and warning-free, renders each stage for its state and follows it, hands the
 * remote director the parts of its proxy (through the child's exposed `rootEl` — a Vapor child's ref answers no `$el`, components/rootEl.ts), and keeps
 * the template ref `remoteDust` apart from the computed of the same name (its const is the twin `remoteDustEl` — R11).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {TileType} from '@/common/TileType';
import {tilePlacementState, tileStageRemoteEls} from '@/client/console/tilePlacement/consoleTilePlacement';
import {remotePlacementState} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {groveBeatState, oceanBeatState} from '@/client/console/tilePlacement/adjacencyPayoutBeat';
import {OCEAN_COIN_SPARKS, TIER_DUST_MOTES} from '@/client/console/tilePlacement/tilePlacementModel';
import ConsoleTilePlacementLayer from '@/client/components/console/tilePlacement/ConsoleTilePlacementLayer.vue';

const PlayerCubeStub = defineComponent({
  name: 'PlayerCube',
  props: {
    color: {type: String, default: undefined},
    size: {type: Number, default: 0},
  },
  render: () => h('i', {class: 'cube-stub'}),
});

const stubs = {PlayerCube: PlayerCubeStub};

function layer(attachTo?: HTMLElement) {
  return mount(ConsoleTilePlacementLayer, {global: {...globalConfig.global, stubs}, attachTo});
}

function box(el: Element): {left: string, top: string, width: string, height: string} {
  const {left, top, width, height} = (el as HTMLElement).style;
  return {left, top, width, height};
}

function childClasses(el: Element): Array<string> {
  return Array.from(el.children).map((child) => child.className);
}

describe('ConsoleTilePlacementLayer — the stage of a tile landing on Mars', () => {
  // Module state every spec of the bundle shares: put back after each test.
  let before: {own: Record<string, unknown>, remote: Record<string, unknown>};
  let stand: HTMLElement;

  beforeEach(() => {
    before = {own: {...tilePlacementState}, remote: {...remotePlacementState}};
    stand = document.createElement('div');
    document.body.appendChild(stand);
  });
  afterEach(() => {
    Object.assign(tilePlacementState, before.own);
    Object.assign(remotePlacementState, before.remote);
    oceanBeatState.coins = [];
    groveBeatState.groves = [];
    groveBeatState.chips = [];
    stand.remove();
  });

  it('is empty while nothing is landing — and lends the remote director nothing', () => {
    const w = layer(stand);

    expect(w.find('.con-tileplace').exists()).to.eq(false);
    expect(stand.querySelector('.con-tileplace__tile'), 'no proxy').to.eq(null);
    expect(tileStageRemoteEls(), 'the stage is registered, its proxy is not on it').to.eq(undefined);
  });

  it('the own landing: the phase on the root, the parked shadow, the proxy in the tile\'s own art, the splash — and a city\'s dust', async () => {
    Object.assign(tilePlacementState, {active: true, phase: 'approaching', tileType: TileType.CITY, aresExtension: false, price: 'flying'});
    const w = layer();

    expect(w.classes()).to.deep.eq(['con-tileplace', 'con-flight-to-board']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('data-flight-lands')).to.eq('board');
    expect(w.attributes('data-tile-phase')).to.eq('approaching');
    expect(w.attributes('data-tile-price')).to.eq('flying');
    expect(w.attributes('data-law-wave')).to.eq(undefined);
    expect(childClasses(w.element)).to.deep.eq([
      'con-tileplace__shadow',
      'con-tileplace__tile',
      'con-tileplace__splash',
      'con-tileplace__dust',
    ]);
    expect(w.find('.con-tileplace__tile > .con-tileplace__art').classes()).to.include('board-space-tile--city');
    expect(w.findAll('.con-tileplace__dust-mote').length, 'the tier\'s motes, stable indices').to.eq(TIER_DUST_MOTES);

    // A greenery grows out of its cell: the same proxy in its art, no dust.
    tilePlacementState.tileType = TileType.GREENERY;
    tilePlacementState.lawWave = true;
    await nextTick();
    expect(w.attributes('data-law-wave')).to.eq('1');
    expect(w.find('.con-tileplace__tile > .con-tileplace__art').classes()).to.include('board-space-tile--greenery');
    expect(w.find('.con-tileplace__dust').exists()).to.eq(false);

    // No tile art (a landing on an existing tile): the proxy is not rendered at all.
    tilePlacementState.tileType = undefined;
    await nextTick();
    expect(childClasses(w.element)).to.deep.eq(['con-tileplace__shadow', 'con-tileplace__splash']);
  });

  it('replays the cell\'s printed bonuses at their captured rects, and stands the departing twin with its owner cube', async () => {
    Object.assign(tilePlacementState, {
      active: true,
      phase: 'departing',
      tileType: TileType.CITY,
      departingTile: TileType.OCEAN,
      departingCube: {color: 'blue', size: 21, right: 3, bottom: 4},
      bonusProxies: [{id: 5, icon: 'steel', rect: {x: 10.4, y: 20.6, w: 30.2, h: 31}}],
    });
    const w = layer();

    const bonus = w.find('.con-tileplace__bonus');
    expect(bonus.classes()).to.deep.eq(['con-tileplace__bonus', 'board-space-bonus--steel']);
    expect(box(bonus.element), 'the captured live rect, in whole px').to.deep.eq({left: '10px', top: '21px', width: '30px', height: '31px'});

    const depart = w.find('.con-tileplace__tile--depart');
    expect(depart.attributes('data-tile-move'), 'a remove-and-replace is no move').to.eq(undefined);
    expect(depart.find('.con-tileplace__art').classes()).to.include('board-space-tile--ocean');
    expect(depart.find('.con-tileplace__touch').exists(), 'only a MOVE\'s proxy lands').to.eq(false);
    const cube = depart.findComponent(PlayerCubeStub);
    expect(cube.props()).to.deep.eq({color: 'blue', size: 21});
    expect(cube.classes()).to.include('board-owner-cube');
    expect({right: (cube.element as HTMLElement).style.right, bottom: (cube.element as HTMLElement).style.bottom}).to.deep.eq({right: '3px', bottom: '4px'});

    tilePlacementState.bonusProxies = [];
    tilePlacementState.departingTile = undefined;
    await nextTick();
    expect(w.find('.con-tileplace__bonus').exists()).to.eq(false);
    expect(w.find('.con-tileplace__tile--depart').exists()).to.eq(false);
  });

  it('the ocean\'s payout beat stands outside the tile scene: one swell and one coin per paying ocean', async () => {
    oceanBeatState.coins = [{id: 7, amount: 2, at: {x: 100.4, y: 50.6}, pulseAt: {x: 90, y: 40}, pulseSize: 20, shore: {x: 1, y: 0}, drift: 4}];
    const w = layer();

    expect(w.attributes('data-tile-phase'), 'no tile transaction — the beat alone holds the layer up').to.eq(undefined);
    expect(childClasses(w.element)).to.deep.eq(['con-tileplace__oceanpulse', 'con-tileplace__oceancoin']);
    expect(box(w.find('.con-tileplace__oceanpulse').element), 'sized from the source hex, centred on the shore point')
      .to.deep.eq({left: '80px', top: '30px', width: '20px', height: '20px'});
    const coin = w.find('.con-tileplace__oceancoin');
    expect({left: (coin.element as HTMLElement).style.left, top: (coin.element as HTMLElement).style.top}).to.deep.eq({left: '100px', top: '51px'});
    expect(coin.find('.con-tileplace__coin-value').text()).to.eq('+2');
    const sparks = coin.findAll('.con-tileplace__coin-spark');
    expect(sparks.length).to.eq(OCEAN_COIN_SPARKS);
    expect(sparks.map((spark) => spark.classes().includes('con-tileplace__coin-spark--cool')), 'two cold highlights among the gold')
      .to.deep.eq([false, true, false, false, true, false]);

    // …and a grove's: its canopy wakes, a chip per half of the rate.
    oceanBeatState.coins = [];
    groveBeatState.groves = [{id: 1, pulseAt: {x: 50, y: 50}, pulseSize: 10, shore: {x: 0, y: 1}, drift: 2}];
    groveBeatState.chips = [
      {id: 1, grove: 1, kind: 'megacredits', amount: 1, at: {x: 40, y: 44}},
      {id: 2, grove: 1, kind: 'plants', amount: 1, at: {x: 60, y: 44}},
    ];
    await nextTick();
    expect(childClasses(w.element)).to.deep.eq([
      'con-tileplace__oceanpulse con-tileplace__oceanpulse--grove',
      'con-tileplace__oceancoin con-tileplace__oceancoin--megacredits',
      'con-tileplace__oceancoin con-tileplace__oceancoin--plants',
    ]);

    groveBeatState.groves = [];
    groveBeatState.chips = [];
    await nextTick();
    expect(w.find('.con-tileplace').exists(), 'nothing staged — the layer is gone').to.eq(false);
  });

  it('lends the REMOTE director its own proxy set — the tile\'s parts off the child\'s element, the beacon in the placer\'s colour, a city\'s dust', async () => {
    const w = layer(stand);
    Object.assign(remotePlacementState, {active: true, tileType: TileType.CITY, beaconColor: 'red', aresExtension: false});
    await nextTick();

    const tile = w.find('.con-tileplace__tile--remote');
    expect(tile.classes(), 'the shared proxy, marked remote by its parent').to.deep.eq(['con-tileplace__tile', 'con-tileplace__tile--remote']);
    const els = tileStageRemoteEls();
    expect(els?.tile, 'the proxy\'s root, read through the ref on the child (its `rootEl`)').to.eq(tile.element);
    expect(els?.edge).to.eq(tile.find('.con-tileplace__edge').element);
    expect(els?.touch).to.eq(tile.find('.con-tileplace__touch').element);
    expect(els?.shadow).to.eq(w.find('.con-tileplace__shadow').element);
    expect(els?.splash).to.eq(w.find('.con-tileplace__splash').element);
    expect(els?.bonusIcons).to.deep.eq([]);
    expect(els?.beacon).to.eq(w.find('.con-tileplace__beacon').element);
    expect(w.find('.con-tileplace__beacon').classes()).to.include('player_bg_color_red');
    expect(w.find('.con-tileplace__beacon').attributes('data-beacon-color')).to.eq('red');
    expect(els?.depart, 'a placement departs nothing').to.eq(undefined);
    expect(els?.cover).to.eq(undefined);
    // The ref `remoteDust` and the computed `remoteDust` are two bindings: the element is lent, the `v-if` keeps reading the boolean.
    expect(els?.dust, 'a city lands with its dust on the remote stage too').to.eq(w.find('.con-tileplace__dust').element);
    expect(w.findAll('.con-tileplace__dust-mote').length).to.eq(TIER_DUST_MOTES);

    remotePlacementState.tileType = TileType.OCEAN;
    await nextTick();
    expect(w.find('.con-tileplace__dust').exists(), 'water raises no dust').to.eq(false);
    expect(tileStageRemoteEls()?.dust).to.eq(undefined);
    expect(tileStageRemoteEls()?.tile.querySelector('.con-tileplace__art')?.className).to.eq('con-tileplace__art board-space-tile--ocean');

    remotePlacementState.tileType = TileType.CITY;
    await nextTick();
    expect(tileStageRemoteEls()?.dust, 'and the dust is back with the next city').to.eq(w.find('.con-tileplace__dust').element);

    // A remote MOVE: the one travelling twin (edge · touch · the owner's cube), and no arriving proxy without art.
    Object.assign(remotePlacementState, {tileType: undefined, departingTile: TileType.CITY, move: true, departingCube: {color: 'green', size: 20, right: 1, bottom: 2}});
    await nextTick();
    expect(tileStageRemoteEls(), 'no arriving proxy — the director is lent nothing').to.eq(undefined);
    const depart = w.find('.con-tileplace__tile--depart');
    expect(depart.attributes('data-tile-move')).to.eq('remote');
    expect(depart.find('.con-tileplace__touch').exists(), 'a move\'s proxy lands').to.eq(true);
    expect(depart.findComponent(PlayerCubeStub).props()).to.deep.eq({color: 'green', size: 20});
  });

  it('exposes nothing to a parent\'s ref, and takes its stage back (the remote stage with it) when it unmounts', async () => {
    const Host = defineComponent({
      render() {
        return h('div', [h(ConsoleTilePlacementLayer, {ref: 'layer'})]);
      },
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs}, attachTo: stand});
    Object.assign(remotePlacementState, {active: true, tileType: TileType.GREENERY});
    await nextTick();

    expect(Object.keys(host.vm.$refs.layer as object), 'no defineExpose: no parent stands a ref on it').to.deep.eq([]);
    expect(tileStageRemoteEls()?.tile, 'registered while mounted').to.eq(host.find('.con-tileplace__tile--remote').element);

    host.unmount();
    expect(tileStageRemoteEls(), 'the registration is taken back').to.eq(undefined);
    expect(remotePlacementState.active, 'a teardown mid-flight aborts the remote stage: nothing stays held').to.eq(false);
    expect(remotePlacementState.tileType).to.eq(undefined);
  });
});
