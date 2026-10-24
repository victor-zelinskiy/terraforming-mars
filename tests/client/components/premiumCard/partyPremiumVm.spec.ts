import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardType} from '@/common/cards/CardType';
import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';

/*
 * THE CARD FACE OF A PARTY (Turmoil Redux — ONE FRAMEWORK, the owner's decision Р2): a party's action is the card
 * composer's, and its hero is a CARD in the project's anatomy with the party's seal — never the plaque.
 */
describe('partyPremiumVm — a party drawn as a card (Р2)', () => {
  it('every Redux party has a face: its name on the nameplate, its seal in the art window, no cost, no tags', () => {
    for (const party of REDUX_PARTIES) {
      const vm = partyPremiumVm(party);
      expect(vm, party).not.to.be.undefined;
      expect(vm!.type, party).to.eq(CardType.ACTIVE);
      expect(vm!.title, party).to.eq(`party name: ${party}`);
      expect(vm!.cost, `${party}: nobody plays a party`).to.be.undefined;
      expect(vm!.tags, party).to.deep.eq([]);
      expect(vm!.parliament?.sealArt, `${party}: the emblem, whole, over the accent field`).to.be.true;
      expect(String(vm!.name), `${party}: the tile key, never a manifest card`).to.eq(`PARTY_${party}`);
    }
  });

  it('the rules block prints the party\'s own graphic — the Reds\' action (their passive is empty)', () => {
    const vm = partyPremiumVm(PartyName.REDS as never)!;
    expect(vm.mechanics.textOnly).to.be.false;
    expect(vm.mechanics.groups.length).to.be.greaterThan(0);
  });

  it('PremiumCard draws it in the PROJECT anatomy, marked as a party face', () => {
    const w = mount(PremiumCard, {...globalConfig, props: {vmOverride: partyPremiumVm(PartyName.SCIENTISTS as never), inert: true}});
    expect(w.classes()).to.include('pcard--party-face');
    expect(w.classes()).not.to.include('pcard--bill');
    expect(w.find('.pcard__art img').exists(), 'the seal in the art window').to.be.true;
  });
});
