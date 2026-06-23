import {expect} from 'chai';
import {buildGameStory, buildHeroThesis} from '@/client/components/endgame/gameNarrative';
import {buildKeyEpisodes} from '@/client/components/endgame/keyEpisodeEngine';
import {InsightContext} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {PlayerStrategyProfile, StrategyArchetype, StrategyDetection} from '@/client/components/endgame/strategyArchetypes';
import {Color} from '@/common/Color';

function det(archetype: StrategyArchetype, vp: number): StrategyDetection {
  return {archetype, score: 0.6, vpContribution: vp, isScoring: true,
    evidence: [{t: 'raw', v: `+${vp}`, label: 'VP', tone: 'good'}], confidence: 'high'};
}
function pl(color: Color, name: string, total: number, primary?: StrategyDetection, awards: Array<{messageArgs?: Array<string>; victoryPoint: number}> = []): EndgamePlayerScore {
  const profile: PlayerStrategyProfile = {color, primary, secondary: [], all: primary ? [primary] : [], confidence: 'high'};
  return {
    color, name, total, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], topCards: [], penaltyCards: [], parametersTotal: 0, globalSteps: {},
    categories: {tr: 20, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0} as any,
    production: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    breakdown: {total, detailsAwards: awards, detailsMilestones: []} as any, strategyProfile: profile,
  } as unknown as EndgamePlayerScore;
}
function ctx(players: Array<EndgamePlayerScore>, margin: number): InsightContext {
  players[0].isWinner = true;
  return {mode: 'duel', generation: 10, players, winner: players[0], runnerUp: players[1], margin,
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1} as InsightContext;
}

describe('gameNarrative (rework Iteration 15, §8 + §16)', () => {
  it('hero thesis is a SCALE verdict at a wide margin — never a low-impact award twist (§1/§16)', () => {
    const c = ctx([
      pl('red', 'Nastya', 120, det('cityGreenery', 30), [{messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5}]),
      pl('blue', 'Victor', 78, det('globalParams', 0), [{messageArgs: ['2nd', 'Banker', 'Victor'], victoryPoint: 0}]),
    ], 42);
    const eps = buildKeyEpisodes(c);
    const hero = buildHeroThesis(c, eps);
    expect(hero, 'hero thesis').to.not.be.undefined;
    // A blowout (+42) reads as a runaway finish, not the award phrasing nor the two plans.
    expect(hero!.key).to.contain('runaway finish');
    expect(hero!.key.toLowerCase()).to.not.contain('award');
    expect(hero!.key.toLowerCase()).to.not.contain('two plans');
  });

  it('hero thesis names the carrying line on a solid margin (§16)', () => {
    const c = ctx([pl('red', 'Nastya', 90, det('cityGreenery', 26)), pl('blue', 'Victor', 80, det('cityGreenery', 18))], 10);
    const hero = buildHeroThesis(c, buildKeyEpisodes(c));
    expect(hero!.key).to.contain('final count settled it');
  });

  it('the 30-second story opens with a conclusion (para 1) then explains the plans (§3)', () => {
    const c = ctx([pl('red', 'Nastya', 100, det('cityGreenery', 28)), pl('blue', 'Victor', 78, det('globalParams', 0))], 22);
    const story = buildGameStory(c, buildKeyEpisodes(c));
    expect(story.length).to.be.within(3, 6);
    // §3 — the first sentence is the brief conclusion (paragraph 1).
    expect(story[0].para).to.eq(1);
    // The plans are explained in paragraph 2.
    expect(story.some((s) => s.key.includes('two plans') && s.para === 2)).to.be.true;
    // A wide margin → the "added up" verdict, never "decided it by a handful".
    expect(story.some((s) => s.key.includes('several lines adding up'))).to.be.true;
    // §4/§5 — strategy + player params carry interactive TERM metadata.
    const plans = story.find((s) => s.key.includes('two plans'))!;
    expect(plans.params.some((p) => p.term?.kind === 'player')).to.be.true;
    expect(plans.params.some((p) => p.term?.kind === 'strategy' && p.term.detail !== undefined)).to.be.true;
  });

  it('a close game gets the "handful of points" verdict', () => {
    const c = ctx([pl('red', 'Nastya', 84, det('cityGreenery', 22)), pl('blue', 'Victor', 81, det('globalParams', 0))], 3);
    const story = buildGameStory(c, buildKeyEpisodes(c));
    expect(story.some((s) => s.key.includes('handful of points'))).to.be.true;
  });

  it('solo games have no story / hero thesis', () => {
    const solo = {mode: 'solo', generation: 8, players: [pl('red', 'A', 50)], winner: pl('red', 'A', 50), runnerUp: undefined,
      margin: 0, categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1} as InsightContext;
    expect(buildGameStory(solo, [])).to.have.length(0);
    expect(buildHeroThesis(solo, [])).to.be.undefined;
  });
});
