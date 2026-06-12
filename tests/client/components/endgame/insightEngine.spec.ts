import {expect} from 'chai';
import {
  computeTimelineStats,
  buildVictoryProfile,
  selectInsights,
  generateInsights,
  gameSeed,
  InsightCandidate,
  InsightContext,
} from '@/client/components/endgame/insightEngine';
import {EndgameCategory, EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

function breakdown(partial: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  return {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0,
    victoryPoints: 0, total: 20,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [],
    negativeVP: 0,
    ...partial,
  };
}

function score(color: Color, name: string, opts: {
  total?: number;
  categories?: Partial<Record<EndgameCategoryKey, number>>;
  vpByGeneration?: Array<number>;
  parametersTotal?: number;
  topCards?: Array<{cardName: string; victoryPoint: number}>;
  penaltyCards?: Array<{cardName: string; victoryPoint: number}>;
} = {}): EndgamePlayerScore {
  const categories: Record<EndgameCategoryKey, number> =
    {tr: 20, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0, ...(opts.categories ?? {})};
  return {
    color,
    name,
    corporations: [],
    place: 1,
    isWinner: false,
    total: opts.total ?? 20,
    megacredits: 0,
    breakdown: breakdown({total: opts.total ?? 20}),
    vpByGeneration: opts.vpByGeneration ?? [],
    categories,
    topCards: (opts.topCards ?? []).map((c) => ({...c, kind: 'conditional' as const})),
    penaltyCards: (opts.penaltyCards ?? []).map((c) => ({...c, kind: 'penalty' as const})),
    globalSteps: {},
    parametersTotal: opts.parametersTotal ?? 0,
    strongestCategory: undefined,
  };
}

function category(key: EndgameCategoryKey, values: Partial<Record<Color, number>>): EndgameCategory {
  let max = 0;
  for (const v of Object.values(values)) {
    if (v !== undefined && v > max) {
      max = v;
    }
  }
  const leaders: Array<Color> = [];
  if (max > 0) {
    for (const [color, v] of Object.entries(values)) {
      if (v === max) {
        leaders.push(color as Color);
      }
    }
  }
  return {key, label: key, accent: key, values: values as Record<string, number>, max, leaders};
}

function ctxFor(players: Array<EndgamePlayerScore>, opts: {
  generation?: number;
  categories?: Array<EndgameCategory>;
} = {}): InsightContext {
  const winner = players[0];
  winner.isWinner = true;
  const runnerUp = players[1];
  const generation = opts.generation ?? 10;
  const margin = runnerUp !== undefined ? winner.total - runnerUp.total : 0;
  const timeline = computeTimelineStats(players, winner, generation, leadGen(players, winner, generation));
  return {
    mode: players.length === 2 ? 'duel' : 'standings',
    generation,
    players,
    winner,
    runnerUp,
    margin,
    categories: opts.categories ?? [],
    parameters: [],
    timeline,
    profile: buildVictoryProfile(winner),
    seed: gameSeed(players, generation),
  };
}

// Re-implements the model's winnerTookLeadGen for the harness (the engine
// receives it from endgameModel in production).
function leadGen(players: Array<EndgamePlayerScore>, winner: EndgamePlayerScore, generation: number): number | undefined {
  const others = players.filter((p) => p.color !== winner.color);
  const len = Math.min(generation, winner.vpByGeneration.length, ...others.map((o) => o.vpByGeneration.length));
  if (len <= 0 || others.length === 0) {
    return undefined;
  }
  let lastNotAhead = -1;
  for (let g = 0; g < len; g++) {
    const w = winner.vpByGeneration[g];
    if (others.some((o) => o.vpByGeneration[g] >= w)) {
      lastNotAhead = g;
    }
  }
  if (lastNotAhead < 0 || lastNotAhead + 1 >= len) {
    return undefined;
  }
  return lastNotAhead + 2;
}

describe('insightEngine', () => {
  describe('computeTimelineStats', () => {
    it('counts lead changes and winner-led generations', () => {
      const a = score('red', 'A', {total: 40, vpByGeneration: [10, 12, 20, 30, 40]});
      const b = score('blue', 'B', {total: 35, vpByGeneration: [11, 14, 15, 25, 35]});
      const t = computeTimelineStats([a, b], a, 5, undefined);
      expect(t).to.not.eq(undefined);
      expect(t?.sampled).to.eq(5);
      // B leads gens 1-2, A leads 3-5 → one change.
      expect(t?.leadChanges).to.eq(1);
      expect(t?.winnerLedGens).to.eq(3);
      expect(t?.wireToWire).to.eq(false);
      expect(t?.maxDeficit).to.eq(2); // gen 2: 14 vs 12
      expect(t?.maxDeficitGen).to.eq(2);
    });

    it('flags wire-to-wire and computes the final surge', () => {
      const a = score('red', 'A', {total: 50, vpByGeneration: [12, 20, 28, 38, 50]});
      const b = score('blue', 'B', {total: 30, vpByGeneration: [8, 14, 20, 26, 30]});
      const t = computeTimelineStats([a, b], a, 5, undefined);
      expect(t?.wireToWire).to.eq(true);
      expect(t?.finalSurge?.color).to.eq('red');
      expect(t?.finalSurge?.gain).to.eq(22); // 50 - 28
      expect(t?.finalSurge?.bestOtherGain).to.eq(10); // 30 - 20
    });

    it('returns undefined without enough data', () => {
      const a = score('red', 'A', {vpByGeneration: []});
      const b = score('blue', 'B', {vpByGeneration: []});
      expect(computeTimelineStats([a, b], a, 8, undefined)).to.eq(undefined);
      expect(computeTimelineStats([a], a, 8, undefined)).to.eq(undefined);
    });
  });

  describe('buildVictoryProfile', () => {
    it('classifies a terraforming-driven win', () => {
      const w = score('red', 'A', {categories: {tr: 45, cards: 10, board: 8, mca: 5}});
      const p = buildVictoryProfile(w);
      expect(p?.kind).to.eq('terraformer');
      expect(p?.sourceKey).to.eq('tr');
      expect(p?.share).to.be.greaterThan(50);
    });

    it('classifies a card-engine win', () => {
      const w = score('red', 'A', {categories: {tr: 25, cards: 30, board: 5, mca: 5}});
      expect(buildVictoryProfile(w)?.kind).to.eq('engine');
    });

    it('falls back to balanced when nothing dominates', () => {
      const w = score('red', 'A', {categories: {tr: 26, cards: 18, board: 14, mca: 12}});
      expect(buildVictoryProfile(w)?.kind).to.eq('balanced');
    });
  });

  describe('selectInsights', () => {
    const candidate = (id: string, group: InsightCandidate['group'], priority: number, suppresses?: Array<string>): InsightCandidate => ({
      id, group, priority, severity: 'normal', icon: 'flag', badge: 'b', textKey: 't', params: [], suppresses,
    });

    it('keeps one insight per group, ranked by priority', () => {
      const picked = selectInsights([
        candidate('a1', 'verdict', 50),
        candidate('a2', 'verdict', 90),
        candidate('b1', 'timeline', 70),
      ]);
      expect(picked.map((p) => p.id)).to.deep.eq(['a2', 'b1']);
    });

    it('honours suppression links', () => {
      const picked = selectInsights([
        candidate('big', 'timeline', 90, ['small']),
        candidate('small', 'momentum', 80),
        candidate('other', 'cards', 70),
      ]);
      expect(picked.map((p) => p.id)).to.deep.eq(['big', 'other']);
    });

    it('caps the list and orders it by story flow', () => {
      const picked = selectInsights([
        candidate('p', 'profile', 99),
        candidate('v', 'verdict', 50),
        candidate('t', 'timeline', 60),
      ], 3);
      // Reading order: verdict → timeline → … → profile, regardless of priority.
      expect(picked.map((p) => p.id)).to.deep.eq(['v', 't', 'p']);
    });
  });

  describe('generateInsights', () => {
    it('tells a photo-finish story', () => {
      const a = score('red', 'A', {total: 41, vpByGeneration: [10, 20, 41]});
      const b = score('blue', 'B', {total: 40, vpByGeneration: [12, 22, 40]});
      const insights = generateInsights(ctxFor([a, b], {generation: 3}));
      expect(insights.some((i) => i.id === 'verdict.photo-finish')).to.eq(true);
    });

    it('tells a tiebreaker story', () => {
      const a = score('red', 'A', {total: 40});
      const b = score('blue', 'B', {total: 40});
      const insights = generateInsights(ctxFor([a, b]));
      expect(insights.some((i) => i.id === 'verdict.tiebreaker')).to.eq(true);
    });

    it('detects a late comeback and suppresses the redundant surge line', () => {
      // Winner trails by 8 until taking the lead in the final generation.
      const a = score('red', 'A', {total: 46, vpByGeneration: [10, 14, 20, 26, 46]});
      const b = score('blue', 'B', {total: 40, vpByGeneration: [12, 20, 28, 34, 40]});
      const insights = generateInsights(ctxFor([a, b], {generation: 5}));
      expect(insights.some((i) => i.id === 'timeline.late-comeback')).to.eq(true);
      expect(insights.some((i) => i.id === 'momentum.winner-surge')).to.eq(false);
    });

    it('flags the decisive category when its lead covers the margin', () => {
      const a = score('red', 'A', {total: 50, categories: {tr: 25, cards: 20, board: 5, mca: 0}});
      const b = score('blue', 'B', {total: 44, categories: {tr: 26, cards: 8, board: 10, mca: 0}});
      const cats = [
        category('tr', {red: 25, blue: 26}),
        category('cards', {red: 20, blue: 8}),
        category('board', {red: 5, blue: 10}),
      ];
      const insights = generateInsights(ctxFor([a, b], {categories: cats}));
      expect(insights.some((i) => i.id === 'reason.decisive-category')).to.eq(true);
    });

    it('returns nothing for solo games', () => {
      const a = score('red', 'A', {total: 60});
      const ctx = {...ctxFor([a]), mode: 'solo' as const};
      expect(generateInsights(ctx)).to.deep.eq([]);
    });

    it('is deterministic for the same game', () => {
      const make = () => {
        const a = score('red', 'A', {total: 47, vpByGeneration: [10, 20, 30, 47]});
        const b = score('blue', 'B', {total: 44, vpByGeneration: [12, 22, 32, 44]});
        return generateInsights(ctxFor([a, b], {generation: 4}));
      };
      expect(make()).to.deep.eq(make());
    });

    it('never emits two insights of the same group', () => {
      const a = score('red', 'A', {total: 80, vpByGeneration: [10, 30, 50, 80], categories: {tr: 40, cards: 30, board: 10, mca: 0}});
      const b = score('blue', 'B', {total: 40, vpByGeneration: [12, 20, 30, 40], categories: {tr: 25, cards: 5, board: 10, mca: 0}});
      const cats = [
        category('tr', {red: 40, blue: 25}),
        category('cards', {red: 30, blue: 5}),
        category('board', {red: 10, blue: 10}),
      ];
      const insights = generateInsights(ctxFor([a, b], {generation: 4, categories: cats}));
      const groups = insights.map((i) => i.group);
      expect(new Set(groups).size).to.eq(groups.length);
      expect(insights.length).to.be.greaterThan(2);
      expect(insights.length).to.be.lessThan(7);
    });
  });
});
