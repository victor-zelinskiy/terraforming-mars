import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IColony} from '../../src/server/colonies/IColony';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {ColonyRosterChange} from '../../src/common/colonies/ColonyRoster';
import {MARSBOT_COLONY_TRACK_START} from '../../src/common/constants';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {GameEvent} from '../../src/common/events/GameEvent';
import {
  COLONY_TILE_HAS_COLONIES_REASON,
  COLONY_TILE_HAS_FLEET_REASON,
  COLONY_TILE_HAS_TILE_REASON,
  ColoniesHandler,
} from '../../src/server/colonies/ColoniesHandler';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {RemoveColonyFromGame} from '../../src/server/deferredActions/RemoveColonyFromGame';
import {Aridor} from '../../src/server/cards/colonies/Aridor';
import {Celestic} from '../../src/server/cards/venusNext/Celestic';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Europa} from '../../src/server/colonies/Europa';
import {Io} from '../../src/server/colonies/Io';
import {Enceladus} from '../../src/server/colonies/Enceladus';
import {Server} from '../../src/server/models/ServerModel';
import {SelectColonyModel} from '../../src/common/models/PlayerInputModel';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {buildEventChildren} from '../../src/client/components/journal/journalEventChild';

const ROOT = path.resolve(__dirname, '..', '..');

function rosterEvents(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'colony-roster-changed');
}

function changes(game: IGame): Array<ColonyRosterChange | undefined> {
  return rosterEvents(game).map((e) => e.impact.colonyRoster);
}

function names(colonies: ReadonlyArray<IColony>): Array<ColonyName> {
  return colonies.map((c) => c.name);
}

/** A tile's whole state, by name — what «the same tile» means across a save/load. */
function states(colonies: ReadonlyArray<IColony>) {
  return [...colonies]
    .sort((a, b) => (a.name > b.name) ? 1 : -1)
    .map((c) => ({name: c.name, isActive: c.isActive, trackPosition: c.trackPosition, visitor: c.visitor, colonies: c.colonies}));
}

/**
 * THE COLONY ROSTER — which tiles are in the game, and in which slot — has ONE
 * writer: `ColoniesHandler.seatColonyTile` / `retireColonyTile` /
 * `replaceColonyTile`, each recording ONE `colony-roster-changed` event.
 * (docs/COLONY_ROSTER_CEREMONY.md)
 */
describe('the colony roster — one writer', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let ceres: Ceres;
  let europa: Europa;
  let luna: Luna;
  let io: Io;
  let titan: Titan;
  let enceladus: Enceladus;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {coloniesExtension: true});
    ceres = new Ceres();
    europa = new Europa();
    luna = new Luna();
    io = new Io();
    titan = new Titan();
    enceladus = new Enceladus();
    // The table in the engine's own order (by name); the reserve likewise.
    game.colonies = [ceres, europa, luna];
    game.discardedColonies = [enceladus, io, titan];
  });

  describe('colonyTileOccupiedReason — «no colonies, tiles, or trade fleets on it»', () => {
    it('an empty tile may leave — active or not, wherever its marker stands', () => {
      luna.trackPosition = 5;
      expect(ColoniesHandler.colonyTileOccupiedReason(luna)).is.undefined;
      expect(ColoniesHandler.colonyTileIsVacant(luna)).is.true;
      expect(titan.isActive, 'Titan before its card').is.false;
      expect(ColoniesHandler.colonyTileIsVacant(titan)).is.true;
    });

    it('a colony of ANY seat keeps the tile — and it is the first reason asked', () => {
      luna.colonies.push(opponent.id);
      luna.visitor = player.id;
      expect(ColoniesHandler.colonyTileOccupiedReason(luna)).eq(COLONY_TILE_HAS_COLONIES_REASON);
      expect(ColoniesHandler.colonyTileIsVacant(luna)).is.false;
    });

    it('a trade fleet keeps the tile', () => {
      luna.visitor = opponent.id;
      expect(ColoniesHandler.colonyTileOccupiedReason(luna)).eq(COLONY_TILE_HAS_FLEET_REASON);
    });

    it('a TILE lying on the tile keeps it (TR22\'s city) — the reasons in the PRINTED order: colonies → tiles → fleets', () => {
      luna.tiles.push(SpaceName.NOVA_CITY);
      expect(ColoniesHandler.colonyTileOccupiedReason(luna)).eq(COLONY_TILE_HAS_TILE_REASON);
      expect(ColoniesHandler.colonyTileIsVacant(luna)).is.false;
      luna.visitor = opponent.id;
      expect(ColoniesHandler.colonyTileOccupiedReason(luna), 'a tile before a fleet').eq(COLONY_TILE_HAS_TILE_REASON);
      luna.colonies.push(player.id);
      expect(ColoniesHandler.colonyTileOccupiedReason(luna), 'a colony before a tile').eq(COLONY_TILE_HAS_COLONIES_REASON);
    });
  });

  describe('seatColonyTile — a tile ENTERS', () => {
    it('sorted in by name, out of the reserve, the engine\'s line, ONE event with the slot it took', () => {
      ColoniesHandler.seatColonyTile(game, player, io);
      expect(names(game.colonies)).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.IO, ColonyName.LUNA]);
      expect(names(game.discardedColonies)).deep.eq([ColonyName.ENCELADUS, ColonyName.TITAN]);
      const line = game.gameLog.find((m) => m.message === '${0} added a new Colony tile: ${1}');
      expect(line?.data.map((d) => d.value)).deep.eq([player.color, ColonyName.IO]);
      expect(changes(game)).deep.eq([{kind: 'add', added: ColonyName.IO, slot: 2}]);
      const event = rosterEvents(game)[0];
      expect(event.player).eq(player.color);
      expect(event.visibility).eq('journal');
    });

    it('a tile that needs a card enters INACTIVE without one, ACTIVE with one in ANY tableau', () => {
      ColoniesHandler.seatColonyTile(game, player, titan);
      expect(titan.isActive).is.false;
      opponent.playedCards.push(new Celestic());
      ColoniesHandler.seatColonyTile(game, player, enceladus);
      expect(enceladus.isActive, 'no microbe card anywhere').is.false;
      // The very predicate the roster prompt projects.
      expect(ColoniesHandler.colonyTileWillEnterActive(new Titan(), game), 'a floater card in the rival\'s tableau').is.true;
    });

    it('the giver of the event is the caller\'s `cause` where no scope is live', () => {
      ColoniesHandler.seatColonyTile(game, player, io, {kind: 'system'});
      expect(rosterEvents(game)[0].source).deep.eq({kind: 'system'});
    });
  });

  describe('retireColonyTile — a tile LEAVES', () => {
    it('the others keep their order and close the gap; ONE event with the slot it left', () => {
      ColoniesHandler.retireColonyTile(game, player, europa);
      expect(names(game.colonies)).deep.eq([ColonyName.CERES, ColonyName.LUNA]);
      expect(names(game.discardedColonies)).deep.eq([ColonyName.ENCELADUS, ColonyName.EUROPA, ColonyName.IO, ColonyName.TITAN]);
      expect(changes(game)).deep.eq([{kind: 'remove', removed: ColonyName.EUROPA, slot: 1}]);
    });

    it('it returns to the reserve AS IT LIES IN THE BOX — track, activity and visitor are the class\'s own', () => {
      game.colonies = [ceres, europa, luna, titan];
      game.discardedColonies = [enceladus, io];
      titan.isActive = true;
      titan.trackPosition = 5;
      ColoniesHandler.retireColonyTile(game, player, titan);
      const boxed = game.discardedColonies.find((c) => c.name === ColonyName.TITAN)!;
      expect(boxed, 'a tile out of the box, not the one that was in play').not.eq(titan);
      expect(boxed.isActive).is.false;
      expect(boxed.trackPosition).eq(1);
      expect(boxed.visitor).is.undefined;
      expect(boxed.colonies).deep.eq([]);
    });

    it('a change nobody made carries no player; a tile that is not in play is refused', () => {
      ColoniesHandler.retireColonyTile(game, undefined, luna, {kind: 'system'});
      expect(rosterEvents(game)[0].player).is.undefined;
      expect(rosterEvents(game)[0].source).deep.eq({kind: 'system'});
      expect(() => ColoniesHandler.retireColonyTile(game, player, io)).to.throw(/not in the game/);
    });
  });

  describe('replaceColonyTile — one leaves, another takes ITS slot', () => {
    it('the same index, no re-sort, no other tile moved; ONE line and ONE event', () => {
      // Titan sorts AFTER Luna by name — it must stand where Ceres stood all the same.
      ColoniesHandler.replaceColonyTile(game, player, ceres, titan);
      expect(names(game.colonies)).deep.eq([ColonyName.TITAN, ColonyName.EUROPA, ColonyName.LUNA]);
      expect(game.colonies[1]).eq(europa);
      expect(game.colonies[2]).eq(luna);
      expect(names(game.discardedColonies)).deep.eq([ColonyName.CERES, ColonyName.ENCELADUS, ColonyName.IO]);
      const lines = game.gameLog.filter((m) => m.message === '${0} replaced the ${1} colony tile with ${2}');
      expect(lines).has.lengthOf(1);
      expect(lines[0].data.map((d) => d.value)).deep.eq([player.color, ColonyName.CERES, ColonyName.TITAN]);
      expect(changes(game)).deep.eq([{kind: 'replace', removed: ColonyName.CERES, added: ColonyName.TITAN, slot: 0}]);
      expect(game.gameLog.some((m) => m.message === '${0} added a new Colony tile: ${1}'), 'not an addition').is.false;
    });

    it('the incoming tile enters by the engine\'s activation rule; the outgoing lies in the box', () => {
      ceres.trackPosition = 4;
      opponent.playedCards.push(new Celestic());
      ColoniesHandler.replaceColonyTile(game, player, ceres, titan);
      expect(titan.isActive, 'a floater card is in a tableau').is.true;
      expect(titan.trackPosition).eq(1);
      const boxed = game.discardedColonies.find((c) => c.name === ColonyName.CERES)!;
      expect(boxed.trackPosition).eq(1);
      expect(boxed).not.eq(ceres);
    });

    it('under a live scope the event names the card whose effect it was', () => {
      game.events.beginAction(player, {kind: 'card', card: CardName.ANTS, owner: player.color});
      ColoniesHandler.replaceColonyTile(game, player, luna, io);
      game.events.endScope();
      expect(rosterEvents(game)[0].source).deep.include({kind: 'card', card: CardName.ANTS});
    });

    it('a tile not in play, or a tile not in the reserve, is refused before anything changes', () => {
      expect(() => ColoniesHandler.replaceColonyTile(game, player, io, titan)).to.throw(/not in the game/);
      expect(() => ColoniesHandler.replaceColonyTile(game, player, luna, new Io())).to.throw(/not in the reserve/);
      expect(names(game.colonies)).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA]);
      expect(changes(game)).deep.eq([]);
    });
  });

  describe('live == after a save/load', () => {
    function reloaded(of: IGame): IGame {
      return Game.deserialize(structuredClone(of.serialize()));
    }

    // A dealt game: the reserve the load rebuilds is the dealer's pool minus the tiles in play.
    function dealt(): [IGame, TestPlayer] {
      const [g, p] = testGame(2, {coloniesExtension: true}, '-roster-saveload');
      return [g, p];
    }

    it('a RETIRED tile is the same tile in the reserve after a load', () => {
      const [g, p] = dealt();
      const leaving = g.colonies[1];
      leaving.trackPosition = 5;
      leaving.isActive = true;
      ColoniesHandler.retireColonyTile(g, p, leaving);
      const after = reloaded(g);
      expect(names(after.colonies)).deep.eq(names(g.colonies));
      expect(states(after.discardedColonies)).deep.eq(states(g.discardedColonies));
      expect(names(after.discardedColonies), 'and in the same order').deep.eq(names(g.discardedColonies));
    });

    it('a REPLACEMENT keeps its slot across a load, and both tiles read the same', () => {
      const [g, p] = dealt();
      const outgoing = g.colonies[0];
      outgoing.trackPosition = 4;
      const incoming = g.discardedColonies[g.discardedColonies.length - 1];
      ColoniesHandler.replaceColonyTile(g, p, outgoing, incoming);
      const after = reloaded(g);
      expect(names(after.colonies), 'the slot survives the load (the save keeps the table\'s order)').deep.eq(names(g.colonies));
      expect(states(after.colonies)).deep.eq(states(g.colonies));
      expect(states(after.discardedColonies)).deep.eq(states(g.discardedColonies));
    });
  });

  describe('the existing changes of the roster go through it', () => {
    it('Aridor\'s first action: the catalog carries the roster marker and its giver; the answer seats the tile and records the event', () => {
      const aridor = new Aridor();
      opponent.playedCards.push(new Celestic());
      player.defer(aridor.initialAction(player));
      runAllActions(game);
      const prompt = cast(player.getWaitingFor(), SelectColony);
      expect(prompt.purpose).eq('addNewColonyToGame');
      expect(prompt.choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.ARIDOR});
      expect(prompt.rosterChange).deep.eq({
        kind: 'add',
        incoming: [
          {colony: ColonyName.ENCELADUS, entersActive: false},
          {colony: ColonyName.IO, entersActive: true},
          {colony: ColonyName.TITAN, entersActive: true},
        ],
      });
      const model = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
      expect(model.rosterChange).deep.eq(prompt.rosterChange);
      // The catalog model is a bare tile — its own flag says nothing; the marker does.
      expect(model.coloniesModel.every((c) => c.isActive === false)).is.true;

      player.process({type: 'colony', colonyName: ColonyName.TITAN});
      expect(names(game.colonies)).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(titan.isActive).is.true;
      expect(changes(game)).deep.eq([{kind: 'add', added: ColonyName.TITAN, slot: 3}]);
      // The journal line of the engine is unchanged.
      expect(game.gameLog.some((m) => m.message === '${0} added a new Colony tile: ${1}')).is.true;
    });

    it('an addition refuses a `replaces` it never asked about', () => {
      player.defer(new Aridor().initialAction(player));
      runAllActions(game);
      expect(() => player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.LUNA}))
        .to.throw('This colony pick does not replace a colony tile');
      expect(names(game.colonies)).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA]);
    });

    it('the solo setup trim: the marker lists every tile in play; the answer retires the tile under the game\'s own rule', () => {
      game.defer(new RemoveColonyFromGame(player));
      runAllActions(game);
      const prompt = cast(player.getWaitingFor(), SelectColony);
      expect(prompt.choiceContext?.source).deep.eq({kind: 'system'});
      expect(prompt.rosterChange).deep.eq({
        kind: 'remove',
        outgoing: [{colony: ColonyName.CERES}, {colony: ColonyName.EUROPA}, {colony: ColonyName.LUNA}],
      });
      player.process({type: 'colony', colonyName: ColonyName.EUROPA});
      expect(names(game.colonies)).deep.eq([ColonyName.CERES, ColonyName.LUNA]);
      expect(names(game.discardedColonies)).contains(ColonyName.EUROPA);
      expect(changes(game)).deep.eq([{kind: 'remove', removed: ColonyName.EUROPA, slot: 1}]);
      expect(rosterEvents(game)[0].source).deep.eq({kind: 'system'});
      const line = game.gameLog.find((m) => m.message === 'You discarded ${0}');
      expect(line?.data.map((d) => d.value)).deep.eq([ColonyName.EUROPA]);
    });

    it('the journal reads an addition as «+1» colony tile and a removal as «−1», each naming its tile', () => {
      ColoniesHandler.seatColonyTile(game, player, io);
      ColoniesHandler.retireColonyTile(game, player, europa);
      const rows = rosterEvents(game).map((e) => buildEventChildren([e], -1, player.color)[0]);
      expect(rows.map((r) => r.political)).deep.eq([
        {kind: 'colonyRoster', change: {kind: 'add', added: ColonyName.IO, slot: 2}},
        {kind: 'colonyRoster', change: {kind: 'remove', removed: ColonyName.EUROPA, slot: 1}},
      ]);
      expect(rows.map((r) => r.chips)).deep.eq([[{icon: 'colony-tile', text: '+1'}], [{icon: 'colony-tile', text: '−1'}]]);
    });

    it('MarsBot\'s Aridor (C30): its setup is a roster event of the BOT, and the tile sits by the table\'s rule', () => {
      const [automaGame, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C30_ARIDOR, coloniesExtension: true}, '-roster-c30');
      automaGame.playerIsFinishedWithResearchPhase(human);
      const added = rosterEvents(automaGame);
      expect(added).has.lengthOf(1);
      expect(added[0].player).eq(bot.color);
      const change = added[0].impact.colonyRoster!;
      expect(change.kind).eq('add');
      const tile = automaGame.colonies.find((c) => c.name === change.added)!;
      expect(automaGame.colonies.indexOf(tile)).eq(change.slot);
      // «All Colony tiles start with their tracker on the highlighted second step» — a tile that joins later too.
      expect(tile.isActive).is.true;
      expect(tile.trackPosition).eq(MARSBOT_COLONY_TRACK_START);
      for (const colony of automaGame.colonies) {
        expect(colony.isActive, `${colony.name} at a MarsBot table`).is.true;
      }
    });
  });

  /*
   * THE SOURCE-LEVEL GUARD. Whether «a tile entered / left the game» is a fact
   * for every reader comes down to this: nothing may write the roster except
   * its three writers (plus the dealer's setup / restore and the load). Before
   * them the solo trim spliced the list itself and published nothing, and a
   * retired tile kept its live state in the reserve until the next load.
   */
  describe('is the only writer of `game.colonies` / `game.discardedColonies`', () => {
    /**
     * A mutation of the GAME's list — an assignment, an indexed write, a
     * truncation or a mutating array method on `game.colonies` /
     * `game.discardedColonies` (never a tile's own `colony.colonies` cubes,
     * never a player's `colonies` helper).
     */
    const ROSTER_WRITE = /\bgame\s*\.\s*(?:colonies|discardedColonies)\s*(?:=[^=]|\[[^\]]+\]\s*=[^=]|\.length\s*=[^=]|\.(?:push|splice|sort|pop|shift|unshift|reverse|fill|copyWithin)\()/;
    const ALLOWED: ReadonlySet<string> = new Set([
      // The roster's three writers.
      path.join('src', 'server', 'colonies', 'ColoniesHandler.ts'),
      // Setup and deserialization ASSIGN the dealer's lists (the deal, and the
      // reserve a load rebuilds) — state creation / restoration.
      path.join('src', 'server', 'Game.ts'),
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

    it('no other server file writes the roster', () => {
      const offenders: Array<string> = [];
      let scanned = 0;
      for (const file of sourceFiles(path.join(ROOT, 'src', 'server'))) {
        scanned++;
        const relative = path.relative(ROOT, file);
        if (ALLOWED.has(relative)) {
          continue;
        }
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw.includes('olonies')) {
          continue;
        }
        const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        code.split('\n').forEach((line, index) => {
          if (ROSTER_WRITE.test(line)) {
            offenders.push(`${relative}:${index + 1}  ${line.trim()}`);
          }
        });
      }
      expect(scanned, 'the scan still reads the server tree').to.be.greaterThan(1000);
      expect(offenders, 'The colony roster has ONE writer — seat / retire / replace in ColoniesHandler ' +
        '(docs/COLONY_ROSTER_CEREMONY.md). Offending writes:\n  ' + offenders.join('\n  ')).deep.eq([]);
    });

    it('the pattern catches what it guards against (anti-vacuous)', () => {
      const line = (s: string) => ROSTER_WRITE.test(s);
      expect(line('game.colonies.splice(game.colonies.indexOf(colony), 1);')).is.true;
      expect(line('game.discardedColonies.push(colony);')).is.true;
      expect(line('this.game.colonies = [];')).is.true;
      expect(line('game.colonies[slot] = incoming;')).is.true;
      expect(line('player.game.colonies.sort((a, b) => 1);')).is.true;
      // Reads and a tile's own cubes are not writes of the roster.
      expect(line('colony.colonies.push(player.id);')).is.false;
      expect(line('const eligible = game.colonies.filter((colony) => colony.isActive);')).is.false;
      expect(line('if (game.colonies.length === 0) {')).is.false;
      expect(line('game.discardedColonies.length = 0;')).is.true;
    });
  });
});
