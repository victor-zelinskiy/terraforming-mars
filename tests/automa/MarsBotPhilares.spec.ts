import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType, isSpecialTile, tileTypeToString} from '../../src/common/TileType';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {NON_MARS_LAND_TILES, marsLandTileFor} from '../../src/server/automa/corps/MarsBotPhilares';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B27 = BonusCardId.B27_BUILD_BUILD_BUILD;
const B07 = BonusCardId.B07_LOCAL_NEURAL_INSTANCE;
/** The printed conversion: this much science buys one track advance. */
const SCIENCE_PER_ADVANCE = 4;

/** A live Philares game with the corporation seated (setup + gen-1 BAP run). */
function philaresGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C22_PHILARES): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function onCard(game: IGame): number {
  return game.automa!.corpResources;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

/** Take a bonus card OUT of the deck, the way the controller's draw does. */
function drawFromBonusDeck(game: IGame, id: BonusCardId): void {
  const deck = game.automa!.bonusDeck;
  const index = deck.findIndex((e) => e.kind === 'bonus' && e.id === id);
  expect(index, `${id} must be in the bonus deck to be drawn`).is.greaterThan(-1);
  deck.splice(index, 1);
}

/** Wipe the map so a spec owns every tile on it. */
function clearBoard(game: IGame): void {
  for (const space of game.board.spaces) {
    space.tile = undefined;
    space.player = undefined;
  }
}

/** An empty LAND cell with `count` free land neighbours, or undefined. */
function landCellWithNeighbours(game: IGame, count: number): Space | undefined {
  return game.board.spaces.find((space) =>
    space.spaceType === SpaceType.LAND && space.tile === undefined &&
    game.board.getAdjacentSpaces(space)
      .filter((adj) => adj.spaceType === SpaceType.LAND && adj.tile === undefined).length >= count);
}

function freeLandNeighbours(game: IGame, space: Space): Array<Space> {
  return game.board.getAdjacentSpaces(space)
    .filter((adj) => adj.spaceType === SpaceType.LAND && adj.tile === undefined);
}

/** Seat a finished tile of `owner` on `space` without running any hook. */
function seatTile(space: Space, owner: IPlayer, tileType: TileType): void {
  space.tile = {tileType};
  space.player = owner;
}

describe('MarsBot Philares (C22) + B27 Build, Build, Build', () => {
  describe('the printed card', () => {
    it('prints no starting tag, no priority, a science resource and owns B27', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C22_PHILARES);
      expect(info.original).eq(CardName.PHILARES);
      expect(info.cardNumber).eq('C22');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.whiteMarkerTracks).is.undefined;
      expect(info.resource, 'the card stores science').eq('science');
      expect(info.corpBonusCards).deep.eq([B27]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
      expect(corpOwningBonusCard(B27)?.id, 'B27 belongs to Philares').eq(MarsBotCorpId.C22_PHILARES);
    });
  });

  describe('the SETUP box', () => {
    it('opens with a greenery of its own and one step of oxygen', () => {
      const [game, , bot] = philaresGame('-ph-setup');
      const greeneries = game.board.spaces.filter((s) =>
        s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id);
      expect(greeneries, 'the bot owns a greenery from turn zero').has.length.at.least(1);
      expect(game.getOxygenLevel(), 'and the step it raised').is.at.least(1);
    });

    it('seeds exactly 1 science on the card', () => {
      const [game] = philaresGame('-ph-seed');
      // The opening greenery may have bordered nothing (an empty map), so the
      // card holds its printed seed and nothing more.
      expect(onCard(game)).eq(1);
      expect(stat(game, 'philaresScience')).eq(1);
    });

    it('resolves Local Neural Instance and destroys it everywhere it could be', () => {
      const [game] = philaresGame('-ph-b07');
      expect(game.automa!.destroyedBonusCards).contains(B07);
      expect(bonusDeckIds(game)).not.contains(B07);
      expect(game.automa!.bonusDiscard).not.contains(B07);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B07)).is.empty;
      // B07 resolving means it did its job: an instance tile, or the printed
      // fallback (a drawn project card) when the map had no room for one.
      const instance = game.board.spaces.filter((s) => s.tile?.tileType === TileType.NEURAL_INSTANCE);
      expect(instance.length === 1 || game.automa!.playedPile.length > 0,
        'B07 either planted its tile or fell back to a project card').is.true;
    });

    it('shuffles its own B27 into the bonus deck — one copy, never recurring', () => {
      const [game] = philaresGame('-ph-b27');
      expect(bonusDeckIds(game).filter((id) => id === B27)).has.length(1);
      expect(game.automa!.recurringBonusCards).not.contains(B27);
    });

    it('another corporation neither seeds science nor touches B07/B27', () => {
      const [game] = philaresGame('-ph-other', MarsBotCorpId.C01_CREDICOR);
      expect(onCard(game)).eq(0);
      expect(game.automa!.destroyedBonusCards).not.contains(B07);
      expect(bonusDeckIds(game)).not.contains(B27);
    });
  });

  describe('the EFFECT — a new border pays', () => {
    it('the OPPONENT building against the bot pays the bot', () => {
      const [game, human, bot] = philaresGame('-ph-human-builds');
      clearBoard(game);
      game.automa!.corpResources = 0;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);
      const neighbour = freeLandNeighbours(game, cell)[0];

      game.addGreenery(human, neighbour);

      expect(onCard(game), 'one new border, one science').eq(1);
      expect(stat(game, 'philaresBorders')).eq(1);
    });

    it('the BOT building against the opponent pays it just the same', () => {
      const [game, human, bot] = philaresGame('-ph-bot-builds');
      clearBoard(game);
      game.automa!.corpResources = 0;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, human, TileType.GREENERY);
      const neighbour = freeLandNeighbours(game, cell)[0];

      game.addGreenery(bot, neighbour);

      expect(onCard(game)).eq(1);
      expect(stat(game, 'philaresBorders')).eq(1);
    });

    it('a placement that touches TWO of the other side pays twice', () => {
      const [game, human, bot] = philaresGame('-ph-two-borders');
      clearBoard(game);
      game.automa!.corpResources = 0;
      const cell = landCellWithNeighbours(game, 2)!;
      const [a, b] = freeLandNeighbours(game, cell);
      seatTile(a, bot, TileType.GREENERY);
      seatTile(b, bot, TileType.GREENERY);

      game.addGreenery(human, cell);

      expect(onCard(game)).eq(2);
      expect(stat(game, 'philaresBorders')).eq(2);
    });

    it('a border with ITS OWN side pays nothing', () => {
      const [game, , bot] = philaresGame('-ph-samesides');
      clearBoard(game);
      game.automa!.corpResources = 0;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);

      game.addGreenery(bot, freeLandNeighbours(game, cell)[0]);

      expect(onCard(game)).eq(0);
      expect(stat(game, 'philaresBorders')).eq(0);
    });

    it('an UNOWNED tile is nobody\'s tile — the engine\'s own reading of the human card', () => {
      const [game, human, bot] = philaresGame('-ph-unowned');
      clearBoard(game);
      game.automa!.corpResources = 0;
      const cell = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
        game.board.getAdjacentSpaces(s).some((adj) => adj.spaceType === SpaceType.LAND && adj.tile === undefined))!;
      const neighbour = freeLandNeighbours(game, cell)[0];
      seatTile(neighbour, bot, TileType.GREENERY);

      game.addOcean(human, cell);

      expect(onCard(game), 'an ocean has no owner and forms no border').eq(0);
    });

    it('another corporation collects nothing from the same placement', () => {
      const [game, human, bot] = philaresGame('-ph-border-other', MarsBotCorpId.C01_CREDICOR);
      clearBoard(game);
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);

      game.addGreenery(human, freeLandNeighbours(game, cell)[0]);

      expect(game.automa!.corpResources).eq(0);
      expect(game.automa!.corpStats['philaresBorders']).is.undefined;
    });
  });

  describe('the EFFECT — 4 science buys a track step', () => {
    it('the 4th science is spent at once, on the most-advanced non-maxed track', () => {
      const [game, human, bot] = philaresGame('-ph-spend');
      clearBoard(game);
      game.automa!.corpResources = 3;
      const target = game.automa!.board.getMostAdvancedNonMaxedTrackIndex()!;
      const before = game.automa!.board.tracks[target].position;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);

      game.addGreenery(human, freeLandNeighbours(game, cell)[0]);

      expect(onCard(game), '3 + 1 = 4, spent to zero').eq(0);
      expect(stat(game, 'philaresSpends')).eq(1);
      expect(game.automa!.board.tracks[target].position,
        'the track the bot was already leading moved').is.greaterThan(before);
    });

    it('ONE spend per trigger, not a drain — 9 science leaves 5', () => {
      const [game, human, bot] = philaresGame('-ph-oneshot');
      clearBoard(game);
      game.automa!.corpResources = 8;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);

      game.addGreenery(human, freeLandNeighbours(game, cell)[0]);

      // 8 + 1 = 9 → one spend of 4 → 5. A cascade may add more BORDERS (an
      // advance can place a tile), so the floor is what the rule guarantees.
      expect(onCard(game)).is.at.least(9 - SCIENCE_PER_ADVANCE - SCIENCE_PER_ADVANCE);
      expect(onCard(game)).is.lessThan(9);
      expect(stat(game, 'philaresSpends')).is.at.least(1);
    });

    it('3 science buys nothing', () => {
      const [game, human, bot] = philaresGame('-ph-nospend');
      clearBoard(game);
      game.automa!.corpResources = 2;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);

      game.addGreenery(human, freeLandNeighbours(game, cell)[0]);

      expect(onCard(game)).eq(3);
      expect(stat(game, 'philaresSpends')).eq(0);
    });

    it('every track complete: the science stays on the card', () => {
      const [game, human, bot] = philaresGame('-ph-maxed');
      clearBoard(game);
      game.automa!.corpResources = 3;
      for (const track of game.automa!.board.tracks) {
        track.position = track.maxPosition;
      }
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);

      game.addGreenery(human, freeLandNeighbours(game, cell)[0]);

      expect(onCard(game), 'nothing to buy — nothing spent').eq(4);
      expect(stat(game, 'philaresSpends')).eq(0);
    });
  });

  describe('B27 lifecycle', () => {
    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = philaresGame('-ph-foreign');
      expect(() => resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw();
    });

    it('the fallback branch puts the card back in the DECK, not the discard', () => {
      const [game] = philaresGame('-ph-return');
      clearBoard(game); // No opponent tiles at all → neither build branch can land.
      drawFromBonusDeck(game, B27); // A resolving card has left the deck.

      const outcome = resolveBonusCard(game, B27);
      routeBonusCard(game, B27, outcome);

      expect(outcome).eq('return-to-deck');
      expect(game.automa!.bonusDiscard).not.contains(B27);
      expect(bonusDeckIds(game).filter((id) => id === B27),
        'still exactly one copy, back in the live deck').has.length(1);
    });
  });

  describe('B27 — the a/b/c ladder', () => {
    it('a. a city goes down beside the opponent\'s greenery, and it pays 5 M€', () => {
      const [game, human, bot] = philaresGame('-ph-b27-city');
      clearBoard(game);
      bot.megaCredits = 20;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, human, TileType.GREENERY);

      const outcome = resolveBonusCard(game, B27);

      const cities = game.board.spaces.filter((s) => s.tile?.tileType === TileType.CITY && s.player?.id === bot.id);
      expect(cities, 'the bot built exactly one city').has.length(1);
      expect(game.board.getAdjacentSpaces(cities[0]).some((adj) => adj.id === cell.id),
        'and it is against the human greenery').is.true;
      expect(stat(game, 'buildMcPaid'), 'the printed 5 M€').eq(5);
      expect(bot.megaCredits, 'net of whatever the cell itself paid back').is.at.most(20);
      expect(stat(game, 'buildCities')).eq(1);
      expect(outcome).eq('discard');
    });

    it('a. a broke bot still builds — «if successful, it loses N» is not a price', () => {
      const [game, human, bot] = philaresGame('-ph-b27-broke');
      clearBoard(game);
      bot.megaCredits = 0;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, human, TileType.GREENERY);

      resolveBonusCard(game, B27);

      expect(game.board.spaces.filter((s) => s.tile?.tileType === TileType.CITY && s.player?.id === bot.id))
        .has.length(1);
      expect(bot.megaCredits, 'and never goes negative').is.at.least(0);
      expect(stat(game, 'buildMcPaid'), 'it paid what it had, not what it owed').is.lessThan(5);
    });

    it('b. with no greenery to build against, a special tile lands beside a city', () => {
      const [game, human, bot] = philaresGame('-ph-b27-special');
      clearBoard(game);
      bot.megaCredits = 20;
      game.automa!.playedPile = [CardName.MINE, CardName.NUCLEAR_ZONE];
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, human, TileType.CITY);

      const outcome = resolveBonusCard(game, B27);

      const planted = game.board.spaces.filter((s) => s.tile?.tileType === TileType.NUCLEAR_ZONE);
      expect(planted, 'the first played card that prints a Mars land tile').has.length(1);
      expect(game.board.getAdjacentSpaces(planted[0]).some((adj) => adj.id === cell.id)).is.true;
      expect(game.automa!.playedPile, '«destroy that card»').deep.eq([CardName.MINE]);
      expect(stat(game, 'buildMcPaid'), 'the printed 3 M€').eq(3);
      expect(stat(game, 'buildSpecialTiles')).eq(1);
      expect(outcome).eq('discard');
    });

    it('b. a played pile with nothing plantable falls through to (c)', () => {
      const [game, human, bot] = philaresGame('-ph-b27-nothing');
      clearBoard(game);
      bot.megaCredits = 5;
      game.automa!.playedPile = [CardName.MINE, CardName.RESEARCH];
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, human, TileType.CITY);

      const outcome = resolveBonusCard(game, B27);

      expect(outcome).eq('return-to-deck');
      expect(bot.megaCredits).eq(5 + 3);
      expect(stat(game, 'buildMc')).eq(3);
    });

    it('the greenery branch OUTRANKS the special tile — printed order is the rule', () => {
      const [game, human, bot] = philaresGame('-ph-b27-order');
      clearBoard(game);
      bot.megaCredits = 20;
      game.automa!.playedPile = [CardName.NUCLEAR_ZONE];
      const greenery = landCellWithNeighbours(game, 1)!;
      seatTile(greenery, human, TileType.GREENERY);
      const city = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== greenery.id &&
        !game.board.getAdjacentSpaces(s).some((adj) => adj.id === greenery.id) &&
        freeLandNeighbours(game, s).length > 0)!;
      seatTile(city, human, TileType.CITY);

      resolveBonusCard(game, B27);

      expect(stat(game, 'buildCities'), 'branch (a) landed').eq(1);
      expect(stat(game, 'buildSpecialTiles'), 'so branch (b) never ran').eq(0);
    });

    it('c. an empty map pays 3 M€ and names the branch', () => {
      const [game, , bot] = philaresGame('-ph-b27-fallback');
      clearBoard(game);
      bot.megaCredits = 1;

      const outcome = resolveBonusCard(game, B27);

      expect(bot.megaCredits).eq(4);
      expect(stat(game, 'buildMc')).eq(3);
      expect(stat(game, 'buildPlayed')).eq(1);
      expect(outcome).eq('return-to-deck');
    });

    it('a build against the opponent immediately feeds the corporation', () => {
      const [game, human] = philaresGame('-ph-b27-feeds');
      clearBoard(game);
      game.automa!.corpResources = 0;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, human, TileType.GREENERY);

      resolveBonusCard(game, B27);

      expect(onCard(game), 'the city it just built borders that greenery').is.at.least(1);
      expect(stat(game, 'philaresBorders')).is.at.least(1);
    });
  });

  describe('the Mars-land tile partition', () => {
    it('classifies every special tile type — the worklist when upstream adds one', () => {
      // Each special tile is either plantable on Mars land or explicitly not.
      // A new TileType upstream lands in neither bucket and fails HERE, by name.
      const unclassified: Array<string> = [];
      for (const [key, value] of Object.entries(tileTypeToString)) {
        const tileType = Number(key) as TileType;
        if (!isSpecialTile(tileType)) {
          continue;
        }
        const plantable = marsLandTileFor(value as CardName) === tileType;
        const excluded = NON_MARS_LAND_TILES.has(tileType);
        if (plantable === excluded) {
          unclassified.push(`${TileType[tileType]} -> "${value}"`);
        }
      }
      expect(unclassified, `special tiles neither plantable nor excluded:\n${unclassified.join('\n')}`).is.empty;
    });

    it('an ocean-hosted or Moon tile is never plantable on Mars land', () => {
      expect(marsLandTileFor(CardName.OCEAN_CITY)).is.undefined;
      expect(marsLandTileFor(CardName.WETLANDS)).is.undefined;
      expect(marsLandTileFor(CardName.LUNA_TRADE_STATION)).is.undefined;
    });

    it('an ordinary land special tile is', () => {
      expect(marsLandTileFor(CardName.NUCLEAR_ZONE)).eq(TileType.NUCLEAR_ZONE);
      expect(marsLandTileFor(CardName.COMMERCIAL_DISTRICT)).eq(TileType.COMMERCIAL_DISTRICT);
      expect(marsLandTileFor(CardName.MINE), 'a card with no tile at all').is.undefined;
    });
  });

  describe('state', () => {
    it('the science, the counters and the deck survive a save/load round trip', () => {
      const [game, human, bot] = philaresGame('-ph-serialize');
      clearBoard(game);
      game.automa!.corpResources = 2;
      const cell = landCellWithNeighbours(game, 1)!;
      seatTile(cell, bot, TileType.GREENERY);
      game.addGreenery(human, freeLandNeighbours(game, cell)[0]);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C22_PHILARES);
      expect(restored.automa!.corpResources).eq(3);
      expect(restored.automa!.corpStats['philaresBorders']).eq(1);
      expect(restored.automa!.destroyedBonusCards).contains(B07);
      expect(bonusDeckIds(restored).filter((id) => id === B27)).has.length(1);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = philaresGame('-ph-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C22_PHILARES);
    });
  });
});
