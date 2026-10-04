import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {cast} from '../../src/common/utils/utils';
import {addOcean, runAllActions} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {InputResponse, isSelectSpaceResponse} from '../../src/common/inputs/InputResponse';
import {
  CITY_MOVE_LABEL, MOVE_CITY_TILE_TITLE, MoveCityTile, NO_SPACE_TO_MOVE_A_CITY_REASON,
} from '../../src/server/deferredActions/MoveCityTile';
import {cityMoveDestinations, cityMoveOffer} from '../../src/server/boards/cityMove';
import {drainBatchTail, parkBatchTail, parkedBatchTailLength, parkedStagedPlacement, clearBatchTail} from '../../src/server/inputs/deferredInputBatch';
import {Server} from '../../src/server/models/ServerModel';
import {SelectSpaceModel} from '../../src/common/models/PlayerInputModel';

/**
 * «REMOVE A CITY TILE YOU OWN ON MARS AND PLACE IT IN AN ADJACENT … SPACE» —
 * the shared step (Turmoil Redux TR14 Re-settlement): ONE question, ONE
 * answer naming both cells.
 */
describe('MoveCityTile', () => {
  const SOURCE = 'A card that moves a city' as CardName;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    [game, player, opponent] = testGame(2);
  });

  const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

  /** An interior land cell: six neighbours, every one plain empty land. */
  function interiorLand(skip: ReadonlyArray<string> = []): Space {
    const board = game.board;
    const plain = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
    const found = board.spaces.find((space) => plain(space) && !skip.includes(space.id) &&
      board.getAdjacentSpaces(space).length === 6 && board.getAdjacentSpaces(space).every(plain));
    if (found === undefined) {
      throw new Error('no interior land cell');
    }
    return found;
  }

  function seatCity(owner: TestPlayer, space: Space): Space {
    game.simpleAddTile(owner, space, {tileType: TileType.CITY});
    return space;
  }

  function ask(): SelectSpace {
    game.defer(new MoveCityTile(player, {kind: 'card', card: SOURCE}));
    runAllActions(game);
    return cast(player.getWaitingFor(), SelectSpace);
  }

  function skips() {
    return game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
  }

  describe('the prompt', () => {
    it('offers the union of every city\'s destinations and carries the move marker', () => {
      const first = seatCity(player, interiorLand());
      const second = seatCity(player, interiorLand([first.id, ...ids(game.board.getAdjacentSpaces(first))]));
      const prompt = ask();
      const offer = cityMoveOffer(player);

      expect(prompt.title).eq(MOVE_CITY_TILE_TITLE);
      expect(ids(prompt.spaces)).deep.eq(ids(cityMoveDestinations(offer)));
      expect(prompt.placementType).eq('city-move');
      expect(prompt.placementEffect).eq('move');
      expect(prompt.tileType).eq(TileType.CITY);
      expect(prompt.sourceCard, 'the dossier\'s source and the staged tail\'s address').eq(SOURCE);
      expect(prompt.tileMove?.sources.map((s) => s.from.id)).to.have.members([first.id, second.id]);
      expect(prompt.placementContext?.cancellable, 'the card is played by now').is.not.true;
    });

    it('serializes the marker on its own model — sources with their cells, the cities that cannot move with their reason', () => {
      const first = seatCity(player, interiorLand());
      const locked = seatCity(player, interiorLand([first.id, ...ids(game.board.getAdjacentSpaces(first))]));
      game.board.getAdjacentSpaces(locked).forEach((s) => game.simpleAddTile(opponent, s, {tileType: TileType.GREENERY}));
      const model = Server.getWaitingFor(player, ask()) as SelectSpaceModel;

      expect(model.placementEffect).eq('move');
      expect(model.placementType).eq('city-move');
      expect(model.tileMove?.sources).has.length(1);
      const source = model.tileMove!.sources[0];
      expect(source.from).eq(first.id);
      expect(source.tileType).eq(TileType.CITY);
      expect(source.arrives).eq(TileType.CITY);
      expect(source.tiers).eq(1);
      expect([...source.to].sort(), 'the one movable city\'s cells ARE the prompt\'s').deep.eq([...model.spaces].sort());
      expect(model.tileMove?.disabledSources).deep.eq([{spaceId: locked.id, reason: 'no-space-to-move'}]);
      // The prompt-level reasons: the locked city reads as occupied, a far free cell as «not adjacent».
      const reasons = new Map((model.illegalSpaces ?? []).map((e) => [e.spaceId, e.reason]));
      expect(reasons.get(locked.id)).eq('occupied');
      expect(reasons.get(first.id)).eq('occupied');
      expect([...reasons.values()]).to.include('not-adjacent-to-the-city');
    });

    it('a SINGLE city with a SINGLE cell is still asked — never auto-moved', () => {
      const from = seatCity(player, interiorLand());
      const [keep, ...rest] = game.board.getAdjacentSpaces(from);
      rest.forEach((s) => game.simpleAddTile(opponent, s, {tileType: TileType.GREENERY}));

      const prompt = ask();

      expect(ids(prompt.spaces)).deep.eq([keep.id]);
      expect(from.tile?.tileType, 'nothing moved before the answer').eq(TileType.CITY);
      expect(keep.tile).is.undefined;
    });

    it('NO MOVE AT ALL is a named skip — the degrade of a board that moved under the play', () => {
      game.defer(new MoveCityTile(player, {kind: 'card', card: SOURCE}));
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(skips()).deep.eq([{label: CITY_MOVE_LABEL, reason: NO_SPACE_TO_MOVE_A_CITY_REASON}]);
    });
  });

  describe('the answer', () => {
    it('names BOTH cells and moves the city atomically', () => {
      const from = seatCity(player, interiorLand());
      const prompt = ask();
      const to = prompt.tileMove!.sources[0].to[0];

      prompt.process({type: 'space', spaceId: to.id, movedFrom: from.id});

      expect(from.tile).is.undefined;
      expect(to.tile?.tileType).eq(TileType.CITY);
      expect(to.player).eq(player);
      expect(game.events.events.filter((e) => e.type === 'tile-moved')).has.length(1);
    });

    it('the addressed form is the same answer', () => {
      const from = seatCity(player, interiorLand());
      const prompt = ask();
      const to = prompt.tileMove!.sources[0].to[0];
      prompt.process({type: 'space', spaceId: to.id, movedFrom: from.id, stagedFor: SOURCE});
      expect(to.tile?.tileType).eq(TileType.CITY);
    });

    it('refuses an answer WITHOUT `movedFrom` — one cell does not say which city came to it', () => {
      const from = seatCity(player, interiorLand());
      const prompt = ask();
      const to = prompt.tileMove!.sources[0].to[0];
      expect(() => prompt.process({type: 'space', spaceId: to.id})).to.throw('A move must name the city that moves');
      expect(from.tile?.tileType).eq(TileType.CITY);
      expect(to.tile).is.undefined;
    });

    it('refuses a city that is not a source: another player\'s, an empty cell, a city over an ocean', () => {
      const from = seatCity(player, interiorLand());
      const foreign = seatCity(opponent, interiorLand([from.id, ...ids(game.board.getAdjacentSpaces(from))]));
      const ocean = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
        game.board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.LAND && n.tile === undefined))!;
      addOcean(player, ocean.id);
      game.addTile(player, ocean, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: ocean.tile});
      const prompt = ask();
      const to = prompt.tileMove!.sources.find((s) => s.from.id === from.id)!.to[0];
      const besideOcean = game.board.getAdjacentSpaces(ocean).find((n) => n.spaceType === SpaceType.LAND && n.tile === undefined)!;

      expect(prompt.tileMove!.disabledSources.map((e) => e.reason)).to.include('city-stands-on-ocean');
      for (const movedFrom of [foreign.id, to.id, ocean.id]) {
        expect(() => prompt.process({type: 'space', spaceId: movedFrom === ocean.id ? besideOcean.id : to.id, movedFrom}), movedFrom)
          .to.throw('This city cannot be moved to that space');
      }
      expect(ocean.tile?.tileType, 'the «city and ocean» tile never left its ocean').eq(TileType.OCEAN_CITY);
      expect(from.tile?.tileType).eq(TileType.CITY);
    });

    it('refuses a cell that is not adjacent to THAT city — though a sibling city reaches it', () => {
      const first = seatCity(player, interiorLand());
      const second = seatCity(player, interiorLand([first.id, ...ids(game.board.getAdjacentSpaces(first))]));
      const prompt = ask();
      const firstTo = ids(prompt.tileMove!.sources.find((s) => s.from.id === first.id)!.to);
      const secondOnly = prompt.tileMove!.sources.find((s) => s.from.id === second.id)!.to.find((s) => !firstTo.includes(s.id))!;
      expect(ids(prompt.spaces), 'the prompt does offer the cell').to.include(secondOnly.id);
      expect(() => prompt.process({type: 'space', spaceId: secondOnly.id, movedFrom: first.id}))
        .to.throw('This city cannot be moved to that space');
      expect(first.tile?.tileType).eq(TileType.CITY);
      expect(secondOnly.tile).is.undefined;
    });

    it('an ORDINARY placement refuses `movedFrom`', () => {
      const cell = interiorLand();
      const plain = new SelectSpace('Select space', [cell]).andThen(() => undefined);
      expect(() => plain.process({type: 'space', spaceId: cell.id, movedFrom: cell.id})).to.throw('This placement does not move a tile');
    });

    it('the wire validator accepts the four key sets and nothing else', () => {
      const valid: Array<InputResponse> = [
        {type: 'space', spaceId: '03'},
        {type: 'space', spaceId: '03', stagedFor: SOURCE},
        {type: 'space', spaceId: '03', movedFrom: '04'},
        {type: 'space', spaceId: '03', movedFrom: '04', stagedFor: SOURCE},
      ];
      for (const response of valid) {
        expect(isSelectSpaceResponse(response), JSON.stringify(response)).is.true;
      }
      const invalid = [
        {type: 'space'},
        {type: 'space', movedFrom: '04'},
        {type: 'space', movedFrom: '04', stagedFor: SOURCE},
        {type: 'space', spaceId: '03', movedFrom: '04', extra: 1},
        {type: 'space', spaceId: '03', replaces: '04'},
      ];
      for (const response of invalid) {
        expect(isSelectSpaceResponse(response as unknown as InputResponse), JSON.stringify(response)).is.false;
      }
    });
  });

  /**
   * THE PARKED PIN of a move holds TWO cells (`deferredInputBatch`): the
   * baseline records both, and either one changing while the tail waits behind
   * an interloper drops it — the question is then asked live.
   */
  describe('the staged tail — two pinned cells', () => {
    afterEach(() => clearBatchTail(player));

    function parked(from: Space, to: Space): InputResponse {
      const tail: InputResponse = {type: 'space', spaceId: to.id, movedFrom: from.id, stagedFor: SOURCE};
      parkBatchTail(player, [tail]);
      return tail;
    }

    it('the self model names both cells of a parked move', () => {
      const from = seatCity(player, interiorLand());
      const to = game.board.getAdjacentSpaces(from)[0];
      parked(from, to);
      expect(parkedStagedPlacement(player)).deep.eq({card: SOURCE, spaceId: to.id, movedFrom: from.id});
    });

    it('lands on its own prompt when neither cell changed', () => {
      const from = seatCity(player, interiorLand());
      const to = game.board.getAdjacentSpaces(from)[0];
      parked(from, to);
      ask();

      drainBatchTail(player);

      expect(parkedBatchTailLength(player)).eq(0);
      expect(from.tile).is.undefined;
      expect(to.tile?.tileType).eq(TileType.CITY);
      expect(player.getWaitingFor(), 'answered — never asked again').is.undefined;
    });

    it('stays parked behind a prompt that is not its own', () => {
      const from = seatCity(player, interiorLand());
      const to = game.board.getAdjacentSpaces(from)[0];
      parked(from, to);
      const other = interiorLand([from.id, ...ids(game.board.getAdjacentSpaces(from))]);
      player.setWaitingFor(new SelectSpace('Select space for ocean tile', [other]).andThen(() => undefined));

      drainBatchTail(player);

      expect(parkedBatchTailLength(player), 'an unaddressed space prompt is another giver\'s question').eq(1);
      expect(from.tile?.tileType).eq(TileType.CITY);
      expect(other.tile).is.undefined;
    });

    it('the DESTINATION was taken while parked: the tail is dropped and the question stands live', () => {
      const from = seatCity(player, interiorLand());
      const [to, another] = game.board.getAdjacentSpaces(from);
      parked(from, to);
      game.simpleAddTile(opponent, to, {tileType: TileType.GREENERY});
      const prompt = ask();

      drainBatchTail(player);

      expect(parkedBatchTailLength(player)).eq(0);
      expect(player.getWaitingFor(), 'the move is asked live').eq(prompt);
      expect(from.tile?.tileType).eq(TileType.CITY);
      expect(ids(prompt.spaces)).to.include(another.id);
    });

    it('the SOURCE changed while parked — the stack lost its top tier — the tail is dropped though the pair is still legal', () => {
      const from = seatCity(player, interiorLand());
      game.addCityTier(player, from);
      const [to, elsewhere] = game.board.getAdjacentSpaces(from);
      parked(from, to);
      // The interloper's own effect moved the top tier away: the cell is still a city, but not the stack the player lifted the top of.
      game.moveCityTile(player, from, elsewhere);
      const prompt = ask();

      drainBatchTail(player);

      expect(parkedBatchTailLength(player)).eq(0);
      expect(player.getWaitingFor()).eq(prompt);
      expect(to.tile, 'the stale pick did not land').is.undefined;
      expect(from.tile?.tileType).eq(TileType.CITY);
    });

    it('a hazard STANDING on the destination at the park is the player\'s own choice — it lands', () => {
      [game, player, opponent] = testGame(2, {aresExtension: true, aresHazards: false});
      const from = seatCity(player, interiorLand());
      const to = game.board.getAdjacentSpaces(from)[0];
      to.tile = {tileType: TileType.DUST_STORM_MILD};
      player.megaCredits = 30;
      parked(from, to);
      ask();

      drainBatchTail(player);
      runAllActions(game);

      expect(parkedBatchTailLength(player)).eq(0);
      expect(to.tile?.tileType).eq(TileType.CITY);
      expect(from.tile).is.undefined;
    });
  });
});
