import {expect} from 'chai';
import {buildFinishVerdict, FinishVerdictType} from '@/client/components/endgame/finishVerdict';
import {InsightContext, TimelineStats} from '@/client/components/endgame/insightEngine';
import {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
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
