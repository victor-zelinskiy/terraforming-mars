import {expect} from 'chai';
import {validateAiStory, EndgameNarrativePayload} from '@/common/endgame/aiStory';
import {buildNarrativePayload} from '@/client/components/endgame/endgameNarrativePayload';
import {EndgameModel} from '@/client/components/endgame/endgameModel';

function payload(over: Partial<EndgameNarrativePayload> = {}): EndgameNarrativePayload {
  return {
    locale: 'ru',
    game: {name: 'G', generations: 11, playerCount: 2, expansions: []},
    result: {winner: 'Nastya', runnerUp: 'Victor', margin: 36, marginScale: 'blowout', finishPattern: 'normal', rarity: 'common'},
    players: [
      {name: 'Nastya', corporation: 'Ecoline', score: 130, primaryLine: 'Города', secondaryLines: [], strongestSources: [{label: 'Города', value: '+42', confidence: 'high'}]},
      {name: 'Victor', corporation: 'Saturn Systems', score: 94, primaryLine: 'Параметры', secondaryLines: [], strongestSources: []},
    ],
    decisiveFacts: [], keyEpisodes: [], unusualEpisodes: [],
    constraints: {maxSentences: 4, tone: 'premium_fresh', doNotMention: ['редкий', 'редкость'], mustMention: ['Nastya'], forbiddenClaims: ['решил игру'], avoidOverclaiming: true},
    ...over,
  };
}

describe('validateAiStory (Iteration 20 §16)', () => {
  it('accepts a clean, honest story', () => {
    const r = validateAiStory({title: 'Итог', paragraphs: ['Nastya собрала отрыв в 36 ПО.']}, payload());
    expect(r.ok, JSON.stringify(r.errors)).to.eq(true);
  });
  it('rejects a wrong shape', () => {
    expect(validateAiStory({title: 'x'}, payload()).ok).to.eq(false);
    expect(validateAiStory(null, payload()).ok).to.eq(false);
  });
  it('rejects "редкий" wording on a non-rare finish', () => {
    const r = validateAiStory({title: 'Редкий финал', paragraphs: ['Nastya показала редкий результат.']}, payload());
    expect(r.ok).to.eq(false);
    expect(r.errors.some((e) => e.includes('overclaim'))).to.eq(true);
  });
  it('allows "редкий" when the finish IS rare', () => {
    const r = validateAiStory({title: 'Редкий финал', paragraphs: ['Nastya показала редкий результат.']},
      payload({result: {winner: 'Nastya', margin: 36, marginScale: 'blowout', finishPattern: 'lower_terraforming_win', rarity: 'rare'}, constraints: {maxSentences: 4, tone: 'x', doNotMention: [], mustMention: ['Nastya'], forbiddenClaims: [], avoidOverclaiming: true}}));
    expect(r.ok, JSON.stringify(r.errors)).to.eq(true);
  });
  it('rejects an invented number', () => {
    const r = validateAiStory({title: 'Итог', paragraphs: ['Nastya набрала 999 ПО.']}, payload());
    expect(r.errors.some((e) => e.includes('invented number'))).to.eq(true);
  });
  it('rejects an invented player name', () => {
    const r = validateAiStory({title: 'Итог', paragraphs: ['Nastya обыграла Maxim.']}, payload());
    expect(r.errors.some((e) => e.includes('invented name'))).to.eq(true);
  });
  it('rejects a missing must-mention winner', () => {
    const r = validateAiStory({title: 'Итог', paragraphs: ['Победа на финальном счёте.']}, payload());
    expect(r.errors.some((e) => e.includes('mustMention'))).to.eq(true);
  });
  it('rejects a forbidden claim', () => {
    const r = validateAiStory({title: 'Итог', paragraphs: ['Эта карта решил игру для Nastya.']}, payload());
    expect(r.errors.some((e) => e.includes('forbidden'))).to.eq(true);
  });
  it('rejects too many sentences', () => {
    const r = validateAiStory({title: 'A', paragraphs: ['Nastya. Раз. Два. Три. Четыре. Пять.']}, payload());
    expect(r.errors.some((e) => e.includes('length'))).to.eq(true);
  });
});

describe('buildNarrativePayload (Iteration 20 §14)', () => {
  function model(rarity: string): EndgameModel {
    const det = (vp: number) => ({archetype: 'cityGreenery', score: 0.6, vpContribution: vp, isScoring: true, evidence: [], confidence: 'high'});
    const winner = {name: 'Nastya', total: 130, corporations: ['Ecoline'], color: 'red',
      strategyProfile: {color: 'red', primary: det(42), secondary: [], all: [det(42)], confidence: 'high'}};
    const runnerUp = {name: 'Victor', total: 94, corporations: ['Saturn Systems'], color: 'blue', strategyProfile: undefined};
    return {
      mode: 'duel', margin: 36, winner, runnerUp, players: [winner, runnerUp],
      finishVerdict: {scale: 'blowout', pattern: 'normal', rarity}, keyEpisodes: [], additionalInsights: [],
    } as unknown as EndgameModel;
  }
  const meta = {name: 'Game', generations: 11, playerCount: 2, expansions: []};
  const id = (k: string) => k;
  const compose = (k: string) => k;

  it('projects verified facts into a sanitized payload', () => {
    const p = buildNarrativePayload(model('common'), meta, id, compose)!;
    expect(p.result.winner).to.eq('Nastya');
    expect(p.result.margin).to.eq(36);
    expect(p.constraints.mustMention).to.include('Nastya');
    expect(p.players[0].strongestSources[0].value).to.eq('+42');
  });
  it('forbids "редкий" wording for a common finish, allows it for a rare one', () => {
    expect(buildNarrativePayload(model('common'), meta, id, compose)!.constraints.doNotMention).to.include('редкий');
    expect(buildNarrativePayload(model('rare'), meta, id, compose)!.constraints.doNotMention).to.have.length(0);
  });
  it('returns undefined for solo', () => {
    const solo = {mode: 'solo', winner: {name: 'A'}} as unknown as EndgameModel;
    expect(buildNarrativePayload(solo, meta, id, compose)).to.be.undefined;
  });
});
