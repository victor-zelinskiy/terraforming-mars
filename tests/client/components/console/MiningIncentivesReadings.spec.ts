import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {
  enactedYieldsOf, PRODUCTION_HORIZON_KEY, productionHorizonOn, voteYieldsOf, winSuffixesOf, yieldCaptionOf, yieldInfluenceEnters, yieldIsFlat,
} from '@/client/console/parliament/influenceYieldModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {quietRewardPoseOf} from '@/client/console/parliament/quietRewardPose';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * MINING INCENTIVES (Turmoil Redux, RX22) — THE READINGS of the family's
 * SIMPLEST card: two ordinary production parts, one flat and one by influence,
 * nothing else. What is pinned on the client:
 *  · the manifest declares the two parts IN PRINTED ORDER — the flat titanium
 *    first, the steel by influence second — and no levy, no count, no cap, no
 *    winner part, no passive;
 *  · the vote reading draws TWO ROWS, each with its OWN resource in its
 *    production plate — never one merged row and never one merged number: a
 *    titanium step and a steel step are not addable;
 *  · INFLUENCE 0 READS AS THE CARD DOES: the steel row is a calm zero (and,
 *    once enacted, names itself skipped) while the titanium row still reads
 *    +1. A surface that hid the titanium row at influence 0 would state a
 *    rule the card does not print;
 *  · THE HORIZON is the shared note, not a second formulation. This card moves
 *    no supply today, so both parts share ONE horizon and there is nothing to
 *    tell apart — `productionHorizonOn` withholds the note by its own law
 *    (the same law that prints it under Industrialist Budget's «+4 M€
 *    production» beside a levy). No local phrase is coined here.
 */
const MINING_ID = 'RDX_INDUSTRIALISTS_MINING_INCENTIVES';
const BLUE = 'blue' as Color;

function seat(color: Color, agenda: number, influence: number): ParliamentPlayerModel {
  return {color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0};
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const mining = (): NonNullable<ReturnType<typeof getResolution>> => {
  const resolution = getResolution(MINING_ID);
  if (resolution === undefined) {
    throw new Error(`${MINING_ID} is not in the client manifest`);
  }
  return resolution;
};

/** The table with the enactment's records on it — what the seat was actually paid. */
function enacted(outcomes: Array<ParliamentEnactOutcomeModel>): ParliamentModel {
  const law = mining();
  return {
    ...model([seat(BLUE, 0, 0)]),
    enacted: {instance: `${law.id}#0`, resolution: law.id, party: law.party},
    lastPhase: {outcomes},
  } as unknown as ParliamentModel;
}

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('MiningIncentivesReadings (RX22)', () => {
  it('the manifest declares TWO production parts in the printed order — flat titanium, then steel by influence — with no levy, no count, no cap, no winner part and no passive', () => {
    const law = mining();
    expect(law.code).eq('RX22');
    expect(law.party).eq(PartyName.INDUSTRIALISTS);
    expect(law.levy).is.undefined;
    expect(law.winnerReward).is.undefined;
    expect(law.tileGrant).is.undefined;
    expect(law.worldMoves ?? []).deep.eq([]);
    expect(law.compatibility ?? []).deep.eq([]);
    const [titanium, steel] = law.scaled ?? [];
    expect(titanium).deep.eq({id: 'titaniumProduction', unit: {kind: 'production', resource: Resource.TITANIUM}, base: 1, perInfluence: 0, recipient: 'each'});
    expect(steel).deep.eq({id: 'steelProduction', unit: {kind: 'production', resource: Resource.STEEL}, perInfluence: 1, recipient: 'each'});
    expect(titanium.cap, 'no «max» is printed').is.undefined;
    expect(steel.cap).is.undefined;
    // The flat part is nobody's number in particular; the scaled one is the seat's own.
    expect(yieldIsFlat(titanium)).is.true;
    expect(yieldInfluenceEnters(titanium), 'no «+ 0 / influence» term the card does not print').is.false;
    expect(yieldIsFlat(steel)).is.false;
    expect(yieldInfluenceEnters(steel)).is.true;
    expect(law.hasImmediate).is.true;
    expect(law.hasPassive).is.false;
    expect(law.hasWinnerEffect).is.false;
    expect(law.hasWorldEffect).is.false;
    expect(law.quest).deep.eq({goal: {kind: 'production', resource: Resource.STEEL}, count: 1});
    expect(law.text.quest, 'the sentence Industrialist Budget already prints — one key').eq('Raise your steel production 1 step');
    expect(familyOf(law), 'the stand opens the influence family — no new scenario shape').eq('influence');
  });

  it('the vote reading lists BOTH parts — titanium then steel, each its own resource — and only the SCALED part gains from a win', () => {
    const law = mining();
    const yields = voteYieldsOf(law, model([seat(BLUE, 4, 2)]), BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq([
      'titaniumProduction:estimate', 'steelProduction:estimate', 'steelProduction:forecast',
    ]);
    expect(yields[0]).deep.include({amount: 1, influence: 2});
    expect(yields[1]).deep.include({amount: 2, influence: 2});
    expect(yields[2]).deep.include({amount: 3, influence: 3, agendaStep: 5});
    // Winning buys one more step of STEEL and nothing of titanium — the flat part has no «+N if you win».
    expect(winSuffixesOf(yields)).deep.eq([{effectId: 'steelProduction', delta: 1, agendaStep: 5, influence: 3, atCap: false}]);
    // …and the caption says WHICH question each number answers.
    expect(yieldCaptionOf(yields[0])).deep.eq({key: 'The same for every player'});
    expect(yieldCaptionOf(yields[1])).deep.eq({key: 'By your current influence'});
  });

  it('INFLUENCE 0 does not blank the card: the steel row reads a calm zero and the TITANIUM row still reads +1', () => {
    const law = mining();
    const none = voteYieldsOf(law, model([seat(BLUE, 0, 0)]), BLUE);
    expect(none.filter((y) => y.context === 'estimate').map((y) => `${y.effect.id}:${y.amount}`)).deep.eq(['titaniumProduction:1', 'steelProduction:0']);
    // …and the «if you win» row still belongs to the steel part alone — the Agenda's first step is one point of influence.
    expect(none.filter((y) => y.context === 'forecast').map((y) => `${y.effect.id}:${y.amount}`)).deep.eq(['steelProduction:1']);
    // Influence 3 moves only the steel row; the titanium row is the same number it was at 0.
    const three = voteYieldsOf(law, model([seat(BLUE, 0, 3)]), BLUE);
    expect(three.filter((y) => y.context === 'estimate').map((y) => `${y.effect.id}:${y.amount}`)).deep.eq(['titaniumProduction:1', 'steelProduction:3']);
  });

  it('the reading component draws TWO groups, each unit in its own PRODUCTION plate — a titanium step and a steel step are never one number', () => {
    const law = mining();
    const yields = voteYieldsOf(law, model([seat(BLUE, 4, 2)]), BLUE);
    const wrapper = mount(ConsoleInfluenceYield, {props: {yields, formula: true, oneNumber: true, captions: false}, ...t});
    const groups = wrapper.findAll('.con-iyield__group');
    expect(groups.map((g) => g.attributes('data-yield-effect'))).deep.eq(['titaniumProduction', 'steelProduction']);
    const titanium = wrapper.find('[data-yield-effect="titaniumProduction"]');
    const titaniumUnit = titanium.find('.con-iyield__formula .con-iyield__unit').classes().join(' ');
    expect(titaniumUnit).contains('titanium');
    expect(titaniumUnit, 'the production frame, never the bare cube').contains('con-iyield__unit--prod');
    expect(titanium.find('.con-iyield__out b').text()).eq('+1');
    const steel = wrapper.find('[data-yield-effect="steelProduction"]');
    const steelUnit = steel.find('.con-iyield__formula .con-iyield__unit').classes().join(' ');
    expect(steelUnit).contains('steel');
    expect(steelUnit).contains('con-iyield__unit--prod');
    expect(steel.find('.con-iyield__out b').text()).eq('+2');
    expect(wrapper.find('.con-iyield__cap').exists(), 'no cap on either part').is.false;
  });

  it('THE HORIZON is the shared note and this card withholds it — nothing of its own is paid today, so the two parts share one horizon', () => {
    const law = mining();
    const effects = law.scaled ?? [];
    for (const effect of effects) {
      expect(productionHorizonOn(effects, effect, false), `${effect.id}: one horizon, nothing to tell it apart from`).is.false;
    }
    // The note EXISTS and is one phrase — the card coins no second one; a levy
    // beside the same parts is what makes the shared predicate print it.
    expect(PRODUCTION_HORIZON_KEY).eq('pays from the next generation');
    expect(productionHorizonOn(effects, effects[0], true), 'the same parts beside something paid today would carry the shared note').is.true;
    const wrapper = mount(ConsoleInfluenceYield, {props: {yields: voteYieldsOf(law, model([seat(BLUE, 4, 2)]), BLUE), formula: true, captions: false}, ...t});
    expect(wrapper.text()).does.not.contain(PRODUCTION_HORIZON_KEY);
  });

  it('the inspector\'s right column: «When enacted» with the card\'s one sentence, then the chairman quest — no count rule, no passive block', () => {
    const blocks = resolutionAnnotations(MINING_ID);
    expect(blocks.map((b) => b.labelKey)).deep.eq(['When enacted', 'Chairman quest']);
    expect(blocks[0].rows.map((r) => r.text)).deep.eq(['Raise your titanium production 1 step. Then raise your steel production 1 step per influence.']);
    expect(blocks[1].rows.map((r) => r.text)).deep.eq(['Raise your steel production 1 step']);
    expect(quietRewardPoseOf(mining()), 'the card has immediate steps — the REWARD stage is no quiet pose').is.undefined;
  });

  it('the ENACTED reading is the record, not a recomputation: the skipped steel names itself beside the titanium that was paid all the same', () => {
    const law = mining();
    const records: Array<ParliamentEnactOutcomeModel> = [
      {player: BLUE, step: 'titanium-production', part: 'effect', effect: 'titaniumProduction', kind: 'production', production: Resource.TITANIUM, amount: 1, influence: 0, before: 0, after: 1},
      {player: BLUE, step: 'steel-production', part: 'effect', effect: 'steelProduction', kind: 'skipped', production: Resource.STEEL, amount: 0, influence: 0, before: 2, after: 2, reason: 'No influence'},
    ];
    const yields = enactedYieldsOf(law, enacted(records), BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.amount}`)).deep.eq(['titaniumProduction:1', 'steelProduction:0']);
    expect(yields[0].skipped, 'the titanium was received — no skip plate over it').is.undefined;
    expect(yields[1].skipped).eq('No influence');
    expect(yieldCaptionOf(yields[0])).deep.eq({key: 'Received'});
    expect(yieldCaptionOf(yields[1])).deep.eq({key: 'No influence'});
  });
});
