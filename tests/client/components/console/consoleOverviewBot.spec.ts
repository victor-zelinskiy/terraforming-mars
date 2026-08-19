import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput, automaCardsTotal} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildConsoleOverviewVm, ConsoleOverviewExtras,
} from '@/client/console/endgame/consoleOverviewModel';
import {VictoryPointsBreakdown, AutomaVictoryPoints} from '@/common/game/VictoryPointsBreakdown';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
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
  // Mirror production: card VP always ships its details (the server itemises
  // every scored card), so the reveal families can re-sum it.
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

function human(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, extra: Partial<EndgamePlayerInput> = {}): EndgamePlayerInput {
  return {color, name, corporations: [], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}, ...extra};
}

function bot(
  automa: AutomaVictoryPoints,
  b: Partial<VictoryPointsBreakdown> = {},
  difficulty: DifficultyLevel = 'hard',
  megacredits = automa.mcToVp * automa.mcPerVp,
): EndgamePlayerInput {
  return {
    color: 'green', name: 'Бот', rawName: 'MarsBot', corporations: [],
    megacredits,
    breakdown: breakdown({...b, automa}),
    vpByGeneration: [], globalSteps: {},
    botDifficulty: difficulty,
  };
}

function extras(partial: Partial<ConsoleOverviewExtras> = {}): ConsoleOverviewExtras {
  return {
    expansions: {venus: false, moon: false, colonies: false},
    globalsPerGeneration: [],
    playersRaw: [],
    ...partial,
  };
}

function build(
  inputs: ReadonlyArray<EndgamePlayerInput>,
  ex: Partial<ConsoleOverviewExtras> = {},
  botColors: ReadonlyArray<Color> = ['green'],
) {
  const model = buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 13});
  const egVm = buildConsoleEndgameVm(model, inputs.map((p) => p.color), {botColors});
  const vm = buildConsoleOverviewVm(model, egVm, extras(ex));
  return {model, egVm, vm};
}

const AUTOMA: AutomaVictoryPoints = {mcToVp: 7, mcPerVp: 3, neuralInstance: 4, cardVp: 24};

describe('consoleOverview — MarsBot endgame profile', () => {
  // ── source classification (one test per scoring source) ─────────────────
  it('M€ conversion is a RESOURCE card source with the real rate and stock', () => {
    const {vm} = build([human('red', 'A', {}), bot({...AUTOMA, neuralInstance: 0, cardVp: 0}, {}, 'normal', 21)]);
    const row = vm.cards.rows.find((r) => r.id === 'green:bot:mc');
    expect(row).to.not.eq(undefined);
    expect(row?.kind).to.eq('resource');
    expect(row?.cardName).to.eq('M€ converted to VP');
    expect(row?.vp).to.eq(7);
    expect(row?.bot).to.deep.eq({kind: 'mc', stock: 21, rate: 3});
  });

  it('Neural Instance is a CONDITIONAL source carrying its adjacency count', () => {
    const {vm} = build([human('red', 'A', {}), bot({...AUTOMA, mcToVp: 0, cardVp: 0})]);
    const row = vm.cards.rows.find((r) => r.id === 'green:bot:neural');
    expect(row?.kind).to.eq('conditional');
    expect(row?.cardName).to.eq('Neural Instance');
    expect(row?.bot).to.deep.eq({kind: 'neural', count: 4});
  });

  it('played-card icons are a FIXED source and carry the difficulty (hard/brutal rule)', () => {
    const {vm} = build([human('red', 'A', {}), bot({...AUTOMA, mcToVp: 0, neuralInstance: 0}, {}, 'brutal')]);
    const row = vm.cards.rows.find((r) => r.id === 'green:bot:icons');
    expect(row?.kind).to.eq('fixed');
    expect(row?.cardName).to.eq('Played card icons');
    expect(row?.bot).to.deep.eq({kind: 'icons', count: 24, difficulty: 'Brutal'});
  });

  it('a zero source produces NO row (a bot without card VP shows an empty list)', () => {
    const {vm} = build([human('red', 'A', {}), bot({mcToVp: 0, mcPerVp: 8, neuralInstance: 0, cardVp: 0})]);
    expect(vm.cards.rows.filter((r) => r.owner === 'green')).to.deep.eq([]);
    expect(vm.cards.byPlayer.find((p) => p.color === 'green')?.cardsVp).to.eq(0);
  });

  // ── the hard invariants (Score = Cards = Players = Insights) ────────────
  it('the «35 vs 0» disagreement is gone: filter chip === ceremony Cards === sum of bot rows', () => {
    const {model, egVm, vm} = build([human('red', 'A', {victoryPoints: 10}), bot(AUTOMA)]);
    const ceremonyCards = egVm.categories.find((c) => c.key === 'cards')!.values['green'];
    expect(ceremonyCards).to.eq(35); // 7 + 4 + 24
    const chip = vm.cards.byPlayer.find((p) => p.color === 'green')!;
    expect(chip.cardsVp).to.eq(ceremonyCards);
    const rowSum = vm.cards.rows.filter((r) => r.owner === 'green').reduce((s, r) => s + r.vp, 0);
    expect(rowSum).to.eq(ceremonyCards);
    // …and the INSIGHT layer sees the same number (endgameModel category).
    const botScore = model.players.find((p) => p.color === 'green')!;
    expect(botScore.categories.cards).to.eq(ceremonyCards);
    expect(automaCardsTotal(botScore.breakdown)).to.eq(35);
    // Players tab score profile — the same canonical category.
    const botCard = vm.players.players.find((p) => p.color === 'green')!;
    expect(botCard.categories.find((c) => c.key === 'cards')?.value).to.eq(ceremonyCards);
  });

  it('the «63 vs 61» disagreement is explained: chip = positive families (Score), penalties stay visible rows', () => {
    const a = human('red', 'A', {
      victoryPoints: 61, // net: 63 positive − 2 penalty
      detailsCards: [
        {cardName: 'Big', victoryPoint: 40, kind: 'conditional'},
        {cardName: 'Small', victoryPoint: 23, kind: 'fixed'},
        {cardName: 'Bad', victoryPoint: -2, kind: 'penalty'},
      ],
    });
    const {egVm, vm} = build([a, bot(AUTOMA)]);
    const ceremonyCards = egVm.categories.find((c) => c.key === 'cards')!.values['red'];
    expect(ceremonyCards).to.eq(63); // the Score tab's number
    expect(vm.cards.byPlayer.find((p) => p.color === 'red')?.cardsVp).to.eq(63);
    const penaltyCat = egVm.categories.find((c) => c.key === 'penalty')!.values['red'];
    expect(penaltyCat).to.eq(-2);
    // Positive rows explain the 63; the −2 stays an explicit penalty row.
    const redRows = vm.cards.rows.filter((r) => r.owner === 'red');
    expect(redRows.filter((r) => r.vp > 0).reduce((s, r) => s + r.vp, 0)).to.eq(63);
    expect(redRows.find((r) => r.vp < 0)?.vp).to.eq(-2);
  });

  it('sum of top-level ceremony categories still equals the final total (bot included)', () => {
    const {egVm} = build([human('red', 'A', {victoryPoints: 10, greenery: 3}), bot(AUTOMA, {greenery: 2, milestones: 5})]);
    for (const row of egVm.rows) {
      const sum = egVm.categories.reduce((acc, c) => acc + (c.values[row.color] ?? 0), 0);
      expect(sum, row.color).to.eq(row.finalTotal);
    }
  });

  // ── identity: difficulty + canonical name ────────────────────────────────
  it('every difficulty level resolves to its label on ceremony rows, ranking and the player profile', () => {
    const levels: Array<[DifficultyLevel, string]> = [
      ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['brutal', 'Brutal'],
    ];
    for (const [level, label] of levels) {
      const {egVm, vm} = build([human('red', 'A', {}), bot(AUTOMA, {}, level)]);
      expect(egVm.rows.find((r) => r.isBot)?.difficulty, level).to.eq(label);
      expect(vm.digest.ranking.find((r) => r.isBot)?.difficulty, level).to.eq(label);
      expect(vm.players.players.find((p) => p.isBot)?.difficulty, level).to.eq(label);
    }
  });

  it('the raw award-funder name maps to the canonical display name («MarsBot» → «Бот»)', () => {
    const {vm} = build([human('red', 'A', {}), bot(AUTOMA)]);
    expect(vm.players.displayNames['MarsBot']).to.eq('Бот');
  });

  // ── the players tab: honest groups + honest bars ─────────────────────────
  it('the bot wears its OWN groups (economy/tracks), never human production/stock/tags', () => {
    const {vm} = build(
      [human('red', 'A', {}), bot(AUTOMA)],
      {automa: {tracks: [{tag: Tag.BUILDING, position: 3, max: 12}], playedCount: 31}});
    const botCard = vm.players.players.find((p) => p.isBot)!;
    expect(botCard.production).to.deep.eq([]);
    expect(botCard.stock).to.deep.eq([]);
    expect(botCard.tags).to.deep.eq([]);
    expect(botCard.groups.map((g) => g.key)).to.deep.eq(['boteco', 'stats', 'bottracks', 'ma', 'categories']);
    expect(botCard.botEconomy).to.deep.eq({stock: 21, rate: 3, vp: 7, playedCount: 31});
    expect(botCard.botTracks).to.deep.eq([{tag: Tag.BUILDING, position: 3, max: 12}]);
    // …and the bot never took the human «Actions» metric with a fake 0.
    expect(botCard.stats.some((s) => s.key === 'stat:actions')).to.eq(false);
  });

  it('a bar exists only where ≥2 participants carry the metric (human-vs-bot: economy bars are OFF)', () => {
    const {vm} = build([human('red', 'A', {}, {production: {megacredits: 9, steel: 1, titanium: 0, plants: 2, energy: 1, heat: 0}}), bot(AUTOMA)]);
    // Production/stock: the human is alone → not comparable, no bars.
    expect(vm.players.comparable['prod:megacredits']).to.eq(1);
    expect(vm.players.comparable['stock:heat']).to.eq(1);
    // Stats: both participants → comparable, bars stay.
    expect(vm.players.comparable['stat:tr']).to.eq(2);
    expect(vm.players.comparable['stat:steps']).to.eq(2);
    // The bot's own group list marks economy non-comparable for the A-detail.
    const botCard = vm.players.players.find((p) => p.isBot)!;
    expect(botCard.groups.find((g) => g.key === 'boteco')?.comparable).to.eq(false);
    expect(botCard.groups.find((g) => g.key === 'stats')?.comparable).to.eq(true);
  });

  it('human-only games regress nowhere: no difficulty, no bot rows, human groups intact', () => {
    const {model, egVm, vm} = build(
      [human('red', 'A', {victoryPoints: 8}), human('blue', 'B', {victoryPoints: 3})], {}, []);
    expect(egVm.rows.every((r) => r.difficulty === undefined)).to.eq(true);
    expect(vm.cards.rows.every((r) => r.bot === undefined)).to.eq(true);
    expect(vm.players.players.every((p) => p.botEconomy === undefined)).to.eq(true);
    expect(vm.players.players[0].groups.map((g) => g.key)).to.deep.eq(
      ['production', 'stock', 'stats', 'tags', 'ma', 'categories']);
    expect(vm.players.comparable['prod:megacredits']).to.eq(2); // bars stay for two humans
    expect(model.players.find((p) => p.color === 'red')?.categories.cards).to.eq(8); // automa fold is a no-op
  });

  // ── insights ─────────────────────────────────────────────────────────────
  it('the bot card engine reaches the insight layer with the ceremony\'s own number (no «luck» wording)', () => {
    const {model} = build([human('red', 'A', {victoryPoints: 4}), bot(AUTOMA)]);
    const botInsight = model.insights.find((i) => i.id === 'cards.bot-engine.green');
    expect(botInsight, 'the bot card-engine insight should be selected in a quiet game').to.not.eq(undefined);
    expect(botInsight?.textKey.toLowerCase()).to.not.contain('luck');
    expect(botInsight?.evidenceChips?.[0]).to.deep.eq({t: 'raw', v: '+35', label: 'VP', tone: 'metric'});
  });

  it('a small bot card engine (< 8 VP) tells no story', () => {
    const {model} = build([human('red', 'A', {victoryPoints: 20}), bot({mcToVp: 3, mcPerVp: 8, neuralInstance: 2, cardVp: 0})]);
    expect(model.insights.find((i) => i.id?.startsWith('cards.bot-engine'))).to.eq(undefined);
  });

  // ── the diagnostic table (test-only proof: nothing lost, nothing doubled) ─
  it('diagnostic contribution table: every point lands exactly once', () => {
    const inputs = [
      human('red', 'A', {
        terraformRating: 53, milestones: 5, awards: 15, greenery: 7, city: 14, deltaProject: 5,
        victoryPoints: 61,
        detailsCards: [
          {cardName: 'Big', victoryPoint: 40, kind: 'conditional'},
          {cardName: 'Small', victoryPoint: 23, kind: 'resource'},
          {cardName: 'Bad', victoryPoint: -2, kind: 'penalty'},
        ],
      }),
      bot({mcToVp: 7, mcPerVp: 3, neuralInstance: 4, cardVp: 24},
        {terraformRating: 62, milestones: 10, awards: 15, greenery: 10, city: 16}),
    ];
    const {egVm, vm} = build(inputs);
    const table: Array<{participant: string; category: string; source: string; value: number}> = [];
    for (const row of egVm.rows) {
      for (const cat of egVm.categories) {
        const subs = cat.subs.length > 0 ? cat.subs : [{key: cat.key, label: cat.label, values: cat.values}];
        for (const sub of subs) {
          const v = sub.values[row.color] ?? 0;
          if (v !== 0) {
            table.push({participant: row.name, category: cat.label, source: sub.label, value: v});
          }
        }
      }
    }
    // The table's per-participant sum IS the final score — nothing lost or doubled.
    for (const row of egVm.rows) {
      const sum = table.filter((t) => t.participant === row.name).reduce((s, t) => s + t.value, 0);
      expect(sum, row.name).to.eq(row.finalTotal);
    }
    // The Cards tab explains the whole Cards category for every participant.
    for (const p of vm.cards.byPlayer) {
      const positives = vm.cards.rows.filter((r) => r.owner === p.color && r.vp > 0).reduce((s, r) => s + r.vp, 0);
      expect(positives, p.name).to.eq(p.cardsVp);
    }
    // Human 160 / bot 148 — the representative party from the field report.
    expect(egVm.rows.map((r) => r.finalTotal)).to.deep.eq([160, 148]);
  });
});
