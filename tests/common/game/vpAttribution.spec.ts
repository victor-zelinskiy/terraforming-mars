import {expect} from 'chai';
import {VpShare, vpAttribution, vpSharesTotal, vpSourceKey} from '../../../src/common/game/vpAttribution';
import {VictoryPointsBreakdown} from '../../../src/common/game/VictoryPointsBreakdown';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {AdvancedEcosystems} from '../../../src/server/cards/base/AdvancedEcosystems';
import {RedsNewsOutlet} from '../../../src/server/cards/turmoilRedux/RedsNewsOutlet';
import {Ants} from '../../../src/server/cards/base/Ants';
import {Capital} from '../../../src/server/cards/base/Capital';
import {CardName} from '../../../src/common/cards/CardName';
import {Tag} from '../../../src/common/cards/Tag';
import {TileType} from '../../../src/common/TileType';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {Space} from '../../../src/server/boards/Space';
import {Phase} from '../../../src/common/Phase';
import {addCity, addGreenery, addOcean, fakeCard, runAllActions} from '../../TestingUtils';

/**
 * The score cell's ONE attribution (TR55): the difference of two server
 * breakdowns, component by component, on REAL games — the engine moves the
 * score, `calculateVictoryPoints` writes the breakdown, the function only
 * subtracts. Every case also pins the guard: Σ shares === Δ total.
 */
function score(player: TestPlayer): VictoryPointsBreakdown {
  return player.getVictoryPoints();
}

/** Attribute what `act` did to `player`'s score — and pin the guard. */
function attribute(player: TestPlayer, act: () => void): Array<VpShare> {
  const before = score(player);
  act();
  const after = score(player);
  const shares = vpAttribution(before, after);
  expect(vpSharesTotal(shares), `Σ shares = Δ total (${JSON.stringify(shares)})`).eq(after.total - before.total);
  return shares;
}

/** A land space with an ocean space next to it (the board is the engine's). */
function landBesideOcean(game: IGame): {land: Space, ocean: Space} {
  for (const ocean of game.board.getAvailableSpacesForOcean(game.players[0])) {
    const land = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    if (land !== undefined) {
      return {land, ocean};
    }
  }
  throw new Error('no land beside an ocean space');
}

/** Two empty LAND spaces next to each other. */
function adjacentLand(game: IGame): [Space, Space] {
  for (const a of game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0)) {
    const b = game.board.getAdjacentSpaces(a).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    if (b !== undefined) {
      return [a, b];
    }
  }
  throw new Error('no two adjacent land spaces');
}

describe('vpAttribution', () => {
  let game: IGame;
  let player: TestPlayer;
  let rival: TestPlayer;

  beforeEach(() => {
    [game, player, rival] = testGame(2);
    game.phase = Phase.ACTION;
  });

  it('nothing moved: no share at all', () => {
    expect(attribute(player, () => {})).deep.eq([]);
  });

  it('a card with FIXED VP lands: one share of that card (Advanced Ecosystems — 3 VP)', () => {
    const shares = attribute(player, () => {
      player.playCard(new AdvancedEcosystems());
      runAllActions(game);
    });
    expect(shares).deep.eq([{source: {kind: 'card', card: CardName.ADVANCED_ECOSYSTEMS}, points: 3}]);
  });

  it('VP FOR TAGS: a Mars tag played moves Reds News Outlet\'s row (TR20 class), the played card has none', () => {
    player.playedCards.push(new RedsNewsOutlet());
    const shares = attribute(player, () => player.playedCards.push(fakeCard({name: 'mars one' as CardName, tags: [Tag.MARS]})));
    expect(shares).deep.eq([{source: {kind: 'card', card: CardName.REDS_NEWS_OUTLET}, points: 1}]);
  });

  it('a resource onto a «1 VP / 2» card: the share is that card\'s, and only at the second unit', () => {
    const ants = new Ants();
    player.playedCards.push(ants);
    expect(attribute(player, () => player.addResourceTo(ants, 1))).deep.eq([]);
    expect(attribute(player, () => player.addResourceTo(ants, 1))).deep.eq([{source: {kind: 'card', card: CardName.ANTS}, points: 1}]);
  });

  it('a RIVAL\'s greenery beside MY city: my share is that city\'s cell; the rival\'s own greenery point is theirs', () => {
    const [cityCell, greeneryCell] = adjacentLand(game);
    addCity(player, cityCell.id);
    const mine = attribute(player, () => addGreenery(rival, greeneryCell.id));
    expect(mine).deep.eq([{source: {kind: 'city', space: cityCell.id}, points: 1}]);
    // The rival's own score holds the greenery tile's point (no parliament: the base rule) — never in mine.
    expect(score(rival).greenery).eq(1);
    expect(score(player).greenery).eq(0);
  });

  it('a city placed beside two greeneries of mine: the city cell +2; each greenery tile its own +1 (the base rule)', () => {
    const [cityCell, g1] = adjacentLand(game);
    const g2 = game.board.getAdjacentSpaces(cityCell).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== g1.id);
    expect(g2, 'a second neighbour').is.not.undefined;
    const greeneries = attribute(player, () => {
      addGreenery(player, g1.id);
      addGreenery(player, g2!.id);
    });
    expect(greeneries.find((s) => s.source.kind === 'greenery')?.points).eq(2);
    const city = attribute(player, () => addCity(player, cityCell.id));
    expect(city).deep.eq([{source: {kind: 'city', space: cityCell.id}, points: 2}]);
  });

  it('Turmoil Redux: a greenery scores NO point of its own (it paid TR) — the neighbouring city\'s cell is the share', () => {
    const [g, me, other] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    g.phase = Phase.ACTION;
    const [cityCell, greeneryCell] = adjacentLand(g);
    addCity(me, cityCell.id);
    expect(attribute(me, () => addGreenery(other, greeneryCell.id))).deep.eq([{source: {kind: 'city', space: cityCell.id}, points: 1}]);
    const theirs = attribute(other, () => addGreenery(other, g.board.getAvailableSpacesForGreenery(other)[0].id));
    expect(theirs.find((s) => s.source.kind === 'greenery'), 'no greenery point under the revision').is.undefined;
  });

  it('a milestone claimed: +5 by its name', () => {
    const milestone = game.milestones[0];
    const shares = attribute(player, () => game.claimedMilestones.push({player, milestone}));
    expect(shares).deep.eq([{source: {kind: 'milestone', name: milestone.name}, points: 5}]);
  });

  it('an award FUNDED and then OVERTAKEN: the share names the award and the places (1st → 2nd: −3, three seats)', () => {
    const [g3, p1, p2] = testGame(3);
    g3.phase = Phase.ACTION;
    const landlord = g3.awards.find((a) => a.name === 'Landlord');
    expect(landlord, 'Landlord is dealt in the base game').is.not.undefined;
    addCity(p1);
    const funded = attribute(p1, () => g3.fundAward(p1, landlord!));
    expect(funded).deep.eq([{source: {kind: 'award', name: 'Landlord', place: {after: '1st'}}, points: 5}]);
    const overtaken = attribute(p1, () => {
      addCity(p2);
      addCity(p2);
    });
    expect(overtaken).deep.eq([{source: {kind: 'award', name: 'Landlord', place: {before: '1st', after: '2nd'}}, points: -3}]);
  });

  it('…and at two seats there is no 2nd place: overtaken is the whole 5 (the engine\'s rule, read — never re-derived)', () => {
    const landlord = game.awards.find((a) => a.name === 'Landlord')!;
    addCity(player);
    game.fundAward(player, landlord);
    const overtaken = attribute(player, () => {
      addCity(rival);
      addCity(rival);
    });
    expect(overtaken).deep.eq([{source: {kind: 'award', name: 'Landlord', place: {before: '1st'}}, points: -5}]);
  });

  it('an ocean beside my Capital: the Capital card\'s row +1 (the board is its operand)', () => {
    const {land, ocean} = landBesideOcean(game);
    player.playedCards.push(new Capital());
    game.addTile(player, land, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
    const shares = attribute(player, () => addOcean(rival, ocean.id));
    expect(shares).deep.eq([{source: {kind: 'card', card: CardName.CAPITAL}, points: 1}]);
  });

  it('the TR: a rating share, the TR cell\'s own business', () => {
    const shares = attribute(player, () => player.increaseTerraformRating(2));
    expect(shares).deep.eq([{source: {kind: 'rating'}, points: 2}]);
  });

  it('several components in ONE response stay apart, and still sum to Δ total', () => {
    const ants = new Ants();
    ants.resourceCount = 1;
    player.playedCards.push(ants);
    const shares = attribute(player, () => {
      player.addResourceTo(ants, 1);
      player.increaseTerraformRating();
      player.playCard(new AdvancedEcosystems());
      runAllActions(game);
    });
    expect(shares.map((s) => `${vpSourceKey(s.source)}=${s.points}`).sort()).deep.eq([
      `card:${CardName.ADVANCED_ECOSYSTEMS}=3`, `card:${CardName.ANTS}=1`, 'rating=1',
    ]);
  });

  it('a component the function does not itemize is the ONE residual — never dropped', () => {
    const before = score(player);
    const after: VictoryPointsBreakdown = {...before, total: before.total + 3};
    expect(vpAttribution(before, after)).deep.eq([{source: {kind: 'other', key: 'unattributed'}, points: 3}]);
  });
});
