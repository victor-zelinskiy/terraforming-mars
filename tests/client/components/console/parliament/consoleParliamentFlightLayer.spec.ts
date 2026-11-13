/*
 * ConsoleParliamentFlightLayer — the SHELL-mounted stage of every proxy the Parliament flies: a figure or a cube, a
 * card (a bare back, or a physical body with a face), a resource token, the alliance's spark, a party's seal. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no prop, no emit, nothing exposed — it DRAWS the
 * flight module's reactive specs (`parliamentFlights`) and hands every proxy's element back to that module through the
 * function ref (`setFlightEl` — the import itself is the template's binding).
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {parliamentArtTier} from '@/client/console/parliament/parliamentArtTier';
import {
  dropFlight, flightEl, flightRegistered, killParliamentFlights, parliamentFlights, pushCardFlight, pushCubeFlight, pushSealFlight,
  pushSparkFlight, pushTokenFlight,
} from '@/client/console/parliament/parliamentFlights';
import ConsoleParliamentFlightLayer from '@/client/components/console/parliament/ConsoleParliamentFlightLayer.vue';

// The figure, the cube and the premium face are their own specs' subjects; this one reads what the layer HANDS them.
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, steel: Boolean, solid: Boolean},
  render: () => h('i', {class: 'delegate-stub'}),
});
const CubeStub = defineComponent({
  name: 'PlayerCube',
  props: {color: String, size: Number, glow: {type: Boolean, default: true}, shadow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'cube-stub'}),
});
/** The premium face is one of the three ASYNC bindings — it answers to the wrapper's name (RECIPES § 3). */
const FaceStub = defineComponent({
  name: 'AsyncComponentWrapper',
  props: {vmOverride: Object, lightweight: Boolean, artTier: String, inert: Boolean},
  render: () => h('i', {class: 'face-stub'}),
});

const stubs = {PlayerDelegate: DelegateStub, PlayerCube: CubeStub, AsyncComponentWrapper: FaceStub};

/** The layer reads a face's `name` for its hook and hands the vm on whole — the name is all this fixture needs. */
const FACE = {name: 'RX07'} as unknown as PremiumCardVM;

function layer() {
  return mount(ConsoleParliamentFlightLayer, {...globalConfig, global: {...globalConfig.global, stubs}});
}

describe('ConsoleParliamentFlightLayer — a proxy per flight of the module, its element handed back to the module', () => {
  // The flights are module state the whole bundle shares: every test starts from, and leaves, an empty air.
  beforeEach(() => killParliamentFlights());
  afterEach(() => killParliamentFlights());

  it('with nothing in the air it is its one root and nothing else — the template STARTS WITH ITS ROOT', () => {
    const w = layer();
    // (Its opening comment lives in the script now: a development build no longer wraps the root in a fragment.)
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['con-parl-flightlayer']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.element.childElementCount).to.eq(0);
  });

  it('a FIGURE, a neutral figure and a player\'s CUBE: one proxy each, born by the module\'s push', async () => {
    const w = layer();
    pushCubeFlight({id: 'd1', color: 'red', size: 30});
    pushCubeFlight({id: 'd2', color: 'neutral', size: 24});
    pushCubeFlight({id: 'c1', color: 'blue', size: 40, shape: 'cube'});
    await nextTick();

    const proxies = w.findAll('.con-parl__flight');
    expect(proxies.map((p) => p.attributes('data-parl-flight'))).to.deep.eq(['d1', 'd2', 'c1']);
    const delegates = w.findAllComponents(DelegateStub);
    expect(delegates.map((d) => [d.props('color'), d.props('size'), d.props('steel'), d.props('solid')])).to.deep.eq([
      ['red', 30, false, true],
      ['neutral', 24, true, true],
    ]);
    // The cube is the player's cube itself — never a figure — flat on its carry (no glow, no shadow of its own).
    const body = proxies[2].find('[data-parl-flight-body="cube"]');
    expect(body.attributes('data-banner-cube-flight')).to.eq('blue');
    const cube = w.findComponent(CubeStub);
    expect([cube.props('color'), cube.props('size'), cube.props('glow'), cube.props('shadow')]).to.deep.eq(['blue', 40, false, false]);
    expect(proxies[2].find('.delegate-stub').exists()).to.eq(false);
  });

  it('a CARD: a bare back without a face; a physical body with one — the SAME lightweight vm at the surface\'s one art tier', async () => {
    const w = layer();
    pushCardFlight({id: 'back1', width: 160, height: 224});
    pushCardFlight({id: 'face1', width: 640, height: 896, face: FACE, faceUp: true});
    await nextTick();

    const [back, faced] = w.findAll('.con-parl__flight--card');
    expect(back.attributes('data-parl-flight')).to.eq('back1');
    expect(back.attributes('data-parl-flight-body')).to.eq('back');
    expect(back.attributes('data-parl-flight-face')).to.eq(undefined);
    expect(back.attributes('style')).to.contain('width: 160px').and.to.contain('height: 224px');
    expect(back.classes()).to.not.include('con-parl__flight--face');
    expect(back.find('.con-parl__cardback').exists()).to.eq(true);
    expect(back.find('.con-card3d').exists()).to.eq(false);

    expect(faced.attributes('data-parl-flight')).to.eq('face1');
    expect(faced.attributes('data-parl-flight-body')).to.eq('3d');
    expect(faced.attributes('data-parl-flight-face')).to.eq('RX07');
    expect(faced.classes()).to.include.members(['con-parl__flight--face', 'con-card3d-outer']);
    // The body: the face (zoomed to the proxy's width off the 320-px design face), the deck's back, the paper edge.
    expect(faced.find('.con-card3d__face .con-parl__flight-face').attributes('style')).to.contain('zoom: 2');
    expect(faced.find('.con-card3d__back .con-parl__cardback').exists()).to.eq(true);
    expect(faced.find('.con-card3d__edge').exists()).to.eq(true);
    const face = w.findComponent(FaceStub);
    expect(face.props('vmOverride')).to.deep.eq(FACE);
    expect([face.props('lightweight'), face.props('inert')]).to.deep.eq([true, true]);
    expect(face.props('artTier')).to.eq(parliamentArtTier());
  });

  it('a TOKEN («+» unless the spec signs it), the alliance\'s SPARK in its accent, a party\'s SEAL', async () => {
    const w = layer();
    pushTokenFlight({id: 't1', iconClass: 'icon-megacredits', amount: 2});
    pushTokenFlight({id: 't2', iconClass: 'icon-plants', amount: 3, sign: '−'});
    pushSparkFlight({id: 's1', accent: 'rgb(1, 2, 3)'});
    pushSealFlight({id: 'e1', emblemUrl: 'assets/seal.png'});
    await nextTick();

    const tokens = w.findAll('[data-parl-flight-body="token"]');
    expect(tokens.map((t) => [t.attributes('data-parl-flight'), t.attributes('data-parl-token-amount'), t.find('.con-parl__token-amount').text()]))
      .to.deep.eq([['t1', '2', '+2'], ['t2', '3', '−3']]);
    expect(tokens[0].find('.con-parl__token-icon').classes()).to.include('icon-megacredits');

    const spark = w.find('[data-parl-flight-body="spark"]');
    expect(spark.attributes('data-parl-flight')).to.eq('s1');
    expect(spark.attributes('style')).to.contain('--spark-accent: rgb(1, 2, 3)');

    const seal = w.find('[data-parl-flight-body="seal"]');
    expect(seal.attributes('data-parl-flight')).to.eq('e1');
    expect(seal.find('img.con-parl__flight-seal').attributes('src')).to.eq('assets/seal.png');
  });

  it('every proxy\'s ELEMENT is the module\'s — registered at its birth, forgotten at its drop and with the layer', async () => {
    const w = layer();
    expect(flightRegistered('d1')).to.eq(false);
    pushCubeFlight({id: 'd1', color: 'red', size: 30});
    pushCardFlight({id: 'back1', width: 160, height: 224});
    pushTokenFlight({id: 't1', iconClass: 'icon-megacredits', amount: 2});
    pushSparkFlight({id: 's1', accent: 'red'});
    pushSealFlight({id: 'e1', emblemUrl: 'assets/seal.png'});
    await nextTick();
    for (const id of ['d1', 'back1', 't1', 's1', 'e1']) {
      expect(flightEl(id), `«${id}» is the proxy the layer rendered`).to.eq(w.find(`[data-parl-flight="${id}"]`).element);
      expect(flightRegistered(id)).to.eq(true);
    }

    // A dropped flight leaves the air: its proxy is gone and its unmount does not register it again.
    dropFlight('t1');
    await nextTick();
    expect(w.find('[data-parl-flight="t1"]').exists()).to.eq(false);
    expect(flightEl('t1')).to.eq(undefined);
    expect(flightRegistered('d1'), 'its neighbours stay').to.eq(true);
    expect(parliamentFlights.tokenFlights.length).to.eq(0);

    w.unmount();
    for (const id of ['d1', 'back1', 's1', 'e1']) {
      expect(flightEl(id), `«${id}» is forgotten with the layer`).to.eq(undefined);
    }
  });

  it('a PARENT\'s ref carries nothing of the script — the layer exposes no member', () => {
    const Host = defineComponent({render: () => h('div', [h(ConsoleParliamentFlightLayer, {ref: 'layer'})])});
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    const held = host.vm.$refs.layer as Record<string, unknown> | undefined;
    expect(held, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(held ?? {})).to.deep.eq([]);
    for (const inner of ['flights', 'artTier', 'setFlightEl']) {
      expect(held?.[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
    host.unmount();
  });
});
