import {expect} from 'chai';
import {testGame} from '../TestGame';
import {addCity} from '../TestingUtils';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';

describe('placement illegal reasons', () => {
  it('attaches the M€ deficit to an unaffordable placement bonus, but not to rule-based reasons', () => {
    const [game, player] = testGame(2, {boardName: BoardName.HELLAS});
    player.megaCredits = 2;

    // Hellas' south-pole land space carries an OCEAN bonus that costs 6 M€.
    const bonusSpace = game.board.getSpaces(SpaceType.LAND)
      .find((s) => s.bonus.includes(SpaceBonus.OCEAN) && s.tile === undefined);
    // `expect.fail` returns `never`, so this both reports a clear failure AND
    // narrows `bonusSpace` to non-undefined below (no extra `return` needed).
    if (bonusSpace === undefined) {
      expect.fail('Hellas should have an ocean-bonus land space');
    }

    const legal = game.board.getAvailableSpacesForCity(player).filter((s) => s.id !== bonusSpace.id);
    const illegal = game.board.computeIllegalReasons(player, 'city', legal);

    // Hellas bakes the 6 M€ south-pole cost into the space's own placement
    // cost, so the block is `cannot-afford`; the deficit is the M€ gap.
    const bonusEntry = illegal.find((e) => e.spaceId === bonusSpace.id);
    expect(bonusEntry?.reason).eq('cannot-afford');
    expect(bonusEntry?.deficit).eq(4); // 6 (space cost) − spendable (2)

    // An ocean cell during a city placement reports the SPECIFIC "only an
    // ocean can go here" (not the generic wrong-terrain), with no deficit.
    const oceanCell = illegal.find((e) => e.reason === 'ocean-only');
    expect(oceanCell, 'expected an ocean-only entry').is.not.undefined;
    expect(oceanCell?.deficit).is.undefined;
  });

  it('distinguishes the two terrain cases (ocean-only vs needs-ocean-space)', () => {
    const [game, player] = testGame(2);

    // Placing a CITY: ocean cells say "only an ocean can go here".
    const cityIllegal = game.board.computeIllegalReasons(player, 'city', game.board.getAvailableSpacesForCity(player));
    expect(cityIllegal.some((e) => e.reason === 'ocean-only'), 'city on ocean → ocean-only').is.true;

    // Placing an OCEAN: land cells say "oceans only go on ocean spaces".
    const oceanIllegal = game.board.computeIllegalReasons(player, 'ocean', game.board.getAvailableSpacesForOcean(player));
    expect(oceanIllegal.some((e) => e.reason === 'needs-ocean-space'), 'ocean on land → needs-ocean-space').is.true;
  });

  it('away-from-cities: a cell adjacent to a city reports adjacent-to-city (not generic unavailable)', () => {
    const [game, player] = testGame(2);
    const city = addCity(player);
    const legal = game.board.getSpacesAwayFromCities(player);
    const illegal = game.board.computeIllegalReasons(player, 'away-from-cities', legal);

    const adjacentLand = game.board.getAdjacentSpaces(city)
      .find((s) => s.tile === undefined && s.spaceType === SpaceType.LAND);
    const entry = illegal.find((e) => e.spaceId === adjacentLand!.id);
    expect(entry?.reason).to.eq('adjacent-to-city');
  });

  // Regression: an UNPROTECTED Ares hazard is coverable (you build over it,
  // paying the removal cost), so it must NEVER read as "occupied". The real
  // reason it's off-limits for a greenery is the adjacency rule.
  it('an unprotected Ares hazard reports the REAL greenery reason, not a false "occupied"', () => {
    const [game, player] = testGame(2, {aresExtension: true});
    const land = game.board.getAvailableSpacesOnLand(player);
    const hazardSpace = land[0];
    AresHazards.putHazardAt(game, hazardSpace, TileType.EROSION_MILD);
    player.megaCredits = 20; // enough to clear the mild hazard (8 M€)

    // Own a real tile that is NOT adjacent to the hazard, so greenery must be
    // placed next to it — and the hazard cell is not adjacent.
    const ownedSpace = land.find((s) =>
      s.id !== hazardSpace.id &&
      game.board.getAdjacentSpaces(hazardSpace).every((adj) => adj.id !== s.id));
    if (ownedSpace === undefined) {
      expect.fail('expected a land space not adjacent to the hazard');
    }
    ownedSpace.tile = {tileType: TileType.GREENERY};
    ownedSpace.player = player;

    const reason = game.board.illegalReasonFor(player, 'greenery', hazardSpace);
    expect(reason, 'a coverable hazard is NOT "occupied"').to.not.eq('occupied');
    expect(reason).to.eq('not-adjacent-to-yours');

    // End-to-end via computeIllegalReasons (the path the SelectSpace model and
    // the board-info panel both use) reports the same honest reason.
    const legal = game.board.getAvailableSpacesForGreenery(player);
    expect(legal.some((s) => s.id === hazardSpace.id), 'hazard cell is not a legal greenery target').is.false;
    const entry = game.board.computeIllegalReasons(player, 'greenery', legal)
      .find((e) => e.spaceId === hazardSpace.id);
    expect(entry?.reason).to.eq('not-adjacent-to-yours');
  });

  it('a PROTECTED Ares hazard still reports protected-hazard', () => {
    const [game, player] = testGame(2, {aresExtension: true});
    const hazardSpace = game.board.getAvailableSpacesOnLand(player)[0];
    AresHazards.putHazardAt(game, hazardSpace, TileType.EROSION_MILD);
    hazardSpace.tile!.protectedHazard = true;

    expect(game.board.illegalReasonFor(player, 'greenery', hazardSpace)).to.eq('protected-hazard');
  });

  it('a coverable hazard that the player cannot afford to clear reports cannot-afford (not occupied)', () => {
    const [game, player] = testGame(2, {aresExtension: true});
    const hazardSpace = game.board.getAvailableSpacesOnLand(player)[0];
    AresHazards.putHazardAt(game, hazardSpace, TileType.EROSION_MILD);
    player.megaCredits = 0; // cannot pay the 8 M€ hazard-removal cost

    expect(game.board.illegalReasonFor(player, 'greenery', hazardSpace)).to.eq('cannot-afford');
  });
});
