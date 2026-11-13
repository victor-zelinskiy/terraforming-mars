/*
 * ConsoleCardDiscardLayer — the stage of «a card physically leaves the hand». A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md) with no props, no emits and nothing exposed: it paints the module's flyers
 * (`cardDiscardState.flights`) while the scene is live, hands each flyer's node to the registry the director animates,
 * and holds the table's ONE discard pile out for as long as the scene's tray is visible (a lease, and the pile's own
 * slot as the landing box).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleCardDiscardLayer from '@/client/components/console/cardDiscard/ConsoleCardDiscardLayer.vue';
import {
  HAND_DISCARD_PILE_LEASE, cardDiscardState, discardFlightEl, discardTrayEl, nextDiscardFlightId, removeDiscardFlights,
  resetCardDiscardStage,
} from '@/client/console/cardDiscard/cardDiscardState';
import {discardPileHeldBy, registerDiscardPileEls, resetDiscardPile} from '@/client/console/discardPile/discardPile';
import {CardName} from '@/common/cards/CardName';

// (A render function, not a template string: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String},
  render() {
    return h('i', {'class': 'face-stub', 'data-name': this.name});
  },
});

function mountLayer() {
  return mount(ConsoleCardDiscardLayer, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub}}});
}

describe('ConsoleCardDiscardLayer — the stage of the hand discard', () => {
  afterEach(() => {
    // The stage and the pile are module state, shared by the whole bundle.
    resetCardDiscardStage();
    resetDiscardPile();
    registerDiscardPileEls(undefined, undefined);
  });

  it('renders nothing until the scene is live; live, it paints one flyer per discarded card — face and back, in paint order', async () => {
    const wrapper = mountLayer();
    expect(wrapper.find('.con-discard').exists(), 'no stage while no discard is on screen').to.eq(false);

    cardDiscardState.flights.push({id: nextDiscardFlightId(), name: CardName.ANTS, z: 1}, {id: nextDiscardFlightId(), name: CardName.BIRDS, z: 2});
    cardDiscardState.live = true;
    await nextTick();

    const stage = wrapper.find('.con-discard');
    expect(stage.attributes('aria-hidden')).to.eq('true');
    const flyers = stage.findAll('.con-deal-proxy.con-discard-proxy');
    expect(flyers.map((f) => (f.element as HTMLElement).style.zIndex)).to.deep.eq(['1', '2']);
    expect(flyers.map((f) => f.find('.con-deal-proxy__flip > .con-deal-proxy__face > .face-stub').attributes('data-name')))
      .to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    for (const flyer of flyers) {
      expect(flyer.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back.con-card-back--flyer').exists()).to.eq(true);
    }
  });

  it('hands every flyer\'s own node to the registry by flight id — and takes it back when the flight leaves', async () => {
    const wrapper = mountLayer();
    const first = nextDiscardFlightId();
    const second = nextDiscardFlightId();
    cardDiscardState.flights.push({id: first, name: CardName.ANTS, z: 1}, {id: second, name: CardName.BIRDS, z: 2});
    cardDiscardState.live = true;
    await nextTick();

    const flyers = wrapper.findAll('.con-discard-proxy');
    expect(discardFlightEl(first), 'the first flyer — the node itself').to.eq(flyers[0].element);
    expect(discardFlightEl(second)).to.eq(flyers[1].element);

    removeDiscardFlights([first]);
    await nextTick();
    expect(discardFlightEl(first)).to.eq(undefined);
    expect(discardFlightEl(second)).to.eq(wrapper.find('.con-discard-proxy').element);
  });

  it('holds the table\'s discard pile out while the scene\'s tray is visible — its slot is the landing box — and lets go with the tray and with the layer', async () => {
    // The pile's own component registers its slot; here a node stands in for it.
    const slot = document.createElement('div');
    registerDiscardPileEls(slot, undefined);

    const wrapper = mountLayer();
    expect(discardPileHeldBy(HAND_DISCARD_PILE_LEASE), 'no lease while the tray is not out').to.eq(false);
    expect(discardTrayEl()).to.eq(undefined);

    cardDiscardState.trayVisible = true;
    await nextTick();
    expect(discardPileHeldBy(HAND_DISCARD_PILE_LEASE), 'the scene holds the pile out').to.eq(true);
    await nextTick();
    expect(discardTrayEl(), 'the landing box is the pile\'s own slot, registered once the pile has rendered').to.eq(slot);

    cardDiscardState.trayVisible = false;
    await nextTick();
    expect(discardPileHeldBy(HAND_DISCARD_PILE_LEASE), 'the tray withdrawn — the lease goes').to.eq(false);
    expect(discardTrayEl()).to.eq(undefined);

    cardDiscardState.trayVisible = true;
    await nextTick();
    await nextTick();
    expect(discardPileHeldBy(HAND_DISCARD_PILE_LEASE)).to.eq(true);
    wrapper.unmount();
    expect(discardPileHeldBy(HAND_DISCARD_PILE_LEASE), 'the layer leaving mid-scene releases the pile').to.eq(false);
    expect(discardTrayEl()).to.eq(undefined);
  });
});
