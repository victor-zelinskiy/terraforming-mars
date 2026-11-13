/*
 * ConsoleCardExitLayer — the ONE app-level stage the exit / transfer flights fly on. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and nothing exposed: it paints the module's flight
 * list (`cardExitState.flights`) and hands every proxy's own node to the registry the director animates
 * (`registerFlightEl` → `flightEl`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleCardExitLayer from '@/client/components/console/cardDeal/ConsoleCardExitLayer.vue';
import {cardExitState, flightEl, nextFlightId, removeFlights} from '@/client/console/cardDeal/cardExitState';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

// The lite face is the premium renderer; this spec is about the LAYER — what each face is HANDED.
// (A render function, not a template string: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String, card: Object, lightweight: Boolean},
  render() {
    return h('i', {
      'class': 'face-stub',
      'data-name': this.name,
      'data-resources': this.card === undefined ? 'none' : String((this.card as CardModel).resources),
      'data-lightweight': String(this.lightweight),
    });
  },
});

function mountLayer() {
  return mount(ConsoleCardExitLayer, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub}}});
}

describe('ConsoleCardExitLayer — the stage of the exit flights', () => {
  afterEach(() => {
    // The flight list is module state, shared by the whole bundle.
    removeFlights(cardExitState.flights.map((f) => f.id));
  });

  it('is empty and inert while nothing flies', () => {
    const wrapper = mountLayer();
    expect(wrapper.classes()).to.deep.eq(['con-exit-layer']);
    expect(wrapper.attributes('aria-hidden')).to.eq('true');
    expect((wrapper.element as Element).children.length).to.eq(0);
  });

  it('paints one proxy per flight of the module\'s list — the hero rim, the LIVE model, the lightweight tier — and follows the list', async () => {
    const wrapper = mountLayer();
    const hero = nextFlightId();
    const plain = nextFlightId();
    cardExitState.flights.push({id: hero, name: CardName.BIRDS, hero: true, card: {name: CardName.BIRDS, resources: 3} as CardModel});
    cardExitState.flights.push({id: plain, name: CardName.ANTS, hero: false});
    await nextTick();

    const proxies = wrapper.findAll('.con-exit-layer > .con-exit-proxy');
    expect(proxies.map((p) => p.classes('con-exit-proxy--hero'))).to.deep.eq([true, false]);
    const faces = wrapper.findAll('.con-exit-proxy > .face-stub');
    expect(faces.map((f) => f.attributes('data-name'))).to.deep.eq([CardName.BIRDS, CardName.ANTS]);
    expect(faces.map((f) => f.attributes('data-resources')), 'no model → the name-only face').to.deep.eq(['3', 'none']);
    expect(faces.map((f) => f.attributes('data-lightweight'))).to.deep.eq(['true', 'true']);

    removeFlights([hero]);
    await nextTick();
    expect(wrapper.findAll('.face-stub').map((f) => f.attributes('data-name'))).to.deep.eq([CardName.ANTS]);
  });

  it('hands every proxy\'s own node to the flight registry by flight id — and takes it back when the flight leaves', async () => {
    const wrapper = mountLayer();
    const first = nextFlightId();
    const second = nextFlightId();
    expect(flightEl(first), 'no node before the flight is painted').to.eq(undefined);
    cardExitState.flights.push({id: first, name: CardName.ANTS, hero: false}, {id: second, name: CardName.COMET, hero: true});
    await nextTick();

    const proxies = wrapper.findAll('.con-exit-proxy');
    expect(flightEl(first), 'the first flight\'s proxy — the node itself').to.eq(proxies[0].element);
    expect(flightEl(second)).to.eq(proxies[1].element);

    removeFlights([first]);
    await nextTick();
    expect(flightEl(first)).to.eq(undefined);
    expect(flightEl(second), 'the flight still in the air keeps its node').to.eq(wrapper.find('.con-exit-proxy').element);

    wrapper.unmount();
    expect(flightEl(second), 'the layer leaving takes every handle back').to.eq(undefined);
  });
});
