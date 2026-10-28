import {expect} from 'chai';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {cancellablePlacement} from '../../src/server/inputs/placementContext';
import {Server} from '../../src/server/models/ServerModel';
import {OrOptionsModel, SelectSpaceModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';
import {Space} from '../../src/server/boards/Space';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {TileType} from '../../src/common/TileType';
import {createMarsSelectSpace} from '../../src/server/boards/marsSelectSpaceHelper';

describe('SelectSpace', () => {
  let game: IGame;
  let player: TestPlayer;
  let selected: Space | undefined;

  const cb = (cards: Space) => {
    selected = cards;
    return undefined;
  };

  beforeEach(() => {
    [game, player] = testGame(1);
    selected = undefined;
  });

  it('Simple', () => {
    const selectSpace = new SelectSpace('', game.board.spaces).andThen(cb);
    selectSpace.process({type: 'space', spaceId: '05'});
    expect(selected!.id).eq('05');
  });

  it('Cannot select space not part of the set', () => {
    const selectSpace = new SelectSpace('', game.board.spaces).andThen(cb);
    expect(() => selectSpace.process({type: 'space', spaceId: '00'}))
      .to.throw(Error, /Space not available/);
  });

  /*
   * The placement marker must survive NESTING.
   *
   * `ServerModel.getWaitingFor` decorates the TOP-LEVEL prompt only, and a
   * placement is routinely nested: converting plants is one branch of the
   * action-menu `OrOptions`, and so is a task's own space option. Serialized
   * centrally, those branches reached the client stripped of their marker — the
   * board's context panel could not name what was placing the tile and had to
   * guess cancellability. The same trap `discardPrompt` already paid for.
   */
  it('the placement marker rides toModel, so it survives nesting', () => {
    const nested = new SelectSpace('Convert 8 plants into greenery', game.board.spaces)
      .markPlacementContext(cancellablePlacement({kind: 'standardProject', card: CardName.CONVERT_PLANTS}));
    const menu = new OrOptions(new SelectOption('Pass'), nested);

    // The model the client actually receives for the ACTION MENU…
    const model = Server.getWaitingFor(player, menu) as OrOptionsModel;
    // …carries the marker on the nested branch, not just on the top level.
    const branch = model.options[1] as SelectSpaceModel;
    expect(branch.placementContext?.cancellable).is.true;
    expect(branch.placementContext?.source?.card).to.eq(CardName.CONVERT_PLANTS);
  });

  it('an unmarked placement still has no context (backward-compatible)', () => {
    const model = new SelectSpace('', game.board.spaces).toModel();
    expect(model.placementContext).is.undefined;
  });

  /*
   * THE LEGAL SET IS LIVE (state delivery, 2026-10-28). A placement prompt stands while the table moves — the
   * start-of-game deployments run concurrently, a bot turn resolves on a timer — and its legal set was computed
   * once: a cell another seat built on meanwhile stayed offered, the player chose it, and `addTile` threw an opaque
   * «occupied» 400. Now the set is re-derived at every read: the model serialized after the change no longer offers
   * the cell (the client's mid-prompt refresh dims it under the same promptId), and the answer is refused by name.
   */
  describe('the legal set is LIVE — a cell taken while the prompt stood leaves the offer', () => {
    it('the generic rule: a cell offered EMPTY that carries a tile now is gone from the model and refused', () => {
      const land = game.board.getAvailableSpacesOnLand(player);
      const selectSpace = new SelectSpace('', land).andThen(cb);
      const taken = land[0];
      expect(selectSpace.toModel().spaces).to.include(taken.id);
      // Another seat builds there while this prompt stands.
      game.simpleAddTile(player, taken, {tileType: TileType.CITY});
      const model = selectSpace.toModel();
      expect(model.spaces, 'the offer shrinks at the next serialization').to.not.include(taken.id);
      expect(model.illegalSpaces?.find((entry) => entry.spaceId === taken.id)?.reason, 'and names why').eq('occupied');
      expect(() => selectSpace.process({type: 'space', spaceId: taken.id}))
        .to.throw(Error, /no longer available/);
      expect(selected, 'nothing was applied').is.undefined;
      // Every other cell is still the player's to choose.
      selectSpace.process({type: 'space', spaceId: land[1].id});
      expect(selected!.id).eq(land[1].id);
    });

    it('a cell offered WITH its tile (a cover over an ocean, a move) is never dropped by the generic rule', () => {
      const ocean = game.board.getAvailableSpacesForOcean(player)[0];
      game.simpleAddTile(player, ocean, {tileType: TileType.OCEAN});
      const selectSpace = new SelectSpace('', [ocean]).andThen(cb);
      expect(selectSpace.toModel().spaces).to.deep.eq([ocean.id]);
      selectSpace.process({type: 'space', spaceId: ocean.id});
      expect(selected!.id).eq(ocean.id);
    });

    it('a producer\'s own derivation (`createMarsSelectSpace({liveSpaces})`) is re-asked at every read, reasons beside it', () => {
      const derive = () => game.board.getAvailableSpacesForCity(player);
      const before = derive();
      const selectSpace = createMarsSelectSpace(player, 'Select space for city tile', before, {
        placementType: 'city', liveSpaces: derive,
      }).andThen(cb);
      const taken = before[0];
      expect(selectSpace.toModel().spaces).to.include(taken.id);
      game.simpleAddTile(player, taken, {tileType: TileType.CITY});
      const model = selectSpace.toModel();
      expect(model.spaces).to.not.include(taken.id);
      // The city rule's own neighbours are re-derived too: a cell beside the new city is no longer legal for a city.
      const neighbours = game.board.getAdjacentSpaces(taken).map((space) => space.id);
      expect(model.spaces.some((id) => neighbours.includes(id)), 'the cells around the new city left the offer').is.false;
      expect(model.illegalSpaces?.some((entry) => entry.spaceId === taken.id), 'the taken cell carries a reason').is.true;
      expect(() => selectSpace.process({type: 'space', spaceId: taken.id})).to.throw(Error, /no longer available/);
    });
  });
});
