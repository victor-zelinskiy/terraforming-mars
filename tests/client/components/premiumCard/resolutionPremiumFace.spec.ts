import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {partyEffectPremiumVmOf, resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {PartyName} from '@/common/turmoil/PartyName';

/**
 * THE RESOLUTION FACE TEMPLATE (Turmoil Redux) on the three technical
 * examples the catalog carries for exactly this purpose (`copies: 0` — never
 * dealt, only inspected): an IMMEDIATE effect, a PASSIVE effect, an ACTION —
 * and a DUMMY. The face prints the mechanics as graphics, the chairman quest
 * as a GRAPHIC zone with the reward marks (never a sentence), and a dummy says
 * «no effect of its own» once, quietly, where the mechanics would stand.
 */
function face(id: string) {
  const vm = resolutionPremiumVmById(id);
  if (vm === undefined) {
    throw new Error(`no resolution ${id} in the client manifest`);
  }
  return mount(PremiumCard, {props: {name: id as CardName, vmOverride: vm}, global: {mocks: {$t: (k: string) => k}}});
}

describe('PremiumCard — the resolution face template', () => {
  for (const [id, label] of [['RDX_DEV_IMMEDIATE', 'immediate'], ['RDX_DEV_PASSIVE', 'passive'], ['RDX_DEV_ACTION', 'action']] as const) {
    it(`a ${label} resolution prints its mechanics as graphics, the quest as a graphic zone, and no dummy caption`, () => {
      const wrapper = face(id);
      expect(wrapper.classes()).to.include('pcard--theme-resolution');
      expect(wrapper.findAll('.pcard-mech-group').length, 'the printed mechanic').to.be.greaterThan(0);
      expect(wrapper.find('.pcard__dummy').exists(), 'no dummy caption on a real effect').to.eq(false);
      expect(wrapper.find('.pcard__quest-graphic').exists(), 'the quest condition is a graphic').to.eq(true);
      expect(wrapper.find('.pcard__quest-text').exists(), 'no sentence on the face').to.eq(false);
      expect(wrapper.find('.pcard__quest-reward').exists(), 'the reward is the same for every resolution — never repeated on the face').to.eq(false);
      expect(wrapper.find('.pcard__party-emblem').exists(), 'the party emblem').to.eq(true);
      expect(wrapper.classes(), 'a resolution always has a lower block (its quest) — the art never runs under it').to.not.include('pcard--no-mech');
    });
  }

  it('a dummy resolution says «no effect of its own» once, in the mechanics zone, beside its real quest', () => {
    const wrapper = face('RDX_DUMMY_MARS_1');
    expect(wrapper.findAll('.pcard-mech-group').length, 'no effect row').to.eq(0);
    expect(wrapper.findAll('.pcard__dummy').length).to.eq(1);
    expect(wrapper.find('.pcard__quest-graphic').exists(), 'the quest is still a graphic').to.eq(true);
    expect(wrapper.find('.pcard__quest-text').exists()).to.eq(false);
    expect(wrapper.classes(), 'the dummy caption and the quest plate are a lower block: the seal art yields them the room').to.not.include('pcard--no-mech');
  });

  it('a STANDING modifier (an effect with no cause — the Scientists\' wild tag) prints no lone colon', () => {
    const vm = partyEffectPremiumVmOf(PartyName.SCIENTISTS);
    if (vm === undefined) {
      throw new Error('no Scientists effect in the client manifest');
    }
    const wrapper = mount(PremiumCard, {props: {name: vm.name, vmOverride: vm}, global: {mocks: {$t: (k: string) => k}}});
    const standing = wrapper.findAll('.pcard-effect--standing');
    expect(standing.length, 'the passive row is a standing modifier').to.eq(1);
    expect(standing[0].text(), 'no colon before the tag').to.not.contain(':');
    expect(standing[0].find('.pcard-effect__part').exists(), 'the result alone').to.eq(true);
  });

  it('the Mars First effect prints the steel ONCE — the city row adds a card («+»), never a second steel', () => {
    const vm = partyEffectPremiumVmOf(PartyName.MARS);
    if (vm === undefined) {
      throw new Error('no Mars First effect in the client manifest');
    }
    const wrapper = mount(PremiumCard, {props: {name: vm.name, vmOverride: vm}, global: {mocks: {$t: (k: string) => k}}});
    const rows = wrapper.findAll('.pcard-mech-group');
    expect(rows.length).to.eq(2);
    const steelIcons = wrapper.findAll('.pcard-ic').filter((ic) => (ic.attributes('style') ?? '').includes('steel'));
    expect(steelIcons.length, 'one steel on the face').to.eq(1);
    expect(rows[1].text(), 'the city row reads as an addition').to.contain('+');
  });

  it('a party effect banner prints the passive AND the action rows as one face', () => {
    const vm = partyEffectPremiumVmOf(PartyName.SCIENTISTS);
    if (vm === undefined) {
      throw new Error('no Scientists effect in the client manifest');
    }
    const wrapper = mount(PremiumCard, {props: {name: vm.name, vmOverride: vm}, global: {mocks: {$t: (k: string) => k}}});
    expect(wrapper.classes()).to.include('pcard--party-banner');
    expect(wrapper.findAll('.pcard-mech-group').length, 'the passive row and the action row').to.be.greaterThan(1);
    expect(wrapper.find('.pcard__quest').exists(), 'a party has no quest').to.eq(false);
    expect(wrapper.find('.pcard__dummy').exists()).to.eq(false);
  });
});
