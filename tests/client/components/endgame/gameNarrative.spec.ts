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
  it('hero thesis is the decisive + contrast — never a low-impact award twist (§16)', () => {
    const c = ctx([
      pl('red', 'Nastya', 120, det('cityGreenery', 30), [{messageArgs: ['1st', 'Banker', 'Victor'], victoryPoint: 5}]),
      pl('blue', 'Victor', 78, det('globalParams', 0), [{messageArgs: ['2nd', 'Banker', 'Victor'], victoryPoint: 0}]),
    ], 42);
    const eps = buildKeyEpisodes(c);
    const hero = buildHeroThesis(c, eps);
    expect(hero, 'hero thesis').to.not.be.undefined;
    // The decisive contrast thesis, not the award phrasing.
    expect(hero!.key).to.contain('won it at the final count');
    expect(hero!.key.toLowerCase()).to.not.contain('award');
  });

  it('hero thesis falls back to the decisive line when there is no contrast', () => {
    const c = ctx([pl('red', 'Nastya', 90, det('cityGreenery', 26)), pl('blue', 'Victor', 80, det('cityGreenery', 18))], 10);
    const hero = buildHeroThesis(c, buildKeyEpisodes(c));
    expect(hero!.key).to.contain('one clear line');
  });

  it('the 30-second story is 3–5 sentences and opens with the plans', () => {
    const c = ctx([pl('red', 'Nastya', 100, det('cityGreenery', 28)), pl('blue', 'Victor', 78, det('globalParams', 0))], 22);
    const story = buildGameStory(c, buildKeyEpisodes(c));
    expect(story.length).to.be.within(2, 5);
    expect(story[0].key).to.contain('two plans');
    // A wide margin → the "added up" verdict, never "decided it by a handful".
    expect(story.some((s) => s.key.includes('several lines adding up'))).to.be.true;
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
