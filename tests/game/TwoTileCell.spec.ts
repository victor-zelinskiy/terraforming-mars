import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {MarsBoard} from '../../src/server/boards/MarsBoard';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceId} from '../../src/common/Types';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {Capital} from '../../src/server/cards/base/Capital';
import {Counter} from '../../src/server/behavior/Counter';
import {buriedOceanOf, hasPlainOcean, isPlainOceanTop, liftOcean} from '../../src/server/boards/cellPieces';
import {liftTopCity} from '../../src/server/boards/cityStack';
import {cityMoveOffer, cityStandsOnOcean} from '../../src/server/boards/cityMove';
import {isPlainOcean, oceanMoveOffer} from '../../src/server/boards/oceanMove';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {RemoveOceanTile} from '../../src/server/deferredActions/RemoveOceanTile';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {marsTileCensus} from '../../src/common/boards/marsTileCensus';
import {aggregateByPlayer} from '../../src/common/events/aggregate';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';

/**
 * TWO TILES ON ONE CELL (Turmoil Redux TR44 Aquatic Research Station — «place
 * a city ON TOP OF AN OCEAN TILE IN PLAY … the ocean underneath still grants
 * its adjacency bonus») — the ENGINE's contract, pinned at the engine: one
 * reading of «what lies here» (`common/boards/cellPieces.ts`), three writers
 * (`Game.addTile` with `overOcean`, `liftTopCity`, `liftOcean`). The card's
 * own spec pins the play; this one pins the physics the card stands on and
 * the physics the Ares composites keep.
 *
 * THE GEOMETRY IS THARSIS'S OWN (the default board), named by cell:
 *   · O1 (33) — an ocean reserve with two plants printed, beside two other
 *     ocean reserves (32, 34) and four land cells (24, 25, 41, 42);
 *   · O2 (34) — an ocean reserve beside O1; R (32) — another, kept empty;
 *   · L (42) — plant land beside O1; C (24) — land beside O1, the Capital's seat.
 */
const O1 = '33' as SpaceId;
const O2 = '34' as SpaceId;
const R = '32' as SpaceId;
const L = '42' as SpaceId;
const C = '24' as SpaceId;
const CARD = CardName.AQUATIC_RESEARCH_STATION;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(options?: {aresExtension?: boolean}): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, aresExtension: options?.aresExtension === true, aresHazards: false});
  const board = game.board;
  const adjacent = (a: SpaceId, b: SpaceId) => board.getAdjacentSpaces(board.getSpaceOrThrow(a)).some((s) => s.id === b);
  expect(board.getSpaceOrThrow(O1).spaceType).eq(SpaceType.OCEAN);
  expect(board.getSpaceOrThrow(O1).bonus).deep.eq([SpaceBonus.PLANT, SpaceBonus.PLANT]);
  expect(board.getSpaceOrThrow(O2).spaceType).eq(SpaceType.OCEAN);
  expect(board.getSpaceOrThrow(L).spaceType).eq(SpaceType.LAND);
  expect(board.getSpaceOrThrow(C).spaceType).eq(SpaceType.LAND);
  for (const [a, b] of [[O1, O2], [O1, R], [O1, L], [O1, C]] as const) {
    expect(adjacent(a, b), `${a} beside ${b}`).is.true;
  }
  expect(adjacent(O2, C), 'the Capital\'s seat is beside O1 only').is.false;
  p1.megaCredits = 0;
  p1.plants = 0;
  return {game, p1, p2};
}

const cell = (game: IGame, id: SpaceId) => game.board.getSpaceOrThrow(id);

/** An ocean seated WITHOUT the parameter's train — the arrangement, never the rule. */
function seatOcean(game: IGame, id: SpaceId): Space {
  const space = cell(game, id);
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
}

/** The card's own commit: an ORDINARY city on top of the ocean on `id`, through the engine's one door. */
function cityOverOcean(t: Table, id: SpaceId, player: TestPlayer = t.p1): Space {
  const space = cell(t.game, id);
  t.game.addTile(player, space, {tileType: TileType.CITY, card: CARD}, {overOcean: true});
  runAllActions(t.game);
  return space;
}

function seatCapital(game: IGame, owner: TestPlayer, id: SpaceId): Space {
  owner.playedCards.push(new Capital());
  const space = cell(game, id);
  game.simpleAddTile(owner, space, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
  return space;
}

const oceans = (game: IGame) => game.board.getOceanSpaces().map((s) => s.id);
const countable = (player: TestPlayer) => new Counter(player, fakeCard()).count({oceans: {}});

describe('TwoTileCell — a city over an ocean (TR44)', () => {
  describe('the writer: `Game.addTile` with `overOcean`', () => {
    it('without the knob a city on an ocean is «occupied», as it always was; with it the cell keeps BOTH pieces', () => {
      const t = table();
      seatOcean(t.game, O1);
      expect(() => t.game.addTile(t.p1, cell(t.game, O1), {tileType: TileType.CITY})).to.throw(/occupied/);
      expect(cell(t.game, O1).tile?.tileType, 'nothing changed').eq(TileType.OCEAN);

      const space = cityOverOcean(t, O1);
      expect(space.tile?.tileType, 'the city on top').eq(TileType.CITY);
      expect(space.tile?.card).eq(CARD);
      expect(space.tile?.covers, 'the ocean under it').deep.eq({tileType: TileType.OCEAN});
      expect(space.player, 'the city is the player\'s').eq(t.p1);
      expect(space.stackHeight).is.undefined;
      expect(buriedOceanOf(space)).deep.eq({tileType: TileType.OCEAN});
    });

    it('only an ordinary CITY may stand on the water this way, and only on a PLAIN ocean with nothing on it', () => {
      const t = table();
      seatOcean(t.game, O1);
      expect(() => t.game.addTile(t.p1, cell(t.game, O1), {tileType: TileType.GREENERY}, {overOcean: true})).to.throw(/occupied/);
      cityOverOcean(t, O1);
      expect(() => t.game.addTile(t.p1, cell(t.game, O1), {tileType: TileType.CITY}, {overOcean: true}), 'a second city on top').to.throw(/occupied/);
      expect(() => t.game.addTile(t.p1, cell(t.game, O1), {tileType: TileType.OCEAN_CITY}), 'a composite on top').to.throw(/occupied/);
      expect(() => t.game.addTile(t.p2, cell(t.game, O1), {tileType: TileType.CITY}, {overOcean: true}), 'a rival\'s city on top — the cell is the owner\'s').to.throw(/claimed/);
      // An EMPTY reserve is the placement KIND's refusal (`requires-ocean-tile`), never the writer's: `addTile` has never read terrain.
    });

    it('the ONE reading: the cell counts as a city AND as an ocean; a plain ocean is on it, but not on top', () => {
      const t = table();
      seatOcean(t.game, O1);
      const space = cityOverOcean(t, O1);
      expect(Board.isCitySpace(space)).is.true;
      expect(Board.isOceanSpace(space)).is.true;
      expect(Board.hasPlainOcean(space)).is.true;
      expect(hasPlainOcean(space)).is.true;
      expect(Board.isPlainOceanTop(space)).is.false;
      expect(isPlainOceanTop(space)).is.false;
      expect(Board.isUncoveredOceanSpace(space), '«when you place an ocean» never fires for the city').is.false;
      expect(Board.hasRealTile(space)).is.true;
      expect(MarsBoard.canCover(space, {tileType: TileType.OCEAN_CITY})).is.false;
    });

    it('the ocean still COUNTS: toward nine, in the countable (TR43\'s class), in the plain-ocean set — and the city in the city count (Mayor)', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      expect(oceans(t.game)).deep.eq([O1, O2]);
      const citiesBefore = t.game.board.countCities(t.p1);
      cityOverOcean(t, O1);
      expect(oceans(t.game), 'the count toward nine is unchanged').deep.eq([O1, O2]);
      expect(countable(t.p1), 'the countable (Ichtiology Grant, the ocean requirement)').eq(2);
      expect(t.game.board.getOceanSpaces({upgradedOceans: false}).map((s) => s.id), 'a plain ocean a removal or a move may take').deep.eq([O1, O2]);
      expect(t.game.board.getPlainOceanTops().map((s) => s.id), 'but nothing may be placed ON it any more').deep.eq([O2]);
      expect(t.game.board.countCities(t.p1), 'one more city of the player\'s').eq(citiesBefore + 1);
      expect(t.game.board.getCitiesOnMars(t.p1).map((s) => s.id)).to.include(O1);
    });

    it('the census (TR45) reads TWO tiles on the cell — the city and the ocean; a tier on top makes three', () => {
      const t = table();
      seatOcean(t.game, O1);
      const space = cityOverOcean(t, O1);
      const census = marsTileCensus([space]);
      expect(census.total).eq(2);
      expect(census.parts.map((p) => [p.kind, p.count])).deep.eq([['city', 1], ['ocean', 1]]);
      t.game.addCityTier(t.p1, space);
      runAllActions(t.game);
      expect(marsTileCensus([space]).total).eq(3);
      expect(marsTileCensus([space]).parts.map((p) => [p.kind, p.count])).deep.eq([['city', 2], ['ocean', 1]]);
    });
  });

  describe('what the placement pays — the ordinary cover\'s', () => {
    it('no printed bonus (the ocean took it); +2 M€ per OTHER adjacent ocean; the ocean under the city is no neighbour and pays nothing', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      cityOverOcean(t, O1);
      expect(t.p1.plants, 'the two plants printed on O1 were covered').eq(0);
      expect(t.p1.megaCredits, 'O2 pays 2; O1 under the city does not').eq(2);
      expect(t.p1.lastOceanBonus?.oceanSpaceIds).deep.eq([O2]);
    });

    it('a `tile-placed` event of a CITY, «tiles placed» grows by one, and the log line names the COVER', () => {
      const t = table();
      seatOcean(t.game, O1);
      const placedBefore = aggregateByPlayer(t.game.events.events).get(t.p1.color)?.tilesPlaced ?? 0;
      const logBefore = t.game.gameLog.length;
      cityOverOcean(t, O1);
      const placed = t.game.events.events.filter((e) => e.type === 'tile-placed');
      expect(placed.at(-1)).deep.include({player: t.p1.color, space: O1, tile: TileType.CITY});
      expect(aggregateByPlayer(t.game.events.events).get(t.p1.color)?.tilesPlaced ?? 0).eq(placedBefore + 1);
      const lines = t.game.gameLog.slice(logBefore).map((l) => l.message);
      expect(lines).to.include('${0} placed a city tile on top of the ocean tile · ${1}');
      expect(lines).to.not.include('${0} ${1} ${2} · ${3}');
    });

    it('a greenery placed beside the cell LATER is paid the ocean\'s M€ — «the ocean underneath still grants its adjacency bonus»', () => {
      const t = table();
      seatOcean(t.game, O1);
      cityOverOcean(t, O1);
      t.game.addGreenery(t.p2, cell(t.game, L));
      runAllActions(t.game);
      // The ocean under the city paid — the breakdown names it (the M€ total also carries the greenery's own TR answers).
      expect(t.p2.lastOceanBonus?.oceanSpaceIds).deep.eq([O1]);
      expect(t.game.board.oceanAdjacencyBonus(t.p2, cell(t.game, L))).deep.include({oceans: 1, megacredits: 2});
    });

    it('the Capital beside the cell KEEPS its point: the ocean under the city is still an adjacent ocean', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatCapital(t.game, t.p2, C);
      expect(t.p2.getVictoryPoints().victoryPoints).eq(1);
      cityOverOcean(t, O1);
      expect(t.p2.getVictoryPoints().victoryPoints).eq(1);
    });
  });

  describe('the placement kind `city-over-ocean`', () => {
    it('the legal cells are the plain ocean tops — anyone\'s, on a reserve or on land; never a composite, never a covered one, never an empty reserve', () => {
      const t = table({aresExtension: true});
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      seatOcean(t.game, L); // an ocean on land (Artificial Lake's family)
      const composite = seatOcean(t.game, R);
      t.game.addTile(t.p2, composite, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY});
      runAllActions(t.game);
      expect(composite.tile?.tileType).eq(TileType.OCEAN_CITY);
      cityOverOcean(t, O2, t.p2);
      const legal = t.game.board.getAvailableSpacesForType(t.p1, 'city-over-ocean').map((s) => s.id);
      expect(legal).to.have.members([O1, L]);
      expect(t.game.board.illegalReasonFor(t.p1, 'city-over-ocean', composite), 'a composite is one tile — occupied').eq('occupied');
      expect(t.game.board.illegalReasonFor(t.p1, 'city-over-ocean', cell(t.game, O2)), 'a city already stands on this ocean').eq('occupied');
      expect(t.game.board.illegalReasonFor(t.p1, 'city-over-ocean', cell(t.game, C)), 'land with no ocean').eq('requires-ocean-tile');
      // An empty reserve: 42's neighbour 43 is a bare ocean reserve.
      const emptyReserve = t.game.board.getAdjacentSpaces(cell(t.game, L)).find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      expect(t.game.board.illegalReasonFor(t.p1, 'city-over-ocean', emptyReserve)).eq('requires-ocean-tile');
    });

    it('a composite\'s own kind no longer offers a covered ocean either: Ocean City and New Holland see the cell as occupied', () => {
      const t = table({aresExtension: true});
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      cityOverOcean(t, O1);
      expect(t.game.board.getAvailableSpacesForType(t.p2, 'upgradeable-ocean').map((s) => s.id)).deep.eq([O2]);
      expect(t.game.board.illegalReasonFor(t.p2, 'upgradeable-ocean', cell(t.game, O1))).eq('occupied');
      expect(t.game.board.getAvailableSpacesForType(t.p2, 'upgradeable-ocean-new-holland').map((s) => s.id), 'New Holland keeps the city rule too: O2 is beside the city on O1').deep.eq([]);
    });

    it('the preview: legal, the cover\'s «no bonus», the OTHER ocean\'s M€, the city\'s scoring, and the fact that the ocean stays under the city', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      const preview = boardCellPreview(t.p1, cell(t.game, O1), 'city-over-ocean', {tileType: TileType.CITY, sourceCard: CARD});
      expect(preview.legal).is.true;
      const ids = [...preview.immediateFacts, ...preview.futureScoringFacts, ...preview.ruleFacts].map((f) => f.id);
      expect(ids).to.include('cover-no-bonus');
      expect(ids).to.include('ocean-under-city');
      expect(ids).to.include('place-city');
      const ocean = preview.immediateFacts.find((f) => f.id === 'ocean-adjacency');
      expect(ocean?.delta?.amount).eq(2);
      expect(ocean?.spaces).deep.eq([O2]);
      expect(boardCellPreview(t.p1, cell(t.game, O2), 'city-over-ocean', {tileType: TileType.CITY}).legal).is.true;
      expect(boardCellPreview(t.p1, cell(t.game, R), 'city-over-ocean', {tileType: TileType.CITY}).illegalReason).eq('requires-ocean-tile');
    });

    it('the inspector of the placed cell says TWO tiles: counts as city and ocean, the ocean marked, the description, the rule the ocean still pays', () => {
      const t = table();
      seatOcean(t.game, O1);
      cityOverOcean(t, O1);
      const info = boardCellInfo(t.p2, cell(t.game, O1));
      expect(info.status.content).eq('city');
      expect(info.status.under).eq('ocean');
      expect(info.status.countsAs).deep.eq(['city', 'ocean']);
      expect(info.status.special, 'an ORDINARY city — never a special one').is.not.true;
      expect(info.description).eq('Two tiles: a city stands on an ocean tile. The ocean still pays its neighbours and still counts.');
      expect(info.facts.map((f) => f.id)).to.include('ocean-neighbour-rule');
      expect(info.facts.map((f) => f.id)).to.include('score-city');
    });
  });

  describe('the ocean leaves from UNDER the city (the set\'s FAQ, p. 18)', () => {
    it('TR39: the ocean under the city is a SOURCE of the move; it moves out, the city stays, the cell stops counting as an ocean', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatCapital(t.game, t.p2, C);
      cityOverOcean(t, O1);
      expect(isPlainOcean(cell(t.game, O1))).is.true;
      const offer = oceanMoveOffer(t.p1);
      const source = offer.sources.find((s) => s.from.id === O1);
      expect(source, 'listed as a source').is.not.undefined;
      expect(source!.tileType, 'what travels is the ocean').eq(TileType.OCEAN);
      expect(source!.arrives).eq(TileType.OCEAN);
      expect(source!.to.map((s) => s.id)).to.include(O2);
      expect(t.p2.getVictoryPoints().victoryPoints).eq(1);
      const countBefore = oceans(t.game).length;

      t.game.moveOceanTile(t.p1, cell(t.game, O1), cell(t.game, O2));
      runAllActions(t.game);
      const from = cell(t.game, O1);
      expect(from.tile?.tileType, 'the city stays').eq(TileType.CITY);
      expect(from.tile?.card).eq(CARD);
      expect(from.tile?.covers, 'without its ocean').is.undefined;
      expect(from.player).eq(t.p1);
      expect(Board.isOceanSpace(from), 'the cell no longer counts as an ocean').is.false;
      expect(Board.isCitySpace(from)).is.true;
      expect(cell(t.game, O2).tile?.tileType).eq(TileType.OCEAN);
      expect(oceans(t.game).length, 'a move never changes the count').eq(countBefore);
      expect(t.p2.getVictoryPoints().victoryPoints, 'the Capital beside O1 only lost its ocean').eq(0);
      const moved = t.game.events.events.filter((e) => e.type === 'tile-moved');
      expect(moved.at(-1)?.impact.tileMove).deep.include({from: O1, to: O2, tileType: TileType.OCEAN});
    });

    it('RX33 / the Reds: a removal takes the ocean from under the city — the city, its owner and its stack stay; `tile-removed` names an OCEAN', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      seatCapital(t.game, t.p2, C);
      const space = cityOverOcean(t, O1);
      t.game.addCityTier(t.p1, space);
      runAllActions(t.game);
      expect(t.game.board.getOceanSpaces({upgradedOceans: false}).map((s) => s.id), 'offered to the removal').deep.eq([O1, O2]);
      t.game.defer(new RemoveOceanTile(t.p2));
      runAllActions(t.game);
      const prompt = cast(t.p2.popWaitingFor(), SelectSpace);
      expect(prompt.spaces.map((s) => s.id)).deep.eq([O1, O2]);
      prompt.process({type: 'space', spaceId: O1});
      runAllActions(t.game);
      expect(space.tile?.tileType, 'the city stays').eq(TileType.CITY);
      expect(space.tile?.covers).is.undefined;
      expect(space.player).eq(t.p1);
      expect(space.stackHeight, 'the stack stays').eq(2);
      expect(oceans(t.game)).deep.eq([O2]);
      expect(t.p2.getVictoryPoints().victoryPoints).eq(0);
      const removed = t.game.events.events.filter((e) => e.type === 'tile-removed');
      expect(removed.at(-1)).deep.include({space: O1, tile: TileType.OCEAN});
    });

    it('the preview of the removal says so: the ocean leaves, the city stays', () => {
      const t = table();
      seatOcean(t.game, O1);
      cityOverOcean(t, O1);
      const preview = boardCellPreview(t.p2, cell(t.game, O1), 'ocean-removal', {placementEffect: 'remove'});
      expect(preview.legal).is.true;
      const ids = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.futureScoringFacts].map((f) => f.id);
      expect(ids).to.include('remove-ocean');
      expect(ids).to.include('remove-ocean-under-city');
    });

    it('`liftOcean` is the one lift: from the top of a bare ocean cell, or from under a city — never from a composite', () => {
      const t = table({aresExtension: true});
      const bare = seatOcean(t.game, O2);
      expect(liftOcean(bare)).deep.eq({tileType: TileType.OCEAN});
      expect(bare.tile).is.undefined;
      seatOcean(t.game, O1);
      const covered = cityOverOcean(t, O1);
      const standing = covered.tile;
      expect(liftOcean(covered)).deep.eq({tileType: TileType.OCEAN});
      expect(covered.tile, 'a fresh object without the cover — the saved one can be put back exactly').deep.eq({tileType: TileType.CITY, card: CARD});
      expect(covered.tile).not.eq(standing);
      const composite = seatOcean(t.game, R);
      t.game.addTile(t.p2, composite, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY});
      expect(() => liftOcean(composite)).to.throw(/No plain ocean/);
      expect(() => liftOcean(cell(t.game, C))).to.throw(/No ocean/);
    });
  });

  describe('the city leaves the water (TR14) — the ocean stays', () => {
    it('`cityStandsOnOcean` is about the COMPOSITE only: the TR44 city is a movable source; the lift leaves a plain ocean of nobody\'s', () => {
      const t = table();
      seatOcean(t.game, O1);
      seatCapital(t.game, t.p2, C);
      const space = cityOverOcean(t, O1);
      expect(cityStandsOnOcean(space)).is.false;
      const offer = cityMoveOffer(t.p1);
      const source = offer.sources.find((s) => s.from.id === O1);
      expect(source).is.not.undefined;
      expect(source!.tileType).eq(TileType.CITY);
      expect(source!.card).eq(CARD);
      expect(source!.to.map((s) => s.id)).to.include(L);
      const countBefore = oceans(t.game).length;

      t.game.moveCityTile(t.p1, space, cell(t.game, L));
      runAllActions(t.game);
      expect(space.tile, 'the ocean stands where the city stood').deep.eq({tileType: TileType.OCEAN});
      expect(space.player).is.undefined;
      expect(Board.isOceanSpace(space)).is.true;
      expect(Board.isPlainOceanTop(space)).is.true;
      expect(cell(t.game, L).tile, 'the city on land, WITHOUT a phantom ocean').deep.eq({tileType: TileType.CITY, card: CARD});
      expect(cell(t.game, L).player).eq(t.p1);
      expect(oceans(t.game).length).eq(countBefore);
      expect(t.p2.getVictoryPoints().victoryPoints, 'the Capital beside O1 keeps its ocean').eq(1);
    });

    it('`liftTopCity` on a stack over the water gives up its top tier only; on the last tier it leaves the ocean', () => {
      const t = table();
      seatOcean(t.game, O1);
      const space = cityOverOcean(t, O1);
      t.game.addCityTier(t.p1, space);
      runAllActions(t.game);
      expect(liftTopCity(space).tile).deep.eq({tileType: TileType.CITY});
      expect(space.tile?.covers, 'the base and its ocean stay').deep.eq({tileType: TileType.OCEAN});
      expect(space.stackHeight).is.undefined;
      const last = liftTopCity(space);
      expect(last.tile).deep.eq({tileType: TileType.CITY, card: CARD});
      expect(last.tiers).deep.eq({before: 1, after: 0});
      expect(space.tile).deep.eq({tileType: TileType.OCEAN});
      expect(space.player).is.undefined;
    });

    it('the composites keep their rule: an Ocean City is listed with `city-stands-on-ocean`, never a source', () => {
      const t = table({aresExtension: true});
      const composite = seatOcean(t.game, O1);
      t.game.addTile(t.p1, composite, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY});
      runAllActions(t.game);
      expect(cityStandsOnOcean(composite)).is.true;
      expect(cityMoveOffer(t.p1).disabledSources.map((d) => [d.space.id, d.reason])).deep.eq([[O1, 'city-stands-on-ocean']]);
      expect(oceanMoveOffer(t.p1).disabledSources.map((d) => [d.space.id, d.reason])).deep.eq([[O1, 'upgraded-ocean']]);
      expect(marsTileCensus([composite]).total, 'ONE tile').eq(1);
      // The one writer recorded the cover for the composite too — the survey family's reading is unchanged.
      expect(composite.tile?.covers).deep.eq({tileType: TileType.OCEAN});
      expect(buriedOceanOf(composite), 'but it is not a piece').is.undefined;
    });
  });

  it('survives a save and a load: both pieces, the owner, the stack — and the ocean still counts', () => {
    const t = table();
    seatOcean(t.game, O1);
    const space = cityOverOcean(t, O1);
    t.game.addCityTier(t.p1, space);
    runAllActions(t.game);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const loaded = live.board.getSpaceOrThrow(O1);
    expect(loaded.tile).deep.eq({tileType: TileType.CITY, card: CARD, covers: {tileType: TileType.OCEAN}});
    expect(loaded.player?.id).eq(t.p1.id);
    expect(loaded.stackHeight).eq(2);
    expect(Board.isOceanSpace(loaded)).is.true;
    expect(live.board.getOceanSpaces().map((s) => s.id)).deep.eq([O1]);
    expect(live.board.countCities(live.getPlayerById(t.p1.id))).eq(2);
  });
});
