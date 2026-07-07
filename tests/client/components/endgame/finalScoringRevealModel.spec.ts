import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildFinalScoringRevealModel} from '@/client/components/endgame/finalScoringRevealModel';
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
  // Mirror production: detailsCards sums to victoryPoints (cards derive from kinds).
  if (merged.victoryPoints !== 0 && merged.detailsCards.length === 0) {
    merged.detailsCards = [{cardName: 'TestFixed', victoryPoint: merged.victoryPoints, kind: 'fixed'}];
  }
  if (partial.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery +
      merged.city + merged.victoryPoints + merged.moonHabitats + merged.moonMines + merged.moonRoads +
      merged.planetaryTracks + merged.escapeVelocity + merged.deltaProject;
  }
  return merged;
}

function player(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, extra: Partial<EndgamePlayerInput> = {}): EndgamePlayerInput {
  return {color, name, corporations: [], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}, ...extra};
}

function model(inputs: ReadonlyArray<EndgamePlayerInput>, opts: Partial<Parameters<typeof buildEndgameModel>[1]> = {}) {
  return buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10, ...opts});
}

describe('finalScoringRevealModel', () => {
  it('lays lanes in the neutral order given, never ranked', () => {
    const a = player('red', 'A', {terraformRating: 20}); // 20 (low)
    const b = player('blue', 'B', {terraformRating: 40}); // 40 (winner)
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    // Seating order preserved even though blue won.
    expect(reveal.players.map((p) => p.color)).to.deep.eq(['red', 'blue']);
    expect(reveal.winner).to.eq('blue');
  });

  it('appends any color missing from the neutral order so no player is dropped', () => {
    const a = player('red', 'A', {terraformRating: 25});
    const b = player('blue', 'B', {terraformRating: 30});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red']); // forgot blue
    expect(reveal.players.map((p) => p.color).sort()).to.deep.eq(['blue', 'red']);
  });

  it('per-player segment sum equals the final total (no divergence)', () => {
    const a = player('red', 'A', {
      terraformRating: 28, greenery: 4, city: 3, victoryPoints: 7, milestones: 5, awards: 2,
    }); // 49
    const reveal = buildFinalScoringRevealModel(model([a, player('blue', 'B', {terraformRating: 20})]), ['red', 'blue']);
    const sum = reveal.segments.reduce((acc, s) => acc + (s.values['red'] ?? 0), 0);
    expect(sum).to.eq(49);
    expect(reveal.players.find((p) => p.color === 'red')?.finalTotal).to.eq(49);
  });

  it('includes Ares hazard-cleanup TR so the segment sum still equals the authoritative total', () => {
    // Regression: the reveal sums per-category SEGMENTS, while the overlay /
    // engine use `breakdown.total`. The TR segment list once omitted the Ares
    // `hazards` sub-part, so an Ares player's reveal total under-counted by their
    // hazard-cleanup TR (the screens disagreed — 154 vs the real 157).
    const a = player('red', 'A', {
      terraformRating: 28,
      terraformRatingBreakdown: {base: 20, temperature: 2, oxygen: 0, oceans: 0, venus: 0, cards: 3, hazards: 3},
      greenery: 4, victoryPoints: 7,
    }); // TR 28 (20 base + 2 temp + 3 cards + 3 hazards) + 4 greenery + 7 cards = 39
    const reveal = buildFinalScoringRevealModel(model([a, player('blue', 'B', {terraformRating: 20})]), ['red', 'blue']);
    const trKeys = reveal.segments.filter((s) => s.group === 'tr').map((s) => s.key);
    expect(trKeys).to.include('tr-hazards');
    const trGroup = reveal.groups.find((g) => g.key === 'tr');
    expect(trGroup?.values['red']).to.eq(28); // sub-parts (incl. hazards) sum to the full TR
    const sum = reveal.segments.reduce((acc, s) => acc + (s.values['red'] ?? 0), 0);
    expect(sum).to.eq(39);
    expect(reveal.players.find((p) => p.color === 'red')?.finalTotal).to.eq(39);
  });

  it('splits TR into its sub-parts (reusing terraformRatingBreakdown), grouped under "tr"', () => {
    const a = player('red', 'A', {
      terraformRating: 28,
      terraformRatingBreakdown: {base: 20, temperature: 3, oxygen: 2, oceans: 2, venus: 0, cards: 1},
    });
    const reveal = buildFinalScoringRevealModel(model([a, player('blue', 'B', {terraformRating: 20})], {hasVenus: false}), ['red', 'blue']);
    const trSegs = reveal.segments.filter((s) => s.group === 'tr').map((s) => s.key);
    // base + the 4 non-zero raisers; venus is 0 → skipped.
    expect(trSegs).to.deep.eq(['tr-base', 'tr-temperature', 'tr-oxygen', 'tr-oceans', 'tr-cards']);
    const trGroup = reveal.groups.find((g) => g.key === 'tr');
    expect(trGroup?.values['red']).to.eq(28); // sub-parts sum to TR
    expect(trGroup?.segmentIndexes.length).to.eq(5);
  });

  it('folds the Handicap (TR Boost) INTO the Base rating segment (not a sibling sub-segment)', () => {
    const a = player('red', 'A', {
      terraformRating: 25,
      terraformRatingBreakdown: {base: 23, baseRating: 20, handicap: 3, temperature: 2, oxygen: 0, oceans: 0, venus: 0, cards: 0, cardEntries: []},
    });
    const reveal = buildFinalScoringRevealModel(model([a, player('blue', 'B', {terraformRating: 20})]), ['red', 'blue']);
    const trKeys = reveal.segments.filter((s) => s.group === 'tr').map((s) => s.key);
    expect(trKeys).to.include('tr-base');
    expect(trKeys).to.not.include('tr-handicap'); // handicap is nested inside Base rating, not a sibling
    // Base rating segment = baseRating + handicap (20 + 3).
    expect(reveal.segments.find((s) => s.key === 'tr-base')?.values['red']).to.eq(23);
  });

  it('only includes segments that moved a score (TR base always kept)', () => {
    const a = player('red', 'A', {terraformRating: 30, greenery: 5});
    const b = player('blue', 'B', {terraformRating: 25, greenery: 2});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    const groupKeys = reveal.groups.map((g) => g.key);
    expect(groupKeys).to.include('tr');
    expect(groupKeys).to.include('greenery');
    expect(groupKeys).to.not.include('city');
    expect(groupKeys).to.not.include('milestones');
    expect(reveal.segments.some((s) => s.key === 'tr-base')).to.eq(true);
  });

  it('orders segments for suspense — milestones/awards after the base, penalty last', () => {
    const a = player('red', 'A', {terraformRating: 25, greenery: 3, city: 2, victoryPoints: 4, milestones: 5, awards: 5, escapeVelocity: -2});
    const b = player('blue', 'B', {terraformRating: 20});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    const keys = reveal.segments.map((s) => s.key);
    expect(keys.indexOf('tr-base')).to.be.lessThan(keys.indexOf('milestones'));
    expect(keys.indexOf('awards')).to.be.lessThan(keys.indexOf('penalty-ev'));
    expect(keys[keys.length - 1]).to.eq('penalty-ev');
    expect(reveal.segments.find((s) => s.key === 'penalty-ev')?.penalty).to.eq(true);
  });

  it('splits Cards into fixed/conditional/resource and pulls penalties into a separate group', () => {
    const a = player('red', 'A', {
      terraformRating: 20, victoryPoints: 9, escapeVelocity: -3,
      detailsCards: [
        {cardName: 'F', victoryPoint: 4, kind: 'fixed'},
        {cardName: 'C', victoryPoint: 5, kind: 'conditional'},
        {cardName: 'R', victoryPoint: 3, kind: 'resource'},
        {cardName: 'P', victoryPoint: -3, kind: 'penalty'},
      ],
    }); // cards positive 12, card penalty -3 → victoryPoints 9; +ev -3 → total 20+9-3 = 26
    const reveal = buildFinalScoringRevealModel(model([a, player('blue', 'B', {terraformRating: 20})]), ['red', 'blue']);
    const cardsGroup = reveal.groups.find((g) => g.key === 'cards');
    expect(cardsGroup?.values['red']).to.eq(12); // fixed+conditional+resource only
    const penaltyGroup = reveal.groups.find((g) => g.key === 'penalty');
    expect(penaltyGroup?.values['red']).to.eq(-6); // card penalty (-3) + escape velocity (-3)
    // The whole thing still reconciles to the player's real total.
    const sum = reveal.segments.reduce((acc, s) => acc + (s.values['red'] ?? 0), 0);
    expect(sum).to.eq(26);
    expect(reveal.players.find((p) => p.color === 'red')?.finalTotal).to.eq(26);
  });

  it('emits a tie-break when the top total is shared, resolved on M€', () => {
    const a = player('red', 'A', {terraformRating: 40}, {megacredits: 5});
    const b = player('blue', 'B', {terraformRating: 40}, {megacredits: 12});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    expect(reveal.tieBreak).to.not.eq(undefined);
    expect(reveal.tieBreak?.contenders.sort()).to.deep.eq(['blue', 'red']);
    expect(reveal.tieBreak?.winner).to.eq('blue');
    expect(reveal.winner).to.eq('blue');
    expect(reveal.tieBreak?.values['blue']).to.eq(12);
  });

  it('reports a genuine tie (no single winner) when total AND M€ are equal', () => {
    const a = player('red', 'A', {terraformRating: 40}, {megacredits: 7});
    const b = player('blue', 'B', {terraformRating: 40}, {megacredits: 7});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    expect(reveal.tieBreak?.winner).to.eq(undefined);
    expect(reveal.winner).to.eq(undefined);
    expect(reveal.winners.sort()).to.deep.eq(['blue', 'red']);
  });

  it('has no tie-break for a clear win', () => {
    const a = player('red', 'A', {terraformRating: 44});
    const b = player('blue', 'B', {terraformRating: 30});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    expect(reveal.tieBreak).to.eq(undefined);
    expect(reveal.winner).to.eq('red');
    expect(reveal.maxTotal).to.eq(44);
  });

  it('reveals the MarsBot scoring group and keeps the bot lane segment-sum ≡ total', () => {
    const human = player('blue', 'Human', {terraformRating: 30});
    // Bot: TR 24 + mcToVp 3 + neural 4 + cardVp 2 = 33.
    const bot = player('red', 'MarsBot', {
      terraformRating: 24,
      total: 33,
      automa: {mcToVp: 3, mcPerVp: 8, neuralInstance: 4, cardVp: 2},
    });
    const reveal = buildFinalScoringRevealModel(model([human, bot]), ['blue', 'red']);
    const automaGroup = reveal.groups.find((g) => g.key === 'automa');
    expect(automaGroup).to.not.eq(undefined);
    expect(automaGroup?.values['red']).to.eq(9);
    expect(automaGroup?.values['blue']).to.eq(0);
    // The segment-sum ≡ final-total invariant holds for the bot lane.
    let botSum = 0;
    for (const seg of reveal.segments) {
      botSum += seg.values['red'] ?? 0;
    }
    expect(botSum).to.eq(33);
  });

  it('omits the MarsBot group in an ordinary game', () => {
    const a = player('red', 'A', {terraformRating: 40});
    const b = player('blue', 'B', {terraformRating: 30});
    const reveal = buildFinalScoringRevealModel(model([a, b]), ['red', 'blue']);
    expect(reveal.groups.find((g) => g.key === 'automa')).to.eq(undefined);
  });

  it('a MarsBot clock win forces the winner regardless of totals, no tie-break', () => {
    const human = player('blue', 'Human', {terraformRating: 60}, {megacredits: 30});
    const bot = player('red', 'MarsBot', {terraformRating: 25});
    const m = model([human, bot], {automaClockWinner: 'red'});
    expect(m.winner?.color).to.eq('red');
    expect(m.players[0].color).to.eq('red');
    expect(m.automaClockWin).to.eq(true);
    const reveal = buildFinalScoringRevealModel(m, ['blue', 'red']);
    expect(reveal.winner).to.eq('red');
    expect(reveal.winners).to.deep.eq(['red']);
    expect(reveal.tieBreak).to.eq(undefined);
  });
});
