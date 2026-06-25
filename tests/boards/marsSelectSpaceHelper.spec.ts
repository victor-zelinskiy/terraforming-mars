import {expect} from 'chai';
import {testGame} from '../TestGame';
import {createMarsSelectSpace} from '../../src/server/boards/marsSelectSpaceHelper';
import {cancellablePlacement} from '../../src/server/inputs/placementContext';

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

  it('carries the placementType through to the model (for the placement preview)', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesForCity(player).slice(0, 3);

    const select = createMarsSelectSpace(player, 'Select', spaces, {placementType: 'city'});

    expect(select.placementType).to.eq('city');
    expect(select.toModel().placementType).to.eq('city');
  });

  it('leaves placementType undefined when not supplied', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesForCity(player).slice(0, 3);

    const select = createMarsSelectSpace(player, 'Select', spaces);

    expect(select.toModel().placementType).is.undefined;
  });

  // placementContext is a BasePlayerInput marker serialized CENTRALLY by
  // ServerModel.getWaitingFor (like startGamePrompt / choiceContext), so it lives
  // on the input instance, not in the input's own toModel().
  it('defaults to a COMMITTED placement marker (not cancellable, with a reason)', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesForCity(player).slice(0, 3);

    const select = createMarsSelectSpace(player, 'Select', spaces);

    expect(select.placementContext?.cancellable).to.eq(false);
    expect(select.placementContext?.reason).to.not.be.undefined;
  });

  it('honours an explicit cancellable placement marker', () => {
    const [game, player] = testGame(2);
    const spaces = game.board.getAvailableSpacesForCity(player).slice(0, 3);

    const select = createMarsSelectSpace(player, 'Select', spaces, {
      placementContext: cancellablePlacement(),
    });

    expect(select.placementContext?.cancellable).to.eq(true);
  });
});
