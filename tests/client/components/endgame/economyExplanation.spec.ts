import {expect} from 'chai';
import {explainEconomy, ECONOMY_CASE_TEXT, EconomyCase} from '@/client/components/endgame/economyExplanation';
import {InsightContext} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';

function pl(color: Color, total: number, opts: {megacredits?: number; cards?: number; board?: number; mcProd?: number} = {}): EndgamePlayerScore {
  return {
    color, name: color, total, isWinner: false, place: 1, megacredits: opts.megacredits ?? 0, corporations: [],
    vpByGeneration: [], topCards: [], penaltyCards: [], parametersTotal: 0, globalSteps: {},
    categories: {tr: 20, cards: opts.cards ?? 0, board: opts.board ?? 0, mca: 0, moon: 0, tracks: 0} as any,
    production: {megacredits: opts.mcProd ?? 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    breakdown: {total} as any,
  } as unknown as EndgamePlayerScore;
}
function fact(type: FactType, player: Color, metrics: Record<string, number>): EndgameFact {
  return {id: `${type}:${player}`, type, player, severity: 0.5, confidence: 'exact', metrics, relatedEventIds: [], tags: []} as EndgameFact;
}
function ctx(players: Array<EndgamePlayerScore>, facts: Array<EndgameFact>): InsightContext {
  players[0].isWinner = true;
  return {
    mode: 'duel', generation: 10, players, winner: players[0], runnerUp: players[1], margin: 10,
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1, facts,
  } as InsightContext;
}

describe('economyExplanation (rework §13)', () => {
  it('every case has winner + loser text', () => {
    const cases: Array<EconomyCase> = ['convertedToPoints', 'fundedColonies', 'metalEngine', 'discountEngine', 'richUnspent', 'tempoOnly'];
    for (const c of cases) {
      expect(ECONOMY_CASE_TEXT[c].winner.length, c).to.be.greaterThan(0);
      expect(ECONOMY_CASE_TEXT[c].loser.length, c).to.be.greaterThan(0);
    }
  });

  it('NO text contains the banned internal metric "value"/"ценности"', () => {
    for (const c of Object.values(ECONOMY_CASE_TEXT)) {
      expect(c.winner.toLowerCase()).to.not.contain('of value');
      expect(c.loser.toLowerCase()).to.not.contain('of value');
    }
  });

  it('undefined when no meaningful economy (< 12 M€)', () => {
    const c = ctx([pl('red', 80), pl('blue', 70)], [fact('economy', 'red', {savedMegacredits: 5})]);
    expect(explainEconomy(c, 'red')).to.be.undefined;
  });

  it('metal engine: steel/titanium spent under a value bonus', () => {
    const c = ctx([pl('red', 90, {cards: 10}), pl('blue', 80)],
      [fact('economy', 'red', {savedMegacredits: 24, paymentValueBonus: 24, paymentValueBonusSteel: 7, paymentValueBonusTitanium: 5})]);
    const exp = explainEconomy(c, 'red');
    expect(exp?.case).to.eq('metalEngine');
    expect(exp?.steelSpent).to.eq(7);
    expect(exp?.evidence.some((ch) => ch.label === 'steel spent')).to.be.true;
  });

  it('discount engine: standing discounts that became plays', () => {
    const c = ctx([pl('red', 90, {cards: 10}), pl('blue', 80)],
      [fact('economy', 'red', {savedMegacredits: 30, discountAndPaymentSaved: 30})]);
    expect(explainEconomy(c, 'red')?.case).to.eq('discountEngine');
  });

  it('rich-unspent: a big economy that never became points', () => {
    // High leftover M€, low scoring VP → money that never converted.
    const c = ctx([pl('red', 90, {megacredits: 40, cards: 4, board: 2, mcProd: 0}), pl('blue', 80)],
      [fact('economy', 'red', {savedMegacredits: 20, discountAndPaymentSaved: 20})]);
    const exp = explainEconomy(c, 'red');
    expect(exp?.case).to.eq('richUnspent');
    expect(exp?.evidence.some((ch) => ch.label === 'unspent')).to.be.true;
  });

  it('converted-to-points: money that became cards / board', () => {
    const c = ctx([pl('red', 110, {cards: 26, board: 4, megacredits: 3}), pl('blue', 80)],
      [fact('economy', 'red', {savedMegacredits: 18})]);
    expect(explainEconomy(c, 'red')?.case).to.eq('convertedToPoints');
  });

  it('funded colonies: economy rode the colony trades', () => {
    const c = ctx([pl('red', 90, {cards: 10}), pl('blue', 80)],
      [fact('economy', 'red', {savedMegacredits: 16, tradeDiscountMegacredits: 6}),
        fact('colony', 'red', {trades: 6})]);
    expect(explainEconomy(c, 'red')?.case).to.eq('fundedColonies');
  });
});
