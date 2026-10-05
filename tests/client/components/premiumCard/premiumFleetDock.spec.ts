import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {fleetDockBerthKey, publicFaceModel} from '@/client/components/premiumCard/premiumFleetDock';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

/*
 * WHAT A NAME-ONLY HOST STILL OWES A FACE (docs/claude/gameplay-polish-ledger.md PL-013): the «РАЗЫГРАНО» table draws
 * its faces without the live model on purpose, and so drew a dock with NO fleet on it — for its owner and for every
 * rival reading that table. The fleet is public and lies on the card: such a host hands the face the minimal model.
 */
describe('publicFaceModel — the public state a printed face carries', () => {
  it('a card with no fleet on it stays NAME-ONLY (no model at all), whatever else its live model holds', () => {
    expect(publicFaceModel(model(CardName.WATER_HAULING))).is.undefined;
    expect(publicFaceModel(model(CardName.BIRDS, {resources: 3}))).is.undefined;
    expect(publicFaceModel(undefined)).is.undefined;
  });

  it('a docked card gets its name and its fleet — and NOTHING else of the live model', () => {
    const live = model(CardName.UNMI_LINER, {fleetDocked: 'blue', resources: 2, calculatedCost: 4, isDisabled: true} as Partial<CardModel>);
    expect(publicFaceModel(live)).deep.eq({name: CardName.UNMI_LINER, fleetDocked: 'blue'});
  });

  it('is ONE object per card and livery — a re-rendering pile never hands the face a «new» model', () => {
    const a = publicFaceModel(model(CardName.UNMI_LINER, {fleetDocked: 'blue'}));
    const b = publicFaceModel(model(CardName.UNMI_LINER, {fleetDocked: 'blue'}));
    expect(a).to.eq(b);
    expect(publicFaceModel(model(CardName.UNMI_LINER, {fleetDocked: 'red'}))).not.to.eq(a);
  });

  it('the face it feeds draws the ship in its owner\'s livery — on EVERY dock of the manifest, found by the flag, never by a name', () => {
    for (const name of [CardName.WATER_HAULING, CardName.UNMI_LINER]) {
      const wrapper = mount(PremiumCard, {props: {name, card: publicFaceModel(model(name, {fleetDocked: 'green'}))}});
      expect(wrapper.find('.pcard-fleet--docked .colony-fleet-icon').classes(), name).to.include('fleet-hue--green');
      expect(wrapper.find('.pcard-fleet').attributes('data-fleet-berth'), name).to.eq(fleetDockBerthKey(name));
    }
  });
});

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
