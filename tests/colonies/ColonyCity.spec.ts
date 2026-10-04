import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {fakeCard} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {HOSTED_SPACES, isHostedSpace} from '../../src/common/boards/hostedSpaces';
import {expansionSpaceColonies} from '../../src/common/boards/expansionSpaceColonies';
import {
  CITY_ALREADY_ON_COLONY_TILE_REASON,
  COLONY_TILE_HAS_COLONIES_REASON,
  COLONY_TILE_HAS_FLEET_REASON,
  COLONY_TILE_HAS_TILE_REASON,
  ColoniesHandler,
  NO_COLONY_TILE_IN_PLAY_REASON,
} from '../../src/server/colonies/ColoniesHandler';
import {coloniesToModel} from '../../src/server/models/ModelUtils';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Board} from '../../src/server/boards/Board';
import {restoreExpansionSpaceColonies} from '../../src/server/boards/BoardBuilder';
import {GameOptions} from '../../src/server/game/GameOptions';
import {Space} from '../../src/server/boards/Space';
import {NO_COLONY_TRACK_REASON} from '../../src/common/parliament/colonyTrackAdvance';

const ROOT = path.resolve(__dirname, '..', '..');
const NOVA = CardName.NOVA_CITY;

/**
 * A TILE ON A COLONY TILE (Turmoil Redux TR22 Nova City — «place a city ON A
 * COLONY TILE in play») — the shared layer: the hosted cell, the link
 * `IColony.tiles`, and its ONE writer `ColoniesHandler.placeCityOnColonyTile`.
 * (docs/TURMOIL_REDUX_NOVA_CITY.md)
 */
describe('a city on a colony tile — one writer', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let luna: Luna;
  let ceres: Ceres;
  let titan: Titan;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    luna = new Luna();
    ceres = new Ceres();
    titan = new Titan();
    titan.isActive = false;
    game.colonies = [ceres, luna, titan];
  });

  function cell(g: IGame = game): Space {
    return g.board.getSpaceOrThrow(SpaceName.NOVA_CITY);
  }

  function place(colony = luna) {
    ColoniesHandler.placeCityOnColonyTile(game, player, colony, {card: NOVA});
  }

  describe('the hosted cell', () => {
    it('is a cell of the board\'s list — a space colony the builder lays for the Redux module', () => {
      expect(cell().spaceType).eq(SpaceType.COLONY);
      expect(cell().tile).is.undefined;
      expect([cell().x, cell().y], 'off the grid, like every space colony').deep.eq([-1, -1]);
    });

    it('a game without the module (and without the card) has no such cell', () => {
      const [plain] = testGame(2, {coloniesExtension: true});
      expect(plain.board.spaces.find((space) => space.id === SpaceName.NOVA_CITY)).is.undefined;
    });

    it('the id is nobody else\'s, and the table names it as HOSTED (its place is not the board)', () => {
      const ids = expansionSpaceColonies.map((row) => row.name);
      expect(new Set(ids).size, 'every space colony has its own id').eq(ids.length);
      expect(Object.values(SpaceName).filter((id) => id === SpaceName.NOVA_CITY)).has.length(1);
      expect(isHostedSpace(SpaceName.NOVA_CITY)).is.true;
      expect([...HOSTED_SPACES]).deep.eq([SpaceName.NOVA_CITY]);
      // Every other space colony has a place beside the planet.
      expect(isHostedSpace(SpaceName.GANYMEDE_COLONY)).is.false;
      expect(isHostedSpace(SpaceName.STANFORD_TORUS)).is.false;
      expect(isHostedSpace(undefined)).is.false;
    });

    it('`colonyTileCitySpace` is the card\'s own row of the builder\'s table', () => {
      expect(ColoniesHandler.colonyTileCitySpace(game, NOVA)).eq(cell());
      expect(ColoniesHandler.colonyTileCitySpace(game, CardName.ANTS), 'a card with no city cell').is.undefined;
    });
  });

  describe('placeCityOnColonyTile', () => {
    it('the link, the tile, its owner and its card', () => {
      place();
      expect(luna.tiles).deep.eq([SpaceName.NOVA_CITY]);
      expect(cell().tile).deep.eq({tileType: TileType.CITY, card: NOVA});
      expect(cell().player).eq(player);
      expect(ColoniesHandler.colonyTileHosting(game, SpaceName.NOVA_CITY)).eq(luna);
      expect(ceres.tiles).deep.eq([]);
    });

    it('the link is written BEFORE the tile lands: a hook and the event already know where', () => {
      const seen: Array<string | undefined> = [];
      const watcher = fakeCard({name: 'A tile watcher' as CardName});
      watcher.onTilePlaced = (_cardOwner, _activePlayer, space) => {
        seen.push(ColoniesHandler.colonyTileHosting(game, space.id)?.name);
      };
      player.playedCards.push(watcher);
      place();
      expect(seen).deep.eq([ColonyName.LUNA]);
      const placed = game.events.events.filter((e) => e.type === 'tile-placed');
      expect(placed).has.length(1);
      expect(placed[0].space).eq(SpaceName.NOVA_CITY);
      expect(placed[0].tile).eq(TileType.CITY);
      expect(placed[0].impact, 'a NEW tile — «tiles placed» grows — on a named colony tile').deep.eq({tilesPlaced: 1, colonyTile: ColonyName.LUNA});
    });

    it('a placement on the board carries no colony tile', () => {
      const land = game.board.getAvailableSpacesOnLand(player)[0];
      game.addCity(player, land);
      const placed = game.events.events.filter((e) => e.type === 'tile-placed');
      expect(placed[0].impact).deep.eq({tilesPlaced: 1});
    });

    it('the journal: the placement\'s own sentence (addTile writes none for an off-board cell)', () => {
      const before = game.gameLog.length;
      place();
      const lines = game.gameLog.slice(before);
      expect(lines.map((line) => line.message)).deep.eq(['${0} placed a city on the ${1} colony tile']);
      expect(lines[0].data.map((d) => d.value)).deep.eq([player.color, ColonyName.LUNA]);
    });

    it('it is a SPACE CITY by the engine\'s own definition — and no city on Mars', () => {
      place();
      expect(game.board.getCitiesOffMars(player)).deep.eq([cell()]);
      expect(game.board.getCitiesOnMars(player)).deep.eq([]);
      expect(game.board.getCities(player)).deep.eq([cell()]);
      expect(game.board.getCitiesOffMars(opponent)).deep.eq([]);
      expect(Board.isCitySpace(cell())).is.true;
      expect(player.game.board.getSpaceByTileCard(NOVA)).eq(cell());
    });

    it('it is NOT a colony: no cube, no berth, no track step, no fleet', () => {
      luna.colonies.push(opponent.id);
      luna.trackPosition = 3;
      const colonies = player.getColoniesCount();
      place();
      expect(luna.colonies).deep.eq([opponent.id]);
      expect(luna.trackPosition).eq(3);
      expect(luna.visitor).is.undefined;
      expect(luna.isFull()).is.false;
      expect(player.getColoniesCount()).eq(colonies);
    });

    it('an INACTIVE tile is a lawful place — and stays inactive', () => {
      place(titan);
      expect(titan.tiles).deep.eq([SpaceName.NOVA_CITY]);
      expect(titan.isActive).is.false;
    });

    it('a fleet arrives on a tile that carries a city as on any other', () => {
      place();
      luna.trackPosition = 2;
      const megaCredits = opponent.megaCredits;
      luna.trade(opponent);
      expect(luna.visitor).eq(opponent.id);
      expect(opponent.megaCredits, 'Luna pays its income').to.be.greaterThan(megaCredits);
      expect(luna.tiles).deep.eq([SpaceName.NOVA_CITY]);
    });

    it('refuses a tile that is not in the game, and a cell that is taken — before anything is written', () => {
      const reserve = new Titan();
      expect(() => ColoniesHandler.placeCityOnColonyTile(game, player, reserve, {card: NOVA})).to.throw('is not in the game');
      expect(reserve.tiles).deep.eq([]);
      place();
      expect(() => place(ceres)).to.throw('is occupied');
      expect(ceres.tiles).deep.eq([]);
      expect(() => ColoniesHandler.placeCityOnColonyTile(game, player, ceres, {card: CardName.ANTS})).to.throw('has no city cell');
    });
  });

  describe('cityOnColonyTileBlockedReason — ONE reason, in order', () => {
    it('a free cell and a tile in play: no reason', () => {
      expect(ColoniesHandler.cityOnColonyTileBlockedReason(game, NOVA)).is.undefined;
    });

    it('the cell is taken (the card was already played): named', () => {
      place();
      expect(ColoniesHandler.cityOnColonyTileBlockedReason(game, NOVA)).eq(CITY_ALREADY_ON_COLONY_TILE_REASON);
    });

    it('no colony tile in play: named with the family\'s existing sentence', () => {
      game.colonies = [];
      expect(ColoniesHandler.cityOnColonyTileBlockedReason(game, NOVA)).eq(NO_COLONY_TILE_IN_PLAY_REASON);
      expect(NO_COLONY_TILE_IN_PLAY_REASON, 'one i18n key, not a second wording').eq(NO_COLONY_TRACK_REASON);
    });

    it('the taken cell is the more fundamental: it wins over «no tile in play»', () => {
      place();
      game.colonies = [];
      expect(ColoniesHandler.cityOnColonyTileBlockedReason(game, NOVA)).eq(CITY_ALREADY_ON_COLONY_TILE_REASON);
    });
  });

  describe('«NO COLONIES, TILES, OR TRADE FLEETS ON IT» — the third clause, in the printed order', () => {
    it('a tile that carries a city cannot leave the game', () => {
      place();
      expect(ColoniesHandler.colonyTileOccupiedReason(luna)).eq(COLONY_TILE_HAS_TILE_REASON);
      expect(ColoniesHandler.colonyTileIsVacant(luna)).is.false;
      expect(ColoniesHandler.colonyTileIsVacant(ceres)).is.true;
    });

    it('the order of the reasons is the printed one: colonies → tiles → fleets', () => {
      place();
      luna.visitor = opponent.id;
      expect(ColoniesHandler.colonyTileOccupiedReason(luna), 'a tile before a fleet').eq(COLONY_TILE_HAS_TILE_REASON);
      luna.colonies.push(opponent.id);
      expect(ColoniesHandler.colonyTileOccupiedReason(luna), 'a colony before a tile').eq(COLONY_TILE_HAS_COLONIES_REASON);
      ceres.visitor = opponent.id;
      expect(ColoniesHandler.colonyTileOccupiedReason(ceres)).eq(COLONY_TILE_HAS_FLEET_REASON);
    });
  });

  describe('the model', () => {
    it('`ColonyModel.tiles` is read off the CELL: what, whose, which card — and absent when nothing lies on the tile', () => {
      place();
      const models = coloniesToModel(game, game.colonies, false);
      expect(models.find((m) => m.name === ColonyName.LUNA)?.tiles).deep.eq([
        {spaceId: SpaceName.NOVA_CITY, tileType: TileType.CITY, color: player.color, card: NOVA},
      ]);
      expect(models.find((m) => m.name === ColonyName.CERES)).to.not.have.property('tiles');
    });
  });

  describe('save / load', () => {
    it('the link and the tile survive a round trip', () => {
      place();
      const loaded = Game.deserialize(game.serialize());
      const loadedLuna = loaded.colonies.find((c) => c.name === ColonyName.LUNA)!;
      expect(loadedLuna.tiles).deep.eq([SpaceName.NOVA_CITY]);
      expect(cell(loaded).tile).deep.eq({tileType: TileType.CITY, card: NOVA});
      expect(cell(loaded).player?.id).eq(player.id);
      expect(ColoniesHandler.colonyTileOccupiedReason(loadedLuna)).eq(COLONY_TILE_HAS_TILE_REASON);
      expect(loaded.colonies.find((c) => c.name === ColonyName.CERES)!.tiles).deep.eq([]);
    });

    it('a tile with nothing on it serializes exactly as before the field existed', () => {
      expect(ceres.serialize()).to.not.have.property('tiles');
      place();
      expect(luna.serialize().tiles).deep.eq([SpaceName.NOVA_CITY]);
    });

    it('a save made BEFORE the cell existed loads WITH it — by the builder\'s own table, in its place', () => {
      const serialized = game.serialize();
      const saved = serialized.board.spaces.length;
      serialized.board.spaces = serialized.board.spaces.filter((space) => space.id !== SpaceName.NOVA_CITY);
      expect(serialized.board.spaces.length, 'the old save lacks the cell').eq(saved - 1);
      const loaded = Game.deserialize(serialized);
      expect(loaded.board.spaces.length).eq(saved);
      expect(cell(loaded).spaceType).eq(SpaceType.COLONY);
      expect(cell(loaded).tile).is.undefined;
      // …and the placement works on the loaded game.
      const loadedPlayer = loaded.players.find((p) => p.id === player.id)!;
      const loadedLuna = loaded.colonies.find((c) => c.name === ColonyName.LUNA)!;
      ColoniesHandler.placeCityOnColonyTile(loaded, loadedPlayer, loadedLuna, {card: NOVA});
      expect(loaded.board.getCitiesOffMars(loadedPlayer).map((space) => space.id)).deep.eq([SpaceName.NOVA_CITY]);
    });

    it('a save older than the `expansions` record is restored as saved — the builder\'s question cannot be asked of it', () => {
      const serialized = game.serialize();
      serialized.board.spaces = serialized.board.spaces.filter((space) => space.id !== SpaceName.NOVA_CITY);
      const before = serialized.board.spaces.length;
      const spaces = restoreExpansionSpaceColonies(
        Board.deserialize(serialized.board, game.players).spaces,
        {...serialized.gameOptions, expansions: undefined} as unknown as GameOptions);
      expect(spaces.length).eq(before);
    });

    it('a save that already carries every cell is loaded untouched (no cell twice)', () => {
      const loaded = Game.deserialize(game.serialize());
      expect(loaded.board.spaces.map((space) => space.id)).deep.eq(game.board.spaces.map((space) => space.id));
    });
  });

  /**
   * The source-level guard: what lies ON a colony tile is written by ONE
   * function (`placeCityOnColonyTile`) and restored by the (de)serializer —
   * nothing else assigns or mutates a colony's `tiles`.
   */
  describe('is the only writer of `colony.tiles`', () => {
    const TILES_WRITE = /\.tiles\s*(?:=[^=]|\.length\s*=[^=]|\.(?:push|splice|sort|pop|shift|unshift|reverse|fill|copyWithin)\()/;
    const ALLOWED: ReadonlySet<string> = new Set([
      // The writer.
      path.join('src', 'server', 'colonies', 'ColoniesHandler.ts'),
      // The load restores the saved list; `serialize` copies it out.
      path.join('src', 'server', 'colonies', 'ColonyDeserializer.ts'),
      path.join('src', 'server', 'colonies', 'Colony.ts'),
      // `ColonyModel.tiles` — the client's reading, built off the cells.
      path.join('src', 'server', 'models', 'ModelUtils.ts'),
      // MarsBot's turn log: `visual.tiles` is its own record of placed tiles, never a colony's.
      path.join('src', 'server', 'automa', 'AutomaTurnLog.ts'),
    ]);

    function sourceFiles(dir: string): Array<string> {
      const out: Array<string> = [];
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...sourceFiles(full));
        } else if (entry.name.endsWith('.ts')) {
          out.push(full);
        }
      }
      return out;
    }

    it('no other server file writes a `tiles` list', () => {
      const offenders: Array<string> = [];
      let scanned = 0;
      for (const file of sourceFiles(path.join(ROOT, 'src', 'server'))) {
        scanned++;
        const relative = path.relative(ROOT, file);
        if (ALLOWED.has(relative)) {
          continue;
        }
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw.includes('.tiles')) {
          continue;
        }
        const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        code.split('\n').forEach((line, index) => {
          if (TILES_WRITE.test(line)) {
            offenders.push(`${relative}:${index + 1}  ${line.trim()}`);
          }
        });
      }
      expect(scanned, 'the scan still reads the server tree').to.be.greaterThan(1000);
      expect(offenders, 'A tile on a colony tile has ONE writer — ColoniesHandler.placeCityOnColonyTile ' +
        '(docs/TURMOIL_REDUX_NOVA_CITY.md). Offending writes:\n  ' + offenders.join('\n  ')).deep.eq([]);
    });

    it('the writer file writes the link exactly once', () => {
      const raw = fs.readFileSync(path.join(ROOT, 'src', 'server', 'colonies', 'ColoniesHandler.ts'), 'utf8');
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code.split('\n').filter((line) => TILES_WRITE.test(line))).has.length(1);
    });

    it('the pattern catches what it guards against (anti-vacuous)', () => {
      const line = (s: string) => TILES_WRITE.test(s);
      expect(line('colony.tiles.push(space.id);')).is.true;
      expect(line('colony.tiles = [];')).is.true;
      expect(line('colony.tiles.length = 0;')).is.true;
      expect(line('tile.tiles.splice(0, 1);')).is.true;
      // Reads are not writes.
      expect(line('if (colony.tiles.length > 0) {')).is.false;
      expect(line('return game.colonies.find((colony) => colony.tiles.includes(spaceId));')).is.false;
      expect(line('const same = a.tiles === b.tiles;')).is.false;
    });
  });
});
