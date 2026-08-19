import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildConsoleOverviewVm, selectHeadline, ConsoleOverviewExtras,
  OVERVIEW_TAB_ORDER, HEADLINE_MAX,
} from '@/client/console/endgame/consoleOverviewModel';
import type {KeyEpisode} from '@/client/components/endgame/keyEpisodeEngine';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {GlobalParameter} from '@/common/GlobalParameter';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';

function breakdown(partial: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  const base: VictoryPointsBreakdown = {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0,
    awards: 0,
    greenery: 0,
    city: 0,
    escapeVelocity: 0,
    moonHabitats: 0,
    moonMines: 0,
    moonRoads: 0,
    planetaryTracks: 0,
    deltaProject: 0,
    victoryPoints: 0,
    total: 20,
    detailsCards: [],
    detailsMilestones: [],
    detailsAwards: [],
    detailsPlanetaryTracks: [],
    negativeVP: 0,
  };
  const merged = {...base, ...partial};
  const trb = merged.terraformRatingBreakdown;
  merged.terraformRatingBreakdown = {...trb, base: merged.terraformRating - (trb.temperature + trb.oxygen + trb.oceans + trb.venus + trb.cards + (trb.hazards ?? 0))};
  if (merged.victoryPoints !== 0 && merged.detailsCards.length === 0) {
    merged.detailsCards = [{cardName: 'TestFixed', victoryPoint: merged.victoryPoints, kind: 'fixed'}];
  }
  if (partial.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery +
      merged.city + merged.victoryPoints + merged.moonHabitats + merged.moonMines + merged.moonRoads +
      merged.planetaryTracks + merged.escapeVelocity + merged.deltaProject +
      (merged.automa !== undefined ? merged.automa.mcToVp + merged.automa.neuralInstance + merged.automa.cardVp : 0);
  }
  return merged;
}

function player(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, extra: Partial<EndgamePlayerInput> = {}): EndgamePlayerInput {
  return {color, name, corporations: [], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}, ...extra};
}

function extras(partial: Partial<ConsoleOverviewExtras> = {}): ConsoleOverviewExtras {
  return {
    expansions: {venus: false, moon: false, colonies: false},
    globalsPerGeneration: [],
    playersRaw: [],
    ...partial,
  };
}

function ovVmOf(
  inputs: ReadonlyArray<EndgamePlayerInput>,
  opts: Partial<Parameters<typeof buildEndgameModel>[1]> = {},
  ex: Partial<ConsoleOverviewExtras> = {},
  botColors: ReadonlyArray<Color> = [],
) {
  const model = buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10, ...opts});
  const egVm = buildConsoleEndgameVm(model, inputs.map((p) => p.color), {botColors});
  return {model, egVm, vm: buildConsoleOverviewVm(model, egVm, extras(ex))};
}

function episode(partial: Partial<KeyEpisode> & {id: string}): KeyEpisode {
  return {
    role: 'signature_moment',
    phase: 'mid',
    order: 0,
    badge: 'Key move',
    textKey: 'x',
    params: [],
    evidenceChips: [],
    impact: 0.5,
    confidence: 'high',
    ...partial,
  };
}

describe('consoleOverviewModel', () => {
  // ── headline selection (the dedup heart) ─────────────────────────────────
  it('headline: capped, role-prioritised, final_scoring and flavor excluded', () => {
    const eps = [
      episode({id: 'fin', role: 'final_scoring', impact: 1}),
      episode({id: 'fl', role: 'flavor_only', impact: 1}),
      episode({id: 'sig', role: 'signature_moment', impact: 0.2}),
      episode({id: 'dec', role: 'decisive_driver', impact: 0.9}),
      episode({id: 'turn', role: 'turning_point', impact: 0.5}),
      episode({id: 'twist', role: 'ironic_twist', impact: 0.4}),
      episode({id: 'near', role: 'near_miss', impact: 0.3}),
    ];
    const picked = selectHeadline(eps);
    expect(picked.length).to.eq(HEADLINE_MAX);
    expect(picked.map((c) => c.id)).to.deep.eq(['dec', 'turn', 'twist', 'near']);
  });

  it('headline: same-thought episodes collapse on dedupeKey, max two per role', () => {
    const eps = [
      episode({id: 'a1', role: 'decisive_driver', dedupeKey: 'award', impact: 0.9}),
      episode({id: 'a2', role: 'decisive_driver', dedupeKey: 'award', impact: 0.8}),
      episode({id: 'd2', role: 'decisive_driver', impact: 0.7}),
      episode({id: 'd3', role: 'decisive_driver', impact: 0.6}),
      episode({id: 'd4', role: 'decisive_driver', impact: 0.5}),
    ];
    const picked = selectHeadline(eps);
    // 'a2' is the same thought as 'a1'; only two decisive drivers may stand.
    expect(picked.map((c) => c.id)).to.deep.eq(['a1', 'd2']);
  });

  it('digest: observations are capped and never repeat a headline episode id', () => {
    const a = player('red', 'A', {terraformRating: 44, greenery: 8, victoryPoints: 12, milestones: 5},
      {vpByGeneration: [20, 24, 30, 38, 55], megacredits: 30});
    const b = player('blue', 'B', {terraformRating: 30, victoryPoints: 4}, {vpByGeneration: [20, 22, 25, 28, 33]});
    const {vm} = ovVmOf([a, b]);
    expect(vm.digest.observations.length).to.be.at.most(4);
    const headlineIds = new Set(vm.digest.headline.map((h) => h.id));
    for (const o of vm.digest.observations) {
      expect(headlineIds.has(o.id), o.id).to.eq(false);
    }
    expect(vm.digest.headline.length).to.be.at.most(HEADLINE_MAX);
  });

  // ── score ────────────────────────────────────────────────────────────────
  it('score: category values are the ceremony numbers and sum to the final total', () => {
    const a = player('red', 'A', {terraformRating: 30, greenery: 4, city: 3, victoryPoints: 7, milestones: 5, awards: 2});
    const b = player('blue', 'B', {terraformRating: 24, greenery: 2, victoryPoints: 3});
    const {vm, egVm} = ovVmOf([a, b]);
    for (const row of egVm.rows) {
      const sum = vm.score.categories.reduce((acc, c) => acc + (c.values[row.color] ?? 0), 0);
      expect(sum, row.color).to.eq(row.finalTotal);
    }
    expect(vm.score.maxCategoryValue).to.be.greaterThan(0);
  });

  it('score: the decisive category is the winner\'s biggest edge over the runner-up', () => {
    const a = player('red', 'A', {terraformRating: 30, greenery: 8, victoryPoints: 2}); // 40
    const b = player('blue', 'B', {terraformRating: 28, greenery: 1, victoryPoints: 4}); // 33
    const {vm} = ovVmOf([a, b]);
    expect(vm.score.decisive?.key).to.eq('greenery'); // +7 — bigger than TR's +2
    expect(vm.score.decisive?.delta).to.eq(7);
  });

  it('score: rank rows carry the gap to the winner (0 for the winner)', () => {
    const a = player('red', 'A', {terraformRating: 40});
    const b = player('blue', 'B', {terraformRating: 31});
    const {vm} = ovVmOf([a, b]);
    expect(vm.score.ranking[0].gapToWinner).to.eq(0);
    expect(vm.score.ranking[1].gapToWinner).to.eq(9);
  });

  // ── timeline ─────────────────────────────────────────────────────────────
  it('timeline: the comparable window is the shortest series, capped by the generation', () => {
    const a = player('red', 'A', {terraformRating: 40}, {vpByGeneration: [20, 25, 30, 40]});
    const b = player('blue', 'B', {terraformRating: 30}, {vpByGeneration: [20, 24, 30]});
    const {vm} = ovVmOf([a, b], {generation: 10});
    expect(vm.timeline.gens).to.eq(3);
    expect(vm.timeline.series.find((s) => s.color === 'red')?.data).to.deep.eq([20, 25, 30]);
    expect(vm.timeline.maxVp).to.eq(30);
  });

  it('timeline: a short party yields gens < 2 (the tab\'s empty state)', () => {
    const {vm} = ovVmOf([player('red', 'A', {}), player('blue', 'B', {})]);
    expect(vm.timeline.gens).to.eq(0);
  });

  // ── cards ────────────────────────────────────────────────────────────────
  it('cards: positives by impact desc, then penalties (most negative first)', () => {
    const a = player('red', 'A', {
      victoryPoints: 9,
      detailsCards: [
        {cardName: 'Small', victoryPoint: 2, kind: 'fixed'},
        {cardName: 'Big', victoryPoint: 8, kind: 'conditional'},
        {cardName: 'Bad', victoryPoint: -1, kind: 'penalty'},
      ],
    });
    const b = player('blue', 'B', {
      victoryPoints: 5,
      detailsCards: [
        {cardName: 'Mid', victoryPoint: 5, kind: 'resource'},
        {cardName: 'Worse', victoryPoint: -4, kind: 'penalty'},
      ],
    });
    const {vm} = ovVmOf([a, b]);
    expect(vm.cards.rows.map((r) => r.cardName)).to.deep.eq(['Big', 'Mid', 'Small', 'Worse', 'Bad']);
    const red = vm.cards.byPlayer.find((p) => p.color === 'red')!;
    // The chip is the CANONICAL Score-tab «Карты» value: positive families
    // (10); the −1 penalty stays a visible row under its own category.
    expect(red.cardsVp).to.eq(10);
    expect(red.count).to.eq(3);
  });

  it('cards: the bot is an ordinary participant (same summary shape, flagged)', () => {
    const a = player('red', 'A', {victoryPoints: 3});
    const bot = player('neutral', 'Бот', {victoryPoints: 5});
    const {vm} = ovVmOf([a, bot], {}, {}, ['neutral']);
    const botRow = vm.cards.byPlayer.find((p) => p.color === 'neutral')!;
    expect(botRow.isBot).to.eq(true);
    expect(botRow.cardsVp).to.eq(5);
    expect(vm.players.players.find((p) => p.color === 'neutral')?.isBot).to.eq(true);
  });

  // ── parameters ───────────────────────────────────────────────────────────
  it('parameters: disabled expansions leave no empty series (venus/moon gated)', () => {
    const gpg: Array<Partial<Record<GlobalParameter, number>>> = [
      {[GlobalParameter.TEMPERATURE]: -30, [GlobalParameter.OXYGEN]: 0, [GlobalParameter.OCEANS]: 0},
      {[GlobalParameter.TEMPERATURE]: -20, [GlobalParameter.OXYGEN]: 3, [GlobalParameter.OCEANS]: 2},
    ];
    const {vm} = ovVmOf([player('red', 'A', {}), player('blue', 'B', {})], {}, {globalsPerGeneration: gpg});
    const keys = vm.parameters.parameters.map((p) => p.key);
    expect(keys).to.deep.eq([GlobalParameter.TEMPERATURE, GlobalParameter.OXYGEN, GlobalParameter.OCEANS]);
    expect(vm.parameters.gens).to.eq(2);
  });

  it('parameters: venus rides its expansion and normalises to % completion', () => {
    const gpg: Array<Partial<Record<GlobalParameter, number>>> = [
      {[GlobalParameter.TEMPERATURE]: -30, [GlobalParameter.VENUS]: 0},
      {[GlobalParameter.TEMPERATURE]: 8, [GlobalParameter.VENUS]: 15},
    ];
    const {vm} = ovVmOf(
      [player('red', 'A', {}), player('blue', 'B', {})],
      {hasVenus: true},
      {globalsPerGeneration: gpg, expansions: {venus: true, moon: false, colonies: false}});
    const venus = vm.parameters.parameters.find((p) => p.key === GlobalParameter.VENUS)!;
    expect(venus.pct).to.deep.eq([0, 50]);
    const temp = vm.parameters.parameters.find((p) => p.key === GlobalParameter.TEMPERATURE)!;
    expect(temp.completed).to.eq(true);
    expect(temp.pct[1]).to.eq(100);
  });

  it('parameters: an old save (no history) keeps the core tracks with an empty series', () => {
    const {vm} = ovVmOf([player('red', 'A', {}), player('blue', 'B', {})]);
    expect(vm.parameters.gens).to.eq(0);
    expect(vm.parameters.parameters.length).to.eq(3);
    expect(vm.parameters.parameters[0].series).to.deep.eq([]);
  });

  // ── players ──────────────────────────────────────────────────────────────
  it('players: colonies stat rides its expansion; tags sorted, capped, event-free', () => {
    const raw = [{
      color: 'red' as Color,
      tags: {
        [Tag.BUILDING]: 5, [Tag.SPACE]: 7, [Tag.SCIENCE]: 1, [Tag.EVENT]: 9,
        [Tag.EARTH]: 2, [Tag.PLANT]: 3, [Tag.JOVIAN]: 4, [Tag.POWER]: 6,
      },
      actionsTakenThisGame: 40,
      citiesCount: 2,
      coloniesCount: 3,
      terraformRating: 33,
    }];
    const base = {globalsPerGeneration: [], playersRaw: raw};
    const off = ovVmOf([player('red', 'A', {}), player('blue', 'B', {})], {}, base).vm;
    const offCard = off.players.players.find((p) => p.color === 'red')!;
    expect(offCard.stats.some((s) => s.key === 'stat:colonies')).to.eq(false);
    const on = ovVmOf([player('red', 'A', {}), player('blue', 'B', {})], {},
      {...base, expansions: {venus: false, moon: false, colonies: true}}).vm;
    const onCard = on.players.players.find((p) => p.color === 'red')!;
    expect(onCard.stats.some((s) => s.key === 'stat:colonies')).to.eq(true);
    expect(onCard.tags.length).to.eq(6); // capped
    expect(onCard.tags.some((t) => t.tag === Tag.EVENT)).to.eq(false);
    expect(onCard.tags[0]).to.deep.eq({tag: Tag.SPACE, count: 7});
  });

  it('players: maxima carry the cross-player comparison scale', () => {
    const a = player('red', 'A', {}, {production: {megacredits: 10, steel: 2, titanium: 0, plants: 4, energy: 1, heat: 3}});
    const b = player('blue', 'B', {}, {production: {megacredits: 4, steel: 6, titanium: 1, plants: 0, energy: 2, heat: 0}});
    const {vm} = ovVmOf([a, b]);
    expect(vm.players.maxima['prod:megacredits']).to.eq(10);
    expect(vm.players.maxima['prod:steel']).to.eq(6);
  });

  // ── shape ────────────────────────────────────────────────────────────────
  it('the tab ring is the six console tabs in exploration order', () => {
    expect(OVERVIEW_TAB_ORDER).to.deep.eq(['digest', 'score', 'timeline', 'cards', 'parameters', 'players']);
  });

  it('the winner nod matches the model', () => {
    const a = player('red', 'A', {terraformRating: 40});
    const b = player('blue', 'B', {terraformRating: 30});
    const {vm} = ovVmOf([a, b]);
    expect(vm.winner).to.deep.eq({color: 'red', name: 'A', total: 40});
    expect(vm.sharedWin).to.eq(false);
  });
});
