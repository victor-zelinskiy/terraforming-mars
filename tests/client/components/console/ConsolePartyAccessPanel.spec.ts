import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePartyAccessPanel from '@/client/components/console/parliament/ConsolePartyAccessPanel.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {Color} from '@/common/Color';
import {ParliamentModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';

/*
 * «ДОСТУП» — the PARTY's dossier names the viewer's access as an OBJECT (Парламент v8 § 7): the tone of the ring (the
 * party rules · the effect is yours · not yours), the viewer's places on its resolution by the seat's OWN threshold
 * (the printed two; one under TR36 — the second place VOID, its room kept), and the state in the glossary's words.
 */
const VIEWER: Color = 'red';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function model(held: PartyAccessModel, inArea: boolean): ParliamentModel {
  return {
    players: [{color: VIEWER, access: [held]}],
    slots: inArea ? [{party: held.party}] : [],
    enacted: undefined,
  } as unknown as ParliamentModel;
}

function make(held: PartyAccessModel, inArea = true) {
  return mount(ConsolePartyAccessPanel, {
    ...globalConfig,
    props: {party: held.party, parliament: model(held, inArea), viewer: VIEWER},
  });
}

describe('ConsolePartyAccessPanel — «ДОСТУП» as an object', () => {
  it('the RULING party: gold, everyone\'s, no places (the road is the rule, not delegates)', () => {
    const w = make(access(PartyName.MARS as ReduxParty, {ruling: true, hasEffect: true}));
    expect(w.attributes('data-access-tone')).eq('rules');
    expect(w.find('[data-parl-access-places]').exists()).is.false;
    expect(w.find('[data-parl-access-state]').text()).to.match(/party rules|партия правит/i);
  });

  it('held by two delegates: mint, both places filled, «2 / 2»', () => {
    const w = make(access(PartyName.SCIENTISTS as ReduxParty, {delegates: 2, byDelegates: true, hasEffect: true, satisfiesRequirement: true}));
    expect(w.attributes('data-access-tone')).eq('holds');
    const places = w.find('[data-parl-access-places]');
    expect(places.attributes('data-parl-access-count')).eq('2');
    expect(places.attributes('data-parl-access-threshold')).eq('2');
    expect(w.findAll('.con-paccess__socket--on').length).eq(2);
  });

  it('one delegate short: slate, one place filled, the state says what would grant it', () => {
    const w = make(access(PartyName.GREENS as ReduxParty, {delegates: 1}));
    expect(w.attributes('data-access-tone')).eq('lacks');
    expect(w.findAll('.con-paccess__socket--on').length).eq(1);
    expect(w.find('[data-parl-access-state]').text()).to.match(/one more delegate|ещё один делегат/i);
  });

  it('a LOWERED threshold (TR36): the second place is VOID — its room kept, «1 / 1»', () => {
    const w = make(access(PartyName.UNITY as ReduxParty, {delegates: 1, byDelegates: true, hasEffect: true, effectDelegates: 1}));
    expect(w.findAll('.con-paccess__socket').length).eq(2);
    expect(w.findAll('.con-paccess__socket--void').length).eq(1);
    expect(w.find('[data-parl-access-places]').attributes('data-parl-access-threshold')).eq('1');
  });

  it('not on the vote: the state names it, the places stand empty', () => {
    const w = make(access(PartyName.REDS as ReduxParty), false);
    expect(w.attributes('data-access-tone')).eq('lacks');
    expect(w.findAll('.con-paccess__socket--on').length).eq(0);
    expect(w.find('[data-parl-access-state]').text()).to.match(/no resolution in the vote|нет резолюции на голосовании/i);
  });
});
