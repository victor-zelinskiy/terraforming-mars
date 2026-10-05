import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {IGame} from '../../src/server/IGame';
import {IColony} from '../../src/server/colonies/IColony';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {MAX_COLONIES_PER_TILE} from '../../src/common/constants';
import {berthCount, berthIsOverLimit, hasFreeTrackCell, printedBerths} from '../../src/common/colonies/colonyBerths';
import {trackTop} from '../../src/common/colonies/ColonyMetadata';
import {ColonyDeserializer} from '../../src/server/colonies/ColonyDeserializer';
import {Titania} from '../../src/server/cards/community/Titania';
import {Luna} from '../../src/server/colonies/Luna';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {JupiterFloatingStation} from '../../src/server/cards/colonies/JupiterFloatingStation';
import {Poseidon} from '../../src/server/cards/colonies/Poseidon';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {NO_FREE_TRACK_CELL_REASON} from '../../src/server/player/Colonies';

/*
 * A COLONY BEYOND THE PRINTED LIMIT — the engine's half of the contract
 * (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md).
 *
 * «Three colonies per tile» is a rule of the ORDINARY DOORS of a build, not a
 * bound of the cube array. A card may lift it for one build (Turmoil Redux
 * TR25 Exclusive Colony), and everything that reads the cubes must then stay
 * TOTAL: the build bonus (read at a berth past the printed ones), the marker's
 * floor, the trade's reset, the owners' bonuses, a save. Nothing here knows
 * the card — it pins what `Colony.addColony` does with a fourth cube, whoever
 * let it through.
 */

const ROOT = path.join(__dirname, '..', '..');

describe('a colony beyond the printed limit', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let player3: TestPlayer;
  let luna: IColony;
  let titan: IColony;
  let pluto: IColony;

  beforeEach(() => {
    [game, player, player2, player3] = testGame(3, {
      coloniesExtension: true,
      customColoniesList: [ColonyName.LUNA, ColonyName.PLUTO, ColonyName.TITAN, ColonyName.CALLISTO, ColonyName.IO],
    });
    luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
    titan = game.colonies.find((c) => c.name === ColonyName.TITAN)!;
    pluto = game.colonies.find((c) => c.name === ColonyName.PLUTO)!;
    titan.isActive = true;
  });

  function messages(): Array<string> {
    return game.gameLog.map((m) => m.message);
  }

  describe('the berths arithmetic (common/colonies/colonyBerths.ts)', () => {
    it('a tile prints MAX_COLONIES_PER_TILE berths, and a berth past them is beyond the limit', () => {
      expect(printedBerths()).eq(MAX_COLONIES_PER_TILE);
      expect(berthIsOverLimit(0)).is.false;
      expect(berthIsOverLimit(MAX_COLONIES_PER_TILE - 1)).is.false;
      expect(berthIsOverLimit(MAX_COLONIES_PER_TILE)).is.true;
    });

    it('a tile shows its printed berths, every cube that stands, and the berth a door projects', () => {
      expect(berthCount(0)).eq(3);
      expect(berthCount(2)).eq(3);
      expect(berthCount(3)).eq(3);
      expect(berthCount(4)).eq(4);
      // A door projecting a cube into the fourth berth of a full tile…
      expect(berthCount(3, 3)).eq(4);
      // …and into an ordinary berth of an ordinary tile: nothing is added.
      expect(berthCount(1, 1)).eq(3);
      expect(berthCount(0, 0)).eq(3);
    });

    it('a cube needs a cell and the marker keeps one of its own', () => {
      const top = trackTop(luna.metadata);
      expect(hasFreeTrackCell(luna.metadata, 0)).is.true;
      expect(hasFreeTrackCell(luna.metadata, top - 1)).is.true;
      expect(hasFreeTrackCell(luna.metadata, top)).is.false;
    });
  });

  describe('the ONE writer of the cube array — Colony.placeCube', () => {
    it('takes the next berth, returns it, and lifts a marker that stood below the colonies', () => {
      luna.trackPosition = 0;
      expect(luna.placeCube(player.id)).eq(0);
      expect(luna.colonies).deep.eq([player.id]);
      expect(luna.trackPosition).eq(1);
      expect(luna.placeCube(player2.id)).eq(1);
      expect(luna.trackPosition).eq(2);
    });

    it('leaves a marker that stands above the colonies where it is', () => {
      luna.trackPosition = 5;
      luna.placeCube(player.id);
      expect(luna.trackPosition).eq(5);
    });

    it('refuses a cube the track has no cell for — and addColony refuses BEFORE paying or journaling', () => {
      const top = trackTop(luna.metadata);
      luna.colonies = Array.from({length: top}, () => player2.id);
      luna.trackPosition = top;
      expect(luna.hasFreeTrackCell()).is.false;
      expect(() => luna.placeCube(player.id)).to.throw(/no free cell/);
      const logged = messages().length;
      expect(() => luna.addColony(player)).to.throw(/no free cell/);
      expect(player.production.megacredits, 'no bonus was paid').eq(0);
      expect(messages().length, 'nothing was journaled').eq(logged);
      expect(luna.colonies).has.length(top);
    });

    it('the door names that limit before a build is offered — whatever the door lifts', () => {
      const top = trackTop(luna.metadata);
      luna.colonies = Array.from({length: top}, () => player2.id);
      expect(player.colonies.buildBlockedReason(luna, {ignoreLimit: true, allowDuplicate: true})).eq(NO_FREE_TRACK_CELL_REASON);
      // The ordinary door still names its own rule first.
      expect(player.colonies.buildBlockedReason(luna)).eq('Colony is full');
    });

    /*
     * THE SOURCE-LEVEL GUARD. «The marker never sits below the colonies» and
     * «a cube needs a cell» are ONE invariant only while ONE function grows
     * the array. The bot's build kept its own push and its own copy of the
     * marker rule until this guard existed.
     */
    describe('is the only place in src/ that writes a tile\'s cubes', () => {
      /**
       * A mutation of a TILE's cube list: `<tile>.colonies` assigned, indexed,
       * truncated or handed a mutating array method — never the GAME's roster
       * (`game.colonies`, the dealer's own list) and never a player's
       * `colonies` helper (an object, assigned once in the constructor).
       */
      const CUBE_WRITE = /\.\s*colonies\s*(?:=[^=]|\[[^\]]+\]\s*=[^=]|\.length\s*=[^=]|\.(?:push|splice|sort|pop|shift|unshift|reverse|fill|copyWithin)\()/;
      const ROSTER = /\b(?:game|Dealer|dealer)\s*\.\s*colonies\b/;
      const ALLOWED: ReadonlyMap<string, string> = new Map([
        [path.join('src', 'server', 'colonies', 'Colony.ts'), 'the writer itself (`placeCube`)'],
        [path.join('src', 'server', 'colonies', 'ColonyDeserializer.ts'), 'a load restores the saved cubes'],
        [path.join('src', 'server', 'colonies', 'ColonyDealer.ts'), 'the dealer\'s own list of TILES (`this.colonies`), not cubes'],
        [path.join('src', 'server', 'Player.ts'), 'the player\'s `colonies` helper object, assigned once'],
        [path.join('src', 'common', 'events', 'aggregate.ts'), 'a statistics record keyed by colony name (`acc.colonyTrack.colonies[name]`), not cubes'],
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

      it('no other server / common file writes them', () => {
        const offenders: Array<string> = [];
        let scanned = 0;
        for (const root of ['server', 'common']) {
          for (const file of sourceFiles(path.join(ROOT, 'src', root))) {
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
              if (CUBE_WRITE.test(line) && !ROSTER.test(line)) {
                offenders.push(`${relative}:${index + 1}  ${line.trim()}`);
              }
            });
          }
        }
        expect(scanned, 'the scan still reads the source tree').to.be.greaterThan(1500);
        expect(offenders, 'A tile\'s cubes have ONE writer — `Colony.placeCube` ' +
          '(docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md). Offending writes:\n  ' + offenders.join('\n  ')).deep.eq([]);
      });

      it('every allow-listed file still exists', () => {
        const gone = [...ALLOWED.keys()].filter((file) => !fs.existsSync(path.join(ROOT, file)));
        expect(gone).deep.eq([]);
      });

      it('the pattern catches what it guards against (anti-vacuous)', () => {
        const hit = (s: string) => CUBE_WRITE.test(s) && !ROSTER.test(s);
        expect(hit('colony.colonies.push(bot.id);')).is.true;
        expect(hit('this.colonies.push(owner);')).is.true;
        expect(hit('tile.colonies = [];')).is.true;
        expect(hit('colony.colonies.length = 0;')).is.true;
        expect(hit('colony.colonies[2] = player.id;')).is.true;
        expect(hit('incoming.colonies.splice(0, 1);')).is.true;
        // Reads, the roster and comparisons are not writes of a tile's cubes.
        expect(hit('if (colony.colonies.length === 0) {')).is.false;
        expect(hit('const own = colony.colonies.filter((id) => id === player.id);')).is.false;
        expect(hit('game.colonies.push(colonyTile);')).is.false;
        expect(hit('game.colonies = colonyDealer.colonies;')).is.false;
        expect(hit('if (a.colonies === b.colonies) {')).is.false;
      });
    });
  });

  describe('the fourth colony — Colony.addColony with three cubes standing', () => {
    beforeEach(() => {
      luna.colonies = [player2.id, player3.id, player2.id];
      luna.trackPosition = 3;
    });

    it('pays the tile\'s build bonus — the last printed cell (Luna: +2 M€ production)', () => {
      luna.addColony(player);
      expect(player.production.megacredits).eq(2);
      expect(luna.colonies).deep.eq([player2.id, player3.id, player2.id, player.id]);
    });

    it('lifts a marker that stood on the third cell to the fourth', () => {
      luna.addColony(player);
      expect(luna.trackPosition).eq(4);
    });

    it('leaves a marker that already stood higher', () => {
      luna.trackPosition = 6;
      luna.addColony(player);
      expect(luna.trackPosition).eq(6);
    });

    it('the journal names the rule the build lifted, instead of the ordinary line', () => {
      const before = messages().length;
      luna.addColony(player);
      const added = messages().slice(before);
      expect(added).to.include('${0} built a colony on ${1} beyond the 3-colony limit');
      expect(added).to.not.include('${0} built a colony on ${1}');
    });

    it('…and a build into a printed berth writes the ordinary line', () => {
      luna.colonies = [player2.id];
      const before = messages().length;
      luna.addColony(player);
      const added = messages().slice(before);
      expect(added).to.include('${0} built a colony on ${1}');
      expect(added).to.not.include('${0} built a colony on ${1} beyond the 3-colony limit');
    });

    it('the tile is at its limit for every ordinary door afterwards — the builder included', () => {
      luna.addColony(player);
      expect(luna.isFull()).is.true;
      for (const seat of [player, player2, player3]) {
        expect(seat.colonies.buildBlockedReason(luna), seat.color).eq('Colony is full');
        expect(seat.colonies.buildBlockedReason(luna, {allowDuplicate: true}), seat.color).eq('Colony is full');
      }
    });

    it('Vital Colony\'s repeat pays the SAME berth twice (the berth is read once, before the cube)', () => {
      luna.addColony(player, {giveBonusTwice: true});
      expect(player.production.megacredits).eq(4);
    });

    it('a card target is asked for the bonus (Titan: 3 floaters)', () => {
      titan.colonies = [player2.id, player3.id, player2.id];
      player.playedCards.push(new Dirigibles(), new JupiterFloatingStation());
      titan.addColony(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      pick.cb([pick.cards[0]]);
      expect(pick.cards[0].resourceCount).eq(3);
    });

    it('a draw is paid in full (Pluto: 2 cards)', () => {
      pluto.colonies = [player2.id, player3.id, player2.id];
      const hand = player.cardsInHand.length;
      pluto.addColony(player);
      runAllActions(game);
      expect(player.cardsInHand.length).eq(hand + 2);
    });

    it('a descending row pays its LAST printed cell (Titania 5 / 3 / 2 → 2 VP)', () => {
      const titania = new Titania();
      titania.colonies = [player2.id, player3.id, player2.id];
      titania.addColony(player);
      expect(player.colonies.victoryPoints).eq(2);
    });

    it('every «colony built» reactor answers as for any build (Poseidon: +1 M€ production)', () => {
      player3.playedCards.push(new Poseidon());
      luna.addColony(player);
      expect(player3.production.megacredits).eq(1);
    });

    it('every count of colonies reads the cubes (+1, as from any build)', () => {
      const before = player.getColoniesCount();
      luna.addColony(player);
      expect(player.getColoniesCount()).eq(before + 1);
    });

    describe('…and the tile lives on with four cubes', () => {
      beforeEach(() => {
        luna.addColony(player);
        runAllActions(game);
      });

      it('the marker never drops below the four colonies', () => {
        luna.trackPosition = 6;
        luna.decreaseTrack(6);
        expect(luna.trackPosition).eq(4);
      });

      it('a trade resets the marker to the four colonies', () => {
        luna.trackPosition = 6;
        luna.trade(player3);
        runAllActions(game);
        expect(luna.trackPosition).eq(4);
      });

      it('a trade pays the owners\' bonus PER CUBE — four payouts (Luna: 2 M€ each)', () => {
        const before = [player, player2, player3].map((p) => p.megaCredits);
        // The trader is the seat with ONE cube: its own income is the track's, read apart.
        const income = new Luna().metadata.trade.quantity[luna.trackPosition];
        luna.trade(player3);
        runAllActions(game);
        expect(player.megaCredits - before[0], 'one cube').eq(2);
        expect(player2.megaCredits - before[1], 'two cubes').eq(4);
        expect(player3.megaCredits - before[2], 'one cube + the trade income').eq(2 + income);
      });

      it('the four cubes survive a save / load, and no new field is written', () => {
        const serialized = luna.serialize();
        expect(Object.keys(serialized).sort()).deep.eq(['colonies', 'isActive', 'name', 'trackPosition', 'visitor']);
        const [restored] = ColonyDeserializer.deserializeAndFilter(JSON.parse(JSON.stringify([serialized])));
        expect(restored.colonies).deep.eq([player2.id, player3.id, player2.id, player.id]);
        expect(restored.trackPosition).eq(4);
        expect(restored.isFull()).is.true;
        expect(restored.hasFreeTrackCell()).is.true;
      });
    });
  });
});
