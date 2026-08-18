import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm, runningTotal} from '@/client/console/endgame/consoleEndgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

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
  // Mirror production: base is the reconciling remainder so the TR sub-parts
  // always sum to terraformRating.
  const trb = merged.terraformRatingBreakdown;
  merged.terraformRatingBreakdown = {...trb, base: merged.terraformRating - (trb.temperature + trb.oxygen + trb.oceans + trb.venus + trb.cards + (trb.hazards ?? 0))};
  // Mirror production: detailsCards sums to victoryPoints.
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

function model(inputs: ReadonlyArray<EndgamePlayerInput>, opts: Partial<Parameters<typeof buildEndgameModel>[1]> = {}) {
  return buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10, ...opts});
}

function vmOf(inputs: ReadonlyArray<EndgamePlayerInput>, opts: Partial<Parameters<typeof buildEndgameModel>[1]> = {}, botColors: ReadonlyArray<Color> = []) {
  return buildConsoleEndgameVm(model(inputs, opts), inputs.map((p) => p.color), {botColors});
}

function categorySum(vm: ReturnType<typeof vmOf>, color: Color): number {
  return vm.categories.reduce((acc, c) => acc + (c.values[color] ?? 0), 0);
}

describe('consoleEndgameModel', () => {
  it('per-player category sum equals the final total (ordinary multiplayer)', () => {
    const a = player('red', 'A', {terraformRating: 30, greenery: 4, city: 3, victoryPoints: 7, milestones: 5, awards: 2}); // 51
    const b = player('blue', 'B', {terraformRating: 24, greenery: 2, victoryPoints: 3}); // 29
    const vm = vmOf([a, b]);
    for (const row of vm.rows) {
      expect(categorySum(vm, row.color), row.color).to.eq(row.finalTotal);
    }
    expect(vm.rows.map((r) => r.finalTotal)).to.deep.eq([51, 29]);
  });

  it('keeps rows in NEUTRAL seating order and rankedColors winner-first', () => {
    const a = player('red', 'A', {terraformRating: 20});
    const b = player('blue', 'B', {terraformRating: 40});
    const vm = vmOf([a, b]);
    expect(vm.rows.map((r) => r.color)).to.deep.eq(['red', 'blue']); // seating
    expect(vm.rankedColors[0]).to.eq('blue'); // ranked
    expect(vm.rows.find((r) => r.color === 'blue')?.place).to.eq(1);
    expect(vm.rows.find((r) => r.color === 'red')?.place).to.eq(2);
  });

  it('reveals categories in the dramaturgic order — cards LAST among positives, penalties after', () => {
    const a = player('red', 'A', {
      terraformRating: 25, milestones: 5, awards: 2, greenery: 3, city: 2, victoryPoints: 6,
      escapeVelocity: -2,
    });
    const vm = vmOf([a, player('blue', 'B', {})]);
    const keys = vm.categories.map((c) => c.key);
    expect(keys).to.deep.eq(['tr', 'milestones', 'awards', 'greenery', 'city', 'cards', 'penalty']);
  });

  it('TR opens as a micro-reveal of its real sources, starting from the calm base', () => {
    const a = player('red', 'A', {
      terraformRating: 33,
      terraformRatingBreakdown: {base: 20, temperature: 4, oxygen: 3, oceans: 2, venus: 0, cards: 4},
    });
    const vm = vmOf([a, player('blue', 'B', {})]);
    const tr = vm.categories.find((c) => c.key === 'tr')!;
    expect(tr.subs.map((s) => s.label)).to.deep.eq(
      ['Starting rating', 'Temperature', 'Oxygen', 'Oceans', 'Cards & effects']); // venus 0 for all → dropped
    const subSum = tr.subs.reduce((acc, s) => acc + (s.values['red'] ?? 0), 0);
    expect(subSum).to.eq(tr.values['red']).and.to.eq(33);
  });

  it('sources absent for EVERY player do not exist (no dead beats, no absent expansions)', () => {
    const vm = vmOf([player('red', 'A', {}), player('blue', 'B', {})]);
    expect(vm.categories.map((c) => c.key)).to.deep.eq(['tr']); // only the always-kept TR base moved
    const tr = vm.categories[0];
    expect(tr.subs).to.deep.eq([]); // a single sub is NOT a micro-reveal
    expect(vm.categories.find((c) => c.key === 'moon')).to.eq(undefined);
  });

  it('a category that exists keeps an honest 0 for the player who scored nothing in it', () => {
    const a = player('red', 'A', {greenery: 5});
    const b = player('blue', 'B', {});
    const vm = vmOf([a, b]);
    const greenery = vm.categories.find((c) => c.key === 'greenery')!;
    expect(greenery.values['blue']).to.eq(0);
  });

  it('cards split into the three families in the console order (resource → conditional → fixed)', () => {
    const a = player('red', 'A', {
      victoryPoints: 12,
      detailsCards: [
        {cardName: 'Fixed', victoryPoint: 3, kind: 'fixed'},
        {cardName: 'Cond', victoryPoint: 4, kind: 'conditional'},
        {cardName: 'Res', victoryPoint: 5, kind: 'resource'},
      ],
    });
    const vm = vmOf([a, player('blue', 'B', {})]);
    const cards = vm.categories.find((c) => c.key === 'cards')!;
    expect(cards.subs.map((s) => s.key)).to.deep.eq(['cards-resource', 'cards-conditional', 'cards-fixed']);
    expect(cards.subs.map((s) => s.values['red'])).to.deep.eq([5, 4, 3]);
    expect(cards.values['red']).to.eq(12);
  });

  it('a single surviving card family collapses to a single beat (no fake micro-reveal)', () => {
    const a = player('red', 'A', {
      victoryPoints: 6,
      detailsCards: [{cardName: 'Fixed', victoryPoint: 6, kind: 'fixed'}],
    });
    const vm = vmOf([a, player('blue', 'B', {})]);
    const cards = vm.categories.find((c) => c.key === 'cards')!;
    expect(cards.subs).to.deep.eq([]);
    expect(cards.values['red']).to.eq(6);
  });

  // ── THE BOT NORMALISATION ────────────────────────────────────────────────

  it('dissolves the legacy «MarsBot scoring» into the card families — no automa category survives', () => {
    const bot = player('neutral', 'MarsBot', {
      automa: {mcToVp: 5, mcPerVp: 8, neuralInstance: 2, cardVp: 3},
    });
    const vm = vmOf([player('red', 'A', {victoryPoints: 4}), bot], {}, ['neutral']);
    expect(vm.categories.some((c) => (c.key as string) === 'automa')).to.eq(false);
    const cards = vm.categories.find((c) => c.key === 'cards')!;
    // mcToVp → resource, neuralInstance → conditional, cardVp → fixed.
    expect(cards.subs.find((s) => s.key === 'cards-resource')?.values['neutral']).to.eq(5);
    expect(cards.subs.find((s) => s.key === 'cards-conditional')?.values['neutral']).to.eq(2);
    expect(cards.subs.find((s) => s.key === 'cards-fixed')?.values['neutral']).to.eq(3);
    expect(cards.values['neutral']).to.eq(10);
  });

  it('maps EVERY legacy bot point exactly once: mapped families ≡ cards bucket + automa summands', () => {
    const bot = player('neutral', 'MarsBot', {
      // The bot can also carry ordinary victoryPoints entries (Turmoil/Colony VP).
      victoryPoints: 3,
      detailsCards: [{cardName: 'Colony VP', victoryPoint: 3, kind: 'conditional'}],
      automa: {mcToVp: 7, mcPerVp: 6, neuralInstance: 1, cardVp: 2},
    });
    const vm = vmOf([player('red', 'A', {}), bot], {}, ['neutral']);
    const cards = vm.categories.find((c) => c.key === 'cards')!;
    const mapped = cards.subs.reduce((acc, s) => acc + (s.values['neutral'] ?? 0), 0);
    expect(mapped).to.eq(3 + 7 + 1 + 2); // nothing lost, nothing doubled
    expect(cards.values['neutral']).to.eq(mapped);
    expect(categorySum(vm, 'neutral')).to.eq(vm.rows.find((r) => r.isBot)?.finalTotal);
  });

  it('the canonical bot example: 72 TR + 19 cities + 7 greenery + 15+15 laurels + 23 cards = 151', () => {
    const bot = player('neutral', 'MarsBot', {
      terraformRating: 72,
      terraformRatingBreakdown: {base: 20, temperature: 8, oxygen: 7, oceans: 6, venus: 8, hazards: 1, cards: 22},
      city: 19, greenery: 7, milestones: 15, awards: 15,
      automa: {mcToVp: 23, mcPerVp: 5, neuralInstance: 0, cardVp: 0},
    });
    const vm = vmOf([player('red', 'A', {terraformRating: 40}), bot], {hasVenus: true}, ['neutral']);
    const byKey = new Map(vm.categories.map((c) => [c.key, c.values['neutral'] ?? 0]));
    expect(byKey.get('tr')).to.eq(72);
    expect(byKey.get('city')).to.eq(19);
    expect(byKey.get('greenery')).to.eq(7);
    expect(byKey.get('milestones')).to.eq(15);
    expect(byKey.get('awards')).to.eq(15);
    expect(byKey.get('cards')).to.eq(23); // the old «Карты: 0 / Подсчёт бота: 23» is gone
    const botRow = vm.rows.find((r) => r.isBot)!;
    expect(botRow.finalTotal).to.eq(151);
    expect(categorySum(vm, 'neutral')).to.eq(151);
    // …and the bot's 23 M€-conversion points read as RESOURCE cards.
    const cards = vm.categories.find((c) => c.key === 'cards')!;
    expect(cards.subs).to.deep.eq([]); // one family moved → single beat
  });

  it('labels the bot-only TR residual «Track actions», a mixed one «Cards & effects»', () => {
    const botOnly = vmOf([
      player('red', 'A', {terraformRating: 24, terraformRatingBreakdown: {base: 20, temperature: 4, oxygen: 0, oceans: 0, venus: 0, cards: 0}}),
      player('neutral', 'MarsBot', {terraformRating: 30, terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 10}}),
    ], {}, ['neutral']);
    const trBot = botOnly.categories.find((c) => c.key === 'tr')!;
    expect(trBot.subs.find((s) => s.key === 'tr-cards')?.label).to.eq('Track actions');

    const mixed = vmOf([
      player('red', 'A', {terraformRating: 24, terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 4}}),
      player('neutral', 'MarsBot', {terraformRating: 30, terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 10}}),
    ], {}, ['neutral']);
    const trMixed = mixed.categories.find((c) => c.key === 'tr')!;
    expect(trMixed.subs.find((s) => s.key === 'tr-cards')?.label).to.eq('Cards & effects');
  });

  // ── ties, shared wins, the clock win ─────────────────────────────────────

  it('equal totals raise the tie-break stage and resolve it on M€', () => {
    const a = player('red', 'A', {terraformRating: 30}, {megacredits: 12});
    const b = player('blue', 'B', {terraformRating: 30}, {megacredits: 40});
    const vm = vmOf([a, b]);
    expect(vm.tieBreak).to.not.eq(undefined);
    expect(vm.tieBreak?.contenders.sort()).to.deep.eq(['blue', 'red']);
    expect(vm.tieBreak?.values['blue']).to.eq(40);
    expect(vm.winners).to.deep.eq(['blue']);
    expect(vm.winner).to.eq('blue');
  });

  it('a full tie (VP and M€) is a SHARED victory — never an arbitrary pick', () => {
    const a = player('red', 'A', {terraformRating: 30}, {megacredits: 15});
    const b = player('blue', 'B', {terraformRating: 30}, {megacredits: 15});
    const vm = vmOf([a, b]);
    expect(vm.winners.slice().sort()).to.deep.eq(['blue', 'red']);
    expect(vm.winner).to.eq(undefined);
    expect(vm.rows.every((r) => r.isWinner)).to.eq(true);
    expect(vm.rows.map((r) => r.place)).to.deep.eq([1, 1]);
  });

  it('a MarsBot clock win overrides the comparison — forced winner, no tie-break', () => {
    const a = player('red', 'A', {terraformRating: 60});
    const bot = player('neutral', 'MarsBot', {terraformRating: 25});
    const vm = vmOf([a, bot], {automaClockWinner: 'neutral'}, ['neutral']);
    expect(vm.automaClockWin).to.eq(true);
    expect(vm.winners).to.deep.eq(['neutral']);
    expect(vm.tieBreak).to.eq(undefined);
    expect(vm.rankedColors[0]).to.eq('neutral');
  });

  it('handles the maximum table — five players, all rows, all invariants', () => {
    const colors: ReadonlyArray<Color> = ['red', 'blue', 'green', 'yellow', 'purple'];
    const inputs = colors.map((c, i) => player(c, 'Игрок с длинным именем ' + i, {
      terraformRating: 20 + i * 3, greenery: i, victoryPoints: i * 2, milestones: i % 2 === 0 ? 5 : 0,
    }, {megacredits: i}));
    const vm = vmOf(inputs);
    expect(vm.rows.map((r) => r.color)).to.deep.eq(colors);
    for (const row of vm.rows) {
      expect(categorySum(vm, row.color), row.color).to.eq(row.finalTotal);
    }
    expect(new Set(vm.rankedColors).size).to.eq(5);
  });

  it('penalties land as the LAST, subtractive category and keep the sum exact', () => {
    const a = player('red', 'A', {
      terraformRating: 30, greenery: 4,
      victoryPoints: 2,
      detailsCards: [
        {cardName: 'Good', victoryPoint: 5, kind: 'fixed'},
        {cardName: 'Vermin', victoryPoint: -3, kind: 'penalty'},
      ],
      escapeVelocity: -2,
    }); // 30 + 4 + 2 - 2 = 34
    const vm = vmOf([a, player('blue', 'B', {})]);
    const penalty = vm.categories[vm.categories.length - 1];
    expect(penalty.key).to.eq('penalty');
    expect(penalty.penalty).to.eq(true);
    expect(penalty.values['red']).to.eq(-5); // -3 card + -2 EV
    expect(categorySum(vm, 'red')).to.eq(34);
    expect(vm.rows.find((r) => r.color === 'red')?.finalTotal).to.eq(34);
  });

  it('solo: one row, mode solo, victory only on the real solo win', () => {
    const won = vmOf([player('red', 'A', {terraformRating: 40})], {soloWin: true});
    expect(won.mode).to.eq('solo');
    expect(won.soloWin).to.eq(true);
    expect(won.winners).to.deep.eq(['red']);
    const lost = vmOf([player('red', 'A', {terraformRating: 40})], {soloWin: false});
    expect(lost.winners).to.deep.eq([]);
  });

  it('runningTotal walks the category prefix (the count-up contract)', () => {
    const a = player('red', 'A', {terraformRating: 25, greenery: 3, victoryPoints: 4});
    const vm = vmOf([a, player('blue', 'B', {})]);
    expect(runningTotal(vm, 'red', 0)).to.eq(0);
    expect(runningTotal(vm, 'red', 1)).to.eq(25);
    expect(runningTotal(vm, 'red', vm.categories.length)).to.eq(32);
  });
});
