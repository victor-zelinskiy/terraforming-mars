import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {ArcadianCommunities} from '../../src/server/cards/promo/ArcadianCommunities';
import {FerrusAcademy} from '../../src/server/cards/turmoilRedux/FerrusAcademy';
import {LandClaim} from '../../src/server/cards/base/LandClaim';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

/**
 * «BUILT ON YOUR OWN MARKER» — read ONCE by `Game.addTile` (`builtOnOwnMarker`), before the tile overwrites the cube
 * that answers it. Two receivers: the engine's +3 M€ (Arcadian Communities, as before) and the table's hook
 * (`ICard.onOwnMarkerBuilt`). The cube is ONE board state whoever laid it — and ONE predicate says where a cube may go
 * (`MarsBoard.isNonReservedLand`).
 */
describe('built on your own marker', () => {
  let game: IGame;
  let player: TestPlayer;
  let rival: TestPlayer;
  let calls: Array<Space>;

  beforeEach(() => {
    [game, player, rival] = testGame(2);
    game.phase = Phase.ACTION;
    calls = [];
    const listener = fakeCard({name: 'Marker listener' as CardName});
    Object.assign(listener, {onOwnMarkerBuilt: (_p: unknown, space: Space) => calls.push(space)});
    player.playedCards.push(listener);
  });

  function freeLand(): Space {
    return game.board.getNonReservedLandSpaces().find((s) => game.board.getAvailableSpacesForGreenery(player).includes(s))!;
  }

  it('the hook answers a tile on a cube Land Claim laid', () => {
    const cell = freeLand();
    cast(new LandClaim().play(player), SelectSpace).cb(cell);
    expect(cell.player).eq(player);
    game.addTile(player, cell, {tileType: TileType.GREENERY});
    expect(calls).deep.eq([cell]);
  });

  it('no cube — no answer; a tile beside a cube — no answer', () => {
    const cell = freeLand();
    game.addTile(player, cell, {tileType: TileType.GREENERY});
    expect(calls).deep.eq([]);
  });

  it('a city TIER is not a marker', () => {
    const cell = game.board.getAvailableSpacesForCity(player)[0];
    game.addTile(player, cell, {tileType: TileType.CITY});
    game.addCityTier(player, cell);
    expect(calls).deep.eq([]);
  });

  it('a rival cannot build on the cube at all', () => {
    const cell = freeLand();
    cell.player = player;
    expect(() => game.addTile(rival, cell, {tileType: TileType.GREENERY})).to.throw(/land claimed/);
    expect(game.board.getAvailableSpacesOnLand(rival)).not.include(cell);
  });

  it('Arcadian Communities is paid as before', () => {
    player.playedCards.push(new ArcadianCommunities());
    const cell = freeLand();
    cell.player = player;
    const before = player.megaCredits;
    game.addTile(player, cell, {tileType: TileType.GREENERY});
    runAllActions(game);
    expect(player.megaCredits - before).gte(3);
    expect(calls).deep.eq([cell]);
  });

  it('ONE predicate for the three cube sources: Land Claim\'s cells are the predicate\'s cells', () => {
    const cell = freeLand();
    cell.player = rival;
    expect(game.board.isNonReservedLand(cell)).is.false;
    expect(game.board.getNonReservedLandSpaces()).not.include(cell);
    expect(game.board.isNonReservedLand(game.board.getSpaceOrThrow(game.board.noctisCitySpaceId ?? cell.id))).is.false;
  });

  it('the preview names BOTH receivers on one marked cell (Arcadian + Ferrus on one table)', () => {
    player.playedCards.push(new ArcadianCommunities(), new FerrusAcademy());
    const cell = freeLand();
    cell.player = player;
    const preview = boardCellPreview(player, cell, 'greenery');
    const all = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts];
    expect(all.some((f) => f.id === 'marked-area-arcadian'), JSON.stringify(all.map((f) => f.id))).is.true;
    const ferrus = all.find((f) => f.id === `${player.color}-marked-area-ferrus`);
    expect(ferrus, JSON.stringify(all.map((f) => f.id))).is.not.undefined;
    expect(ferrus?.tableAnswer).is.true;
  });

  it('a rival\'s Ferrus says nothing about the placer\'s own cube', () => {
    rival.playedCards.push(new FerrusAcademy());
    const cell = freeLand();
    cell.player = player;
    const preview = boardCellPreview(player, cell, 'greenery');
    const all = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts];
    expect(all.some((f) => f.id.endsWith('marked-area-ferrus'))).is.false;
  });
});
