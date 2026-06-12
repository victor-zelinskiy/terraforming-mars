import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {GlobalParameter} from '@/common/GlobalParameter';
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
    victoryPoints: 0,
    total: 20,
    detailsCards: [],
    detailsMilestones: [],
    detailsAwards: [],
    detailsPlanetaryTracks: [],
    negativeVP: 0,
  };
  const merged = {...base, ...partial};
  // Keep total consistent unless explicitly overridden.
  if (partial.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery +
      merged.city + merged.victoryPoints + merged.moonHabitats + merged.moonMines + merged.moonRoads +
      merged.planetaryTracks + merged.escapeVelocity;
  }
  return merged;
}

function player(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, extra: Partial<EndgamePlayerInput> = {}): EndgamePlayerInput {
  return {
    color,
    name,
    corporations: [],
    megacredits: 0,
    breakdown: breakdown(b),
    vpByGeneration: [],
    globalSteps: {},
    ...extra,
  };
}

describe('endgameModel', () => {
  it('ranks players by total then megacredits, flags the winner', () => {
    const a = player('red', 'A', {terraformRating: 30, victoryPoints: 10}, {megacredits: 5}); // 40
    const b = player('blue', 'B', {terraformRating: 30, victoryPoints: 10}, {megacredits: 12}); // 40, more M€
    const c = player('green', 'C', {terraformRating: 20, victoryPoints: 5}); // 25
    const model = buildEndgameModel([a, b, c], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10});

    expect(model.mode).to.eq('standings');
    expect(model.players.map((p) => p.name)).to.deep.eq(['B', 'A', 'C']);
    expect(model.winner?.name).to.eq('B');
    expect(model.players[0].isWinner).to.eq(true);
    expect(model.players[1].isWinner).to.eq(false);
    expect(model.runnerUp?.name).to.eq('A');
    expect(model.margin).to.eq(0); // tie on total, decided on M€
  });

  it('detects duel mode for exactly two players', () => {
    const a = player('red', 'A', {terraformRating: 35});
    const b = player('blue', 'B', {terraformRating: 30});
    const model = buildEndgameModel([a, b], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 8});
    expect(model.mode).to.eq('duel');
    expect(model.margin).to.eq(5);
  });

  it('detects solo mode and honours soloWin', () => {
    const a = player('red', 'A', {terraformRating: 40});
    const win = buildEndgameModel([a], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 14, soloWin: true});
    expect(win.mode).to.eq('solo');
    expect(win.winner?.isWinner).to.eq(true);
    const loss = buildEndgameModel([a], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 14, soloWin: false});
    expect(loss.players[0].isWinner).to.eq(false);
  });

  it('computes category leaders', () => {
    const a = player('red', 'A', {terraformRating: 30, milestones: 5, awards: 0}); // mca 5
    const b = player('blue', 'B', {terraformRating: 25, milestones: 0, awards: 10}); // mca 10
    const model = buildEndgameModel([a, b], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 9});
    const tr = model.categories.find((c) => c.key === 'tr');
    const mca = model.categories.find((c) => c.key === 'mca');
    expect(tr?.leaders).to.deep.eq(['red']);
    expect(mca?.leaders).to.deep.eq(['blue']);
  });

  it('aggregates global parameter contributions and drops untouched parameters', () => {
    const a = player('red', 'A', {terraformRating: 30}, {globalSteps: {[GlobalParameter.TEMPERATURE]: 5, [GlobalParameter.OXYGEN]: 2}});
    const b = player('blue', 'B', {terraformRating: 25}, {globalSteps: {[GlobalParameter.TEMPERATURE]: 1, [GlobalParameter.OCEANS]: 4}});
    const model = buildEndgameModel([a, b], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 9});
    const keys = model.parameters.map((p) => p.key);
    expect(keys).to.include(GlobalParameter.TEMPERATURE);
    expect(keys).to.include(GlobalParameter.OXYGEN);
    expect(keys).to.include(GlobalParameter.OCEANS);
    expect(keys).to.not.include(GlobalParameter.VENUS); // hasVenus=false
    const temp = model.parameters.find((p) => p.key === GlobalParameter.TEMPERATURE);
    expect(temp?.leaders).to.deep.eq(['red']);
    expect(model.players.find((p) => p.color === 'red')?.parametersTotal).to.eq(7);
  });

  it('finds the generation the winner took the lead', () => {
    // B trails for two generations then overtakes and holds the lead.
    const a = player('red', 'A', {terraformRating: 30, total: 30}, {vpByGeneration: [10, 18, 22, 24]});
    const b = player('blue', 'B', {terraformRating: 35, total: 35}, {vpByGeneration: [8, 15, 25, 35]});
    const model = buildEndgameModel([a, b], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 4});
    expect(model.winner?.name).to.eq('B');
    expect(model.winnerTookLeadGen).to.eq(3);
    expect(model.insights.some((i) => i.kind === 'lead-taken' && i.gen === 3)).to.eq(true);
  });

  it('marks a wire-to-wire winner', () => {
    const a = player('red', 'A', {terraformRating: 40, total: 40}, {vpByGeneration: [12, 20, 30, 40]});
    const b = player('blue', 'B', {terraformRating: 25, total: 25}, {vpByGeneration: [8, 14, 20, 25]});
    const model = buildEndgameModel([a, b], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 4});
    expect(model.winnerTookLeadGen).to.eq(undefined);
    expect(model.insights.some((i) => i.kind === 'wire-to-wire')).to.eq(true);
  });

  it('separates top cards from penalty cards', () => {
    const a = player('red', 'A', {
      victoryPoints: 6,
      detailsCards: [
        {cardName: 'Big', victoryPoint: 5, kind: 'conditional'},
        {cardName: 'Small', victoryPoint: 2, kind: 'fixed'},
        {cardName: 'Bad', victoryPoint: -1, kind: 'penalty'},
      ],
    });
    const model = buildEndgameModel([a, player('blue', 'B', {})], {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 5});
    const scored = model.players.find((p) => p.color === 'red');
    expect(scored?.topCards.map((c) => c.cardName)).to.deep.eq(['Big', 'Small']);
    expect(scored?.penaltyCards.map((c) => c.cardName)).to.deep.eq(['Bad']);
  });
});
