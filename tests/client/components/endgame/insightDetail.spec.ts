import {expect} from 'chai';
import {buildInsightDetail, buildStyleDetail} from '@/client/components/endgame/insightDetail';
import {InsightCandidate, InsightContext} from '@/client/components/endgame/insightEngine';
import {EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';
import ruEndgame from '@/locales/ru/endgame.json';

// ── Minimal builders (mirror the other endgame specs) ──
function pl(color: Color, name: string, strongest?: EndgameCategoryKey): EndgamePlayerScore {
  return {color, name, total: 80, isWinner: false, place: 1, megacredits: 0, corporations: [],
    vpByGeneration: [], categories: {} as any, topCards: [], penaltyCards: [], globalSteps: {},
    parametersTotal: 0, strongestCategory: strongest,
    breakdown: {total: 80, detailsAwards: [], detailsMilestones: []} as any} as unknown as EndgamePlayerScore;
}
function fact(type: FactType, partial: Partial<EndgameFact>): EndgameFact {
  return {id: partial.id ?? `${type}:x`, type, player: partial.player ?? 'red', severity: 0.5,
    confidence: 'exact', metrics: partial.metrics ?? {}, relatedEventIds: [], tags: [], ...partial} as EndgameFact;
}
function ctx(players: Array<EndgamePlayerScore>, facts?: Array<EndgameFact>): InsightContext {
  return {mode: 'duel', generation: 10, players, winner: players[0], runnerUp: players[1], margin: 10,
    categories: [], parameters: [], timeline: undefined, profile: undefined, seed: 1, facts} as InsightContext;
}
function cand(partial: Partial<InsightCandidate>): InsightCandidate {
  return {id: 'x', group: 'reason', priority: 50, severity: 'normal', icon: 'spark', badge: 'Badge', textKey: 'k', params: [],
    ...partial} as InsightCandidate;
}

describe('Insight explainability — buildInsightDetail (Iteration 12)', () => {
  it('economy detail: measured confidence + a "card draw not converted" caveat', () => {
    const d = buildInsightDetail(cand({storyCluster: 'economy', family: 'economy',
      evidenceChips: [{t: 'raw', v: '+106'}, {t: 'i18n', v: 'discounts + payment bonuses'}]}));
    expect(d, 'economy has a detail').to.not.be.undefined;
    expect(d!.confidence).to.eq('measured');
    expect(d!.caveat, 'honest caveat about card draw').to.be.a('string');
    // Evidence reuses the SAME chips (no drift).
    expect(d!.evidence.map((r) => r.v)).to.include('+106');
  });

  it('an explicit "exact" chip overrides the cluster confidence', () => {
    const d = buildInsightDetail(cand({storyCluster: 'economy', family: 'economy',
      evidenceChips: [{t: 'raw', v: '+40'}, {t: 'i18n', v: 'exact'}]}));
    expect(d!.confidence).to.eq('exact');
  });

  it('colony domination detail explains the asymmetry (partial confidence)', () => {
    const d = buildInsightDetail(cand({storyCluster: 'colonyDomination', family: 'colony'}));
    expect(d, 'colony domination detail').to.not.be.undefined;
    expect(d!.confidence).to.eq('partial');
    expect(d!.explanation).to.contain('colonies');
  });

  it('counterplay detail explains category answering category', () => {
    const d = buildInsightDetail(cand({storyCluster: 'counterplay', family: 'duelContrast'}));
    expect(d, 'counterplay detail').to.not.be.undefined;
    expect(d!.whyItMatters).to.be.a('string');
  });

  it('unused-potential detail carries an honest "no proof" caveat', () => {
    const d = buildInsightDetail(cand({storyCluster: 'unusedMoney', family: 'unusedPotential'}));
    expect(d!.caveat).to.be.a('string');
    expect(d!.confidence).to.eq('partial');
  });

  it('best-card-not-enough has a by-id detail', () => {
    const d = buildInsightDetail(cand({id: 'cards.best-loser', group: 'cards'}));
    expect(d, 'best-loser detail').to.not.be.undefined;
  });

  it('a decorative / unregistered badge gets NO detail (popover stays off)', () => {
    expect(buildInsightDetail(cand({id: 'z', group: 'race', storyCluster: 'race'}))).to.be.undefined;
  });
});

describe('Player-style explainability — buildStyleDetail (Iteration 12)', () => {
  it('Disruptor: evidence shows attacks + resources dealt', () => {
    const c = ctx([pl('red', 'A'), pl('blue', 'B')], [
      fact('negativeInteraction', {id: 'n1', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 6, hits: 2}}),
      fact('negativeInteraction', {id: 'n2', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 3, hits: 1}}),
    ]);
    const d = buildStyleDetail(c, 'red', 'Disruptor');
    expect(d.title).to.eq('Disruptor');
    const raws = d.evidence.filter((r) => r.t === 'raw').map((r) => r.v);
    expect(raws.some((v) => v.startsWith('×')), 'attack count chip').to.be.true;
    expect(raws.some((v) => v.startsWith('−')), 'resources-dealt chip').to.be.true;
  });

  it('Colony Trader: evidence shows trades', () => {
    const c = ctx([pl('red', 'A'), pl('blue', 'B')], [
      fact('colony', {id: 'c', player: 'red', metrics: {trades: 7, trackBonusSteps: 2}}),
    ]);
    const d = buildStyleDetail(c, 'red', 'Colony Trader');
    expect(d.evidence.some((r) => r.t === 'raw' && r.v === '7'), 'trade count').to.be.true;
    expect(d.confidence).to.eq('measured');
  });

  it('a thin-evidence style is honest about it (caveat)', () => {
    const c = ctx([pl('red', 'A'), pl('blue', 'B')], []); // no facts → thin
    const d = buildStyleDetail(c, 'red', 'Balanced');
    expect(d.caveat, 'thin style caveat').to.be.a('string');
  });
});

describe('Editorial guard — no banned / debug phrasing in ru/endgame.json (Iteration 12)', () => {
  const values = Object.values(ruEndgame as Record<string, string>);
  const BANNED = ['победил стиль', 'играл как', 'storyCluster', 'evidenceKey', 'finalScore'];
  for (const phrase of BANNED) {
    it(`no ru value contains "${phrase}"`, () => {
      const hit = values.find((v) => v.includes(phrase));
      expect(hit, `found banned phrasing: ${hit}`).to.be.undefined;
    });
  }
});
