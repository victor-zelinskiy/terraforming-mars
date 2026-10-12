import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {handTenderItems} from '@/client/console/handTenderPlate';
import {initialCounts, paymentLanes, projectCardPaymentPrompt} from '@/client/console/paymentPlan';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * К-H1 (TR48 — the owner's decision 2026-10-12): the hand tile names the
 * CARD-BOUND tender that pays for a card M€ alone cannot — the panel's own
 * opening mix, never a second rule.
 */
function payer(overrides: Partial<Record<string, unknown>> = {}): PublicPlayerModel {
  return {
    megacredits: 0, steel: 0, titanium: 0, plants: 0, heat: 0,
    steelValue: 2, titaniumValue: 3,
    canUseHeatAsMegaCredits: false, canUseTitaniumAsMegacredits: false, canUsePlantsAsMegacredits: false,
    tableau: [{name: CardName.SUPERCOMPUTER, resources: 4}],
    ...overrides,
  } as unknown as PublicPlayerModel;
}
const hand = (name: CardName, cost: number): CardModel => ({name, calculatedCost: cost} as CardModel);

describe('handTenderPlate — what pays for a card M€ alone cannot (К-H1)', () => {
  // Research Startups: Science + Building, 8 — the TR48 table's own case.
  const STARTUPS = CardName.RESEARCH_STARTUPS;

  it('the fixture is real: Research Startups carries the Science tag the data pay for', () => {
    expect(getCard(STARTUPS)?.tags).to.include('science');
  });

  it('a Science card M€ cannot pay: the data the opening mix spends, in the panel\'s order', () => {
    expect(handTenderItems(hand(STARTUPS, 8), payer({megacredits: 4}))).to.deep.eq([{unit: 'supercomputerData', count: 4, megacredits: 8}]);
  });

  it('the plate IS the panel\'s mix: data first, then steel (the owner\'s order) — steel never on the plate', () => {
    const p = payer({megacredits: 0, steel: 2, tableau: [{name: CardName.SUPERCOMPUTER, resources: 2}]});
    expect(handTenderItems(hand(STARTUPS, 8), p)).to.deep.eq([{unit: 'supercomputerData', count: 2, megacredits: 4}]);
    const lanes = paymentLanes(projectCardPaymentPrompt(8, getCard(STARTUPS)!.tags, {}, undefined, undefined), p);
    expect(initialCounts(8, lanes, 0)).to.deep.include({supercomputerData: 2, steel: 2});
  });

  it('M€ alone covers the price: no plate (the plate is about a card that would otherwise NOT be paid)', () => {
    expect(handTenderItems(hand(STARTUPS, 8), payer({megacredits: 8}))).to.deep.eq([]);
  });

  it('a card with no Science tag: no data lane, no plate — and a free card none either', () => {
    expect(handTenderItems(hand(CardName.ASTEROID, 14), payer({megacredits: 4}))).to.deep.eq([]);
    expect(handTenderItems(hand(STARTUPS, 0), payer({megacredits: 0}))).to.deep.eq([]);
  });

  it('steel alone tops it up: no card-bound tender spent, no plate', () => {
    const p = payer({megacredits: 4, steel: 2, tableau: []});
    expect(handTenderItems(hand(STARTUPS, 8), p)).to.deep.eq([]);
  });

  it('the class: EVA Mechs\' mechs on a Space card', () => {
    const p = payer({megacredits: 4, tableau: [{name: CardName.EVA_MECHS, resources: 2}]});
    expect(handTenderItems(hand(CardName.ASTEROID, 14), p)).to.deep.eq([{unit: 'mechs', count: 2, megacredits: 10}]);
  });
});
