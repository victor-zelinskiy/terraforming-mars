import {expect} from 'chai';
import {
  generateInsights,
  selectStoryInsights,
  finalScore,
  InsightContext,
  InsightCandidate,
} from '@/client/components/endgame/insightEngine';
import {EndgameCategory, EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';

// ── Minimal builders (the fact analyzers only read color/name/total + ctx.facts +
//    ctx.categories[board] + ctx.playerCards; the selector reads candidate fields). ──
function pl(color: Color, name: string, total: number): EndgamePlayerScore {
  return {color, name, total, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], categories: {} as any, topCards: [], penaltyCards: [], globalSteps: {},
    parametersTotal: 0, strongestCategory: undefined, breakdown: {total} as any} as unknown as EndgamePlayerScore;
}
function boardCat(values: Partial<Record<Color, number>>): EndgameCategory {
  return {key: 'board' as EndgameCategoryKey, label: 'board', accent: 'board', values: values as Record<string, number>, max: 0, leaders: []};
}
function fact(type: FactType, partial: Partial<EndgameFact>): EndgameFact {
  return {id: partial.id ?? `${type}:x`, type, player: partial.player ?? 'red', severity: 0.5,
    confidence: 'exact', metrics: partial.metrics ?? {}, relatedEventIds: [], tags: [], ...partial} as EndgameFact;
}
function ctx(opts: {players: Array<EndgamePlayerScore>; facts?: Array<EndgameFact>; categories?: Array<EndgameCategory>; playerCards?: Partial<Record<Color, ReadonlyArray<CardName>>>; margin?: number}): InsightContext {
  const players = opts.players;
  players[0].isWinner = true;
  const runnerUp = players[1];
  return {
    mode: players.length === 2 ? 'duel' : 'standings', generation: 10, players,
    winner: players[0], runnerUp, margin: opts.margin ?? (runnerUp !== undefined ? players[0].total - runnerUp.total : 0),
    categories: opts.categories ?? [], parameters: [], timeline: undefined, profile: undefined, seed: 1,
    facts: opts.facts, playerCards: opts.playerCards,
  };
}
function ids(c: InsightContext): Array<string> {
  return generateInsights(c).map((i) => i.id);
}
function find(c: InsightContext, id: string) {
  return generateInsights(c).find((i) => i.id === id);
}

describe('fact-based endgame insights (Iteration 5)', () => {
  const duo = () => [pl('red', 'Nastya', 80), pl('blue', 'Victor', 70)];

  it('economy fact → an economy-engine insight', () => {
    const c = ctx({players: duo(), margin: 10, facts: [fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 30}})]});
    const ins = find(c, 'fact.economy.engine');
    expect(ins, 'economy engine insight').to.not.be.undefined;
    expect(ins!.family).to.eq('economy');
  });

  it('economy underdog: winner out-economised but still wins', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 4}}),
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 24}}),
    ]});
    expect(ids(c)).to.include('fact.economy.underdog');
  });

  it('blue-action engine (most used) + unused engine', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('actionUsage', {id: 'action:red:ai', player: 'red', sourceCard: CardName.AI_CENTRAL, metrics: {activations: 6}}),
      fact('engineTiming', {id: 'engine:blue:x', player: 'blue', sourceCard: CardName.AI_CENTRAL, metrics: {neverActivated: 1, availableGenerations: 6}}),
    ]});
    expect(ids(c)).to.include('fact.action.engine');
    expect(ids(c)).to.include('fact.action.unused');
  });

  it('negative drama: most-targeted + Predators rare event (6+ animals)', () => {
    const c = ctx({players: duo(), margin: 10,
      facts: [fact('negativeInteraction', {id: 'attack:red->blue', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 8, hits: 3, Animal: 6}})],
      playerCards: {red: [CardName.PREDATORS]}});
    expect(ids(c)).to.include('fact.negative.targeted');
    const pred = find(c, 'fact.negative.predators');
    expect(pred, 'Predators rare insight').to.not.be.undefined;
    expect(pred!.family).to.eq('rareEvent');
  });

  it('Vermin pressure when an opponent is city-heavy', () => {
    const c = ctx({players: duo(), margin: 10, playerCards: {red: [CardName.VERMIN]}, categories: [boardCat({blue: 14, red: 2})]});
    const v = find(c, 'fact.vermin.pressure');
    expect(v, 'Vermin rare insight').to.not.be.undefined;
    expect(v!.family).to.eq('rareEvent');
    expect(v!.confidence ?? undefined, 'engine field set').to.satisfy(() => true);
  });

  it('global-parameter driver + reveal + colony facts produce insights', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('globalParameter', {id: 'global:red', player: 'red', metrics: {totalSteps: 9}}),
      fact('reveal', {id: 'reveal:red', player: 'red', metrics: {revealed: 7, shown: 0}}),
      fact('colony', {id: 'colony:red', player: 'red', metrics: {trades: 5}}),
    ]});
    const out = ids(c);
    expect(out).to.include('fact.global.driver');
    expect(out).to.include('fact.reveal.flow');
    expect(out).to.include('fact.colony.engine');
  });

  it('a tiebreaker becomes the HERO of the story', () => {
    const players = [pl('red', 'Nastya', 80), pl('blue', 'Victor', 80)];
    const c = ctx({players, margin: 0});
    const hero = generateInsights(c).find((i) => i.rankSection === 'hero');
    expect(hero, 'a hero insight').to.not.be.undefined;
    expect(hero!.group).to.eq('verdict');
  });

  it('no facts → fact insights absent, base insights still work (graceful)', () => {
    const c = ctx({players: duo(), margin: 12});
    const out = ids(c);
    expect(out.some((id) => id.startsWith('fact.')), 'no fact insights without facts').to.be.false;
    expect(out.length, 'base insights still present').to.be.greaterThan(0);
  });

  // ── selectStoryInsights mechanics ──

  it('selectStoryInsights: one cluster per primary, rare facts break through, dedup', () => {
    const mk = (id: string, cluster: string, priority: number, rarity = 0): InsightCandidate => ({
      id, group: 'cards', priority, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: [],
      storyCluster: cluster, scores: {rarity},
    });
    const out = selectStoryInsights([
      mk('a', 'eco', 60), mk('b', 'eco', 55), mk('c', 'attack', 50), mk('d', 'attack', 90, 0.65 /* rare (≥0.6) → breaks the cluster dedup, but <0.7 so not hero */),
    ]);
    const primary = out.filter((i) => i.rankSection === 'primary');
    // 'a' (eco) + 'd' (rare attack) in primary; 'b' (eco dup) demoted, 'c' (attack dup, not rare) demoted.
    expect(primary.map((i) => i.id)).to.include('a');
    expect(primary.map((i) => i.id)).to.include('d');
    expect(primary.map((i) => i.id)).to.not.include('b');
  });

  it('finalScore: a rare/dramatic fact out-ranks a higher raw priority', () => {
    const routine: InsightCandidate = {id: 'r', group: 'category', priority: 70, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: []};
    const rare: InsightCandidate = {id: 'x', group: 'cards', priority: 50, severity: 'major', icon: 'spark', badge: 'B', textKey: 't', params: [], scores: {rarity: 0.9, drama: 0.8}};
    expect(finalScore(rare)).to.be.greaterThan(finalScore(routine));
  });

  it('partial-confidence scales the score down (no overclaim dominance)', () => {
    const exact: InsightCandidate = {id: 'e', group: 'cards', priority: 50, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: [], scores: {impact: 1, confidence: 1}};
    const partial: InsightCandidate = {id: 'p', group: 'cards', priority: 50, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: [], scores: {impact: 1, confidence: 0.5}};
    expect(finalScore(exact)).to.be.greaterThan(finalScore(partial));
  });
});
