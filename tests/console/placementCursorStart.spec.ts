import {expect} from 'chai';
import {testGame} from '../TestGame';
import {addCity, addGreenery} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceId} from '../../src/common/Types';
import {MINI_ROWS, miniCellCenter} from '../../src/common/boards/boardLayoutGeometry';
import {CursorStartCell, initialPlacementCursor} from '../../src/client/console/tilePlacement/placementCursorStart';

/**
 * THE CURSOR'S FIRST CELL (T15 · CD): the legal cell nearest the centre of the player's own tiles on Mars — the
 * board's centre for a player with none — on the board's own hex geometry, never the list's order.
 */
describe('initialPlacementCursor — the cursor\'s first cell (T15 · CD)', () => {
  function cellsOf(game: IGame): Array<CursorStartCell> {
    return game.board.spaces.map((s) => ({id: s.id, x: s.x, y: s.y, tileType: s.tile?.tileType, color: s.player?.color}));
  }
  function plane(game: IGame, id: SpaceId) {
    const s = game.board.getSpaceOrThrow(id);
    return miniCellCenter(s.x, s.y, MINI_ROWS[s.y]);
  }
  function dist(a: {cx: number, cy: number}, b: {cx: number, cy: number}) {
    return Math.hypot(a.cx - b.cx, a.cy - b.cy);
  }
  function legalFor(game: IGame, player: IPlayer, kind: 'greenery' | 'city'): Array<SpaceId> {
    const spaces = kind === 'greenery' ? game.board.getAvailableSpacesForGreenery(player) : game.board.getAvailableSpacesForCity(player);
    return spaces.map((s) => s.id);
  }

  it('no tiles of one\'s own: the legal cell nearest the CENTRE of the board — never the first of the list', () => {
    const [game, p1] = testGame(2);
    const legal = legalFor(game, p1, 'city');
    const first = initialPlacementCursor({cells: cellsOf(game), legal, viewer: p1.color});
    expect(first).is.not.undefined;
    expect(first, 'not merely the list\'s head').not.eq(legal[0]);
    const onMars = game.board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);
    const centre = onMars.map((s) => miniCellCenter(s.x, s.y, MINI_ROWS[s.y]))
      .reduce((a, p) => ({cx: a.cx + p.cx / onMars.length, cy: a.cy + p.cy / onMars.length}), {cx: 0, cy: 0});
    const best = Math.min(...legal.map((id) => dist(plane(game, id), centre)));
    expect(dist(plane(game, first!), centre)).closeTo(best, 1e-6);
  });

  it('a greenery: the cursor opens BESIDE the player\'s own tile (the legal set hugs it — never a far cell)', () => {
    const [game, p1] = testGame(2);
    const city = addCity(p1);
    const legal = legalFor(game, p1, 'greenery');
    const first = initialPlacementCursor({cells: cellsOf(game), legal, viewer: p1.color});
    const neighbours = game.board.getAdjacentSpaces(city).map((s) => s.id);
    expect(neighbours).to.include(first);
  });

  it('a city: the legal cell nearest the centre of the player\'s OWN tiles — another player\'s tiles anchor nothing', () => {
    const [game, p1, p2] = testGame(2);
    const own = [addCity(p1), addGreenery(p1)];
    for (let i = 0; i < 3; i++) {
      addCity(p2);
    }
    const legal = legalFor(game, p1, 'city');
    const first = initialPlacementCursor({cells: cellsOf(game), legal, viewer: p1.color});
    const anchor = own.map((s) => plane(game, s.id))
      .reduce((a, p) => ({cx: a.cx + p.cx / own.length, cy: a.cy + p.cy / own.length}), {cx: 0, cy: 0});
    const best = Math.min(...legal.map((id) => dist(plane(game, id), anchor)));
    expect(dist(plane(game, first!), anchor)).closeTo(best, 1e-6);
  });

  it('deterministic: the same board answers the same cell, whatever the order of the legal list', () => {
    const [game, p1] = testGame(2);
    addCity(p1);
    const legal = legalFor(game, p1, 'city');
    const a = initialPlacementCursor({cells: cellsOf(game), legal, viewer: p1.color});
    const b = initialPlacementCursor({cells: cellsOf(game), legal: [...legal].reverse(), viewer: p1.color});
    expect(a).eq(b);
  });

  it('a pick of off-grid cells only (a colony slot) has no plane position: the caller keeps its own fallback', () => {
    const [game, p1] = testGame(2);
    const colonySlots = game.board.spaces.filter((s) => s.spaceType === SpaceType.COLONY).map((s) => s.id);
    expect(colonySlots.length).is.greaterThan(0);
    expect(initialPlacementCursor({cells: cellsOf(game), legal: colonySlots, viewer: p1.color})).is.undefined;
    expect(initialPlacementCursor({cells: cellsOf(game), legal: [], viewer: p1.color})).is.undefined;
  });
});
