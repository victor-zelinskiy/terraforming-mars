import {expect} from 'chai';
import {
  buildStrategyProfiles, strategyStyleLabel, strategyLabel, ARCHETYPE_LABEL, StrategyInput,
} from '@/client/components/endgame/strategyArchetypes';
import {InsightContext} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {CardVpBySource, CardVpSource, CARD_VP_SOURCES} from '@/client/components/endgame/cardScoreContribution';
import {Tag} from '@/common/cards/Tag';
import {Color} from '@/common/Color';

function cardVp(partial: Partial<Record<CardVpSource, number>>): CardVpBySource {
  const base = {} as Record<CardVpSource, number>;
  for (const s of CARD_VP_SOURCES) {
    base[s] = partial[s] ?? 0;
  }
  const total = CARD_VP_SOURCES.filter((s) => s !== 'other').reduce((sum, s) => sum + Math.max(0, base[s]), 0);
  return {...base, total, penalties: 0, confidence: 'high'};
}
function si(partial: Partial<StrategyInput>): StrategyInput {
  return {
    tags: partial.tags ?? {},
    coloniesOwned: partial.coloniesOwned ?? [],
    cardVp: partial.cardVp ?? cardVp({}),
    resourceTotals: partial.resourceTotals ?? {animals: 0, microbes: 0, floaters: 0, animalCards: 0, microbeCards: 0, floaterCards: 0},
  };
}
function pl(color: Color, total: number, opts: {
  cards?: number; board?: number; tr?: number; mca?: number;
  globalSteps?: Partial<Record<string, number>>; titaniumProd?: number; strategyInput?: StrategyInput;
} = {}): EndgamePlayerScore {
  return {
    color, name: color, total, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], topCards: [], penaltyCards: [], parametersTotal: 0,
    categories: {tr: opts.tr ?? 20, cards: opts.cards ?? 0, board: opts.board ?? 0, mca: opts.mca ?? 0, moon: 0, tracks: 0} as any,
    globalSteps: (opts.globalSteps ?? {}) as any,
    production: {megacredits: 0, steel: 0, titanium: opts.titaniumProd ?? 0, plants: 0, energy: 0, heat: 0},
    breakdown: {total} as any, strategyInput: opts.strategyInput,
  } as unknown as EndgamePlayerScore;
}
function fact(type: FactType, player: Color, metrics: Record<string, number>): EndgameFact {
  return {id: `${type}:${player}`, type, player, severity: 0.5, confidence: 'exact', metrics, relatedEventIds: [], tags: []} as EndgameFact;
}
function ctx(players: Array<EndgamePlayerScore>, facts: Array<EndgameFact> = [], margin = 10): InsightContext {
  players[0].isWinner = true;
  return {
    mode: players.length === 2 ? 'duel' : 'standings', generation: 10, players,
    winner: players[0], runnerUp: players[1], margin,
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1, facts,
  } as InsightContext;
}

describe('strategyArchetypes (rework §4–§20)', () => {
  it('every archetype has a label', () => {
    expect(Object.keys(ARCHETYPE_LABEL).length).to.eq(14);
  });

  it('detects ANIMALS as the primary line when animals scored real points', () => {
    const w = pl('red', 90, {cards: 30, strategyInput: si({cardVp: cardVp({animal: 14}), resourceTotals: {animals: 16, microbes: 0, floaters: 0, animalCards: 3, microbeCards: 0, floaterCards: 0}})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    expect(profiles.red?.primary?.archetype).to.eq('animals');
    expect(profiles.red?.primary?.isScoring).to.be.true;
    expect(profiles.red?.primary?.vpContribution).to.eq(14);
  });

  it('detects JOVIAN from VP + tags', () => {
    const w = pl('red', 95, {cards: 28, strategyInput: si({cardVp: cardVp({jovian: 12}), tags: {[Tag.JOVIAN]: 6}})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    expect(profiles.red?.primary?.archetype).to.eq('jovian');
  });

  it('does NOT call a 2-VP animal stash a strategy (§5 — contribution, not presence)', () => {
    const w = pl('red', 88, {strategyInput: si({cardVp: cardVp({animal: 2}), resourceTotals: {animals: 2, microbes: 0, floaters: 0, animalCards: 1, microbeCards: 0, floaterCards: 0}})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    const archetypes = (profiles.red?.all ?? []).map((d) => d.archetype);
    expect(archetypes).to.not.include('animals');
  });

  it('detects COLONY TRADE from the colony fact (a support line)', () => {
    const w = pl('red', 90, {strategyInput: si({})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)], [fact('colony', 'red', {trades: 7, trackBonusSteps: 3})]));
    const colony = (profiles.red?.all ?? []).find((d) => d.archetype === 'colonyTrade');
    expect(colony, 'colony trade detected').to.not.be.undefined;
    expect(colony!.isScoring, 'a support line, not a direct scorer').to.be.false;
  });

  it('detects GLOBAL PARAMETERS from steps + TR', () => {
    const w = pl('red', 92, {tr: 42, globalSteps: {temperature: 8, oxygen: 6, oceans: 4}, strategyInput: si({})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    const gp = (profiles.red?.all ?? []).find((d) => d.archetype === 'globalParams');
    expect(gp, 'global params detected').to.not.be.undefined;
  });

  it('strategyStyleLabel returns the primary archetype label (replaces duelStyle)', () => {
    const w = pl('red', 90, {cards: 30, strategyInput: si({cardVp: cardVp({animal: 14})})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    expect(strategyStyleLabel(profiles.red)).to.eq(strategyLabel('animals'));
    expect(strategyStyleLabel(undefined)).to.eq('Balanced');
  });

  it('a player with no strategyInput yields no profile (graceful)', () => {
    const w = pl('red', 90); // no strategyInput
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    expect(profiles.red).to.be.undefined;
  });

  it('evidence chips carry real numbers + a localized unit label', () => {
    const w = pl('red', 90, {cards: 30, strategyInput: si({cardVp: cardVp({animal: 14}), resourceTotals: {animals: 16, microbes: 0, floaters: 0, animalCards: 3, microbeCards: 0, floaterCards: 0}})});
    const profiles = buildStrategyProfiles(ctx([w, pl('blue', 80)]));
    const chips = profiles.red?.primary?.evidence ?? [];
    expect(chips.some((c) => c.v === '+14' && c.label === 'VP'), 'a +14 VP chip').to.be.true;
    expect(chips.some((c) => c.v === '16' && c.label === 'Animals'), 'a 16 Animals chip').to.be.true;
  });
});
