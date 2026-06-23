import {expect} from 'chai';
import {
  buildKeyEpisodes, timelineEpisodes, unusualEpisodes, decisiveEpisodes, contrastEpisode,
} from '@/client/components/endgame/keyEpisodeEngine';
import {InsightContext, TimelineStats} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {PlayerStrategyProfile, StrategyArchetype, StrategyDetection} from '@/client/components/endgame/strategyArchetypes';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';

type MA = {messageArgs?: Array<string>; victoryPoint: number};

function det(archetype: StrategyArchetype, vp: number, isScoring = true): StrategyDetection {
  return {archetype, score: 0.6, vpContribution: vp, isScoring,
    evidence: [{t: 'raw', v: `+${vp}`, label: 'VP', tone: 'good'}, {t: 'i18n', v: 'cities & greenery'}], confidence: 'high'};
}
function profile(color: Color, primary?: StrategyDetection, secondary: Array<StrategyDetection> = []): PlayerStrategyProfile {
  return {color, primary, secondary, all: [...(primary ? [primary] : []), ...secondary], confidence: 'high'};
}
function pl(color: Color, name: string, total: number, opts: {
  primary?: StrategyDetection; secondary?: Array<StrategyDetection>;
  awards?: Array<MA>; vpByGeneration?: Array<number>; megacredits?: number; mcProd?: number;
  penalties?: number; board?: number;
} = {}): EndgamePlayerScore {
  return {
    color, name, total, isWinner: false, place: 1, megacredits: opts.megacredits ?? 0, corporations: [],
    vpByGeneration: opts.vpByGeneration ?? [], topCards: [],
    penaltyCards: opts.penalties !== undefined ? [{cardName: 'P', victoryPoint: -opts.penalties, kind: 'penalty'}] : [],
    parametersTotal: 0, globalSteps: {},
    categories: {tr: 20, cards: 0, board: opts.board ?? 0, mca: 0, moon: 0, tracks: 0} as any,
    production: {megacredits: opts.mcProd ?? 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    breakdown: {total, detailsAwards: opts.awards ?? [], detailsMilestones: []} as any,
    strategyProfile: profile(color, opts.primary, opts.secondary),
  } as unknown as EndgamePlayerScore;
}
function fact(type: FactType, player: Color, metrics: Record<string, number>, extra: Partial<EndgameFact> = {}): EndgameFact {
  return {id: `${type}:${player}`, type, player, severity: 0.5, confidence: 'exact', metrics, relatedEventIds: [], tags: [], ...extra} as EndgameFact;
}
function ctx(players: Array<EndgamePlayerScore>, opts: {facts?: Array<EndgameFact>; margin: number; timeline?: TimelineStats; generation?: number} = {margin: 10}): InsightContext {
  players[0].isWinner = true;
  return {
    mode: players.length === 2 ? 'duel' : 'standings', generation: opts.generation ?? 10, players,
    winner: players[0], runnerUp: players[1], margin: opts.margin,
    categories: [], parameters: [], timeline: opts.timeline, profile: undefined, seed: 1, facts: opts.facts,
  } as InsightContext;
}

describe('keyEpisodeEngine (rework Iteration 15)', () => {
  it('a strong winner scoring line → a decisive_driver episode', () => {
    const c = ctx([pl('red', 'Nastya', 90, {primary: det('cityGreenery', 28), board: 28}), pl('blue', 'Victor', 78)], {margin: 12});
    const eps = buildKeyEpisodes(c);
    const driver = eps.find((e) => e.id.startsWith('episode.driver'));
    expect(driver, 'driver episode').to.not.be.undefined;
    expect(driver!.role).to.eq('decisive_driver');
  });

  it('two different plans → a structural_contrast episode (never decisive)', () => {
    const c = ctx([pl('red', 'Nastya', 90, {primary: det('cityGreenery', 24)}), pl('blue', 'Victor', 78, {primary: det('globalParams', 0, false)})], {margin: 12});
    const cont = contrastEpisode(buildKeyEpisodes(c));
    expect(cont, 'contrast episode').to.not.be.undefined;
    expect(cont!.role).to.eq('structural_contrast');
    // §17 role correctness — a contrast is NEVER a decisive driver.
    expect(decisiveEpisodes(buildKeyEpisodes(c)).some((e) => e.role === 'structural_contrast')).to.be.false;
  });

  // §5 / §16 — IMPACT-AWARE: a 5-VP award at a +42 margin is an ironic twist, not a driver.
  it('award sponsor-lost at a WIDE margin → ironic_twist (not decisive)', () => {
    const c = ctx([
      pl('red', 'Nastya', 120, {primary: det('cityGreenery', 30), board: 30, awards: [{messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5}]}),
      pl('blue', 'Victor', 78, {awards: [{messageArgs: ['2nd', 'Banker', 'Victor'], victoryPoint: 0}]}),
    ], {margin: 42});
    const award = buildKeyEpisodes(c).find((e) => e.dedupeKey === 'award');
    expect(award, 'award episode').to.not.be.undefined;
    expect(award!.role).to.eq('ironic_twist');
    expect(award!.role).to.not.eq('decisive_driver');
    // It lands in "unusual", NOT in the decisive drivers.
    expect(unusualEpisodes(buildKeyEpisodes(c)).some((e) => e.dedupeKey === 'award')).to.be.true;
    expect(decisiveEpisodes(buildKeyEpisodes(c)).some((e) => e.dedupeKey === 'award')).to.be.false;
  });

  it('award sponsor-lost where the points COVER the margin → a turning point (decisive)', () => {
    const c = ctx([
      pl('red', 'Nastya', 84, {primary: det('cityGreenery', 20), awards: [{messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5}]}),
      pl('blue', 'Victor', 81, {awards: [{messageArgs: ['2nd', 'Banker', 'Victor'], victoryPoint: 0}]}),
    ], {margin: 3});
    const award = buildKeyEpisodes(c).find((e) => e.dedupeKey === 'award');
    expect(award!.role).to.eq('turning_point');
  });

  // §6 / §17 — the award appears ONCE (no duplicate phrasing).
  it('the award produces exactly ONE episode (no duplicate)', () => {
    const c = ctx([
      pl('red', 'Nastya', 100, {primary: det('cityGreenery', 26), awards: [{messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5}]}),
      pl('blue', 'Victor', 80, {awards: [{messageArgs: ['2nd', 'Banker', 'Victor'], victoryPoint: 0}]}),
    ], {margin: 20});
    expect(buildKeyEpisodes(c).filter((e) => e.dedupeKey === 'award').length).to.eq(1);
  });

  it('a late comeback → a turning_point in the timeline', () => {
    const timeline: TimelineStats = {
      sampled: 8, leadChanges: 2, winnerLedGens: 3, topOtherLeader: {color: 'blue', gens: 5},
      maxDeficit: 10, maxDeficitGen: 6, finalSurge: undefined, winnerTookLeadGen: 8, wireToWire: false, earlyGap: -8,
    };
    const c = ctx([pl('red', 'Nastya', 90, {primary: det('cards', 20)}), pl('blue', 'Victor', 80)], {margin: 10, timeline, generation: 9});
    const tp = buildKeyEpisodes(c).find((e) => e.role === 'turning_point');
    expect(tp, 'turning point').to.not.be.undefined;
    expect(tp!.generation).to.eq(8);
  });

  it('episodes are ordered chronologically (early → scoring) and split into timeline vs unusual', () => {
    const timeline: TimelineStats = {sampled: 8, leadChanges: 1, winnerLedGens: 6, topOtherLeader: undefined, maxDeficit: 7, maxDeficitGen: 5, finalSurge: undefined, winnerTookLeadGen: 7, wireToWire: false, earlyGap: 2};
    const c = ctx([
      pl('red', 'Nastya', 100, {primary: det('cityGreenery', 28), board: 28, awards: [{messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5}]}),
      pl('blue', 'Victor', 80, {primary: det('globalParams', 0, false), awards: [{messageArgs: ['2nd', 'Banker', 'Victor'], victoryPoint: 0}]}),
    ], {margin: 20, timeline, generation: 9});
    const eps = buildKeyEpisodes(c);
    const orders = eps.map((e) => e.order);
    expect(orders).to.deep.equal([...orders].sort((a, b) => a - b));
    // Iteration 16 §7 — each episode lives on ONE surface: the turning point is a timeline
    // beat; the contrast is NOT in the timeline (it's the editorial "what defined"); the
    // decisive driver is NOT in the timeline (it's "why won"); the award is "unusual" only.
    expect(timelineEpisodes(eps).some((e) => e.role === 'turning_point')).to.be.true;
    expect(timelineEpisodes(eps).some((e) => e.role === 'structural_contrast'), 'contrast not in timeline').to.be.false;
    expect(timelineEpisodes(eps).some((e) => e.role === 'decisive_driver'), 'decisive not in timeline').to.be.false;
    expect(contrastEpisode(eps), 'contrast available for the editorial').to.not.be.undefined;
    expect(unusualEpisodes(eps).some((e) => e.dedupeKey === 'award')).to.be.true;
    expect(timelineEpisodes(eps).some((e) => e.dedupeKey === 'award')).to.be.false;
  });

  it('Hydronetwork: a skewed Delta Project finish becomes a signature episode (§16)', () => {
    const w = pl('red', 'Nastya', 90, {primary: det('cityGreenery', 24)});
    (w.breakdown as any).deltaProject = 5;
    const r = pl('blue', 'Victor', 80);
    (r.breakdown as any).deltaProject = 0;
    const eps = buildKeyEpisodes(ctx([w, r], {margin: 10}));
    const hn = eps.find((e) => e.dedupeKey === 'hydronetwork');
    expect(hn, 'hydronetwork episode').to.not.be.undefined;
    expect(hn!.role).to.eq('signature_moment');
    expect(unusualEpisodes(eps).some((e) => e.dedupeKey === 'hydronetwork')).to.be.true;
  });

  it('Hydronetwork: an even split is NOT a story', () => {
    const w = pl('red', 'Nastya', 90, {primary: det('cityGreenery', 24)});
    (w.breakdown as any).deltaProject = 4;
    const r = pl('blue', 'Victor', 80);
    (r.breakdown as any).deltaProject = 4;
    const eps = buildKeyEpisodes(ctx([w, r], {margin: 10}));
    expect(eps.some((e) => e.dedupeKey === 'hydronetwork')).to.be.false;
  });

  it('solo games produce no episodes', () => {
    const c = {mode: 'solo', generation: 10, players: [pl('red', 'A', 50)], winner: pl('red', 'A', 50), runnerUp: undefined,
      margin: 0, categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1} as InsightContext;
    expect(buildKeyEpisodes(c)).to.have.length(0);
  });
});
