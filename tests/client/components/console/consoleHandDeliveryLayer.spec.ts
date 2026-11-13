/*
 * ConsoleHandDeliveryLayer — the fixed stage of every «cards arrive in the hand» cinematic. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and nothing exposed: it renders ONE flip
 * proxy per flight of the module state (`handDeliveryState.flights`) and registers each proxy's element under the
 * flight's id (`registerDeliveryEl` — the director animates what `deliveryEl(id)` answers). The lite face is stubbed
 * by name: this spec is about the LAYER — what each face is handed.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {clearDeliveryFlights, deliveryEl, handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import ConsoleHandDeliveryLayer from '@/client/components/console/ConsoleHandDeliveryLayer.vue';

// (A render function, not a template string: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String},
  render() {
    return h('i', {'class': 'face-stub', 'data-name': this.name});
  },
});

function layerOf() {
  return mount(ConsoleHandDeliveryLayer, {...globalConfig, global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub}}});
}

describe('ConsoleHandDeliveryLayer — the stage of the hand intake', () => {
  afterEach(() => {
    clearDeliveryFlights();
  });

  it('renders the inert stage and one flip proxy per flight: its dock-order z, its card, the face and the back', () => {
    handDeliveryState.flights = [
      {id: 11, name: CardName.ANTS, z: 3},
      {id: 12, name: CardName.BIRDS, z: 7},
    ];
    const wrapper = layerOf();
    const layer = wrapper.find('div.con-handdelivery-layer');
    expect(layer.exists()).to.eq(true);
    expect(wrapper.element, 'the template starts with its root — no comment node before it').to.eq(layer.element);
    expect(layer.attributes('aria-hidden')).to.eq('true');

    const proxies = layer.findAll('.con-deal-proxy');
    expect(proxies.map((p) => p.attributes('data-delivery-card'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    expect(proxies.map((p) => (p.element as HTMLElement).style.zIndex)).to.deep.eq(['3', '7']);
    expect(proxies.map((p) => p.find('.con-deal-proxy__flip > .con-deal-proxy__face > .face-stub').attributes('data-name')))
      .to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    for (const proxy of proxies) {
      expect(proxy.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back.con-card-back--flyer').exists()).to.eq(true);
    }
    expect(wrapper.findAllComponents(FaceStub).map((face) => face.props('name'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
  });

  it('registers each proxy\'s element under its flight\'s id — the handle the director animates', () => {
    handDeliveryState.flights = [
      {id: 21, name: CardName.COMET, z: 1},
      {id: 22, name: CardName.ALGAE, z: 2},
    ];
    const wrapper = layerOf();
    const proxies = wrapper.findAll('.con-deal-proxy').map((p) => p.element as HTMLElement);
    expect(deliveryEl(21)).to.eq(proxies[0]);
    expect(deliveryEl(22)).to.eq(proxies[1]);
    expect(deliveryEl(23), 'an id nobody flew').to.eq(undefined);
  });

  it('follows the module state: a new flight gets its proxy, a flight that left takes its registration with it', async () => {
    const wrapper = layerOf();
    expect(wrapper.findAll('.con-deal-proxy')).to.have.length(0);

    handDeliveryState.flights = [{id: 31, name: CardName.ANTS, z: 1}, {id: 32, name: CardName.BIRDS, z: 2}];
    await nextTick();
    expect(wrapper.findAll('.con-deal-proxy').map((p) => p.attributes('data-delivery-card'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    expect(deliveryEl(31)).to.eq(wrapper.find('[data-delivery-card="' + CardName.ANTS + '"]').element);

    // The STATE alone drops the flight (not `removeDeliveryFlights`, which also clears the registry itself): the
    // function ref is called with `null` for the node that leaves.
    handDeliveryState.flights = handDeliveryState.flights.filter((f) => f.id !== 31);
    await nextTick();
    expect(wrapper.findAll('.con-deal-proxy').map((p) => p.attributes('data-delivery-card'))).to.deep.eq([CardName.BIRDS]);
    expect(deliveryEl(31)).to.eq(undefined);
    expect(deliveryEl(32)).to.eq(wrapper.find('.con-deal-proxy').element);
  });
});
