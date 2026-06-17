import {expect} from 'chai';
import {
  generateInsights,
  selectStoryInsights,
  buildInsightCandidates,
  finalScore,
  InsightContext,
  InsightCandidate,
} from '@/client/components/endgame/insightEngine';
import {EndgameCategory, EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {EndgameFact, FactType} from '@/common/events/endgameFacts';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';

// ── Minimal builders (the fact analyzers only read color/name/total + ctx.facts +
//    ctx.categories[board] + ctx.playerCards; the selector reads candidate fields). ──
type MA = {message: string; messageArgs?: Array<string>; victoryPoint: number};
function pl(color: Color, name: string, total: number, opts: {
  megacredits?: number; strongestCategory?: EndgameCategoryKey;
  detailsAwards?: Array<MA>; detailsMilestones?: Array<MA>; penaltyCards?: Array<{cardName: string; victoryPoint: number}>;
} = {}): EndgamePlayerScore {
  return {color, name, total, isWinner: false, place: 1, megacredits: opts.megacredits ?? 0, corporations: [],
    vpByGeneration: [], categories: {} as any, topCards: [],
    penaltyCards: (opts.penaltyCards ?? []).map((c) => ({...c, kind: 'penalty' as const})),
    globalSteps: {}, parametersTotal: 0, strongestCategory: opts.strongestCategory,
    breakdown: {total, detailsAwards: opts.detailsAwards ?? [], detailsMilestones: opts.detailsMilestones ?? []} as any} as unknown as EndgamePlayerScore;
}
// MADetail builders mirroring calculateVictoryPoints' exact messageArgs shape.
function award(place: string, name: string, funder: string, vp: number): MA {
  return {message: '${0} place for ${1} award (funded by ${2})', messageArgs: [place, name, funder], victoryPoint: vp};
}
function milestone(name: string): MA {
  return {message: 'Claimed ${0} milestone', messageArgs: [name], victoryPoint: 5};
}
function boardCat(values: Partial<Record<Color, number>>): EndgameCategory {
  return {key: 'board' as EndgameCategoryKey, label: 'board', accent: 'board', values: values as Record<string, number>, max: 0, leaders: []};
}
function fact(type: FactType, partial: Partial<EndgameFact>): EndgameFact {
  return {id: partial.id ?? `${type}:x`, type, player: partial.player ?? 'red', severity: 0.5,
    confidence: 'exact', metrics: partial.metrics ?? {}, relatedEventIds: [], tags: [], ...partial} as EndgameFact;
}
function ctx(opts: {players: Array<EndgamePlayerScore>; facts?: Array<EndgameFact>; categories?: Array<EndgameCategory>; playerCards?: Partial<Record<Color, ReadonlyArray<CardName>>>; cardResources?: Partial<Record<Color, Partial<Record<CardName, number>>>>; margin?: number}): InsightContext {
  const players = opts.players;
  players[0].isWinner = true;
  const runnerUp = players[1];
  return {
    mode: players.length === 2 ? 'duel' : 'standings', generation: 10, players,
    winner: players[0], runnerUp, margin: opts.margin ?? (runnerUp !== undefined ? players[0].total - runnerUp.total : 0),
    categories: opts.categories ?? [], parameters: [], timeline: undefined, profile: undefined, seed: 1,
    facts: opts.facts, playerCards: opts.playerCards, cardResources: opts.cardResources,
  };
}
function cat(key: EndgameCategoryKey, values: Partial<Record<Color, number>>): EndgameCategory {
  return {key, label: key, accent: key, values: values as Record<string, number>, max: 0, leaders: []};
}
function ids(c: InsightContext): Array<string> {
  return generateInsights(c).map((i) => i.id);
}
function find(c: InsightContext, id: string) {
  return generateInsights(c).find((i) => i.id === id);
}

describe('fact-based endgame insights (Iteration 5)', () => {
  const duo = () => [pl('red', 'Nastya', 80), pl('blue', 'Victor', 70)];

  it('economy fact → an economy-engine insight', () => {
    const c = ctx({players: duo(), margin: 10, facts: [fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 30}})]});
    const ins = find(c, 'fact.economy.engine');
    expect(ins, 'economy engine insight').to.not.be.undefined;
    expect(ins!.family).to.eq('economy');
  });

  it('economy underdog (multiplayer): winner out-economised but still wins', () => {
    // 3 players = standings, so the DUEL economy-conversion analyzer (which would
    // otherwise suppress this generic one) does not run.
    const c = ctx({players: [pl('red', 'Nastya', 80), pl('blue', 'Victor', 70), pl('green', 'Ada', 60)], margin: 10, facts: [
      fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 4}}),
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 24}}),
    ]});
    expect(ids(c)).to.include('fact.economy.underdog');
  });

  it('blue-action engine (most used) + unused engine', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('actionUsage', {id: 'action:red:ai', player: 'red', sourceCard: CardName.AI_CENTRAL, metrics: {activations: 6}}),
      fact('engineTiming', {id: 'engine:blue:x', player: 'blue', sourceCard: CardName.AI_CENTRAL, metrics: {neverActivated: 1, availableGenerations: 6}}),
    ]});
    expect(ids(c)).to.include('fact.action.engine');
    expect(ids(c)).to.include('fact.action.unused');
  });

  it('negative drama: most-targeted + Predators rare event (6+ animals)', () => {
    const c = ctx({players: duo(), margin: 10,
      facts: [fact('negativeInteraction', {id: 'attack:red->blue', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 8, hits: 3, Animal: 6}})],
      playerCards: {red: [CardName.PREDATORS]}});
    expect(ids(c)).to.include('fact.negative.targeted');
    const pred = find(c, 'fact.negative.predators');
    expect(pred, 'Predators rare insight').to.not.be.undefined;
    expect(pred!.family).to.eq('rareEvent');
  });

  it('Vermin 2.0: meaningful animals + city-heavy opponent → a rare insight', () => {
    const c = ctx({players: duo(), margin: 10, playerCards: {red: [CardName.VERMIN]},
      cardResources: {red: {[CardName.VERMIN]: 8}}, categories: [boardCat({blue: 14, red: 2})]});
    const v = find(c, 'fact.vermin.pressure');
    expect(v, 'Vermin rare insight').to.not.be.undefined;
    expect(v!.family).to.eq('rareEvent');
  });

  it('Vermin 2.0: played but NO animals → no insight (false-positive fix)', () => {
    const c = ctx({players: duo(), margin: 10, playerCards: {red: [CardName.VERMIN]}, categories: [boardCat({blue: 14, red: 2})]});
    expect(find(c, 'fact.vermin.pressure'), 'empty Vermin is not a story').to.be.undefined;
  });

  it('global-parameter driver + reveal + colony facts produce insights', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('globalParameter', {id: 'global:red', player: 'red', metrics: {totalSteps: 9}}),
      fact('reveal', {id: 'reveal:red', player: 'red', metrics: {revealed: 7, shown: 0}}),
      fact('colony', {id: 'colony:red', player: 'red', metrics: {trades: 5}}),
    ]});
    const out = ids(c);
    expect(out).to.include('fact.global.driver');
    expect(out).to.include('fact.reveal.flow');
    expect(out).to.include('fact.colony.engine');
  });

  it('a tiebreaker becomes the HERO of the story', () => {
    const players = [pl('red', 'Nastya', 80), pl('blue', 'Victor', 80)];
    const c = ctx({players, margin: 0});
    const hero = generateInsights(c).find((i) => i.rankSection === 'hero');
    expect(hero, 'a hero insight').to.not.be.undefined;
    expect(hero!.group).to.eq('verdict');
  });

  it('no facts → fact insights absent, base insights still work (graceful)', () => {
    const c = ctx({players: duo(), margin: 12});
    const out = ids(c);
    expect(out.some((id) => id.startsWith('fact.')), 'no fact insights without facts').to.be.false;
    expect(out.length, 'base insights still present').to.be.greaterThan(0);
  });

  // ── selectStoryInsights mechanics ──

  it('selectStoryInsights: one cluster per primary, rare facts break through, dedup', () => {
    const mk = (id: string, cluster: string, priority: number, rarity = 0): InsightCandidate => ({
      id, group: 'cards', priority, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: [],
      storyCluster: cluster, scores: {rarity},
    });
    const out = selectStoryInsights([
      mk('a', 'eco', 60), mk('b', 'eco', 55), mk('c', 'attack', 50), mk('d', 'attack', 90, 0.65 /* rare (≥0.6) → breaks the cluster dedup, but <0.7 so not hero */),
    ]);
    const primary = out.filter((i) => i.rankSection === 'primary');
    // 'a' (eco) + 'd' (rare attack) in primary; 'b' (eco dup) demoted, 'c' (attack dup, not rare) demoted.
    expect(primary.map((i) => i.id)).to.include('a');
    expect(primary.map((i) => i.id)).to.include('d');
    expect(primary.map((i) => i.id)).to.not.include('b');
  });

  it('finalScore: a rare/dramatic fact out-ranks a higher raw priority', () => {
    const routine: InsightCandidate = {id: 'r', group: 'category', priority: 70, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: []};
    const rare: InsightCandidate = {id: 'x', group: 'cards', priority: 50, severity: 'major', icon: 'spark', badge: 'B', textKey: 't', params: [], scores: {rarity: 0.9, drama: 0.8}};
    expect(finalScore(rare)).to.be.greaterThan(finalScore(routine));
  });

  it('partial-confidence scales the score down (no overclaim dominance)', () => {
    const exact: InsightCandidate = {id: 'e', group: 'cards', priority: 50, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: [], scores: {impact: 1, confidence: 1}};
    const partial: InsightCandidate = {id: 'p', group: 'cards', priority: 50, severity: 'normal', icon: 'spark', badge: 'B', textKey: 't', params: [], scores: {impact: 1, confidence: 0.5}};
    expect(finalScore(exact)).to.be.greaterThan(finalScore(partial));
  });

  // ── Iteration 6: deep story expansion ──

  it('runner-up story: stronger in a category but answered elsewhere', () => {
    const players = [pl('red', 'Nastya', 82), pl('blue', 'Victor', 74)];
    const c = ctx({players, margin: 8, categories: [
      cat('tr', {blue: 30, red: 18}), // Victor (runner-up) out-terraformed
      cat('cards', {red: 28, blue: 12}), // Nastya answered with cards
    ]});
    const ins = find(c, 'fact.runnerup.category');
    expect(ins, 'runner-up story').to.not.be.undefined;
    expect(ins!.family).to.eq('runnerUpStory');
  });

  it('category structure: a two-pillar win', () => {
    const players = [pl('red', 'Nastya', 90), pl('blue', 'Victor', 78)];
    const c = ctx({players, margin: 12, categories: [
      cat('cards', {red: 30, blue: 18}), // +12
      cat('mca', {red: 20, blue: 12}),   // +8 (>= 12*0.55)
    ]});
    expect(ids(c)).to.include('fact.category.twopillar');
  });

  it('standard-project strategy fires on a project-heavy player', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('standardProject', {id: 'standardProject:red', player: 'red', metrics: {projects: 6, parameterSteps: 5}}),
    ]});
    expect(ids(c)).to.include('fact.standardProject.strategy');
  });

  it('unused potential: a player left a big M€ pile', () => {
    const players = [pl('red', 'Nastya', 80), pl('blue', 'Victor', 70)];
    players[1].megacredits = 42; // Victor ends rich but lost
    const c = ctx({players, margin: 10});
    const ins = find(c, 'fact.unused.money');
    expect(ins, 'unused money insight').to.not.be.undefined;
    expect(ins!.family).to.eq('unusedPotential');
  });

  it('notable moment: a late economy burst', () => {
    const c = ctx({players: duo(), margin: 10, facts: [
      fact('notableEvent', {id: 'notable:economyBurst', player: 'red', generation: 13, metrics: {savedMegacredits: 18, generation: 13}}),
    ]});
    const ins = find(c, 'fact.notable.economyBurst');
    expect(ins, 'economy burst notable').to.not.be.undefined;
    expect(ins!.relatedGeneration).to.eq(13);
  });

  it('Predators normal tier (3–5 animals) reads as a hunt, not a rare raid', () => {
    const c = ctx({players: duo(), margin: 10,
      facts: [fact('negativeInteraction', {id: 'attack:red->blue', player: 'red', targetPlayer: 'blue', metrics: {totalLost: 4, hits: 2, Animal: 4}})],
      playerCards: {red: [CardName.PREDATORS]}});
    const pred = find(c, 'fact.negative.predators');
    expect(pred, 'Predators normal insight').to.not.be.undefined;
    expect(pred!.severity, 'a normal hunt, not major').to.eq('normal');
  });

  it('buildInsightCandidates exposes scored candidates for debug', () => {
    const c = ctx({players: duo(), margin: 10, facts: [fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 30}})]});
    const cands = buildInsightCandidates(c);
    expect(cands.length).to.be.greaterThan(0);
    expect(cands.every((x) => typeof x.finalScore === 'number'), 'every candidate has finalScore').to.be.true;
    // Sorted strongest-first.
    expect(cands[0].finalScore).to.be.gte(cands[cands.length - 1].finalScore ?? 0);
    expect(cands.some((x) => x.id === 'fact.economy.engine'), 'includes the economy candidate').to.be.true;
  });

  // ── Iteration 7: duel-specific ──

  it('duel style contrast: two different styles → a comparison hero', () => {
    const players = [pl('red', 'Nastya', 84, {strongestCategory: 'cards'}), pl('blue', 'Victor', 76, {strongestCategory: 'tr'})];
    const c = ctx({players, margin: 8});
    const ins = find(c, 'duel.styleContrast');
    expect(ins, 'style contrast insight').to.not.be.undefined;
    expect(ins!.family).to.eq('duelContrast');
    expect(ins!.relatedPlayers).to.have.length(2);
  });

  it('award race: a sponsor who LOST their own award (funded by A, won by B)', () => {
    const players = [
      pl('red', 'Nastya', 82, {detailsAwards: [award('1st', 'Banker', 'Victor', 5)]}), // Nastya won it
      pl('blue', 'Victor', 74, {detailsAwards: [award('2nd', 'Banker', 'Victor', 2)]}), // Victor funded but 2nd
    ];
    const c = ctx({players, margin: 8});
    const ins = find(c, 'duel.award.sponsorLost');
    expect(ins, 'sponsor-lost award insight').to.not.be.undefined;
    expect(ins!.relatedPlayers).to.include('blue');
    expect(ins!.relatedPlayers).to.include('red');
  });

  it('award swing bigger than the margin (no sponsor-lost)', () => {
    const players = [
      pl('red', 'Nastya', 80, {detailsAwards: [award('1st', 'Scientist', 'Nastya', 5)]}),
      pl('blue', 'Victor', 76, {detailsAwards: [award('2nd', 'Scientist', 'Nastya', 0)]}),
    ];
    const c = ctx({players, margin: 4});
    expect(ids(c)).to.include('duel.award.swing');
  });

  it('milestone lockout: winner claimed several, runner-up none', () => {
    const players = [
      pl('red', 'Nastya', 85, {detailsMilestones: [milestone('Builder'), milestone('Planner')]}),
      pl('blue', 'Victor', 75, {}),
    ];
    const c = ctx({players, margin: 10});
    expect(ids(c)).to.include('duel.milestone.lockout');
  });

  it('category counterplay: winner took one category, runner-up answered with another', () => {
    const players = [pl('red', 'Nastya', 84), pl('blue', 'Victor', 76)];
    const c = ctx({players, margin: 8, categories: [cat('cards', {red: 30, blue: 16}), cat('board', {blue: 24, red: 12})]});
    expect(ids(c)).to.include('duel.counterplay');
  });

  it('economy conversion: winner less rich but more efficient (suppresses generic underdog)', () => {
    const players = [pl('red', 'Nastya', 80), pl('blue', 'Victor', 70)];
    const c = ctx({players, margin: 10, facts: [
      fact('economy', {id: 'economy:red', player: 'red', metrics: {savedMegacredits: 4}}),
      fact('economy', {id: 'economy:blue', player: 'blue', metrics: {savedMegacredits: 24}}),
    ]});
    const out = generateInsights(c);
    expect(out.some((i) => i.id === 'duel.economyConversion'), 'duel conversion present').to.be.true;
    expect(out.some((i) => i.id === 'fact.economy.underdog'), 'generic underdog suppressed').to.be.false;
  });

  it('almost: penalties cost the runner-up the match', () => {
    const players = [pl('red', 'Nastya', 78), pl('blue', 'Victor', 74, {penaltyCards: [{cardName: 'X', victoryPoint: -6}]})];
    const c = ctx({players, margin: 4});
    expect(ids(c)).to.include('duel.almost.penalty');
  });

  it('duel selector surfaces BOTH players, not only the winner', () => {
    const players = [pl('red', 'Nastya', 84, {strongestCategory: 'cards'}), pl('blue', 'Victor', 76, {strongestCategory: 'tr'})];
    const c = ctx({players, margin: 8, categories: [cat('cards', {red: 30, blue: 16}), cat('board', {blue: 22, red: 10})]});
    const out = generateInsights(c);
    const players2 = new Set<string>();
    for (const i of out) {
      (i.relatedPlayers ?? []).forEach((p) => players2.add(p));
    }
    expect(players2.has('red') && players2.has('blue'), 'both players appear in the story').to.be.true;
  });

  // ── Iteration 8: special card story registry (source-aware attacks) ──

  const cardAttack = (player: Color, victim: Color, sourceCard: CardName, metrics: Record<string, number>): EndgameFact =>
    fact('cardAttack', {id: `cardAttack:${player}:${sourceCard}:${victim}`, player, targetPlayer: victim, sourceCard, metrics});

  it('production steal: a card that hijacked production → insight', () => {
    const c = ctx({players: duo(), margin: 10, facts: [cardAttack('red', 'blue', CardName.SABOTAGE, {total: 3, production: 1, transfer: 1, energy: 3})]});
    const ins = find(c, 'special.productionSteal');
    expect(ins, 'production steal insight').to.not.be.undefined;
    expect(ins!.relatedCards).to.include(CardName.SABOTAGE);
  });

  it('production steal: a tiny hit (1) does NOT fire (no spam)', () => {
    const c = ctx({players: duo(), margin: 10, facts: [cardAttack('red', 'blue', CardName.SABOTAGE, {total: 1, production: 1, energy: 1})]});
    expect(find(c, 'special.productionSteal'), 'tiny production hit is not a story').to.be.undefined;
  });

  it('resource-on-card disruption: a microbe engine broken → rare insight', () => {
    const c = ctx({players: duo(), margin: 10, facts: [cardAttack('red', 'blue', CardName.SABOTAGE, {total: 5, production: 0, Microbe: 5})]});
    const ins = find(c, 'special.resourceDisruption');
    expect(ins, 'resource disruption insight').to.not.be.undefined;
    expect(ins!.family).to.eq('rareEvent');
  });

  it('resource disruption EXCLUDES animals (Predators owns that story)', () => {
    const c = ctx({players: duo(), margin: 10, facts: [cardAttack('red', 'blue', CardName.PREDATORS, {total: 6, production: 0, Animal: 6})]});
    expect(find(c, 'special.resourceDisruption'), 'animals are not generic disruption').to.be.undefined;
  });

  it('plant denial: a big plant strip → insight', () => {
    const c = ctx({players: duo(), margin: 10, facts: [cardAttack('red', 'blue', CardName.ASTEROID, {total: 7, production: 0, plants: 7})]});
    expect(ids(c)).to.include('special.plantDenial');
  });

  it('counter-style: plant attack on a board-heavy victim supersedes plain plant denial', () => {
    const c = ctx({players: duo(), margin: 10,
      facts: [cardAttack('red', 'blue', CardName.ASTEROID, {total: 6, production: 0, plants: 6})],
      categories: [cat('board', {blue: 16, red: 4})]});
    const out = generateInsights(c);
    expect(out.some((i) => i.id === 'special.counterStyle'), 'counter-style present').to.be.true;
    expect(out.some((i) => i.id === 'special.plantDenial'), 'plant-denial suppressed by counter').to.be.false;
  });

  it('no card attacks → no special-card stories (graceful)', () => {
    const out = ids(ctx({players: duo(), margin: 10}));
    expect(out.some((id) => id.startsWith('special.')), 'no special stories without attacks').to.be.false;
  });
});
