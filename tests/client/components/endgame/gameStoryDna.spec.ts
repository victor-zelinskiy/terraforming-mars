import {expect} from 'chai';
import {
  composeStory,
  buildStoryDebug,
  finalScore,
  InsightContext,
  InsightCandidate,
} from '@/client/components/endgame/insightEngine';
import {buildGameStoryDna, StoryType} from '@/client/components/endgame/gameStoryDna';
import {EndgameCategory, EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';

// ── Minimal builders (mirror factInsights.spec) ──
function pl(color: Color, name: string, total: number, opts: {
  megacredits?: number; strongestCategory?: EndgameCategoryKey; parametersTotal?: number;
  categories?: Partial<Record<EndgameCategoryKey, number>>; vpByGeneration?: Array<number>;
} = {}): EndgamePlayerScore {
  return {color, name, total, isWinner: false, place: 1, megacredits: opts.megacredits ?? 0, corporations: [],
    vpByGeneration: opts.vpByGeneration ?? [], categories: (opts.categories ?? {}) as Record<EndgameCategoryKey, number>,
    topCards: [], penaltyCards: [], globalSteps: {}, parametersTotal: opts.parametersTotal ?? 0,
    strongestCategory: opts.strongestCategory,
    breakdown: {total, detailsAwards: [], detailsMilestones: []} as any} as unknown as EndgamePlayerScore;
}
function fact(type: FactType, partial: Partial<EndgameFact>): EndgameFact {
  return {id: partial.id ?? `${type}:x`, type, player: partial.player ?? 'red', severity: 0.5,
    confidence: 'exact', metrics: partial.metrics ?? {}, relatedEventIds: [], tags: [], ...partial} as EndgameFact;
}
function cat(key: EndgameCategoryKey, values: Partial<Record<Color, number>>): EndgameCategory {
  return {key, label: key, accent: key, values: values as Record<string, number>, max: 0, leaders: []};
}
function ctx(opts: {players: Array<EndgamePlayerScore>; facts?: Array<EndgameFact>; categories?: Array<EndgameCategory>;
  margin?: number; mode?: 'duel' | 'standings' | 'solo'; timeline?: any} = {players: []}): InsightContext {
  const players = opts.players;
  players[0].isWinner = true;
  const runnerUp = players[1];
  return {
    mode: opts.mode ?? (players.length === 2 ? 'duel' : 'standings'), generation: 10, players,
    winner: players[0], runnerUp, margin: opts.margin ?? (runnerUp !== undefined ? players[0].total - runnerUp.total : 0),
    categories: opts.categories ?? [], parameters: [], timeline: opts.timeline, profile: undefined, seed: 1,
    facts: opts.facts,
  };
}
// A synthetic candidate (only the fields the DNA detectors read).
function cand(id: string, partial: Partial<InsightCandidate> = {}): InsightCandidate {
  return {id, group: 'reason', priority: 50, severity: 'normal', icon: 'spark', badge: id, textKey: id, params: [],
    finalScore: partial.priority ?? 50, ...partial} as InsightCandidate;
}
const duo = () => [pl('red', 'Nastya', 80), pl('blue', 'Victor', 70)];
function storyType(c: InsightContext): StoryType {
  return composeStory(c).dna.storyType;
}

describe('Game Story DNA (Iteration 9) — storyType detection', () => {
  it('photo finish on a razor-thin margin', () => {
    const dna = buildGameStoryDna(ctx({players: duo(), margin: 2}), []);
    expect(dna.storyType).to.eq('photo_finish');
  });

  it('photo finish (tiebreaker) on a zero margin', () => {
    const players = [pl('red', 'A', 80), pl('blue', 'B', 80)];
    const dna = buildGameStoryDna(ctx({players, margin: 0}), []);
    expect(dna.storyType).to.eq('photo_finish');
  });

  it('award betrayal beats a duel style contrast (more special wins)', () => {
    const cands = [cand('duel.styleContrast', {storyCluster: 'duelContrast', family: 'duelContrast'}),
      cand('duel.award.sponsorLost', {storyCluster: 'awardRace', family: 'duelContrast', priority: 76})];
    const dna = buildGameStoryDna(ctx({players: duo(), margin: 10}), cands);
    expect(dna.storyType).to.eq('award_betrayal');
    // The losing detector is recorded in debug (transparency).
    expect(dna.debug.rejectedStoryTypes.some((r) => r.type === 'duel_styles')).to.be.true;
  });

  it('rare-card drama from a predators cluster', () => {
    const cands = [cand('special.predators', {storyCluster: 'predators', family: 'rareEvent', scores: {rarity: 0.8}})];
    const dna = buildGameStoryDna(ctx({players: duo(), margin: 10}), cands);
    expect(dna.storyType).to.eq('rare_card_drama');
    expect(dna.recommendedHeroCluster).to.eq('predators');
    expect(dna.rarityScore).to.be.greaterThan(0.7);
  });

  it('economy upset from the economyUpset cluster', () => {
    const cands = [cand('duel.economyConversion', {storyCluster: 'economyUpset', family: 'duelContrast', scores: {rarity: 0.6}})];
    const dna = buildGameStoryDna(ctx({players: duo(), margin: 8}), cands);
    expect(dna.storyType).to.eq('economy_upset');
  });

  it('duel of styles when only the style contrast is present (margin too wide for photo finish)', () => {
    const cands = [cand('duel.styleContrast', {storyCluster: 'duelContrast', family: 'duelContrast'})];
    const dna = buildGameStoryDna(ctx({players: duo(), margin: 14}), cands);
    expect(dna.storyType).to.eq('duel_styles');
    expect(dna.mainConflict, 'duel conflict named').to.not.be.undefined;
    expect(dna.mainConflict!.leftPlayer).to.eq('red');
    expect(dna.mainConflict!.rightPlayer).to.eq('blue');
  });

  it('runaway on a commanding margin', () => {
    const players = [pl('red', 'A', 110), pl('blue', 'B', 70)];
    const dna = buildGameStoryDna(ctx({players, margin: 40}), []);
    expect(dna.storyType).to.eq('runaway');
  });

  it('balanced_control fallback for a quiet game (no signal)', () => {
    const dna = buildGameStoryDna(ctx({players: [pl('red', 'A', 80), pl('blue', 'B', 65)], margin: 15}), []);
    expect(dna.storyType).to.eq('balanced_control');
    expect(dna.uniquenessScore).to.be.lessThan(0.5);
    expect(dna.suppressedGenericThemes, 'a quiet game suppresses no generics').to.have.length(0);
  });

  it('recommended hero cluster always resolves to a present cluster', () => {
    const cands = [cand('x', {storyCluster: 'turningPoint', family: 'turningPoint', scores: {drama: 0.9}})];
    const dna = buildGameStoryDna(ctx({players: duo(), margin: 10}), cands);
    expect([...new Set(cands.map((c) => c.storyCluster))]).to.include(dna.recommendedHeroCluster);
  });
});

describe('Narrative composer (Iteration 9)', () => {
  it('the hero matches the story DNA hero cluster (economy upset)', () => {
    // duel economy conversion: runner-up richer, winner more efficient.
    const c = ctx({players: duo(), margin: 8, facts: [
      fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 6}}),
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 26}}),
    ]});
    const {dna, insights} = composeStory(c);
    expect(dna.storyType).to.eq('economy_upset');
    const hero = insights.find((i) => i.rankSection === 'hero');
    expect(hero, 'a hero was chosen').to.not.be.undefined;
    expect(hero!.storyCluster).to.eq(dna.recommendedHeroCluster);
    expect(hero!.storyRole).to.eq('headline');
  });

  it('penalizes off-story generic themes on a strong story', () => {
    const c = ctx({players: duo(), margin: 8, facts: [
      fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 6}}),
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 26}}),
    ]});
    const {dna, candidates} = buildStoryDebug(c);
    expect(dna.suppressedGenericThemes).to.include('verdict');
    expect(dna.suppressedGenericThemes).to.not.include(dna.recommendedHeroCluster);
    const verdict = candidates.find((x) => (x.storyCluster ?? x.family) === 'verdict');
    if (verdict !== undefined) {
      expect(verdict.storyBoost ?? 0, 'a generic verdict line is pushed down').to.be.lessThan(0);
    }
  });

  it('assigns story roles to the selected insights', () => {
    const c = ctx({players: duo(), margin: 8, facts: [
      fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 6}}),
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 26}}),
    ]});
    const {insights} = composeStory(c);
    expect(insights.every((i) => i.storyRole !== undefined), 'every insight has a role').to.be.true;
  });

  it('solo → no story, no error', () => {
    const {dna, insights} = composeStory(ctx({players: [pl('red', 'A', 60)], mode: 'solo'}));
    expect(insights).to.have.length(0);
    expect(dna.storyType).to.eq('balanced_control');
  });
});

describe('Cross-fact analyzers (Iteration 9)', () => {
  it('A · economy that did not convert (tempo, not points)', () => {
    const players = duo();
    (players[1].categories as any).cards = 3; // runner-up: low card scoring
    const c = ctx({players, margin: 6, facts: [
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 26}}),
    ]});
    expect(composeStory(c).insights.map((i) => i.id)).to.include('xfact.econConv.blue');
  });

  it('B · card flow fed the winning card engine', () => {
    const players = duo();
    (players[0].categories as any).cards = 18;
    const c = ctx({players, margin: 10, facts: [
      fact('reveal', {id: 'reveal:red', player: 'red', metrics: {revealed: 5, shown: 4}}),
    ]});
    expect(composeStory(c).insights.map((i) => i.id)).to.include('xfact.cardFlow.fed.red');
  });

  it('C · moved the planet but lost', () => {
    const players = [pl('red', 'A', 90, {parametersTotal: 4}), pl('blue', 'B', 80, {parametersTotal: 14})];
    const c = ctx({players, margin: 10});
    expect(composeStory(c).insights.map((i) => i.id)).to.include('xfact.globalMismatch.blue');
  });

  it('D · the attack hit a board-heavy victim\'s plan', () => {
    const players = [pl('red', 'A', 90), pl('blue', 'B', 80, {strongestCategory: 'board'})];
    const c = ctx({players, margin: 10, facts: [
      fact('negativeInteraction', {id: 'neg:red', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 9, plants: 9}}),
    ]});
    expect(composeStory(c).insights.map((i) => i.id)).to.include('xfact.attackDamage.blue');
  });

  it('E · standard projects as plan B (low card scoring)', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('standardProject', {id: 'standardProject:red', player: 'red', metrics: {projects: 6}}),
    ]});
    expect(composeStory(c).insights.map((i) => i.id)).to.include('xfact.projectStarvation.red');
  });
});

describe('Story quality guard (Iteration 9)', () => {
  // Each fixture should classify to a DISTINCT story type — the screen must not read
  // the same from game to game.
  const fixtures: Array<{name: string; build: () => InsightContext}> = [
    {name: 'photo finish', build: () => ctx({players: [pl('red', 'A', 81), pl('blue', 'B', 80)], margin: 1})},
    {name: 'runaway', build: () => ctx({players: [pl('red', 'A', 120), pl('blue', 'B', 75)], margin: 45})},
    {name: 'award betrayal', build: () => {
      const players = duo();
      players[1].breakdown = {total: 70, detailsMilestones: [], detailsAwards: [
        {message: 'a', messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 0},
      ]} as any;
      players[0].breakdown = {total: 80, detailsMilestones: [], detailsAwards: [
        {message: 'a', messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5},
      ]} as any;
      return ctx({players, margin: 10});
    }},
    {name: 'attack pressure', build: () => ctx({players: [pl('red', 'A', 90), pl('blue', 'B', 80, {strongestCategory: 'board'})], margin: 10, facts: [
      fact('negativeInteraction', {id: 'neg', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 12, plants: 12}}),
    ]})},
    {name: 'economy upset', build: () => ctx({players: duo(), margin: 8, facts: [
      fact('economy', {id: 'e:blue', player: 'blue', metrics: {savedMegacredits: 28}}),
      fact('economy', {id: 'e:red', player: 'red', metrics: {savedMegacredits: 5}}),
    ]})},
    {name: 'quiet', build: () => ctx({players: [pl('red', 'A', 80), pl('blue', 'B', 66)], margin: 14})},
  ];

  it('classifies the fixtures to mostly-distinct story types', () => {
    const types = fixtures.map((f) => storyType(f.build()));
    const distinct = new Set(types);
    expect(distinct.size, `story types: ${types.join(', ')}`).to.be.greaterThanOrEqual(5);
  });

  it('a rare event is never buried in the hidden band', () => {
    const c = fixtures.find((f) => f.name === 'attack pressure')!.build();
    const insights = composeStory(c).insights;
    // The attack STORY (by evidence key) must be visible — Iteration 10 dedups the two
    // "under fire" cards to one, so we assert the story, not a specific cluster.
    const attack = insights.find((i) => (i.evidenceKey ?? '').startsWith('attack:'));
    expect(attack, 'attack insight present').to.not.be.undefined;
    expect(attack!.rankSection, 'shown in hero/primary, not hidden').to.be.oneOf(['hero', 'primary', 'secondary']);
    // And the duplicate "under fire" telling is force-hidden — never two visible.
    const visibleAttacks = insights.filter((i) => (i.evidenceKey ?? '').startsWith('attack:') && i.rankSection !== 'hidden');
    expect(visibleAttacks.length, 'only one attack card visible (deduped)').to.eq(1);
  });

  it('a duel story names both players', () => {
    const c = fixtures.find((f) => f.name === 'economy upset')!.build();
    const dna = composeStory(c).dna;
    expect(dna.mainConflict).to.not.be.undefined;
    expect([dna.mainConflict!.leftPlayer, dna.mainConflict!.rightPlayer]).to.have.members(['red', 'blue']);
  });

  it('a quiet game still produces graceful output with low uniqueness', () => {
    const c = fixtures.find((f) => f.name === 'quiet')!.build();
    const {dna, insights} = composeStory(c);
    expect(dna.storyType).to.eq('balanced_control');
    expect(dna.uniquenessScore).to.be.lessThan(0.5);
    expect(insights.length, 'still tells something').to.be.greaterThan(0);
  });

  it('finalScore folds in the storyBoost (composer reward)', () => {
    const boosted = {...cand('x'), priority: 50, storyBoost: 16} as InsightCandidate;
    expect(finalScore(boosted)).to.eq(66);
  });
});
