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
  merged.terraformRatingBreakdown = {...trb, base: merged.terraformRating - (trb.temperature + trb.oxygen + trb.oceans + trb.venus + trb.cards)};
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
    expect(keys.indexOf('awards')).to.be.lessThan(keys.indexOf('penalty'));
    expect(keys[keys.length - 1]).to.eq('penalty');
    expect(reveal.segments.find((s) => s.key === 'penalty')?.penalty).to.eq(true);
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
});
