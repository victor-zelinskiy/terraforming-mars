import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePartyEffectsStrip from '@/client/components/console/ConsolePartyEffectsStrip.vue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {IClientResolution} from '@/common/parliament/IClientResolution';

/*
 * THE INFORMATION EFFECTS LIST (Turmoil Redux): the ENACTED RESOLUTION's own
 * passive is everyone's LAW, so its row LEADS the strip, says what it is
 * («Принятая резолюция» over the card's name), draws the card's OWN printed
 * graphic (one drawing for the bill, the list and the inspector — never a
 * second formula) and wears the gold mark of the government in power
 * (`--resolution`). The party rows follow. A resolution without a passive
 * (an immediate-only card) has no row: nothing is standing.
 */
const BLUE: Color = 'blue';

/** A REAL dealt resolution with a live passive — found by its declaration, never by name (the client knows no ids). */
function passiveResolution(): IClientResolution {
  const found = allResolutions().find((r) => r.copies > 0 && r.hasPassive && r.text.passive !== undefined);
  if (found === undefined) {
    throw new Error('the catalog ships no dealt resolution with a passive');
  }
  return found;
}

function immediateResolution(): IClientResolution {
  const found = allResolutions().find((r) => r.copies > 0 && !r.hasPassive && !r.hasAction);
  if (found === undefined) {
    throw new Error('the catalog ships no immediate-only resolution');
  }
  return found;
}

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function seat(over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
    access: REDUX_PARTIES.map((party) => access(party)), partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

function model(enacted: IClientResolution | undefined, heldParties: ReadonlyArray<ReduxParty>): ParliamentModel {
  const ruling = enacted?.party ?? PartyName.GREENS;
  return {
    slots: [],
    enacted: enacted === undefined ? undefined : {instance: `${enacted.id}#0`, resolution: enacted.id, party: enacted.party},
    rulingParty: ruling,
    popularSupport: {},
    players: [seat({access: REDUX_PARTIES.map((party) => access(party, {ruling: party === ruling, hasEffect: heldParties.includes(party)}))})],
    deckSize: 0, discardSize: 0, neutralSupply: 0,
  } as unknown as ParliamentModel;
}

function make(parliament: ParliamentModel) {
  return mount(ConsolePartyEffectsStrip, {...globalConfig, props: {parliament, color: BLUE}});
}

describe('ConsolePartyEffectsStrip — the enacted resolution\'s row', () => {
  it('the law LEADS: the resolution row stands first, marked as the enacted resolution, titled by the card\'s name, before the party rows', () => {
    const law = passiveResolution();
    const w = make(model(law, [law.party, PartyName.GREENS]));
    const items = w.findAll('.con-pfx__item');
    expect(items.length, 'the law + two party rows').eq(3);
    const first = items[0];
    expect(first.classes()).includes('con-pfx__item--resolution');
    expect(first.attributes('data-resolution')).eq(law.id);
    expect(first.attributes('data-party')).eq(law.party);
    expect(first.find('.con-pfx__law').text()).eq('Enacted resolution');
    expect(first.find('.con-pfx__why b').text()).eq(law.text.name);
    expect(first.find('.con-pfx__reason--holds').text()).eq('Enacted resolution: its effect applies to every player');
    expect(items[1].classes(), 'a party row is not the law').does.not.include('con-pfx__item--resolution');
    expect(items[1].find('.con-pfx__law').exists()).is.false;
  });

  it('the row draws the resolution\'s OWN printed graphic — the same render root the bill and the inspector draw', () => {
    const law = passiveResolution();
    const w = make(model(law, [law.party]));
    const formula = w.findComponent({name: 'ConsolePartyFormula'});
    expect(formula.exists()).is.true;
    expect(formula.props('renderRoot')).deep.eq(law.renderData);
    expect(formula.props('party')).eq(law.party);
  });

  it('an enacted resolution WITHOUT a passive has no row — nothing of it is standing', () => {
    const quiet = immediateResolution();
    const w = make(model(quiet, [quiet.party]));
    expect(w.findAll('.con-pfx__item--resolution')).has.length(0);
    expect(w.findAll('.con-pfx__item'), 'the ruling party\'s own row stands').has.length(1);
  });

  it('nothing enacted → no law row; a seat outside the parliament sees no strip at all', () => {
    const w = make(model(undefined, [PartyName.GREENS]));
    expect(w.findAll('.con-pfx__item--resolution')).has.length(0);
    const out = make({...model(passiveResolution(), [PartyName.GREENS]), players: [seat({participates: false})]});
    expect(out.find('.con-pfx').exists()).is.false;
  });
});
