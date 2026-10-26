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
import {buildBotGroupFacts, buildCardsHub, buildScoreOverview} from '../../src/client/console/scoreExplorerModel';
import {marsBotCorpAnnotations, marsBotDividendAnnotation, marsBotHoldingAnnotations} from '../../src/client/components/marsbot/marsBotCorpRules';

/**
 * The bot's HOLDINGS on the client — in a campaign the bot reads as one more
 * player (the owner, 2026-10-27), so a holding is one more corporation: its
 * points fold into «Карты» beside the bot's own corporation (no category of
 * their own), its face stands behind the bot's on the podium, and how it acts
 * differently is told by its rules on inspection. The segment-sum ≡ total
 * invariant holds on every surface. The fixtures carry a NON-ZERO dividend:
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
    botCorporation: {
      id: MarsBotCorpId.C01_CREDICOR, name: 'Credicor',
      ...(withDividends ? {holdings: DETAILS.map((d) => ({id: d.corporation, name: marsBotCorpInfo(d.corporation).original}))} : {}),
    },
  };
  const model = buildEndgameModel([human, bot], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 9});
  return buildConsoleEndgameVm(model, ['red', 'neutral'] as Array<Color>, {botColors: ['neutral']});
}

describe('the bot\'s holdings read as further corporations (client)', () => {
  it('the ceremony: no category of their own — the points stand in «Карты», Σ categories ≡ the bot\'s total', () => {
    const vm = endgameVm(true);
    expect(vm.categories.some((c) => (c.key as string) === 'dividends'), 'never a category of its own').is.false;
    const cards = vm.categories.find((c) => c.key === 'cards')!;
    expect(cards.values['neutral']).eq(3 + 1 + 6 + DIVIDEND_VP);
    const fixed = cards.subs.find((s) => s.key === 'cards-fixed')!;
    expect(fixed.values['neutral'], 'beside the bot\'s own corporation').eq(6 + DIVIDEND_VP);
    const sum = vm.categories.reduce((acc, c) => acc + (c.values['neutral'] ?? 0), 0);
    expect(sum).eq(vm.rows.find((r) => r.isBot)!.finalTotal);
  });

  it('the podium: the holdings stand behind the bot\'s face as its lineage, each on its own face', () => {
    const bot = endgameVm(true).rows.find((r) => r.isBot)!;
    expect(bot.lineage).deep.eq(DETAILS.map((d) => marsBotCorpInfo(d.corporation).original));
    expect(bot.botLineage).deep.eq(DETAILS.map((d) => d.corporation));
    const plain = endgameVm(false).rows.find((r) => r.isBot)!;
    expect(plain.lineage).deep.eq([]);
    expect(plain.botLineage).is.undefined;
  });

  it('the live score: no category of their own, Σ categories ≡ the total', () => {
    const plain = buildLiveScoreModel(botBreakdown(false), {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false});
    const full = buildLiveScoreModel(botBreakdown(true), {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false});
    expect(full.categories.map((c) => c.key)).deep.eq(plain.categories.map((c) => c.key));
    expect(full.categories.find((c) => c.key === 'cards')!.value - plain.categories.find((c) => c.key === 'cards')!.value).eq(DIVIDEND_VP);
    expect(full.categories.reduce((acc, c) => acc + c.value, 0)).eq(botBreakdown(true).total);
  });

  it('the score explorer: each holding is a row of the fixed family, named by its corporation', () => {
    const b = botBreakdown(true);
    const facts = buildBotGroupFacts(b, 'cards-fixed', 24);
    expect(facts.rows.map((r) => [r.cardName, r.vp])).deep.eq([
      ['icons', 6],
      [marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE).original, 16],
      [marsBotCorpInfo(MarsBotCorpId.C10_THARSIS_REPUBLIC).original, 12],
    ]);
    expect(facts.subtotal).eq(6 + DIVIDEND_VP);
    const live = buildLiveScoreModel(b, {isBot: true, hasMoon: false, hasPathfinders: false, hasDelta: false});
    expect(buildScoreOverview(live, b, {isBot: true}).tiles.some((t) => (t.key as string) === 'dividends')).is.false;
    const hub = buildCardsHub(live, b, true);
    expect(hub.subtotal).eq(3 + 1 + 6 + DIVIDEND_VP);
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

  it('a HOLDING\'s rules tell the difference: its dividend first, every printed box marked as not acting', () => {
    const printed = marsBotCorpAnnotations(MarsBotCorpId.C02_ECOLINE);
    const held = marsBotHoldingAnnotations(MarsBotCorpId.C02_ECOLINE);
    expect(held.length).eq(printed.length + 1);
    expect(held[0].labelKey).eq('Dividends');
    expect(held[0].order).eq(0);
    held.slice(1).forEach((group, i) => {
      expect(group.labelKey).eq(printed[i].labelKey);
      expect(group.order).eq(i + 1);
      expect(group.rows.length, 'the not-acting line, then the printed lines').eq(printed[i].rows.length + 1);
    });
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
