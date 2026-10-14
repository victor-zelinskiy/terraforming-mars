import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Phase} from '../../src/common/Phase';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {CardName} from '../../src/common/cards/CardName';
import {BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {runAllActions} from '../TestingUtils';

/**
 * «ЧТО ОТКРОЕТСЯ» — WHAT A LIFTED PIECE UNCOVERS (the «ПРОСВЕТ» law, Turmoil
 * Redux TR47; the owner's accent of 2026-10-14). ONE function
 * (`uncoverFacts`) states it for every picker that lifts a piece — an ocean
 * removal (RX33 / the Reds / TR47), a move's SOURCE level (TR39's ocean,
 * TR14's city), a remove-and-replace (Kaguya Tech) — and the hover of an
 * occupied cell says what lies under its tile (К-E1). Pinned here on the real
 * engine, cell by cell: the printed bonus as NEUTRAL chips, the reserve that
 * takes an ocean again, the land, the cell with no printed bonus, the piece
 * that STAYS (a city over its water, the water under a city, a stack).
 */
function table(): [IGame, TestPlayer, TestPlayer] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, aresHazards: false});
  game.phase = Phase.ACTION;
  return [game, p1, p2];
}

const seatOcean = (space: Space): Space => {
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
};

const uncovers = (facts: ReadonlyArray<BoardFact>) => facts.filter((f) => f.category === 'uncovered-bonus');
const brief = (f: BoardFact) => `${f.id}:${typeof f.title === 'string' ? f.title : f.title.message}${f.delta === undefined ? '' : `:${f.delta.icon}×${f.delta.amount}`}`;

/** An ocean reserve printing exactly these bonuses, and one printing none. */
function reserves(game: IGame, player: TestPlayer): {plants: Space, bare: Space} {
  const free = game.board.getAvailableSpacesForOcean(player);
  const plants = free.find((s) => s.bonus.length === 2 && s.bonus.every((b) => b === SpaceBonus.PLANT))!;
  const bare = free.find((s) => s.bonus.length === 0)!;
  expect(plants, 'Tharsis prints a two-plant ocean reserve').is.not.undefined;
  expect(bare, 'Tharsis prints a bare ocean reserve').is.not.undefined;
  return {plants, bare};
}

describe('uncoverFacts — what a lifted piece uncovers', () => {
  describe('an OCEAN REMOVAL (the `remove` preview)', () => {
    it('a lone ocean on a reserve with a printed bonus: the bonus as neutral chips (the next tile\'s), and the reserve takes an ocean again', () => {
      const [game, p1] = table();
      const {plants} = reserves(game, p1);
      seatOcean(plants);
      const preview = boardCellPreview(p1, plants, 'ocean-removal', {tileType: TileType.OCEAN, placementEffect: 'remove'});
      const facts = uncovers(preview.ruleFacts);
      expect(facts.map(brief)).deep.eq(['uncover-plants:Cell bonus available again:plants×2', 'uncover-reserve:The ocean reserve will take an ocean again']);
      expect(facts.every((f) => f.recipient.kind === 'nobody'), 'addressed to nobody — a statement about the cell').is.true;
      expect(facts[0].timing, 'the next tile\'s').eq('future');
      expect(preview.immediateFacts, 'nothing is promised to the picker').deep.eq([]);
    });

    it('a lone ocean on a bare reserve: the reserve line alone — never silence', () => {
      const [game, p1] = table();
      const {bare} = reserves(game, p1);
      seatOcean(bare);
      const preview = boardCellPreview(p1, bare, 'ocean-removal', {tileType: TileType.OCEAN, placementEffect: 'remove'});
      expect(uncovers(preview.ruleFacts).map(brief)).deep.eq(['uncover-reserve:The ocean reserve will take an ocean again']);
    });

    it('the water UNDER a TR44 city: NOTHING is uncovered — the city stays, said ONCE under the family\'s own id (PL-335)', () => {
      const [game, p1, p2] = table();
      const {plants} = reserves(game, p1);
      seatOcean(plants);
      game.addTile(p2, plants, {tileType: TileType.CITY}, {overOcean: true});
      runAllActions(game);
      const preview = boardCellPreview(p1, plants, 'ocean-removal', {tileType: TileType.OCEAN, placementEffect: 'remove'});
      expect(uncovers(preview.ruleFacts).map(brief)).deep.eq(['remove-ocean-under-city:Nothing is uncovered — a city stays on the cell']);
      const stays = preview.ruleFacts.filter((f) => /stays/.test(typeof f.title === 'string' ? f.title : f.title.message));
      expect(stays, 'one sentence for one fact — no «the city stays» rule beside it').to.have.length(1);
    });

    it('an ocean on LAND (Artificial Lake\'s family): the printed bonus, then «the land is free again»; land with no bonus says so', () => {
      const [game, p1] = table();
      const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 1 && s.bonus[0] === SpaceBonus.STEEL)!;
      seatOcean(land);
      const preview = boardCellPreview(p1, land, 'ocean-removal', {tileType: TileType.OCEAN, placementEffect: 'remove'});
      expect(uncovers(preview.ruleFacts).map(brief)).deep.eq(['uncover-steel:Cell bonus available again:steel×1', 'uncover-land:The land is free again']);
      const bareLand = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 && game.board.onMarsGrid(s))!;
      seatOcean(bareLand);
      const bare = boardCellPreview(p1, bareLand, 'ocean-removal', {tileType: TileType.OCEAN, placementEffect: 'remove'});
      expect(uncovers(bare.ruleFacts).map(brief)).deep.eq(['uncover-land:No printed bonus — the land is free again']);
    });
  });

  describe('a MOVE\'s source level', () => {
    it('TR39 — an ocean lifted off its reserve: the same words as the removal\'s', () => {
      const [game, p1] = table();
      const {plants} = reserves(game, p1);
      seatOcean(plants);
      const preview = boardCellPreview(p1, plants, 'ocean-move', {tileType: TileType.OCEAN, placementEffect: 'move'});
      expect(preview.placesTile).is.false;
      expect(uncovers(preview.ruleFacts).map(brief)).deep.eq(['uncover-plants:Cell bonus available again:plants×2', 'uncover-reserve:The ocean reserve will take an ocean again']);
    });

    it('TR39 — the ocean from under a TR44 city: nothing is uncovered, the city stays', () => {
      const [game, p1, p2] = table();
      const {plants} = reserves(game, p1);
      seatOcean(plants);
      game.addTile(p2, plants, {tileType: TileType.CITY}, {overOcean: true});
      runAllActions(game);
      const preview = boardCellPreview(p1, plants, 'ocean-move', {tileType: TileType.OCEAN, placementEffect: 'move'});
      expect(uncovers(preview.ruleFacts).map(brief)).deep.eq(['move-ocean-under-city:Nothing is uncovered — a city stays on the cell']);
    });

    it('TR14 — a city lifted off land: its cell\'s bonus; off its water (TR44): the ocean stays; the top of a stack: the stack stays', () => {
      const [game, p1] = table();
      const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 1 && s.bonus[0] === SpaceBonus.STEEL)!;
      game.addCity(p1, land);
      runAllActions(game);
      const off = boardCellPreview(p1, land, 'city-move', {tileType: TileType.CITY, placementEffect: 'move'});
      expect(uncovers(off.ruleFacts).map(brief)).deep.eq(['uncover-steel:Cell bonus available again:steel×1', 'uncover-land:The land is free again']);
      const {plants} = reserves(game, p1);
      seatOcean(plants);
      game.addTile(p1, plants, {tileType: TileType.CITY}, {overOcean: true});
      runAllActions(game);
      const water = boardCellPreview(p1, plants, 'city-move', {tileType: TileType.CITY, placementEffect: 'move'});
      expect(uncovers(water.ruleFacts).map(brief)).deep.eq(['move-city-off-water:Nothing is uncovered — the ocean stays on the cell']);
      game.addCityTier(p1, land);
      runAllActions(game);
      const stack = boardCellPreview(p1, land, 'city-move', {tileType: TileType.CITY, placementEffect: 'move'});
      expect(uncovers(stack.ruleFacts).map(brief)).deep.eq(['uncover-stack-stays:Nothing is uncovered — the stack stays']);
    });
  });

  it('a REMOVE-AND-REPLACE (Kaguya Tech — `cleared`): one line — uncovered and collected at once; the bonus itself is the gain', () => {
    const [game, p1] = table();
    const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 1 && s.bonus[0] === SpaceBonus.STEEL)!;
    game.addGreenery(p1, land);
    runAllActions(game);
    const preview = boardCellPreview(p1, land, 'city', {cleared: true, tileType: TileType.CITY, sourceCard: CardName.KAGUYA_TECH});
    expect(uncovers(preview.ruleFacts).map(brief)).deep.eq(['uncover-collected:Uncovered and collected at once']);
    expect(preview.immediateFacts.some((f) => f.category === 'printed-placement-bonus' && f.delta?.icon === 'steel'), 'the bonus is the player\'s gain').is.true;
    // A bare cell under the doomed tile promises nothing — and says so, never a line about a bonus the commit cannot pay.
    const bareLand = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 && game.board.onMarsGrid(s))!;
    game.addGreenery(p1, bareLand);
    runAllActions(game);
    const bare = boardCellPreview(p1, bareLand, 'city', {cleared: true, tileType: TileType.CITY, sourceCard: CardName.KAGUYA_TECH});
    expect(uncovers(bare.ruleFacts).map(brief)).deep.eq(['uncover-collected-none:No printed bonus — nothing is uncovered']);
  });

  describe('the HOVER of an occupied cell (К-E1)', () => {
    it('a lone tile over a printed bonus: «Under the tile» chips; a TR44 cell and a stack carry their own mark and say nothing', () => {
      const [game, p1, p2] = table();
      const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 1 && s.bonus[0] === SpaceBonus.STEEL)!;
      game.addCity(p1, land);
      runAllActions(game);
      expect(uncovers(boardCellInfo(p1, land).facts).map(brief)).deep.eq(['under-tile-steel:Under the tile:steel×1']);
      const {plants, bare} = reserves(game, p1);
      seatOcean(bare);
      expect(uncovers(boardCellInfo(p1, bare).facts), 'no printed bonus — nothing under the tile').deep.eq([]);
      seatOcean(plants);
      game.addTile(p2, plants, {tileType: TileType.CITY}, {overOcean: true});
      runAllActions(game);
      expect(uncovers(boardCellInfo(p1, plants).facts), 'two pieces — the mark says what lies under').deep.eq([]);
      game.addCityTier(p1, land);
      runAllActions(game);
      expect(uncovers(boardCellInfo(p1, land).facts), 'a stack — the counter says what lies under').deep.eq([]);
    });
  });
});
