import {expect} from 'chai';
import {testGame} from '../TestGame';
import {createMarsSelectSpace} from '../../src/server/boards/marsSelectSpaceHelper';

describe('createMarsSelectSpace', () => {
  it('preserves existing tiles by default — no hiddenTiles', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesForCity(player).slice(0, 3);

    const select = createMarsSelectSpace(player, 'Select', spaces);

    // Default: an occupied target keeps its tile visible during selection
    // (overlay markers, pick-a-tile, place-over-hazard). Nothing is hidden.
    expect(select.hiddenTiles).is.undefined;
    expect(select.toModel().hiddenTiles).is.undefined;
  });

  it('marks every target as hidden with hideExistingTile — remove-and-replace', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesForCity(player).slice(0, 3);

    const select = createMarsSelectSpace(player, 'Select', spaces, {hideExistingTile: true});

    const ids = spaces.map((s) => s.id);
    expect(select.hiddenTiles).to.have.members(ids);
    expect(select.toModel().hiddenTiles).to.have.members(ids);
  });
});
