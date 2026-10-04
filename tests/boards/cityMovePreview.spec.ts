import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {boardCellPreview, withHypotheticalMove} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact, BoardPlacementPreview} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {BoardName} from '../../src/common/boards/BoardName';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {addOcean} from '../TestingUtils';

/**
 * THE PREVIEW OF A CITY MOVE (Turmoil Redux TR14 Re-settlement,
 * `kind: 'city-move'`) — its two readings: the SOURCE (may this city move,
 * and where) and the DESTINATION (what the cell gives with the city already
 * lifted off its old one, and what the old cell stops giving). Every number
 * is read off the engine's own rule sources under the commit's own lift.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(options?: {aresExtension?: boolean, boardName?: BoardName}): Table {
  const [game, p1, p2] = testGame(2, {
    aresExtension: options?.aresExtension === true,
    aresHazards: false,
    ...(options?.boardName !== undefined ? {boardName: options.boardName} : {}),
  });
  return {game, p1, p2};
}

const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

function allFacts(preview: BoardPlacementPreview): ReadonlyArray<BoardFact> {
  return [
    ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
    ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ...(preview.progressFacts ?? []),
  ];
}

const plainLand = (game: IGame) => (s: Space) =>
  s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== game.board.noctisCitySpaceId;

/**
 * Two ADJACENT land cells `from` / `to`, each with six plain-land neighbours —
 * so the cells beside only one of them and the two beside both are all free.
 */
function pair(game: IGame): {from: Space, to: Space, onlyFrom: Array<Space>, onlyTo: Array<Space>, both: Array<Space>} {
  const board = game.board;
  const free = plainLand(game);
  const interior = (s: Space) => free(s) && board.getAdjacentSpaces(s).length === 6 && board.getAdjacentSpaces(s).every(free);
  for (const from of board.spaces.filter(interior)) {
    const to = board.getAdjacentSpaces(from).find(interior);
    if (to === undefined) {
      continue;
    }
    const aroundFrom = board.getAdjacentSpaces(from).filter((s) => s.id !== to.id);
    const aroundTo = board.getAdjacentSpaces(to).filter((s) => s.id !== from.id);
    const toIds = new Set(ids(aroundTo));
    const fromIds = new Set(ids(aroundFrom));
    return {
      from, to,
      onlyFrom: aroundFrom.filter((s) => !toIds.has(s.id)),
      onlyTo: aroundTo.filter((s) => !fromIds.has(s.id)),
      both: aroundFrom.filter((s) => toIds.has(s.id)),
    };
  }
  throw new Error('no pair of adjacent interior land cells');
}

function seat(game: IGame, owner: TestPlayer, space: Space, tileType: TileType = TileType.CITY, card?: CardName): Space {
  game.simpleAddTile(owner, space, card === undefined ? {tileType} : {tileType, card});
  return space;
}

describe('cityMovePreview', () => {
  describe('the SOURCE reading (no `movedFrom`)', () => {
    it('a movable city: legal, names its destinations as the fact\'s cells, and what it scores where it stands', () => {
      const {game, p1, p2} = table();
      const {from, onlyFrom} = pair(game);
      seat(game, p1, from);
      seat(game, p2, onlyFrom[0], TileType.GREENERY);

      const preview = boardCellPreview(p1, from, 'city-move');

      expect(preview.legal).is.true;
      expect(preview.illegalReason).is.undefined;
      expect(preview.placesTile, 'lifting a city puts nothing down yet').is.false;
      const reach = allFacts(preview).find((f) => f.id === 'move-reach')!;
      expect(reach.category).eq('tile-move');
      expect(reach.params).deep.eq(['5']);
      expect(reach.spaces, 'the field lights exactly the cells the city can reach').to.have.members(
        ids(game.board.getAdjacentSpaces(from)).filter((id) => id !== onlyFrom[0].id));
      const scores = allFacts(preview).find((f) => f.id === 'move-scores-now')!;
      expect(scores.title).eq('Scores now: ${0} VP');
      expect(scores.params).deep.eq(['1']);
      expect(scores.vp, 'a standing fact — never a «+N» promise').is.undefined;
    });

    it('a stack: only the top tier leaves — ×2 → ×1', () => {
      const {game, p1} = table();
      const {from} = pair(game);
      seat(game, p1, from, TileType.CAPITAL, CardName.CAPITAL);
      game.addCityTier(p1, from);
      const stack = allFacts(boardCellPreview(p1, from, 'city-move')).find((f) => f.id === 'move-stack')!;
      expect(stack.params).deep.eq(['2', '1']);
    });

    it('a city with nowhere to go and a city over an ocean are NOT legal and state their ONE reason', () => {
      const {game, p1, p2} = table();
      const {from} = pair(game);
      seat(game, p1, from);
      game.board.getAdjacentSpaces(from).forEach((s) => seat(game, p2, s, TileType.GREENERY));
      const locked = boardCellPreview(p1, from, 'city-move');
      expect(locked.legal).is.false;
      expect(locked.illegalReason).eq('no-space-to-move');
      expect(allFacts(locked).some((f) => f.id === 'move-reach'), 'no destinations are promised').is.false;
      expect(allFacts(locked).some((f) => f.id === 'move-scores-now'), 'it is still the player\'s city and says what it scores').is.true;

      const ocean = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      addOcean(p1, ocean.id);
      game.addTile(p1, ocean, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: ocean.tile});
      const overOcean = boardCellPreview(p1, ocean, 'city-move');
      expect(overOcean.legal).is.false;
      expect(overOcean.illegalReason).eq('city-stands-on-ocean');
    });

    it('any other cell — empty land, another player\'s city — is «not one of your cities on Mars»', () => {
      const {game, p1, p2} = table();
      const {from, to, onlyTo} = pair(game);
      seat(game, p1, from);
      seat(game, p2, onlyTo[0]);
      for (const cell of [to, onlyTo[0]]) {
        const preview = boardCellPreview(p1, cell, 'city-move');
        expect(preview.legal, cell.id).is.false;
        expect(preview.illegalReason, cell.id).eq('not-your-city');
        expect(allFacts(preview), cell.id).deep.eq([]);
      }
    });
  });

  describe('the DESTINATION reading (`movedFrom`)', () => {
    it('reads the cell as a city placement: its printed bonus, its ocean adjacency, every «tile placed» trigger', () => {
      const {game, p1, p2} = table();
      const {from, to} = pair(game);
      seat(game, p1, from);
      to.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL];
      p2.playedCards.push(new RoverConstruction());

      const preview = boardCellPreview(p1, to, 'city-move', {movedFrom: from});

      expect(preview.legal).is.true;
      expect(preview.placesTile).is.true;
      const steel = preview.immediateFacts.find((f) => f.category === 'printed-placement-bonus')!;
      expect(steel.delta).deep.include({icon: 'steel', amount: 2, direction: 'gain'});
      expect(preview.recipientFacts.some((f) => f.source?.id === CardName.ROVER_CONSTRUCTION),
        'another player\'s Rover Construction answers the city landing').is.true;
    });

    it('the city\'s VP is ONE pool with two members: what the new cell adds and what the former one takes — a shared neighbour is no part of it', () => {
      const {game, p1, p2} = table();
      const {from, to, onlyFrom, onlyTo, both} = pair(game);
      seat(game, p1, from);
      seat(game, p2, onlyFrom[0], TileType.GREENERY);
      seat(game, p2, both[0], TileType.GREENERY);
      seat(game, p2, onlyTo[0], TileType.GREENERY);
      seat(game, p2, onlyTo[1], TileType.GREENERY);

      const preview = boardCellPreview(p1, to, 'city-move', {movedFrom: from});

      const members = preview.futureScoringFacts.filter((f) => f.title === 'City VP');
      expect(members.map((f) => f.id)).deep.eq(['move-city-vp-gain', 'move-city-vp-loss']);
      const [gain, loss] = members;
      expect(gain.vp, 'the city scores 2 today; the new cell adds 2').deep.eq({from: 2, to: 4});
      expect(gain.reason).eq('At the new space');
      expect(gain.category).eq('city-greenery-scoring');
      expect(gain.spaces).to.have.members([onlyTo[0].id, onlyTo[1].id]);
      expect(loss.vp, 'the former cell takes 1').deep.eq({from: 2, to: 1});
      expect(loss.reason).eq('At the former space');
      expect(loss.category, 'a loss must read as one on the field').eq('tile-departure');
      expect(loss.severity).eq('warning');
      expect(loss.spaces).deep.eq([onlyFrom[0].id]);
      // The pool lands on 2 + 2 − 1 = 3 — the number the board will read after the move.
      const resulting = withHypotheticalMove(p1, from, to, () => game.board.getAdjacentSpaces(to).filter(Board.isGreenerySpace).length);
      expect(gain.vp!.from + (gain.vp!.to - gain.vp!.from) + (loss.vp!.to - loss.vp!.from)).eq(resulting);
    });

    it('nothing changes → one calm line, never a «+0» badge', () => {
      const {game, p1, p2} = table();
      const {from, to, both} = pair(game);
      seat(game, p1, from);
      seat(game, p2, both[0], TileType.GREENERY);
      const preview = boardCellPreview(p1, to, 'city-move', {movedFrom: from});
      const fact = preview.futureScoringFacts.find((f) => f.id === 'move-city-vp')!;
      expect(fact.vp).is.undefined;
      expect(fact.description).eq('Unchanged: ${0} VP');
      expect(fact.params).deep.eq(['1']);
    });

    it('the Capital counts its adjacent OCEANS in the same pool', () => {
      const {game, p1, p2} = table();
      const board = game.board;
      const free = plainLand(game);
      // `to` beside an ocean cell that `from` is not beside.
      let found: {from: Space, to: Space, ocean: Space} | undefined;
      for (const to of board.spaces.filter(free)) {
        const ocean = board.getAdjacentSpaces(to).find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined);
        const from = ocean === undefined ? undefined :
          board.getAdjacentSpaces(to).find((s) => free(s) && !board.getAdjacentSpaces(s).some((n) => n.id === ocean.id));
        if (ocean !== undefined && from !== undefined) {
          found = {from, to, ocean};
          break;
        }
      }
      const {from, to, ocean} = found!;
      seat(game, p1, from, TileType.CAPITAL, CardName.CAPITAL);
      addOcean(p2, ocean.id);

      const gain = boardCellPreview(p1, to, 'city-move', {movedFrom: from}).futureScoringFacts.find((f) => f.id === 'move-city-vp-gain')!;

      expect(gain.vp).deep.eq({from: 0, to: 1});
      expect(gain.spaces).deep.eq([ocean.id]);
      // …and a plain tier lifted off that same Capital does not score oceans.
      game.addCityTier(p1, from);
      const tier = boardCellPreview(p1, to, 'city-move', {movedFrom: from}).futureScoringFacts;
      expect(tier.some((f) => f.id === 'move-city-vp-gain'), 'a plain city scores no ocean').is.false;
    });

    it('the number of cities does NOT grow: Mayor stands still, where an ordinary city placement advances it', () => {
      const {game, p1} = table();
      const {from, to, onlyTo} = pair(game);
      seat(game, p1, from);
      const move = boardCellPreview(p1, to, 'city-move', {movedFrom: from});
      expect((move.progressFacts ?? []).some((f) => f.title === 'Mayor'), 'a moved city is not a new one').is.false;
      // The control: the same engine DOES report Mayor for a city that is placed.
      const placed = boardCellPreview(p1, onlyTo[0], 'land', {tileType: TileType.CITY});
      expect((placed.progressFacts ?? []).some((f) => f.title === 'Mayor')).is.true;
    });

    it('an award of PLACE recounts honestly — up when the new cell earns it, DOWN (as a warning) when only the old one did', () => {
      const {game, p1, p2} = table({boardName: BoardName.ELYSIUM});
      expect(game.awards.map((a) => a.name), 'Elysium funds Estate Dealer').to.include('Estate Dealer');
      const board = game.board;
      const free = plainLand(game);
      let found: {inland: Space, shore: Space, ocean: Space} | undefined;
      for (const shore of board.spaces.filter(free)) {
        const ocean = board.getAdjacentSpaces(shore).find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined);
        const inland = ocean === undefined ? undefined :
          board.getAdjacentSpaces(shore).find((s) => free(s) && board.getAdjacentSpaces(s).every((n) => n.spaceType !== SpaceType.OCEAN));
        if (ocean !== undefined && inland !== undefined) {
          found = {inland, shore, ocean};
          break;
        }
      }
      const {inland, shore, ocean} = found!;
      addOcean(p2, ocean.id);
      const estate = (preview: BoardPlacementPreview) => (preview.progressFacts ?? []).find((f) => f.title === 'Estate Dealer');

      seat(game, p1, inland);
      const up = estate(boardCellPreview(p1, shore, 'city-move', {movedFrom: inland}))!;
      expect(up.progress).deep.include({from: 0, to: 1});
      expect(up.severity).eq('info');

      game.moveCityTile(p1, inland, shore);
      const down = estate(boardCellPreview(p1, inland, 'city-move', {movedFrom: shore}))!;
      expect(down.progress).deep.include({from: 1, to: 0});
      expect(down.severity, 'a silent loss of standing is what the panel exists to prevent').eq('warning');
    });

    it('the Ares Capital is never promised ITS OWN adjacency for landing beside the cell it left', () => {
      const {game, p1} = table({aresExtension: true});
      const {from, to} = pair(game);
      seat(game, p1, from, TileType.CAPITAL, CardName.CAPITAL_ARES);
      from.adjacency = {bonus: [SpaceBonus.MEGACREDITS, SpaceBonus.MEGACREDITS]};

      const move = boardCellPreview(p1, to, 'city-move', {movedFrom: from});
      expect(allFacts(move).some((f) => f.category === 'ares-adjacency-bonus' || f.category === 'tile-owner-benefit'),
        'the adjacency left with the tile').is.false;
      // The control: a tile placed beside the STANDING Capital does earn it.
      const placed = boardCellPreview(p1, to, 'land', {tileType: TileType.GREENERY});
      expect(allFacts(placed).some((f) => f.category === 'ares-adjacency-bonus')).is.true;
    });

    it('the former cell: a single city frees it and names the bonus the NEXT tile there collects — to nobody', () => {
      const {game, p1} = table();
      const {from, to} = pair(game);
      seat(game, p1, from);
      from.bonus = [SpaceBonus.PLANT, SpaceBonus.PLANT];
      const preview = boardCellPreview(p1, to, 'city-move', {movedFrom: from});
      const freed = preview.ruleFacts.filter((f) => f.id.startsWith('move-vacated'));
      expect(freed.map((f) => f.id)).deep.eq(['move-vacated', `move-vacated-${SpaceBonus.PLANT}`]);
      expect(freed.every((f) => f.category === 'tile-move' && f.recipient.kind === 'nobody')).is.true;
      expect(freed.every((f) => f.spaces?.length === 1 && f.spaces[0] === from.id), 'each names the cell it is about').is.true;
      expect(freed[1].delta).deep.include({icon: 'plants', amount: 2});
      expect(preview.immediateFacts.some((f) => f.delta?.icon === 'plants'), 'never a gain of the mover\'s').is.false;
    });

    it('the former cell: a stack stands one tier shorter and keeps its base', () => {
      const {game, p1} = table();
      const {from, to} = pair(game);
      seat(game, p1, from);
      game.addCityTier(p1, from);
      const preview = boardCellPreview(p1, to, 'city-move', {movedFrom: from});
      const stack = preview.ruleFacts.find((f) => f.id === 'move-stack')!;
      expect(stack.params).deep.eq(['2', '1']);
      expect(stack.spaces).deep.eq([from.id]);
      expect(preview.ruleFacts.some((f) => f.id === 'move-vacated'), 'the cell is not freed').is.false;
    });

    it('a Commercial District recounts for its OWNER: one city fewer beside the old cell', () => {
      const {game, p1, p2} = table();
      const {from, to, onlyFrom, onlyTo} = pair(game);
      seat(game, p1, from);
      seat(game, p2, onlyFrom[0], TileType.COMMERCIAL_DISTRICT, CardName.COMMERCIAL_DISTRICT);
      seat(game, p1, onlyTo[0], TileType.COMMERCIAL_DISTRICT, CardName.COMMERCIAL_DISTRICT);

      const preview = boardCellPreview(p1, to, 'city-move', {movedFrom: from});

      const theirs = preview.recipientFacts.find((f) => f.id === `move-commercial-${onlyFrom[0].id}`)!;
      expect(theirs.vp).deep.eq({from: 1, to: 0});
      expect(theirs.recipient).deep.eq({kind: 'tile-owner', color: p2.color});
      expect(theirs.spaces).deep.eq([onlyFrom[0].id]);
      const mine = preview.futureScoringFacts.find((f) => f.id === `move-commercial-${onlyTo[0].id}`)!;
      expect(mine.vp).deep.eq({from: 0, to: 1});
      expect(mine.severity).eq('positive');
    });

    it('an illegal destination states its reason: a far free cell, the city\'s own cell, a city that cannot move', () => {
      const {game, p1} = table();
      const {from, to, onlyTo} = pair(game);
      seat(game, p1, from);
      const far = boardCellPreview(p1, onlyTo[0], 'city-move', {movedFrom: from});
      expect(far.legal).is.false;
      expect(far.illegalReason).eq('not-adjacent-to-the-city');
      const self = boardCellPreview(p1, from, 'city-move', {movedFrom: from});
      expect(self.legal).is.false;
      expect(self.illegalReason).eq('occupied');
      expect(allFacts(self)).deep.eq([]);
      const noSource = boardCellPreview(p1, onlyTo[0], 'city-move', {movedFrom: to});
      expect(noSource.legal, '`to` holds no city of theirs').is.false;
      expect(allFacts(noSource)).deep.eq([]);
    });
  });

  describe('the hypothesis is exactly undone', () => {
    it('`withHypotheticalMove` shows the board after the move and restores both cells — keys included', () => {
      const {game, p1} = table({aresExtension: true});
      const {from, to} = pair(game);
      seat(game, p1, from, TileType.CAPITAL, CardName.CAPITAL_ARES);
      const adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
      from.adjacency = adjacency;
      const tile = from.tile;

      const inside = withHypotheticalMove(p1, from, to, () => ({
        fromTile: from.tile, toTile: to.tile?.tileType, toOwner: to.player, cities: game.board.countCities(p1),
        fromAdjacency: 'adjacency' in from,
      }));

      expect(inside).deep.eq({fromTile: undefined, toTile: TileType.CAPITAL, toOwner: p1, cities: 1, fromAdjacency: false});
      expect(from.tile, 'the SAME tile object is back').eq(tile);
      expect(from.adjacency).eq(adjacency);
      expect(from.player).eq(p1);
      expect('stackHeight' in from, 'an absent key stays absent').is.false;
      expect('coOwner' in from).is.false;
      expect(to.tile).is.undefined;
      expect(to.player).is.undefined;
    });

    it('is read-only: both readings, over every cell, mutate no game state', () => {
      const {game, p1, p2} = table({aresExtension: true});
      const {from, to, onlyFrom} = pair(game);
      seat(game, p1, from, TileType.CAPITAL, CardName.CAPITAL_ARES);
      from.adjacency = {bonus: [SpaceBonus.MEGACREDITS, SpaceBonus.MEGACREDITS]};
      seat(game, p1, onlyFrom[0]);
      game.addCityTier(p1, onlyFrom[0]);
      seat(game, p2, to, TileType.GREENERY);
      const before = JSON.stringify(game.board.serialize());
      const shape = (s: Space) => Object.keys(s).sort().join(',');
      const shapes = game.board.spaces.map(shape);
      const mc = p1.megaCredits;
      const deferred = game.deferredActions.length;
      const events = game.events.events.length;
      const aresBefore = JSON.stringify(game.aresData);

      for (const space of game.board.spaces) {
        boardCellPreview(p1, space, 'city-move');
        boardCellPreview(p1, space, 'city-move', {movedFrom: from});
        boardCellPreview(p1, space, 'city-move', {movedFrom: onlyFrom[0]});
      }

      expect(JSON.stringify(game.board.serialize())).eq(before);
      expect(game.board.spaces.map(shape), 'no key appeared or vanished on any cell').deep.eq(shapes);
      expect(p1.megaCredits).eq(mc);
      expect(game.deferredActions.length).eq(deferred);
      expect(game.events.events.length).eq(events);
      expect(JSON.stringify(game.aresData)).eq(aresBefore);
      expect(game.tileMoves).deep.eq([]);
    });
  });
});
