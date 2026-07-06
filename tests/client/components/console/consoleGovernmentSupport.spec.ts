import {expect} from 'chai';
import {buildGovSupportCards, firstAvailableIndex, GovGameState} from '@/client/console/consoleGovernmentSupport';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/* Synthetic WGT options — leaf (option) and board (space), stable titles. */
function leaf(title: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Increase'} as unknown as PlayerInputModel;
}
function space(title: string): PlayerInputModel {
  return {type: 'space', title, spaces: []} as unknown as PlayerInputModel;
}

const TEMP = 'Increase temperature';
const OXY = 'Increase oxygen';
const OCEAN = 'Add an ocean';
const VENUS = 'Increase Venus scale';

function game(overrides: Partial<GovGameState> = {}): GovGameState {
  return {
    temperature: -24,
    oxygenLevel: 7,
    oceans: 5,
    venusScaleLevel: 8,
    venusInGame: true,
    ...overrides,
  };
}

describe('consoleGovernmentSupport', () => {
  it('builds the full 2×2 in canonical order with previews', () => {
    const cards = buildGovSupportCards([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)], game());
    expect(cards.map((c) => c.param)).to.deep.eq(['temperature', 'oxygen', 'oceans', 'venus']);

    const [temp, oxy, ocean, venus] = cards;
    expect(temp.currentText).to.eq('-24°C');
    expect(temp.nextText).to.eq('-22°C'); // temperature rises by 2
    expect(oxy.currentText).to.eq('7%');
    expect(oxy.nextText).to.eq('8%'); // oxygen rises by 1
    expect(ocean.currentText).to.eq('5 / 9');
    expect(ocean.nextText).to.eq('6 / 9'); // ocean count +1 of MAX 9
    expect(venus.currentText).to.eq('8%');
    expect(venus.nextText).to.eq('10%'); // venus rises by 2

    cards.forEach((c) => expect(c.available).to.be.true);
    expect(ocean.isSpace).to.be.true;
    expect(temp.isSpace).to.be.false;
  });

  it('maps optionIndex to the ORIGINAL option order even when reordered', () => {
    // Server order: ocean(0), temperature(1) → canonical order temp, ocean.
    const cards = buildGovSupportCards([space(OCEAN), leaf(TEMP)], game());
    expect(cards.map((c) => c.param)).to.deep.eq(['temperature', 'oceans']);
    expect(cards[0].optionIndex).to.eq(1); // temperature was option #1
    expect(cards[1].optionIndex).to.eq(0); // ocean was option #0
  });

  it('carries icon + accent per parameter', () => {
    const cards = buildGovSupportCards([leaf(TEMP), leaf(OXY), space(OCEAN), leaf(VENUS)], game());
    expect(cards[0].iconClass).to.eq('wgt-icon wgt-icon--temperature');
    expect(cards[0].accent).to.eq('temperature');
    expect(cards[2].iconClass).to.eq('wgt-icon wgt-icon--ocean');
    expect(cards[2].accent).to.eq('ocean');
    expect(cards[3].accent).to.eq('venus');
  });

  it('synthesizes a DISABLED card for an in-scope MAXED parameter (server omits it)', () => {
    // Oxygen maxed at 14 → the server drops it; the panel still shows it.
    const cards = buildGovSupportCards([leaf(TEMP), space(OCEAN), leaf(VENUS)], game({oxygenLevel: 14}));
    expect(cards.map((c) => c.param)).to.deep.eq(['temperature', 'oxygen', 'oceans', 'venus']);
    const oxy = cards[1];
    expect(oxy.available).to.be.false;
    expect(oxy.optionIndex).to.eq(-1);
    expect(oxy.disabledReason).to.eq('Maximum reached');
    expect(oxy.currentText).to.eq('14%');
    expect(oxy.nextText).to.eq(''); // no gain shown for a maxed card
  });

  it('does NOT synthesize a card for an absent parameter that is not maxed', () => {
    // Oxygen absent but only at 10 (not maxed — e.g. a niche board case) → skip.
    const cards = buildGovSupportCards([leaf(TEMP), space(OCEAN), leaf(VENUS)], game({oxygenLevel: 10}));
    expect(cards.map((c) => c.param)).to.deep.eq(['temperature', 'oceans', 'venus']);
  });

  it('omits Venus entirely when Venus is not in the game', () => {
    // No Venus option, Venus not in game → never a Venus card (even at 0/maxed).
    const cards = buildGovSupportCards([leaf(TEMP), leaf(OXY), space(OCEAN)], game({venusInGame: false, venusScaleLevel: 0}));
    expect(cards.map((c) => c.param)).to.deep.eq(['temperature', 'oxygen', 'oceans']);
  });

  it('appends recognized extras (hazard) after the core set', () => {
    const cards = buildGovSupportCards([leaf(TEMP), space('Remove an unprotected hazard')], game());
    expect(cards.map((c) => c.param)).to.deep.eq(['temperature', 'hazard']);
    const hazard = cards[1];
    expect(hazard.accent).to.eq('hazard');
    expect(hazard.isSpace).to.be.true;
    expect(hazard.hasPreview).to.be.false;
    expect(hazard.iconClass).to.eq('wgt-icon wgt-icon--hazard');
  });

  it('firstAvailableIndex skips a leading disabled card', () => {
    // Temperature maxed (synth disabled at slot 0) → focus lands on oxygen.
    const cards = buildGovSupportCards([leaf(OXY), space(OCEAN), leaf(VENUS)], game({temperature: 8}));
    expect(cards[0].param).to.eq('temperature');
    expect(cards[0].available).to.be.false;
    expect(firstAvailableIndex(cards)).to.eq(1);
  });

  it('computes segmented-scale fractions from the live values', () => {
    const cards = buildGovSupportCards([leaf(OXY), space(OCEAN)], game({oxygenLevel: 7, oceans: 3}));
    const oxy = cards[0];
    expect(oxy.fraction).to.be.closeTo(7 / 14, 1e-9);
    expect(oxy.nextFraction).to.be.closeTo(8 / 14, 1e-9);
    const ocean = cards[1];
    expect(ocean.fraction).to.be.closeTo(3 / 9, 1e-9);
    expect(ocean.nextFraction).to.be.closeTo(4 / 9, 1e-9);
  });
});
