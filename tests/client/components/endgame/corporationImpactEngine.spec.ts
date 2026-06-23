import {expect} from 'chai';
import {buildCorporationImpacts, buildCorporationAudit, CorporationImpact} from '@/client/components/endgame/corporationImpactEngine';
import type {InsightContext} from '@/client/components/endgame/insightEngine';
import type {EndgamePlayerScore, EndgameCategoryKey} from '@/client/components/endgame/endgameModel';
import {EndgameFact} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';

// Iteration 17 — the per-corporation impact engine. ALWAYS one readout per in-scope corp
// (§5), tiered + placed by how fully the corporation was realised (§7/§8/§19/§20).

const ZERO_CATS: Record<EndgameCategoryKey, number> = {tr: 0, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0};

function pl(color: Color, name: string, total: number, corporations: ReadonlyArray<string>,
  opts: {isWinner?: boolean; megacredits?: number; categories?: Partial<Record<EndgameCategoryKey, number>>} = {}): EndgamePlayerScore {
  return {
    color, name, total, isWinner: opts.isWinner ?? false, place: 1, megacredits: opts.megacredits ?? 0, corporations,
    vpByGeneration: [], categories: {...ZERO_CATS, ...(opts.categories ?? {})}, topCards: [], penaltyCards: [],
    globalSteps: {}, parametersTotal: 0, strongestCategory: undefined,
    breakdown: {total, detailsAwards: [], detailsMilestones: []} as any,
  } as unknown as EndgamePlayerScore;
}

function corpFact(player: Color, corp: CardName, metrics: Record<string, number>): EndgameFact {
  return {id: `corporation:${player}:${corp}`, type: 'corporationImpact', player, sourceCard: corp,
    severity: 0.5, confidence: 'partial', metrics, relatedEventIds: [], tags: ['economy', 'timeline']};
}

function mk(players: Array<EndgamePlayerScore>, facts: Array<EndgameFact> | undefined, margin?: number, generation = 11): InsightContext {
  players[0].isWinner = true;
  const runnerUp = players[1];
  return {
    mode: players.length === 2 ? 'duel' : 'standings', generation, players, winner: players[0], runnerUp,
    margin: margin ?? (runnerUp !== undefined ? players[0].total - runnerUp.total : 0),
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1, facts,
  };
}

function impactFor(ctx: InsightContext, color: Color): CorporationImpact | undefined {
  return buildCorporationImpacts(ctx).find((i) => i.color === color);
}

describe('corporationImpactEngine (Iteration 17)', () => {
  it('ALWAYS returns one readout per in-scope corp, even with no measured fact (§5)', () => {
    const ctx = mk([pl('red', 'Nastya', 80, [CardName.HELION]), pl('blue', 'Victor', 70, [CardName.ECOLINE])], []);
    const impacts = buildCorporationImpacts(ctx);
    expect(impacts).to.have.length(2);
    for (const i of impacts) {
      expect(i.playerProfileSummary.key, 'summary key non-empty').to.be.a('string').and.not.eq('');
      expect(i.metrics.length, 'never an empty metric list').to.be.greaterThan(0);
      expect(i.achievements, 'no achievement when nothing measurable').to.have.length(0);
      expect(i.placement).to.eq('player_profile_only');
    }
  });

  it('a high-use corporate action reaches a main section as a platinum (§6/§9)', () => {
    const ctx = mk([pl('red', 'Nastya', 95, [CardName.VIRON], {isWinner: true}), pl('blue', 'V', 70, [CardName.HELION])],
      [corpFact('red', CardName.VIRON, {actionActivations: 10, totalMeasuredValue: 16, actionResources: 6})], 25);
    const i = impactFor(ctx, 'red')!;
    expect(i.achievements.some((a) => a.tier === 'platinum'), 'platinum action achievement').to.eq(true);
    expect(['why_winner_won', 'what_defined_game']).to.include(i.placement);
  });

  it('a moderately-used action is an unusual episode (gold), not decisive', () => {
    const ctx = mk([pl('red', 'Nastya', 90, [CardName.FACTORUM], {isWinner: true}), pl('blue', 'V', 70, [CardName.HELION])],
      [corpFact('red', CardName.FACTORUM, {actionActivations: 8, totalMeasuredValue: 12})], 20);
    const i = impactFor(ctx, 'red')!;
    expect(i.achievements.some((a) => a.tier === 'gold')).to.eq(true);
    expect(i.placement).to.eq('unusual_episode');
  });

  it('a passive city engine that triggered a lot earns an achievement (§13 Tharsis)', () => {
    const ctx = mk([pl('red', 'Nastya', 92, [CardName.THARSIS_REPUBLIC], {isWinner: true, categories: {board: 24}}), pl('blue', 'V', 70, [CardName.HELION])],
      [corpFact('red', CardName.THARSIS_REPUBLIC, {passiveTriggers: 13, passiveSaved: 10, totalMeasuredValue: 20})], 22);
    const i = impactFor(ctx, 'red')!;
    expect(i.achievements.length, 'an achievement fired').to.be.greaterThan(0);
    expect(['additional_observation', 'unusual_episode']).to.include(i.placement);
    expect(i.ruleStatus).to.eq('specific');
  });

  it('a dominant resource engine (Celestic) can reach what-defined as a signature (§6/§7)', () => {
    const ctx = mk([pl('red', 'Nastya', 100, [CardName.CELESTIC], {isWinner: true}), pl('blue', 'V', 72, [CardName.HELION])],
      [corpFact('red', CardName.CELESTIC, {passiveCardResources: 38, totalMeasuredValue: 30})], 28);
    const i = impactFor(ctx, 'red')!;
    expect(i.efficiencyTier).to.eq('signature');
    expect(i.placement).to.eq('what_defined_game');
  });

  it('an opening burst WITHOUT conversion is not decisive (§8 — Credicor)', () => {
    const ctx = mk([pl('red', 'Nastya', 95, [CardName.SATURN_SYSTEMS], {isWinner: true}), pl('blue', 'Victor', 60, [CardName.CREDICOR])],
      [corpFact('blue', CardName.CREDICOR, {earlyValue: 20, passiveSaved: 0})], 35);
    const i = impactFor(ctx, 'blue')!;
    expect(i.realized).to.eq('start');
    expect(['missed', 'minor', 'solid']).to.include(i.efficiencyTier);
    expect(i.placement).to.not.be.oneOf(['why_winner_won', 'what_defined_game']);
  });

  it('anti-overclaim: a winner with a low corp impact stays in the profile (§19)', () => {
    const ctx = mk([pl('red', 'Nastya', 90, [CardName.MINING_GUILD], {isWinner: true}), pl('blue', 'V', 78, [CardName.HELION])],
      [corpFact('red', CardName.MINING_GUILD, {totalMeasuredValue: 6, passiveSaved: 0, passiveProduction: 2})], 12);
    const i = impactFor(ctx, 'red')!;
    expect(i.placement).to.eq('player_profile_only');
  });

  it('a loser with a strong corp but no win is an observation, never why-winner-won (§20)', () => {
    const ctx = mk([pl('red', 'Nastya', 95, [CardName.HELION], {isWinner: true}), pl('blue', 'Victor', 70, [CardName.SATURN_SYSTEMS], {categories: {cards: 16}})],
      [corpFact('blue', CardName.SATURN_SYSTEMS, {totalMeasuredValue: 28, passiveTriggers: 0})], 25);
    const i = impactFor(ctx, 'blue')!;
    expect(i.placement).to.not.be.oneOf(['why_winner_won', 'what_defined_game']);
    expect(['additional_observation', 'unusual_episode', 'player_profile_only']).to.include(i.placement);
  });

  it('an unfired corporate action surfaces ONLY for a close loser (§7 underused)', () => {
    const close = mk([pl('red', 'Nastya', 80, [CardName.HELION], {isWinner: true}), pl('blue', 'Victor', 74, [CardName.VIRON])],
      [corpFact('blue', CardName.VIRON, {actionActivations: 0, hasAction: 1, totalMeasuredValue: 0})], 6);
    const ci = impactFor(close, 'blue')!;
    expect(ci.realized).to.eq('underused');
    expect(ci.placement).to.eq('additional_observation');

    const blowout = mk([pl('red', 'Nastya', 120, [CardName.HELION], {isWinner: true}), pl('blue', 'Victor', 60, [CardName.VIRON])],
      [corpFact('blue', CardName.VIRON, {actionActivations: 0, hasAction: 1, totalMeasuredValue: 0})], 60);
    expect(impactFor(blowout, 'blue')!.placement).to.eq('player_profile_only');
  });

  it('Merger with both corps contributing is the rare high-priority case (§9)', () => {
    const ctx = mk([pl('red', 'Nastya', 100, [CardName.SATURN_SYSTEMS, CardName.HELION], {isWinner: true}), pl('blue', 'V', 70, [CardName.ECOLINE])],
      [corpFact('red', CardName.SATURN_SYSTEMS, {totalMeasuredValue: 16}), corpFact('red', CardName.HELION, {totalMeasuredValue: 12})], 30);
    const i = impactFor(ctx, 'red')!;
    expect(i.realized).to.eq('merged');
    expect(i.mergedWith).to.eq(CardName.HELION);
    expect(i.achievements.some((a) => a.tier === 'platinum')).to.eq(true);
    expect(['why_winner_won', 'what_defined_game']).to.include(i.placement);
  });

  it('an out-of-scope corporation is never above an observation, and suppress with no data (§12)', () => {
    const withData = mk([pl('red', 'Nastya', 90, [CardName.LAKEFRONT_RESORTS], {isWinner: true}), pl('blue', 'V', 70, [CardName.HELION])],
      [corpFact('red', CardName.LAKEFRONT_RESORTS, {totalMeasuredValue: 25})], 20);
    const wi = impactFor(withData, 'red')!;
    expect(wi.ruleStatus).to.eq('missing');
    expect(wi.placement).to.eq('additional_observation');

    const noData = mk([pl('red', 'Nastya', 90, [CardName.LAKEFRONT_RESORTS], {isWinner: true}), pl('blue', 'V', 70, [CardName.HELION])], []);
    expect(impactFor(noData, 'red')!.placement).to.eq('suppress');
  });

  it('every spec §22 marquee corporation yields a valid readout', () => {
    const marquee = [
      CardName.ECOLINE, CardName.THARSIS_REPUBLIC, CardName.CREDICOR, CardName.SATURN_SYSTEMS,
      CardName.HELION, CardName.MINING_GUILD, CardName.POINT_LUNA, CardName.POSEIDON,
      CardName.CELESTIC, CardName.FACTORUM, CardName.STORMCRAFT_INCORPORATED,
    ];
    for (const corp of marquee) {
      const ctx = mk([pl('red', 'N', 80, [corp], {isWinner: true}), pl('blue', 'V', 70, [CardName.HELION])],
        [corpFact('red', corp, {totalMeasuredValue: 14, passiveTriggers: 6, actionActivations: 4, passiveCardResources: 8})], 10);
      const i = impactFor(ctx, 'red')!;
      expect(i.corporationName, `${corp} readout`).to.eq(corp);
      expect(i.playerProfileSummary.key, `${corp} summary`).to.be.a('string').and.not.eq('');
      expect(['missed', 'minor', 'solid', 'strong', 'exceptional', 'signature']).to.include(i.efficiencyTier);
    }
  });
});

describe('corporation audit (Iteration 17 §2)', () => {
  it('every registered (in-scope) corporation has a specific or generic rule, none missing', () => {
    const audit = buildCorporationAudit();
    expect(audit.length, 'covers the whole registry').to.be.greaterThan(30);
    for (const e of audit) {
      expect(e.includedInCurrentScope).to.eq(true);
      expect(['specific', 'generic']).to.include(e.ruleStatus);
    }
  });

  it('Turmoil / out-of-scope corporations are NOT in the required coverage', () => {
    const names = buildCorporationAudit().map((e) => e.corporationName);
    expect(names).to.not.include(CardName.LAKEFRONT_RESORTS);
    expect(names).to.not.include(CardName.SEPTUM_TRIBUS);
  });

  it('the marquee corporations with bespoke logic are tagged specific', () => {
    const audit = buildCorporationAudit();
    const specific = new Set(audit.filter((e) => e.ruleStatus === 'specific').map((e) => e.corporationName));
    for (const corp of [CardName.ECOLINE, CardName.THARSIS_REPUBLIC, CardName.CREDICOR, CardName.SATURN_SYSTEMS, CardName.POSEIDON, CardName.POINT_LUNA, CardName.VITOR]) {
      expect(specific.has(corp), `${corp} specific`).to.eq(true);
    }
  });
});
