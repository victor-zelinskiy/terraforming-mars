import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {VictoryPointsBreakdown, AutomaVictoryPoints} from '../../src/common/game/VictoryPointsBreakdown';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {MarsBotDividendDetail, dividendTermFormula, perUnitTerm, bonusTerm, dividendResult} from '../../src/common/automa/MarsBotDividend';
import {vpAttribution} from '../../src/common/game/vpAttribution';
import {buildEndgameModel, EndgamePlayerInput} from '../../src/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm} from '../../src/client/console/endgame/consoleEndgameModel';
import {buildLiveScoreModel} from '../../src/client/console/liveScoreModel';
import {buildDividendFacts, buildScoreOverview} from '../../src/client/console/scoreExplorerModel';
import {marsBotCorpAnnotations, marsBotDividendAnnotation} from '../../src/client/components/marsbot/marsBotCorpRules';

/**
 * «ДИВИДЕНДЫ КОРПОРАЦИЙ» on the client — the titles precedent: a category of
 * its own, present only with a portfolio, and the segment-sum ≡ total
 * invariant kept on every surface. The fixtures carry a NON-ZERO dividend:
 * a zero cannot be lost, so a guard over one proves nothing.
 */

const DETAILS: ReadonlyArray<MarsBotDividendDetail> = [
  {corporation: MarsBotCorpId.C02_ECOLINE, ...dividendResult([perUnitTerm('Greenery tiles', 7, 2), bonusTerm('Threshold bonus', 7, 6, 2)])},
  {corporation: MarsBotCorpId.C10_THARSIS_REPUBLIC, ...dividendResult([perUnitTerm('City tiles', 4, 3)])},
];
const DIVIDEND_VP = 16 + 12;

function automa(withDividends: boolean): AutomaVictoryPoints {
  return {
    mcToVp: 3, mcPerVp: 8, neuralInstance: 1, cardVp: 6, corpVp: 0,
    ...(withDividends ? {dividendVp: DIVIDEND_VP, detailsDividends: DETAILS} : {}),
  };
}

function botBreakdown(withDividends: boolean): VictoryPointsBreakdown {
  const a = automa(withDividends);
  const tr = 50;
  return {
    terraformRating: tr,
    terraformRatingBreakdown: {base: tr, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 5, awards: 0, greenery: 4, city: 3, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0,
    victoryPoints: 0,
    automa: a,
    total: tr + 5 + 4 + 3 + a.mcToVp + a.neuralInstance + a.cardVp + a.corpVp + (a.dividendVp ?? 0),
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
}

function endgameVm(withDividends: boolean) {
  const human: EndgamePlayerInput = {
    color: 'red', name: 'A', corporations: [], megacredits: 0, vpByGeneration: [], globalSteps: {},
    breakdown: {...botBreakdown(false), automa: undefined, total: 50 + 5 + 4 + 3},
  };
  const bot: EndgamePlayerInput = {
    color: 'neutral', name: 'MarsBot', corporations: [], megacredits: 24, vpByGeneration: [], globalSteps: {},
    breakdown: botBreakdown(withDividends),
  };
  const model = buildEndgameModel([human, bot], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 9});
  return buildConsoleEndgameVm(model, ['red', 'neutral'] as Array<Color>, {botColors: ['neutral']});
}

describe('the dividends category (client)', () => {
  it('the ceremony: a category of its own, Σ categories ≡ the bot\'s total', () => {
    const vm = endgameVm(true);
    const dividends = vm.categories.find((c) => c.key === 'dividends');
    expect(dividends, 'a real category').is.not.undefined;
    expect(dividends!.values['neutral']).eq(DIVIDEND_VP);
    const sum = vm.categories.reduce((acc, c) => acc + (c.values['neutral'] ?? 0), 0);
    expect(sum).eq(vm.rows.find((r) => r.isBot)!.finalTotal);
    // Never folded into the cards: the families still hold exactly the bot's card terms.
    expect(vm.categories.find((c) => c.key === 'cards')!.values['neutral']).eq(3 + 1 + 6);
  });

  it('without a portfolio there is no dividends category at all', () => {
    const vm = endgameVm(false);
    expect(vm.categories.some((c) => c.key === 'dividends')).is.false;
  });

  it('the live score: present from generation 1 with a portfolio (an honest 0), absent without one', () => {
    const zero: VictoryPointsBreakdown = {...botBreakdown(true), automa: {...automa(true), dividendVp: 0}};
    zero.total -= DIVIDEND_VP;
    const live = buildLiveScoreModel(zero, {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false, hasDividends: true});
    expect(live.categories.find((c) => c.key === 'dividends')?.value).eq(0);
    const plain = buildLiveScoreModel(botBreakdown(false), {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false});
    expect(plain.categories.some((c) => c.key === 'dividends')).is.false;
    const full = buildLiveScoreModel(botBreakdown(true), {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false, hasDividends: true});
    expect(full.categories.reduce((acc, c) => acc + c.value, 0)).eq(botBreakdown(true).total);
  });

  it('the score explorer names each holding and every term of its formula with the server\'s numbers', () => {
    const b = botBreakdown(true);
    const facts = buildDividendFacts(b);
    expect(facts.rows.map((r) => [r.label, r.value])).deep.eq([
      [marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE).original, undefined],
      ['Greenery tiles', 14],
      ['Threshold bonus', 2],
      [marsBotCorpInfo(MarsBotCorpId.C10_THARSIS_REPUBLIC).original, undefined],
      ['City tiles', 12],
    ]);
    const live = buildLiveScoreModel(b, {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false, hasDividends: true});
    const tile = buildScoreOverview(live, b, {isBot: true}).tiles.find((t) => t.key === 'dividends')!;
    expect(tile.value).eq(DIVIDEND_VP);
    expect(tile.ledger.kind).not.eq('empty');
  });

  it('the formula reading covers every term shape', () => {
    expect(dividendTermFormula(perUnitTerm('x', 7, 2))).deep.eq({label: '${0} × ${1} VP', params: [7, 2]});
    expect(dividendTermFormula(perUnitTerm('x', 7, 5, 2))).deep.eq({label: '${0} ÷ ${1} × ${2} VP', params: [7, 2, 5]});
    expect(dividendTermFormula(bonusTerm('x', 4, 6, 3))).deep.eq({label: '${0} of ${1} for +${2} VP', params: [4, 6, 3]});
    const capped = dividendResult([perUnitTerm('x', 20, 3)], 24);
    expect(capped.vp).eq(24);
    expect(dividendTermFormula(capped.terms[0])).deep.eq({label: '${0} × ${1} VP, at most ${2}', params: [20, 3, 24]});
  });

  it('the bot\'s VP cell attributes a dividend change to the bot\'s own scoring (Σ shares ≡ Δ total)', () => {
    const before = botBreakdown(false);
    const after = botBreakdown(true);
    const shares = vpAttribution(before, after);
    expect(shares.reduce((acc, s) => acc + s.points, 0)).eq(after.total - before.total);
    expect(shares.some((s) => s.source.kind === 'other' && s.points === DIVIDEND_VP)).is.true;
  });

  it('the «Дивиденды» box is its own group — the printed boxes stay the printed card', () => {
    const printed = marsBotCorpAnnotations(MarsBotCorpId.C02_ECOLINE);
    expect(printed.map((g) => g.labelKey)).not.contains('Dividends');
    const box = marsBotDividendAnnotation(MarsBotCorpId.C02_ECOLINE, printed.length);
    expect(box.labelKey).eq('Dividends');
    expect(box.kind).eq('victory-points');
    expect(box.order).eq(printed.length);
    expect(box.rows.length, 'the holding-only line, then the printed lines').eq(1 + 2);
  });
});
