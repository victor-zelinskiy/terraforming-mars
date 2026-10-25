import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardType} from '@/common/cards/CardType';
import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';

/*
 * THE CARD FACE OF A PARTY (Turmoil Redux — ONE FRAMEWORK, the owner's decision Р2; since 2026-10-25 its own anatomy,
 * THE CHARTER): a party's action is the card composer's, its hero is a CARD — the faction's charter (banner · crest ·
 * name · clauses · the law of access), never the project anatomy and never the plaque.
 */
describe('partyPremiumVm — a party drawn as a card (the charter)', () => {
  it('every Redux party has a face: its name on the banner, its crest, no cost, no tags, at least one clause', () => {
    for (const party of REDUX_PARTIES) {
      const vm = partyPremiumVm(party);
      expect(vm, party).not.to.be.undefined;
      expect(vm!.type, party).to.eq(CardType.ACTIVE);
      expect(vm!.title, party).to.eq(`party name: ${party}`);
      expect(vm!.cost, `${party}: nobody plays a party`).to.be.undefined;
      expect(vm!.tags, party).to.deep.eq([]);
      expect(vm!.parliament?.sealArt, `${party}: the emblem, whole, over the accent field`).to.be.true;
      expect(String(vm!.name), `${party}: the tile key, never a manifest card`).to.eq(`PARTY_${party}`);
      expect(vm!.theme, `${party}: the charter anatomy`).to.eq('charter');
      const charter = vm!.parliament?.charter;
      expect(charter?.effect !== undefined || charter?.action !== undefined, `${party}: a clause to print`).to.be.true;
    }
  });

  it('the rules block prints the party\'s own graphic — the Reds\' action (their passive is empty)', () => {
    const vm = partyPremiumVm(PartyName.REDS as never)!;
    expect(vm.mechanics.textOnly).to.be.false;
    expect(vm.mechanics.groups.length).to.be.greaterThan(0);
  });

  it('the clauses keep the SAME node references as the whole formula (the commit anchors resolve on the charter)', () => {
    const vm = partyPremiumVm(PartyName.GREENS as never)!;
    const whole = vm.mechanics.groups.flatMap((g) => g.nodes);
    const clauses = [vm.parliament?.charter?.effect, vm.parliament?.charter?.action].flatMap((m) => m?.groups ?? []).flatMap((g) => g.nodes);
    expect(clauses.length).to.be.greaterThan(0);
    expect(clauses.every((n) => whole.includes(n)), 'every clause node is a node of the whole formula').to.be.true;
  });

  it('PremiumCard draws it as the CHARTER — never the project anatomy, never the bill', () => {
    const w = mount(PremiumCard, {...globalConfig, props: {vmOverride: partyPremiumVm(PartyName.SCIENTISTS as never), inert: true}});
    expect(w.classes()).to.include('pcard--party-face');
    expect(w.classes()).to.include('pcard--charter');
    expect(w.classes()).not.to.include('pcard--bill');
    expect(w.find('.pcard__art').exists(), 'no art window').to.be.false;
    expect(w.find('.pcard-nameplate').exists(), 'no project nameplate').to.be.false;
    expect(w.find('.pcard-charter__crest').exists(), 'the crest on the banner').to.be.true;
    expect(w.find('[data-charter-access]').exists(), 'the law of access printed at the foot').to.be.true;
    expect(w.findAll('[data-charter-clause]').length).to.be.greaterThan(0);
  });
});
