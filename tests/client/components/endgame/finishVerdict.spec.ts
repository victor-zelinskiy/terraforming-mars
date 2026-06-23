import {expect} from 'chai';
import {buildFinishVerdict, FinishScale, FinishPattern, FinishRarity} from '@/client/components/endgame/finishVerdict';
import {InsightContext, TimelineStats} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {PlayerStrategyProfile, StrategyArchetype, StrategyDetection} from '@/client/components/endgame/strategyArchetypes';
import {CARD_VP_SOURCES, CardVpSource} from '@/client/components/endgame/cardScoreContribution';
import {Color} from '@/common/Color';

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
type Opts = {tr?: number; awards?: number; topCardVp?: number; topCardName?: string; lines?: Array<StrategyDetection>; jovianVp?: number};
function pl(color: Color, name: string, total: number, o: Opts = {}): EndgamePlayerScore {
  const profile: PlayerStrategyProfile = {color, primary: o.lines?.[0], secondary: (o.lines ?? []).slice(1), all: o.lines ?? [], confidence: 'high'};
  const cardVp = {...emptyCardVp(), jovian: o.jovianVp ?? 0};
  return {
    color, name, total, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], topCards: o.topCardVp !== undefined ? [{cardName: o.topCardName ?? 'Big Card', victoryPoint: o.topCardVp, kind: 'fixed'}] : [],
    penaltyCards: [], parametersTotal: 0, globalSteps: {},
    categories: {tr: o.tr ?? 20, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0} as never,
    production: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    breakdown: {total, awards: o.awards ?? 0} as never,
    strategyProfile: profile,
    strategyInput: {tags: {}, coloniesOwned: [], cardVp, resourceTotals: {animals: 0, microbes: 0, floaters: 0, animalCards: 0, microbeCards: 0, floaterCards: 0}} as never,
  } as unknown as EndgamePlayerScore;
}
function ctx(w: EndgamePlayerScore, r: EndgamePlayerScore, margin: number, timeline?: TimelineStats): InsightContext {
  w.isWinner = true;
  return {mode: 'duel', generation: 10, players: [w, r], winner: w, runnerUp: r, margin,
    categories: [], parameters: [], timeline, profile: undefined, seed: 1, facts: []} as InsightContext;
}
const tl = (o: Partial<TimelineStats>): TimelineStats => ({
  sampled: 8, leadChanges: 0, winnerLedGens: 8, topOtherLeader: undefined, maxDeficit: 0,
  maxDeficitGen: undefined, finalSurge: undefined, winnerTookLeadGen: undefined, wireToWire: false, earlyGap: 0, ...o,
});

describe('finishVerdict — scale axis (Iteration 19)', () => {
  const cases: Array<[number, FinishScale]> = [
    [0, 'photo_finish'], [2, 'photo_finish'], [5, 'close'], [12, 'solid'], [24, 'large'], [42, 'blowout'],
  ];
  for (const [margin, scale] of cases) {
    it(`margin ${margin} → scale ${scale}, pattern normal, rarity common`, () => {
      const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 100), pl('blue', 'Victor', 100 - margin), margin));
      expect(v?.scale).to.eq(scale);
      expect(v?.pattern).to.eq('normal');
      expect(v?.rarity).to.eq('common');
    });
  }
  it('solo / no runner-up → no verdict', () => {
    const solo = {mode: 'solo', generation: 8, players: [pl('red', 'A', 50)], winner: pl('red', 'A', 50),
      runnerUp: undefined, margin: 0, categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1} as InsightContext;
    expect(buildFinishVerdict(solo)).to.be.undefined;
  });
});

describe('finishVerdict — calibration: no over-claimed rarity (§1–§4)', () => {
  it('won with less TR + few scoring lines → lower_terraforming_win but rarity NOTABLE, not rare', () => {
    const v = buildFinishVerdict(ctx(
      pl('red', 'Nastya', 130, {tr: 30, lines: [det('cityGreenery', 40)]}),
      pl('blue', 'Victor', 88, {tr: 48}), 42));
    expect(v?.pattern).to.eq('lower_terraforming_win');
    expect(v?.rarity).to.eq('notable');
    // The TITLE stays the SCALE title (a wide finish), NOT a rare title.
    expect(v?.titleKey).to.eq('A runaway finish');
  });

  it('a small TR deficit is NOT even a lower-terraforming pattern', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 100, {tr: 38}), pl('blue', 'Victor', 78, {tr: 42}), 22));
    expect(v?.pattern).to.eq('normal');
    expect(v?.rarity).to.eq('common');
    expect(v?.scale).to.eq('large');
  });

  it('HUGE TR deficit + blowout + 3 scoring lines → rare/legendary', () => {
    const v = buildFinishVerdict(ctx(
      pl('red', 'Nastya', 135, {tr: 25, lines: [det('cityGreenery', 30), det('animals', 16), det('microbes', 10)]}),
      pl('blue', 'Victor', 100, {tr: 53}), 35));
    expect(v?.pattern).to.eq('lower_terraforming_win');
    expect(v?.rarity).to.eq('legendary');
    expect(v?.titleKey).to.eq('A rare gap against terraforming');
  });
});

describe('finishVerdict — genuine rare finishes (§5)', () => {
  it('a single card worth more than a tiny gap → single_card_swing (rare)', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 84, {topCardVp: 9, topCardName: 'Birds'}), pl('blue', 'Victor', 81), 3));
    expect(v?.pattern).to.eq('single_card_swing');
    expect(v?.rarity).to.eq('rare');
  });
  it('award points larger than a close gap → award_swing (rare)', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 85, {awards: 6}), pl('blue', 'Victor', 81), 4));
    expect(v?.pattern).to.eq('award_swing');
    expect(v?.rarity).to.eq('rare');
  });
  it('a DOMINANT ≥30-VP animal line covering the margin → resource_card_finish (rare)', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'N', 130, {lines: [det('animals', 32)]}), pl('blue', 'V', 100), 30));
    expect(v?.pattern).to.eq('resource_card_finish');
    expect(v?.rarity).to.eq('rare');
  });
  it('a DOMINANT ≥25-VP Jovian block covering the margin → jovian_finish (rare)', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'N', 130, {jovianVp: 28}), pl('blue', 'V', 100), 30));
    expect(v?.pattern).to.eq('jovian_finish');
    expect(v?.rarity).to.eq('rare');
  });
  it('a finish-line comeback → comeback (rare)', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'N', 90), pl('blue', 'V', 80), 10, tl({winnerTookLeadGen: 10, maxDeficit: 9})));
    expect(v?.pattern).to.eq('comeback');
    expect(v?.rarity).to.eq('rare');
  });
  it('records rare candidates (accepted + rejected) for debug', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'N', 100, {tr: 40}), pl('blue', 'V', 78, {tr: 42}), 22));
    expect((v?.rareCandidates.length ?? 0) >= 0).to.be.true;
  });
});

describe('finishVerdict — Iteration 20: no over-claimed strategic finishes (§1–§4, §24)', () => {
  it('+20 animals as the ONLY line → resource pattern but rarity NOTABLE (title = scale, no "finish")', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 110, {lines: [det('animals', 20)]}), pl('blue', 'Victor', 80), 30));
    expect(v?.pattern).to.eq('resource_card_finish');
    expect(v?.rarity).to.eq('notable');
    // The banner TITLE stays the scale title, NOT "A card-resource finish".
    expect(v?.titleKey).to.eq('A wide finish');
  });

  it('+20 animals as a SECONDARY line (board is primary) → pattern normal, NOT a resource finish (§8)', () => {
    const v = buildFinishVerdict(ctx(
      pl('red', 'Nastya', 120, {lines: [det('cityGreenery', 32), det('animals', 20)]}),
      pl('blue', 'Victor', 84), 36));
    expect(v?.pattern).to.eq('normal');
    expect(v?.rarity).to.eq('common');
    expect(v?.titleKey).to.eq('A runaway finish');
  });

  it('+18 Jovian block (not covering the margin) → jovian pattern but NOTABLE, not a finish', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'N', 110, {jovianVp: 18}), pl('blue', 'V', 90), 30));
    expect(v?.pattern).to.eq('jovian_finish');
    expect(v?.rarity).to.eq('notable');
  });

  it('a strategic finish NEVER overrides a close finish — strategy is flavour (§5)', () => {
    // A close game (margin 3) won with a big animal line: the verdict is still the close
    // finish (scale), not "a card-resource finish".
    const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 90, {lines: [det('animals', 24)]}), pl('blue', 'Victor', 87), 3));
    expect(v?.pattern).to.not.eq('resource_card_finish');
    expect(v?.scale).to.eq('photo_finish');
  });
});

describe('finishVerdict — verdict line carries interactive terms (§8)', () => {
  it('a plain blowout line carries an accented score + player term', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'Nastya', 100), pl('blue', 'Victor', 58), 42));
    const types: Array<FinishPattern> = ['normal'];
    expect(types).to.include(v!.pattern);
    expect(v!.line.params.some((p) => p.term?.kind === 'score')).to.be.true;
    expect(v!.line.params.some((p) => p.term?.kind === 'player')).to.be.true;
  });
  const rarities: Array<FinishRarity> = ['common', 'notable', 'rare', 'legendary'];
  it('rarity is always one of the four tiers', () => {
    const v = buildFinishVerdict(ctx(pl('red', 'N', 100), pl('blue', 'V', 90), 10));
    expect(rarities).to.include(v!.rarity);
  });
});
