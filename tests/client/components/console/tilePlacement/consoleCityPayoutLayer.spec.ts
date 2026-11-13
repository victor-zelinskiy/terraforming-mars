/*
 * ConsoleCityPayoutLayer — the shell-level stage of «ТАЙЛ ПЛАТИТ КАРТЕ» (a card reward a placed tile pays): the wakes,
 * the tokens condensing at their senders' edges and — in the own scene — the receiving card with its capsule counting
 * the touchdowns. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing
 * exposed — its whole input is the scene's MODULE state (`cityPayoutState`) and its whole output, besides the DOM, is
 * the element set it LENDS the director (`registerCityPayoutStage`, taken back when it unmounts — and the scene goes
 * with its stage). The director has its own specs and e2e; this one is the layer.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {abortCityPayoutBeat, cityPayoutAbortCount, cityPayoutState} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import {OCEAN_COIN_SPARKS} from '@/client/console/tilePlacement/tilePlacementModel';
import ConsoleCityPayoutLayer from '@/client/components/console/tilePlacement/ConsoleCityPayoutLayer.vue';

// The premium face is its own subject; this spec reads what the layer HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {
    name: {type: String, default: ''},
    card: {type: Object, default: undefined},
    lightweight: {type: Boolean, default: false},
  },
  render: () => h('i', {class: 'face-stub'}),
});

const stubs = {ConsoleCardFaceLite: FaceStub};

function layer(attached = false) {
  return mount(ConsoleCityPayoutLayer, {global: {...globalConfig.global, stubs}, ...(attached ? {attachTo: document.body} : {})});
}

function box(el: Element): {left: string, top: string, width: string, height: string} {
  const {left, top, width, height} = (el as HTMLElement).style;
  return {left, top, width, height};
}

const wake = (id: number, city: number, x: number, y: number, pulseSize: number) =>
  ({id, city, pulseAt: {x, y}, pulseSize, shore: {x, y}, drift: 0});

describe('ConsoleCityPayoutLayer — the stage of a tile that pays a card', () => {
  afterEach(() => {
    // The scene is module state, shared by the whole bundle (and a scene on stage is a live animation hold).
    abortCityPayoutBeat();
    cityPayoutState.degraded = false;
    cityPayoutState.landed = 0;
    cityPayoutState.resource = 'data';
  });

  it('renders nothing while the scene is idle; a scene on stage carries its state on the root — demoted under a workspace unless it answers a live pick', async () => {
    const wrapper = layer();
    expect(wrapper.find('.con-citypay').exists(), 'idle — no stage').to.eq(false);

    cityPayoutState.phase = 'paying';
    cityPayoutState.mode = 'own';
    cityPayoutState.seq = 5;
    await nextTick();
    const root = wrapper.find('.con-citypay');
    expect(root.classes()).to.deep.eq(['con-citypay', 'con-flight-to-board']);
    expect(root.attributes('data-flight-lands')).to.eq('board');
    expect(root.attributes('aria-hidden')).to.eq('true');
    expect(root.attributes('data-city-payout')).to.eq('paying');
    expect(root.attributes('data-city-payout-mode')).to.eq('own');
    expect(root.attributes('data-city-payout-seq')).to.eq('5');
    expect(root.attributes('data-city-payout-degraded'), 'a state that has nothing to say renders no attribute').to.eq(undefined);

    // The answer of a live «on which card» pick steps OUT of the plate it was chosen on: it flies over that plate.
    cityPayoutState.inPrompt = true;
    await nextTick();
    expect(wrapper.find('.con-citypay').classes()).to.deep.eq(['con-citypay']);

    // An honest degrade stands on the root even after the scene went idle (the probe's witness).
    cityPayoutState.phase = 'idle';
    cityPayoutState.degraded = true;
    await nextTick();
    const degraded = wrapper.find('.con-citypay');
    expect(degraded.exists()).to.eq(true);
    expect(degraded.attributes('data-city-payout')).to.eq('idle');
    expect(degraded.attributes('data-city-payout-degraded')).to.eq('1');
  });

  it('one wake per token a sender sends and one token per unit — at their rounded points, the token\'s face by the resource', async () => {
    const wrapper = layer();
    cityPayoutState.phase = 'paying';
    cityPayoutState.mode = 'remote';
    cityPayoutState.wakes = [wake(1, 0, 200.4, 100.6, 80)];
    cityPayoutState.tokens = [{id: 11, city: 0, at: {x: 120.4, y: 64.6}}, {id: 12, city: 1, at: {x: 300, y: 80}}];
    await nextTick();

    const wakes = wrapper.findAll('.con-citypay > .con-tileplace__oceanpulse');
    expect(wakes).to.have.length(1);
    expect(wakes[0].classes(), 'the ocean\'s swell in the city\'s register').to.include('con-tileplace__oceanpulse--city');
    expect(wakes[0].attributes('data-city-wake')).to.eq('0');
    // Centred on its point: the box starts half a pulse up and to the left.
    expect(box(wakes[0].element)).to.deep.eq({left: '160px', top: '61px', width: '80px', height: '80px'});
    expect(wakes[0].find('.con-tileplace__oceanpulse-wash').exists()).to.eq(true);
    expect(wakes[0].find('.con-tileplace__oceanpulse-ring').exists()).to.eq(true);

    const tokens = wrapper.findAll('.con-citypay > .con-tileplace__oceancoin');
    expect(tokens.map((t) => t.attributes('data-city-token'))).to.deep.eq(['0', '1']);
    expect(tokens.map((t) => (t.element as HTMLElement).style.left)).to.deep.eq(['120px', '300px']);
    expect(tokens.map((t) => (t.element as HTMLElement).style.top)).to.deep.eq(['65px', '80px']);
    expect(tokens.map((t) => t.classes('con-tileplace__oceancoin--data'))).to.deep.eq([true, true]);
    expect(tokens.map((t) => t.classes('con-tileplace__oceancoin--animal'))).to.deep.eq([false, false]);
    for (const token of tokens) {
      expect(token.findAll('.con-tileplace__coin-spark')).to.have.length(OCEAN_COIN_SPARKS);
      expect(token.find('.con-tileplace__coin-ring').exists()).to.eq(true);
      expect(token.find('.con-tileplace__coin-body > .con-tileplace__coin-value').text()).to.eq('+1');
      expect(token.find('.con-tileplace__coin-body > .con-tileplace__coin-sheen').exists()).to.eq(true);
    }
    expect(wrapper.find('.con-citypay__card').exists(), 'a remote scene raises no card').to.eq(false);

    // An animal pays (Pets): the same tokens wear the other face.
    cityPayoutState.resource = 'animal';
    await nextTick();
    const animals = wrapper.findAll('.con-tileplace__oceancoin');
    expect(animals.map((t) => t.classes('con-tileplace__oceancoin--animal'))).to.deep.eq([true, true]);
    expect(animals.map((t) => t.classes('con-tileplace__oceancoin--data'))).to.deep.eq([false, false]);

    // A token that handed off leaves the stage; the one still in the air keeps its node.
    const kept = animals[1].element;
    cityPayoutState.tokens = [cityPayoutState.tokens[1]];
    await nextTick();
    const left = wrapper.findAll('.con-tileplace__oceancoin');
    expect(left.map((t) => t.attributes('data-city-token'))).to.deep.eq(['1']);
    expect(left[0].element).to.eq(kept);
  });

  it('the receiving card stands at its plate; its capsule and the reading under it count the TOUCHDOWNS — never the model', async () => {
    const wrapper = layer();
    const model: CardModel = {name: CardName.PETS, resources: 2};
    /** Pets with 2 animals before the payout, at a plate of the given size. */
    const pets = (w: number, h: number, committed: CardModel | undefined) =>
      ({name: CardName.PETS, model: committed, before: 2, plate: {x: 400.4, y: 120.6, w, h}});
    cityPayoutState.phase = 'rising';
    cityPayoutState.mode = 'own';
    cityPayoutState.resource = 'animal';
    cityPayoutState.card = pets(0, 0, model);
    await nextTick();

    const card = () => wrapper.find('.con-citypay__card');
    const face = () => wrapper.findComponent(FaceStub);
    expect(card().classes(), 'not measured yet: the plate has no box').to.include('con-citypay__card--measuring');
    expect([(card().element as HTMLElement).style.left, (card().element as HTMLElement).style.top]).to.deep.eq(['400px', '121px']);
    expect(card().attributes('data-played-key')).to.eq(CardName.PETS);
    expect(card().attributes('data-city-payout-count')).to.eq('2');
    expect(face().props('name')).to.eq(CardName.PETS);
    expect(face().props('lightweight')).to.eq(true);
    expect(face().props('card')).to.deep.eq({name: CardName.PETS, resources: 2});
    expect(wrapper.find('.con-citypay__flash').exists(), 'nothing has touched the card').to.eq(false);
    const read = wrapper.find('[data-city-payout-read]');
    expect(read.find('.con-citypay__read-icon').classes()).to.include.members(iconClassFor('animal').split(' '));
    expect(read.find('.con-citypay__read-from').text()).to.eq('2');
    expect(read.find('.con-citypay__read-to').text()).to.eq('2');

    // The plate is measured: the card takes its box.
    cityPayoutState.card = pets(200, 280, model);
    await nextTick();
    expect(card().classes()).to.not.include('con-citypay__card--measuring');

    // Two tokens touched the capsule: the count is the start plus the touchdowns, with one contact flash.
    cityPayoutState.landed = 2;
    await nextTick();
    expect(card().attributes('data-city-payout-count')).to.eq('4');
    expect(face().props('card'), 'the face reads the PRESENTED count').to.deep.eq({name: CardName.PETS, resources: 4});
    expect(model.resources, 'the committed model is never written').to.eq(2);
    expect(wrapper.findAll('.con-citypay__flash')).to.have.length(1);
    expect(wrapper.find('.con-citypay__read-from').text(), 'the reading keeps where it started').to.eq('2');
    expect(wrapper.find('.con-citypay__read-to').text()).to.eq('4');

    // A card the view carries no model for: the pristine printed face.
    cityPayoutState.card = pets(200, 280, undefined);
    await nextTick();
    expect(face().props('card')).to.eq(undefined);
    expect(card().attributes('data-city-payout-count')).to.eq('4');
  });

  it('the stage it registers hands the director the MOUNTED pieces — an abort takes their flights down; a piece outside the document is not handed', async () => {
    const stand = (attached: boolean) => {
      const wrapper = layer(attached);
      cityPayoutState.phase = 'paying';
      cityPayoutState.mode = 'own';
      cityPayoutState.wakes = [wake(1, 0, 200, 100, 80)];
      cityPayoutState.tokens = [{id: 11, city: 0, at: {x: 120, y: 64}}];
      cityPayoutState.card = {name: CardName.PETS, model: undefined, before: 0, plate: {x: 400, y: 120, w: 200, h: 280}};
      return wrapper;
    };
    const flights = (wrapper: ReturnType<typeof layer>) => {
      const pieces = [
        wrapper.find('.con-tileplace__oceanpulse').element,
        // The director drives a token's PARTS too: the abort reaches every child of a piece.
        wrapper.find('.con-tileplace__oceancoin .con-tileplace__coin-body').element,
        wrapper.find('.con-citypay__card').element,
      ];
      // A flight in the air on each (paused: nothing ticks in the spec).
      pieces.forEach((el) => gsap.to(el, {x: 10, duration: 5, paused: true}));
      return pieces;
    };
    const inTheAir = (pieces: ReadonlyArray<Element>) => pieces.map((el) => gsap.getTweensOf(el).length);

    const mounted = stand(true);
    await nextTick();
    const lent = flights(mounted);
    expect(inTheAir(lent)).to.deep.eq([1, 1, 1]);
    abortCityPayoutBeat();
    expect(inTheAir(lent), 'the abort reached the wake, the token and the card through the layer\'s stage').to.deep.eq([0, 0, 0]);
    mounted.unmount();

    const detached = stand(false);
    await nextTick();
    const kept = flights(detached);
    abortCityPayoutBeat();
    expect(inTheAir(kept), 'not in the document — not a piece of the stage').to.deep.eq([1, 1, 1]);
    kept.forEach((el) => gsap.killTweensOf(el));
  });

  it('the scene goes with its stage: leaving mid-scene pays what was owed — no wake, no token, no card, no phase left behind', async () => {
    const wrapper = layer();
    cityPayoutState.phase = 'paying';
    cityPayoutState.mode = 'own';
    cityPayoutState.seq = 3;
    cityPayoutState.inPrompt = true;
    cityPayoutState.wakes = [wake(1, 0, 200, 100, 80)];
    cityPayoutState.tokens = [{id: 11, city: 0, at: {x: 120, y: 64}}];
    cityPayoutState.card = {name: CardName.PETS, model: undefined, before: 1, plate: {x: 400, y: 120, w: 200, h: 280}};
    await nextTick();
    expect(wrapper.findAll('.con-tileplace__oceancoin')).to.have.length(1);

    const aborts = cityPayoutAbortCount();
    wrapper.unmount();
    expect(cityPayoutAbortCount(), 'the layer aborts the scene exactly once as it leaves').to.eq(aborts + 1);
    expect(cityPayoutState.phase).to.eq('idle');
    expect(cityPayoutState.mode).to.eq(undefined);
    expect(cityPayoutState.wakes).to.deep.eq([]);
    expect(cityPayoutState.tokens).to.deep.eq([]);
    expect(cityPayoutState.card).to.eq(undefined);
    expect(cityPayoutState.seq).to.eq(undefined);
    expect(cityPayoutState.inPrompt).to.eq(false);
  });

  it('a parent\'s ref reaches nothing — the shell mounts it and the director drives it through the stage it registers', async () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleCityPayoutLayer, {ref: 'layer'})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    cityPayoutState.phase = 'paying';
    await nextTick();
    expect(host.find('.con-citypay').exists(), 'the stage stands under the host').to.eq(true);
    expect(Object.keys((host.vm.$refs.layer ?? {}) as object), 'no `defineExpose`').to.deep.eq([]);
  });
});
