import {expect} from 'chai';
import {EmptyBoard} from '../testing/EmptyBoard';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Resource} from '../../src/common/Resource';
import {SelectProductionToLose} from '../../src/server/inputs/SelectProductionToLose';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {Units} from '../../src/common/Units';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';

/*
 * A tile placed adjacent to SEVERAL hazards pays the SUMMED production cost as
 * ONE prompt (AresHandler.computePlacementCosts sums HAZARD_STEPS per adjacent
 * hazard, then defers a single SelectProductionToLose). The console/desktop
 * production-loss surface must therefore open directly at the final amount —
 * this guards the server contract the UI relies on.
 */
describe('Ares double-hazard production loss', () => {
  it('adjacent to TWO mild hazards → ONE prompt of cost 2 (not two cost-1 prompts)', () => {
    const [game, player] = testGame(2, {aresExtension: true});
    game.board = EmptyBoard.newInstance();

    const center = game.board.getAvailableSpacesOnLand(player)[5];
    const neighbours = game.board.getAdjacentSpaces(center).filter((s) => s.spaceType === SpaceType.LAND);
    AresHazards.putHazardAt(game, neighbours[0], TileType.DUST_STORM_MILD); // −1
    AresHazards.putHazardAt(game, neighbours[1], TileType.DUST_STORM_MILD); // −1

    player.production.add(Resource.PLANTS, 7);
    game.addTile(player, center, {tileType: TileType.GREENERY});
    runAllActions(game);

    // ONE prompt, summed cost 2 — NOT a cost-1 prompt followed by a cost-2 one.
    const input = cast(player.popWaitingFor(), SelectProductionToLose);
    expect(input.unitsToLose).eq(2);

    input.process({type: 'productionToLose', units: Units.of({plants: 2})}, player);
    runAllActions(game);
    // No SECOND production-loss prompt lingering behind the first.
    expect(player.getWaitingFor()).is.undefined;
  });

  it('adjacent to TWO severe hazards → ONE prompt of cost 4', () => {
    const [game, player] = testGame(2, {aresExtension: true});
    game.board = EmptyBoard.newInstance();

    const center = game.board.getAvailableSpacesOnLand(player)[5];
    const neighbours = game.board.getAdjacentSpaces(center).filter((s) => s.spaceType === SpaceType.LAND);
    AresHazards.putHazardAt(game, neighbours[0], TileType.DUST_STORM_SEVERE); // −2
    AresHazards.putHazardAt(game, neighbours[1], TileType.DUST_STORM_SEVERE); // −2

    player.production.add(Resource.PLANTS, 7);
    game.addTile(player, center, {tileType: TileType.GREENERY});
    runAllActions(game);

    const input = cast(player.getWaitingFor(), SelectProductionToLose);
    expect(input.unitsToLose).eq(4);
  });
});
