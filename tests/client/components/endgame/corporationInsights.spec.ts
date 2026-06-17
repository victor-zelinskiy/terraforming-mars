import {expect} from 'chai';
import {generateInsights, buildInsightCandidates, InsightContext} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';

// Iteration 13 — the corporation impact analyzer. It fires ONLY when the corporation
// MATTERED (engine / start / action / Merger / a near-loss underuse) — never filler.

function pl(color: Color, name: string, total: number, corporations: ReadonlyArray<string>, opts: {megacredits?: number} = {}): EndgamePlayerScore {
  return {
    color, name, total, isWinner: false, place: 1, megacredits: opts.megacredits ?? 0, corporations,
    vpByGeneration: [], categories: {} as any, topCards: [], penaltyCards: [],
    globalSteps: {}, parametersTotal: 0, strongestCategory: undefined,
    breakdown: {total, detailsAwards: [], detailsMilestones: []} as any,
  } as unknown as EndgamePlayerScore;
}

function corpFact(player: Color, corp: CardName, metrics: Record<string, number>): EndgameFact {
  return {id: `corporation:${player}:${corp}`, type: 'corporationImpact', player, sourceCard: corp,
    severity: 0.5, confidence: 'partial', metrics, relatedEventIds: [], tags: ['economy', 'timeline']};
}

function ctx(players: Array<EndgamePlayerScore>, facts: Array<EndgameFact> | undefined, margin?: number): InsightContext {
  players[0].isWinner = true;
  const runnerUp = players[1];
  return {
    mode: players.length === 2 ? 'duel' : 'standings', generation: 12, players,
    winner: players[0], runnerUp, margin: margin ?? (runnerUp !== undefined ? players[0].total - runnerUp.total : 0),
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1, facts,
  };
}
function ids(c: InsightContext): Array<string> {
  return generateInsights(c).map((i) => i.id);
}

describe('corporation impact analyzer (Iteration 13)', () => {
  it('a strong passive corporation engine fires a corp insight', () => {
    const c = ctx([pl('red', 'Nastya', 90, [CardName.SATURN_SYSTEMS]), pl('blue', 'Victor', 70, [CardName.TERACTOR])], [
      corpFact('red', CardName.SATURN_SYSTEMS, {totalMeasuredValue: 26, passiveValue: 26, passiveTriggers: 10, actionActivations: 0}),
    ], 20);
    const out = generateInsights(c);
    const ins = out.find((i) => i.id === 'corp.engine.red');
    expect(ins, 'corp engine insight').to.not.be.undefined;
    expect(ins!.family).to.eq('corporationImpact');
  });

  it('a weak corporation produces NO insight (no filler)', () => {
    const c = ctx([pl('red', 'Nastya', 80, [CardName.MINING_GUILD]), pl('blue', 'Victor', 70, [CardName.ECOLINE])], [
      corpFact('red', CardName.MINING_GUILD, {totalMeasuredValue: 5, passiveValue: 5, passiveTriggers: 2, actionActivations: 0}),
    ], 10);
    expect(ids(c)).to.not.include('corp.engine.red');
  });

  it('an action corporation that fired often is an action engine', () => {
    const c = ctx([pl('red', 'Nastya', 90, [CardName.VIRON]), pl('blue', 'Victor', 70, [CardName.HELION])], [
      corpFact('red', CardName.VIRON, {totalMeasuredValue: 8, actionActivations: 7, passiveTriggers: 0}),
    ], 20);
    const ins = generateInsights(c).find((i) => i.id === 'corp.engine.red');
    expect(ins, 'corp action engine insight').to.not.be.undefined;
    expect(ins!.family).to.eq('corporationImpact');
  });

  it('Merger (two corporations both contributing) → a merger insight, no single-corp engine', () => {
    const c = ctx([pl('red', 'Nastya', 95, [CardName.SATURN_SYSTEMS, CardName.HELION]), pl('blue', 'Victor', 70, [CardName.TERACTOR])], [
      corpFact('red', CardName.SATURN_SYSTEMS, {totalMeasuredValue: 16, passiveValue: 16}),
      corpFact('red', CardName.HELION, {totalMeasuredValue: 12, passiveValue: 12}),
    ], 25);
    const out = ids(c);
    expect(out).to.include('corp.merger.red');
    expect(out).to.not.include('corp.engine.red');
  });

  it('an unused corporate action surfaces ONLY for a non-winner who lost closely', () => {
    const close = ctx([pl('red', 'Nastya', 80, [CardName.SATURN_SYSTEMS]), pl('blue', 'Victor', 74, [CardName.VIRON])], [
      corpFact('blue', CardName.VIRON, {totalMeasuredValue: 0, actionActivations: 0, hasAction: 1}),
    ], 6);
    expect(ids(close)).to.include('corp.underused.blue');

    // A blowout (margin > 10) does NOT shame the loser's unused corporation.
    const blowout = ctx([pl('red', 'Nastya', 110, [CardName.SATURN_SYSTEMS]), pl('blue', 'Victor', 60, [CardName.VIRON])], [
      corpFact('blue', CardName.VIRON, {totalMeasuredValue: 0, actionActivations: 0, hasAction: 1}),
    ], 50);
    expect(ids(blowout)).to.not.include('corp.underused.blue');
  });

  it('a colony corporation engine dedups with the generic colony card (shared evidenceKey)', () => {
    const c = ctx([pl('red', 'Nastya', 90, [CardName.POSEIDON]), pl('blue', 'Victor', 70, [CardName.TERACTOR])], [
      corpFact('red', CardName.POSEIDON, {totalMeasuredValue: 20, passiveValue: 20, passiveTriggers: 8}),
    ], 20);
    const cand = buildInsightCandidates(c).find((i) => i.id === 'corp.engine.red');
    expect(cand, 'Poseidon corp candidate').to.not.be.undefined;
    expect(cand!.evidenceKey).to.eq('colony');
  });

  it('no facts (old game / facts not fetched) → no corporation insights (graceful)', () => {
    const c = ctx([pl('red', 'Nastya', 80, [CardName.SATURN_SYSTEMS]), pl('blue', 'Victor', 70, [CardName.HELION])], undefined, 10);
    expect(ids(c).some((id) => id.startsWith('corp.'))).to.eq(false);
  });
});
