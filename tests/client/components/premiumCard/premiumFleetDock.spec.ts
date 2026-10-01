import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {fleetDockBerthKey} from '@/client/components/premiumCard/premiumFleetDock';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

describe('PremiumCard — the fleet on a dock card (TR06 Water Hauling, B5)', () => {
  it('a dock card\'s ▲ carries the mark slot — the flight\'s landing anchor — even while the dock is free', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.WATER_HAULING)}});
    const slots = wrapper.findAll('.pcard-fleet');
    expect(slots).to.have.length(1);
    expect(slots[0].attributes('data-fleet-berth')).to.eq(fleetDockBerthKey(CardName.WATER_HAULING));
    expect(slots[0].find('.colony-fleet-icon').exists(), 'no fleet on a free dock').to.eq(false);
    // The slot sits INSIDE the trade item of the printed effect (zero layout — absolute in CSS).
    expect(slots[0].element.parentElement?.classList.contains('pcard-mi')).to.eq(true);
  });

  it('the fleet standing on the card sits in the slot, in its OWNER\'s livery — and the card does not read as used', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.WATER_HAULING, {fleetDocked: 'red'})}});
    const ship = wrapper.find('.pcard-fleet .colony-fleet-icon');
    expect(ship.exists()).to.eq(true);
    expect(ship.classes()).to.include('fleet-hue--red');
    expect(wrapper.find('.pcard-fleet').classes()).to.include('pcard-fleet--docked');
    expect(wrapper.classes()).to.not.include('pcard--unavailable');
  });

  it('the printed face (no live model) keeps the slot and shows no fleet', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.WATER_HAULING}});
    expect(wrapper.find('.pcard-fleet').exists()).to.eq(true);
    expect(wrapper.find('.pcard-fleet .colony-fleet-icon').exists()).to.eq(false);
  });

  it('a card that is no dock never grows a slot — not even on a TRADE symbol (Venus Trade Hub)', () => {
    for (const name of [CardName.VENUS_TRADE_HUB, CardName.BIRDS]) {
      const wrapper = mount(PremiumCard, {props: {card: model(name)}});
      expect(wrapper.find('.pcard-fleet').exists(), name).to.eq(false);
    }
  });
});
