import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {computed, nextTick, ref} from 'vue';
import {CardName} from '@/common/cards/CardName';
import PremiumFleetMark from '@/client/components/premiumCard/PremiumFleetMark.vue';
import {fleetDockBerthKey, PCARD_FLEET_DOCK_KEY, PremiumFleetDockFace} from '@/client/components/premiumCard/premiumFleetDock';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';

/*
 * THE FLEET DOCK'S MARK SLOT on its own (the face around it is `premiumFleetDock.spec.ts`): the component takes no
 * props, emits nothing and exposes nothing — its whole input is ONE injection, the card's fleet-dock state that
 * `PremiumCard` provides as a COMPUTED REF. So the spec is what it renders for what is provided: nothing outside a
 * card face, the laid-out slot on a free dock, the ship in its owner's livery on a taken one — and that it FOLLOWS
 * the provided ref (an injected ref arrives as the ref itself in `<script setup>`; the mark must still read through it).
 */
describe('PremiumFleetMark', () => {
  const CARD = CardName.WATER_HAULING;

  function mountMark(provided?: unknown) {
    return mount(PremiumFleetMark, provided === undefined ? {} : {global: {provide: {[PCARD_FLEET_DOCK_KEY]: provided}}});
  }

  afterEach(() => {
    // Module state is bundle-shared: the one-shot settle is put back for every later spec.
    tradeFleetState.dockedCard = '';
  });

  it('outside a card face (nothing provided) it renders nothing — and the missing injection is no warning', () => {
    const warnings: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warnings.push(args.map(String).join(' '));
    };
    try {
      const wrapper = mountMark();
      expect(wrapper.find('.pcard-fleet').exists()).to.eq(false);
      expect(wrapper.find('.colony-fleet-icon').exists()).to.eq(false);
      expect(wrapper.text()).to.eq('');
    } finally {
      console.warn = warn;
    }
    // «Absent» is this component's ordinary state (every ▲ outside a dock card): the injection has a default.
    expect(warnings.filter((line) => line.includes('injection')), warnings.join('\n')).to.deep.eq([]);
  });

  it('on a FREE dock the slot is laid out — the flight\'s landing anchor — and carries no ship', () => {
    const wrapper = mountMark(computed((): PremiumFleetDockFace | undefined => ({card: CARD, color: undefined})));
    const slot = wrapper.find('.pcard-fleet');
    expect(slot.exists()).to.eq(true);
    expect(slot.element.tagName).to.eq('SPAN');
    expect(slot.attributes('data-fleet-berth')).to.eq(fleetDockBerthKey(CARD));
    expect(slot.attributes('aria-hidden')).to.eq('true');
    expect(slot.classes()).to.not.include('pcard-fleet--docked');
    expect(slot.find('.colony-fleet-icon').exists(), 'no fleet on a free dock').to.eq(false);
  });

  it('the fleet on the card sits in the slot in its OWNER\'s livery — and settles once, only on the card it has just landed on', async () => {
    const wrapper = mountMark(computed((): PremiumFleetDockFace | undefined => ({card: CARD, color: 'red'})));
    const slot = wrapper.find('.pcard-fleet');
    expect(slot.classes()).to.include('pcard-fleet--docked');
    expect(slot.attributes('data-fleet-berth')).to.eq(fleetDockBerthKey(CARD));
    const ship = () => wrapper.find('.pcard-fleet .colony-fleet-icon');
    expect(ship().exists()).to.eq(true);
    expect(ship().classes()).to.include('fleet-hue--red');
    expect(ship().classes(), 'a standing fleet is idle').to.not.include('colony-fleet-icon--docked');

    tradeFleetState.dockedCard = CardName.UNMI_LINER;
    await nextTick();
    expect(ship().classes(), 'another dock\'s landing').to.not.include('colony-fleet-icon--docked');

    tradeFleetState.dockedCard = CARD;
    await nextTick();
    expect(ship().classes(), 'the flight\'s proxy has just faded onto this mark').to.include('colony-fleet-icon--docked');

    tradeFleetState.dockedCard = '';
    await nextTick();
    expect(ship().classes()).to.not.include('colony-fleet-icon--docked');
  });

  it('FOLLOWS the provided ref — a fleet landing, its livery, the dock freed, the face no longer a dock', async () => {
    const face = ref<PremiumFleetDockFace | undefined>({card: CARD, color: undefined});
    // The shape `PremiumCard` provides: a computed over its own state.
    const wrapper = mountMark(computed(() => face.value));
    expect(wrapper.find('.pcard-fleet').exists()).to.eq(true);
    expect(wrapper.find('.colony-fleet-icon').exists()).to.eq(false);

    face.value = {card: CARD, color: 'blue'};
    await nextTick();
    expect(wrapper.find('.pcard-fleet').classes()).to.include('pcard-fleet--docked');
    expect(wrapper.find('.colony-fleet-icon').classes()).to.include('fleet-hue--blue');

    face.value = {card: CardName.UNMI_LINER, color: 'green'};
    await nextTick();
    expect(wrapper.find('.pcard-fleet').attributes('data-fleet-berth')).to.eq(fleetDockBerthKey(CardName.UNMI_LINER));
    expect(wrapper.find('.colony-fleet-icon').classes()).to.include('fleet-hue--green');

    face.value = {card: CardName.UNMI_LINER, color: undefined};
    await nextTick();
    expect(wrapper.find('.pcard-fleet').classes()).to.not.include('pcard-fleet--docked');
    expect(wrapper.find('.colony-fleet-icon').exists()).to.eq(false);

    face.value = undefined;
    await nextTick();
    expect(wrapper.find('.pcard-fleet').exists()).to.eq(false);
  });

  it('reads a PLAIN provided value the same way (either shape of the injection)', () => {
    const wrapper = mountMark({card: CARD, color: 'green'} satisfies PremiumFleetDockFace);
    expect(wrapper.find('.pcard-fleet').attributes('data-fleet-berth')).to.eq(fleetDockBerthKey(CARD));
    expect(wrapper.find('.pcard-fleet .colony-fleet-icon').classes()).to.include('fleet-hue--green');
  });
});
