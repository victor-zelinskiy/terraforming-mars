import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentModel, ParliamentPlayerModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsolePartyEffectsStrip from '@/client/components/console/ConsolePartyEffectsStrip.vue';
import {productionHorizonOn, voteYieldsOf, winSuffixesOf, yieldInfluenceEnters} from '@/client/console/parliament/influenceYieldModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {quietRewardPoseOf} from '@/client/console/parliament/quietRewardPose';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * METAL RESEARCH (Turmoil Redux, RX19) — THE READINGS of two supply payouts
 * by influence beside a passive that changes the VALUE of a resource. What is
 * pinned on the client: the manifest declares TWO stock parts (the steel and
 * titanium rows the family already reads) and the passive with its sentence;
 * the vote reading lists BOTH parts, each with its estimate and its «if you
 * win» forecast — two rows on the stand, on the bill and in the sitting, never
 * one merged row; the inspector's right column carries «When enacted» / the
 * passive under «Resolution effect» / the quest; the REWARD stage's quiet pose
 * reads the passive; the effects strip leads with the law's row. Nothing here
 * knows the rate: the value bonus reaches the rail badge and the payment panel
 * through the model's live `steelValue` / `titaniumValue` (their own specs).
 */
const METAL_ID = 'RDX_INDUSTRIALISTS_METAL_RESEARCH';
const BLUE = 'blue' as Color;

function seat(color: Color, agenda: number, influence: number): ParliamentPlayerModel {
  return {color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0};
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

/** The table with the law ENACTED, the viewer holding its party's effect. */
function enactedModel(): ParliamentModel {
  const law = metal();
  return {
    ...model([{
      ...seat(BLUE, 0, 0),
      access: REDUX_PARTIES.map((party) => access(party, {ruling: party === law.party, hasEffect: party === law.party})),
    }]),
    enacted: {instance: `${law.id}#0`, resolution: law.id, party: law.party},
    rulingParty: law.party,
  } as unknown as ParliamentModel;
}

const metal = (): NonNullable<ReturnType<typeof getResolution>> => {
  const resolution = getResolution(METAL_ID);
  if (resolution === undefined) {
    throw new Error(`${METAL_ID} is not in the client manifest`);
  }
  return resolution;
};

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('MetalResearchReadings (RX19)', () => {
  it('the manifest declares two SUPPLY parts by influence — steel and titanium, 1 per point, no count, no cap — the passive with its sentence, and the +1 titanium production quest', () => {
    const law = metal();
    expect(law.code).eq('RX19');
    expect(law.party).eq(PartyName.INDUSTRIALISTS);
    expect(law.levy).is.undefined;
    expect(law.winnerReward).is.undefined;
    expect(law.worldMoves ?? []).deep.eq([]);
    const [steel, titanium] = law.scaled ?? [];
    expect(steel).deep.eq({id: 'steel', unit: {kind: 'stock', resource: Resource.STEEL}, perInfluence: 1, recipient: 'each'});
    expect(titanium).deep.eq({id: 'titanium', unit: {kind: 'stock', resource: Resource.TITANIUM}, perInfluence: 1, recipient: 'each'});
    expect(yieldInfluenceEnters(steel)).is.true;
    expect(yieldInfluenceEnters(titanium)).is.true;
    expect(productionHorizonOn(law.scaled!, steel, false), 'supply today — no horizon').is.false;
    expect(law.hasPassive).is.true;
    expect(law.hasImmediate).is.true;
    expect(law.hasWinnerEffect).is.false;
    expect(law.hasWorldEffect).is.false;
    expect(law.text.passive).eq('Each unit of your steel and titanium is worth 1 M€ more.');
    expect(law.quest).deep.eq({goal: {kind: 'production', resource: Resource.TITANIUM}, count: 1});
    expect(familyOf(law), 'the stand opens the influence family').eq('influence');
  });

  it('the vote reading lists BOTH parts — steel then titanium, each with its estimate and its «if you win» forecast — never one merged row', () => {
    const law = metal();
    const yields = voteYieldsOf(law, model([seat(BLUE, 4, 2)]), BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['steel:estimate', 'steel:forecast', 'titanium:estimate', 'titanium:forecast']);
    expect(yields[0]).deep.include({influence: 2, amount: 2});
    expect(yields[1]).deep.include({influence: 3, amount: 3, agendaStep: 5});
    expect(yields[2]).deep.include({influence: 2, amount: 2});
    expect(yields[3]).deep.include({influence: 3, amount: 3, agendaStep: 5});
    expect(winSuffixesOf(yields)).deep.eq([
      {effectId: 'steel', delta: 1, agendaStep: 5, influence: 3, atCap: false},
      {effectId: 'titanium', delta: 1, agendaStep: 5, influence: 3, atCap: false},
    ]);
    // Influence 0: two calm zeros, one per part.
    const none = voteYieldsOf(law, model([seat(BLUE, 0, 0)]), BLUE);
    expect(none.filter((y) => y.context === 'estimate').map((y) => `${y.effect.id}:${y.amount}`)).deep.eq(['steel:0', 'titanium:0']);
  });

  it('the reading component draws TWO groups — a steel row and a titanium row — each with its own formula and result (the stand, the bill and the sitting share this block)', () => {
    const law = metal();
    const yields = voteYieldsOf(law, model([seat(BLUE, 4, 2)]), BLUE);
    const wrapper = mount(ConsoleInfluenceYield, {props: {yields, formula: true, oneNumber: true, captions: false}, ...t});
    const groups = wrapper.findAll('.con-iyield__group');
    expect(groups.map((g) => g.attributes('data-yield-effect'))).deep.eq(['steel', 'titanium']);
    const steel = wrapper.find('[data-yield-effect="steel"]');
    expect(steel.find('.con-iyield__formula .con-iyield__unit').classes().join(' ')).contains('steel');
    expect(steel.find('.con-iyield__out b').text()).eq('+2');
    const titanium = wrapper.find('[data-yield-effect="titanium"]');
    expect(titanium.find('.con-iyield__formula .con-iyield__unit').classes().join(' ')).contains('titanium');
    expect(titanium.find('.con-iyield__out b').text()).eq('+2');
    expect(wrapper.find('.con-iyield__cap').exists(), 'no cap on either part').is.false;
  });

  it('the inspector\'s right column: «When enacted» (the two payouts as one sentence), the passive under «Resolution effect», then the chairman quest', () => {
    const blocks = resolutionAnnotations(METAL_ID);
    expect(blocks.map((b) => b.labelKey)).deep.eq(['When enacted', 'Resolution effect', 'Chairman quest']);
    expect(blocks[0].rows.map((r) => r.text)).deep.eq(['Gain 1 steel and 1 titanium for every point of your influence.']);
    expect(blocks[1].kind).eq('effect');
    expect(blocks[1].rows.map((r) => r.text)).deep.eq(['Each unit of your steel and titanium is worth 1 M€ more.']);
    expect(blocks[2].rows.map((r) => r.text)).deep.eq(['Raise your titanium production 1 step']);
  });

  it('the REWARD stage\'s quiet pose reads the passive — what the law does while it stands, after the two payouts', () => {
    const pose = quietRewardPoseOf(metal());
    expect(pose?.kind).eq('passive');
    expect(pose?.text).eq('Each unit of your steel and titanium is worth 1 M€ more.');
  });

  it('the effects strip LEADS with the law\'s row once enacted — titled by the card, wearing the Industrialists\' accent, drawing the printed graphic', () => {
    const law = metal();
    const w = mount(ConsolePartyEffectsStrip, {...globalConfig, props: {parliament: enactedModel(), color: BLUE}});
    const first = w.findAll('.con-pfx__item')[0];
    expect(first.classes()).includes('con-pfx__item--resolution');
    expect(first.attributes('data-resolution')).eq(METAL_ID);
    expect(first.attributes('data-party')).eq(PartyName.INDUSTRIALISTS);
    expect(first.find('.con-pfx__why b').text()).eq(law.text.name);
    const formula = w.findComponent({name: 'ConsolePartyFormula'});
    expect(formula.props('renderRoot')).deep.eq(law.renderData);
  });
});
