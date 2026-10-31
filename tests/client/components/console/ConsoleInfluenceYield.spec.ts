import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {voteYieldsOf} from '@/client/console/parliament/influenceYieldModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * INFLUENCE → RESULT, the BLOCK (Turmoil Redux): what the formula row and the
 * reading PRINT for a part whose rate per influence is ZERO beside a count
 * (Jovian Tax Rights's «1 M€ production per colony, max 5»). Influence is not
 * a term of that part, so the block must print neither «+ 0 [unit] /
 * [influence]» in the formula nor «+ [influence] 3» in the reading — either
 * would claim a term the card does not print — while the titanium part beside
 * it keeps both. The production part also wears the HORIZON, because the
 * titanium beside it is paid TODAY (`productionHorizonOn`).
 */
const RIGHTS_ID = 'RDX_UNITY_JOVIAN_TAX_RIGHTS';
const AWARD_ID = 'RDX_MARS_ARCHITECTURE_AWARD';

function seat(color: Color, agenda: number, influence: number, colonies: ReadonlyArray<ColonyName>): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{id: 'colonies', count: colonies.length, cards: [], colonies}, {id: 'buildingCardsWithNonNegativeVp', count: 2, cards: []}],
  };
}

function model(players: Array<ParliamentPlayerModel>): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none'};
}

const mountBlock = (id: string, opts: {formula: boolean, oneNumber: boolean, captions: boolean}) => {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    throw new Error(`${id} is not in the client manifest`);
  }
  const yields = voteYieldsOf(resolution, model([seat('blue' as Color, 5, 3, [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN, ColonyName.MIRANDA])]), 'blue' as Color);
  return mount(ConsoleInfluenceYield, {props: {yields, ...opts}, global: {mocks: {$t: (key: string) => key}}});
};

describe('ConsoleInfluenceYield — a counted part with no influence term (Jovian Tax Rights)', () => {
  it('the formula: «1 [M€ production] / [colony] · max 5» prints NO influence term, while the titanium formula beside it keeps «1 [titanium] / [influence]»', () => {
    const wrapper = mountBlock(RIGHTS_ID, {formula: true, oneNumber: false, captions: true});
    const production = wrapper.find('[data-yield-effect="production"] .con-iyield__formula');
    expect(production.exists()).to.eq(true);
    expect(production.attributes('data-yield-influence-term')).to.eq('false');
    expect(production.find('.con-iyield__inf').exists(), 'no influence badge').to.eq(false);
    expect(production.find('.pcglyph--colony').exists(), 'the counted object is the colony tile').to.eq(true);
    expect(production.findAll('.con-iyield__num').map((n) => n.text()), 'the rate per colony alone — never a «0» per influence').to.deep.eq(['1']);
    expect(production.find('.con-iyield__plus').exists(), 'nothing to add the count to').to.eq(false);
    expect(production.find('.con-iyield__cap').exists(), 'the cap is printed with the formula it bounds').to.eq(true);
    const titanium = wrapper.find('[data-yield-effect="titanium"] .con-iyield__formula');
    expect(titanium.attributes('data-yield-influence-term')).to.eq('true');
    expect(titanium.find('.con-iyield__inf').exists()).to.eq(true);
    expect(titanium.findAll('.con-iyield__num').map((n) => n.text())).to.deep.eq(['1']);
  });

  it('the reading: «[colony] 4 → +4» prints no influence input and no dangling «+»; the titanium reads «[influence] 3 → +3»; the production wears the horizon, the titanium does not', () => {
    const wrapper = mountBlock(RIGHTS_ID, {formula: false, oneNumber: true, captions: false});
    const production = wrapper.find('[data-yield-effect="production"]');
    expect(production.find('[data-yield-in="count"]').text()).to.eq('4');
    expect(production.find('[data-yield-in="influence"]').exists(), 'influence is not an input of the production').to.eq(false);
    expect(production.find('.con-iyield__in .con-iyield__plus').exists(), 'no «+» after the count with nothing to follow it').to.eq(false);
    expect(production.find('[data-yield-context="estimate"]').attributes('data-yield-amount')).to.eq('4');
    expect(production.find('[data-yield-horizon]').exists(), 'the production part first pays in the next generation').to.eq(true);
    const titanium = wrapper.find('[data-yield-effect="titanium"]');
    expect(titanium.find('[data-yield-in="influence"]').text()).to.eq('3');
    expect(titanium.find('[data-yield-in="count"]').exists()).to.eq(false);
    expect(titanium.find('[data-yield-context="estimate"]').attributes('data-yield-amount')).to.eq('3');
    expect(titanium.find('[data-yield-horizon]').exists(), 'the titanium is paid today').to.eq(false);
  });

  it('a production-only card (Architecture Award) is untouched: its formula keeps the influence term and «+», its reading the influence input, and it wears no horizon', () => {
    const wrapper = mountBlock(AWARD_ID, {formula: true, oneNumber: true, captions: true});
    const formula = wrapper.find('[data-yield-effect="production"] .con-iyield__formula');
    expect(formula.attributes('data-yield-influence-term')).to.eq('true');
    expect(formula.find('.con-iyield__inf').exists()).to.eq(true);
    expect(formula.find('.con-iyield__plus').exists()).to.eq(true);
    const reading = wrapper.find('[data-yield-effect="production"]');
    expect(reading.find('[data-yield-in="influence"]').text()).to.eq('3');
    expect(reading.find('[data-yield-in="count"]').text()).to.eq('2');
    expect(reading.find('[data-yield-horizon]').exists(), 'one horizon — nothing to tell apart').to.eq(false);
  });
});

/**
 * THE WIN'S SUFFIX (P77 · DH — it replaced the «win column» of 2026-10-26, which read as a second, louder number): the
 * one-number block of a card whose win raises a number gains ONE quiet line UNDER that number — what the win ADDS,
 * «+1 [unit] если победите · [нашивка] ③», the Career node said once per block. A row the win leaves as it is has no line.
 * Mining Incentives (RX22) at the owner's frame: Career position 2 (influence 1), the win moving the marker to node 3
 * (influence 2) — the titanium is flat (+1 either way), the steel is +1 → +2.
 */
describe('ConsoleInfluenceYield — the win\'s suffix (Mining Incentives)', () => {
  const MINING_ID = 'RDX_INDUSTRIALISTS_MINING_INCENTIVES';
  const mountMining = (oneNumber: boolean, agenda = 2, influence = 1) => {
    const resolution = getResolution(MINING_ID);
    if (resolution === undefined) {
      throw new Error(`${MINING_ID} is not in the client manifest`);
    }
    const yields = voteYieldsOf(resolution, model([seat('blue' as Color, agenda, influence, [])]), 'blue' as Color);
    return mount(ConsoleInfluenceYield, {props: {yields, formula: false, oneNumber, captions: false}, global: {mocks: {$t: (key: string) => key}}});
  };

  it('no second plate: no head of its own, no table — ONE line under the number the win raises', () => {
    const wrapper = mountMining(true);
    expect(wrapper.find('[data-influence-yield]').classes()).not.to.include('con-iyield--table');
    expect(wrapper.find('[data-parl-vote-winhead]').exists(), 'no head of a win column').to.eq(false);
    const suffixes = wrapper.findAll('.con-iyield__suffix');
    expect(suffixes.length, 'the flat titanium has no line — only the steel the win raises').to.eq(1);
    const steel = wrapper.find('[data-yield-effect="steelProduction"]');
    const line = steel.find('.con-iyield__suffix');
    expect(line.exists(), 'the line stands in the steel\'s own group, under its number').to.eq(true);
    expect(line.attributes('data-parl-vote-suffix'), 'the witness keeps what the win ADDS').to.eq('1');
    expect(line.attributes('data-suffix-step')).to.eq('3');
    expect(line.find('.con-iyield__suffix-num').text(), 'what the win ADDS — never the total').to.eq('+1');
    expect(line.find('.con-iyield__suffix-words').text()).to.eq('if you win');
    expect(line.find('.career-step-glyph').exists(), 'the step is the Career insignia, not the word «шаг»').to.eq(true);
    expect(line.find('.con-iyield__suffix-node').text()).to.eq('3');
    expect(wrapper.find('[data-yield-effect="titaniumProduction"] .con-iyield__suffix').exists(), 'a row the win does not change has no line').to.eq(false);
    expect(wrapper.text(), 'the word «step» is gone from the block').not.to.contain('step');
  });

  it('outside the one-number mode there is no suffix line (the inspector keeps its forecast plate)', () => {
    const wrapper = mountMining(false);
    expect(wrapper.find('.con-iyield__suffix').exists()).to.eq(false);
  });

  it('a block whose every number is a plain ZERO prints the word, never «0 → +0» — and the suffix still stands under it', () => {
    // Influence 0 at the start of the Career: the steel reads 0 and the flat titanium… is +1 — so this block is NOT a zero.
    const mixed = mountMining(true, 0, 0);
    expect(mixed.find('[data-yield-zero]').exists(), 'a block with a +1 in it is no zero block').to.eq(false);
    // Architecture Award at influence 0 with no counted cards: «0 + 0 → +0» — one zero, the word in its place.
    const resolution = getResolution(AWARD_ID)!;
    const bare: ParliamentPlayerModel = {...seat('blue' as Color, 0, 0, []), counts: [{id: 'buildingCardsWithNonNegativeVp', count: 0, cards: []}]};
    const yields = voteYieldsOf(resolution, model([bare]), 'blue' as Color);
    const zero = mount(ConsoleInfluenceYield, {props: {yields, formula: false, oneNumber: true, captions: false}, global: {mocks: {$t: (key: string) => key}}});
    expect(zero.find('[data-yield-zero]').text()).to.eq('Nothing');
    expect(zero.find('[data-yield-context="estimate"]').exists(), 'no «0 → +0» plate').to.eq(false);
    expect(zero.find('[data-parl-vote-suffix]').exists(), 'what the win adds still stands').to.eq(true);
  });
});
