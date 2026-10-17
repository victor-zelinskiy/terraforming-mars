import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellInfo, boardCellPreview, cellPortrait} from '../../src/server/boards/BoardInformationEngine';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {Board} from '../../src/server/boards/Board';
import {addCity, addGreenery} from '../TestingUtils';

/**
 * TR67 «КЛЕТКА — ОДНО ДОСЬЕ» — the server half: the cell's PORTRAIT (the square
 * as the console dossier draws it — its kind, its printed bonus, the piece on
 * top, its owner, the card that put it there, the six neighbours in the
 * engine's own clockwise geometry), the `each` a spatial fact states for ONE of
 * its cells (the ring's chip), and what a greenery is worth to the cities
 * beside it. All read-only — the hover's purity contract.
 */
describe('cellPortrait — the cell as the console dossier draws it (TR67)', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  function land(predicate: (s: Space) => boolean = () => true): Space {
    const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    if (space === undefined) {
      throw new Error('no matching land');
    }
    return space;
  }

  it('an empty square: its kind and printed bonus as data, no tile, no owner, no source', () => {
    const space = land((s) => s.bonus.length > 0);
    const p = cellPortrait(player, space);
    expect(p.space).eq(space.id);
    expect(p.spaceType).eq(SpaceType.LAND);
    expect(p.bonus).deep.eq(space.bonus);
    expect(p.tileType).is.undefined;
    expect(p.ownerColor).is.undefined;
    expect(p.sourceCard).is.undefined;
  });

  it('the six neighbours are the engine\'s clockwise geometry — `null` at the board\'s edge, never a stub', () => {
    const edge = game.board.spaces.find((s) => s.spaceType !== SpaceType.COLONY && game.board.getAdjacentSpacesClockwise(s).some((n) => n === undefined))!;
    const p = cellPortrait(player, edge);
    expect(p.neighbours).has.length(6);
    const engine = game.board.getAdjacentSpacesClockwise(edge);
    p.neighbours.forEach((n, i) => {
      expect(n === null ? undefined : n.space, `slot ${i}`).eq(engine[i]?.id);
    });
    expect(p.neighbours.some((n) => n === null)).is.true;
  });

  it('a placed city: the tile, its owner, the CARD that placed it; the neighbour reads its own piece', () => {
    const space = land((s) => game.board.getAdjacentSpaces(s).every((n) => n.spaceType === SpaceType.LAND && n.tile === undefined));
    game.simpleAddTile(player, space, {tileType: TileType.CITY, card: CardName.CAPITAL});
    const next = game.board.getAdjacentSpaces(space)[0];
    addGreenery(player2, next.id);
    const p = cellPortrait(player, space);
    expect(p.tileType).eq(TileType.CITY);
    expect(p.ownerColor).eq(player.color);
    expect(p.sourceCard).eq(CardName.CAPITAL);
    const ring = p.neighbours.find((n) => n?.space === next.id);
    expect(ring?.tileType).eq(TileType.GREENERY);
    expect(ring?.ownerColor).eq(player2.color);
    expect(ring !== undefined && ring !== null && 'sourceCard' in ring, 'a neighbour is a piece, not a portrait').is.false;
  });

  it('a tile with no card behind it (a standard project) has no source', () => {
    const space = land();
    addGreenery(player, space.id);
    expect(cellPortrait(player, space).sourceCard).is.undefined;
  });

  it('the hover carries the portrait', () => {
    const space = land();
    expect(boardCellInfo(player, space).portrait?.space).eq(space.id);
  });

  it('an off-Mars slot has no neighbours at all', () => {
    const off = game.board.spaces.find((s) => s.spaceType === SpaceType.COLONY);
    if (off === undefined) {
      return;
    }
    expect(cellPortrait(player, off).neighbours).deep.eq([]);
  });

  it('`each` — the adjacent oceans state what ONE pays (the rate), the sum stays the delta', () => {
    const target = land((s) => game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).length >= 2);
    const oceans = game.board.getAdjacentSpaces(target).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).slice(0, 2);
    oceans.forEach((o) => game.addOcean(player, o));
    const fact = boardCellInfo(player, target).facts.find((f) => f.category === 'ocean-adjacency-bonus' && f.spaces !== undefined)!;
    expect(fact.spaces).has.length(2);
    expect(fact.delta?.amount).eq(4);
    expect(fact.each?.delta).deep.eq({icon: 'megacredits', amount: player.oceanBonus, direction: 'gain'});
  });

  it('`each` — a city\'s greeneries are +1 VP apiece', () => {
    const city = land((s) => game.board.getAdjacentSpaces(s).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined).length >= 2);
    addCity(player, city.id);
    const greens = game.board.getAdjacentSpaces(city).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined).slice(0, 2);
    greens.forEach((g) => addGreenery(player, g.id));
    const fact = boardCellInfo(player, city).facts.find((f) => f.id === 'score-city')!;
    expect(fact.spaces).has.length(2);
    expect(fact.each).deep.eq({vp: 1});
  });

  it('a greenery names what it is worth to every city beside it — the city\'s owner, once per tier; a neutral city scores nobody', () => {
    const green = land((s) => game.board.getAdjacentSpaces(s).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined).length >= 3);
    const [a, b, c] = game.board.getAdjacentSpaces(green).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined);
    addCity(player2, a.id);
    addCity(player, b.id);
    game.simpleAddTile(player, c, {tileType: TileType.CITY});
    c.player = undefined; // a solo setup city — owned by nobody who scores
    c.coOwner = undefined;
    addGreenery(player, green.id);
    const feeds = boardCellInfo(player, green).facts.filter((f) => f.id.startsWith('score-greenery-city-'));
    expect(feeds.map((f) => f.spaces?.[0]).sort()).deep.eq([a.id, b.id].sort());
    const rival = feeds.find((f) => f.spaces?.[0] === a.id)!;
    expect(rival.recipient).deep.eq({kind: 'tile-owner', color: player2.color});
    expect(rival.vp).deep.eq({from: 0, to: Board.cityTiersOf(a)});
    expect(rival.title).eq('Adjacent city scores at game end');
    const mine = feeds.find((f) => f.spaces?.[0] === b.id)!;
    expect(mine.recipient).deep.eq({kind: 'current-player'});
  });

  it('is read-only — the portrait and the hover leave the game untouched', () => {
    const space = land();
    addCity(player, space.id);
    const before = JSON.stringify(game.serialize());
    cellPortrait(player, space);
    boardCellInfo(player, space);
    boardCellPreview(player, land(), 'greenery');
    expect(JSON.stringify(game.serialize())).eq(before);
  });
});
