import {expect} from 'chai';
import {buildFinishVerdict, FinishVerdictType} from '@/client/components/endgame/finishVerdict';
import {InsightContext, TimelineStats} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {PlayerStrategyProfile, StrategyArchetype, StrategyDetection} from '@/client/components/endgame/strategyArchetypes';
import {CARD_VP_SOURCES, CardVpSource} from '@/client/components/endgame/cardScoreContribution';
import {Color} from '@/common/Color';

function pl(color: Color, name: string, total: number): EndgamePlayerScore {
  return {
    color, name, total, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], topCards: [], penaltyCards: [], parametersTotal: 0, globalSteps: {},
    categories: {tr: 20, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0} as never,
    breakdown: {total} as never,
  } as unknown as EndgamePlayerScore;
}
function ctx(margin: number, timeline?: TimelineStats): InsightContext {
  const w = pl('red', 'Nastya', 100); w.isWinner = true;
  const r = pl('blue', 'Victor', 100 - margin);
  return {mode: 'duel', generation: 10, players: [w, r], winner: w, runnerUp: r, margin,
    categories: [], parameters: [], timeline, profile: undefined, seed: 1} as InsightContext;
}
const tl = (o: Partial<TimelineStats>): TimelineStats => ({
  sampled: 8, leadChanges: 0, winnerLedGens: 8, topOtherLeader: undefined, maxDeficit: 0,
  maxDeficitGen: undefined, finalSurge: undefined, winnerTookLeadGen: undefined, wireToWire: false, earlyGap: 0, ...o,
});

describe('finishVerdict (Iteration 17 §2/§17)', () => {
  const cases: Array<[number, FinishVerdictType]> = [
    [0, 'photo_finish'], [2, 'photo_finish'], [5, 'close_finish'],
    [12, 'solid_win'], [24, 'large_win'], [42, 'blowout'],
  ];
  for (const [margin, type] of cases) {
    it(`margin ${margin} → ${type}`, () => {
      expect(buildFinishVerdict(ctx(margin))?.type).to.eq(type);
    });
  }

  it('a late lead change after a deficit → comeback (overrides the margin tier)', () => {
    const v = buildFinishVerdict(ctx(20, tl({winnerTookLeadGen: 10, maxDeficit: 9})));
    expect(v?.type).to.eq('comeback');
  });

  it('close at 2/3 then a wide finish → late_breakaway', () => {
    const v = buildFinishVerdict(ctx(24, tl({earlyGap: 4, wireToWire: false})));
    expect(v?.type).to.eq('late_breakaway');
  });

  it('the verdict line carries an accented score term + a player term where relevant (§4)', () => {
    const v = buildFinishVerdict(ctx(42));
    expect(v, 'verdict').to.not.be.undefined;
    expect(v!.line.params.some((p) => p.term?.kind === 'score' && p.term.accent === true)).to.be.true;
    expect(v!.line.params.some((p) => p.term?.kind === 'player')).to.be.true;
    expect(v!.glyph).to.be.a('string').with.length.greaterThan(0);
  });

  it('solo / no runner-up → no verdict', () => {
    const solo = {mode: 'solo', generation: 8, players: [pl('red', 'A', 50)], winner: pl('red', 'A', 50),
      runnerUp: undefined, margin: 0, categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1} as InsightContext;
    expect(buildFinishVerdict(solo)).to.be.undefined;
  });
});

// ── Iteration 18 §12 — rare finish fixtures ──────────────────────────────────
function emptyCardVp() {
  const base = {} as Record<CardVpSource, number>;
  for (const s of CARD_VP_SOURCES) {
    base[s] = 0;
  }
  return {...base, total: 0, penalties: 0, confidence: 'high' as const};
}
function det(archetype: StrategyArchetype, vp: number): StrategyDetection {
  return {archetype, score: 0.6, vpContribution: vp, isScoring: true, evidence: [{t: 'raw', v: `+${vp}`, label: 'VP', tone: 'good'}], confidence: 'high'};
}
type RichOpts = {tr?: number; awards?: number; topCardVp?: number; topCardName?: string; lines?: Array<StrategyDetection>; jovianVp?: number};
function rich(color: Color, name: string, total: number, o: RichOpts = {}): EndgamePlayerScore {
  const profile: PlayerStrategyProfile = {color, primary: o.lines?.[0], secondary: (o.lines ?? []).slice(1), all: o.lines ?? [], confidence: 'high'};
  const cardVp = {...emptyCardVp(), jovian: o.jovianVp ?? 0};
  return {
    color, name, total, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], topCards: o.topCardVp !== undefined ? [{cardName: o.topCardName ?? 'Big Card', victoryPoint: o.topCardVp, kind: 'fixed'}] : [],
    penaltyCards: [], parametersTotal: 0, globalSteps: {},
    categories: {tr: o.tr ?? 20, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0} as never,
    production: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    breakdown: {total, awards: o.awards ?? 0} as never,
    strategyProfile: profile, strategyInput: {tags: {}, coloniesOwned: [], cardVp, resourceTotals: {animals: 0, microbes: 0, floaters: 0, animalCards: 0, microbeCards: 0, floaterCards: 0}} as never,
  } as unknown as EndgamePlayerScore;
}
function rctx(w: EndgamePlayerScore, r: EndgamePlayerScore, margin: number): InsightContext {
  w.isWinner = true;
  return {mode: 'duel', generation: 10, players: [w, r], winner: w, runnerUp: r, margin,
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1, facts: []} as InsightContext;
}

describe('finishVerdict — rare finishes (Iteration 18 §3/§12)', () => {
  it('won with notably less TR + a wide margin → low_terraforming_big_win (legendary)', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 130, {tr: 30, lines: [det('cityGreenery', 40)]}), rich('blue', 'Victor', 88, {tr: 48}), 42));
    expect(v?.type).to.eq('low_terraforming_big_win');
    expect(v?.tier).to.eq('legendary');
    expect(v?.chips.some((c) => c.label === 'TR')).to.be.true;
  });

  it('a small TR deficit does NOT trigger the rare verdict (strong-evidence gate)', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 100, {tr: 38}), rich('blue', 'Victor', 78, {tr: 42}), 22));
    expect(v?.type).to.not.eq('low_terraforming_big_win');
    expect(v?.type).to.eq('large_win');
  });

  it('a single card worth more than a tiny gap → single_card_decider', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 84, {topCardVp: 9, topCardName: 'Birds'}), rich('blue', 'Victor', 81), 3));
    expect(v?.type).to.eq('single_card_decider');
    expect(v?.tier).to.eq('rare');
  });

  it('award points larger than a close gap → award_decider', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 85, {awards: 6}), rich('blue', 'Victor', 81), 4));
    expect(v?.type).to.eq('award_decider');
  });

  it('a big animal line → resource_card_finish', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 110, {lines: [det('animals', 16)]}), rich('blue', 'Victor', 92), 18));
    expect(v?.type).to.eq('resource_card_finish');
  });

  it('a heavy Jovian combo → jovian_reveal', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 110, {jovianVp: 14}), rich('blue', 'Victor', 92), 18));
    expect(v?.type).to.eq('jovian_reveal');
  });

  it('records rejected rare candidates for debug', () => {
    const v = buildFinishVerdict(rctx(rich('red', 'Nastya', 100, {tr: 40}), rich('blue', 'Victor', 78, {tr: 42}), 22));
    expect(v?.rejected.length, 'rejected candidates').to.be.greaterThan(0);
  });
});
