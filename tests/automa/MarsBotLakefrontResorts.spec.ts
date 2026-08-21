import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Board} from '../../src/server/boards/Board';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotLakefrontResorts} from '../../src/server/automa/corps/MarsBotLakefrontResorts';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';
import {addOcean} from '../TestingUtils';

/** A live Lakefront Resorts game with the corporation seated (setup already run). */
function lakefrontGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C35_LAKEFRONT_RESORTS): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function buildingTrack(game: IGame): number {
  return game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position;
}

function cube(game: IGame): number {
  return game.automa!.corpResources;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

/** A free land space nobody has built on. */
function freeLand(game: IGame) {
  return game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId)!;
}

/** A free LAND space with at least one ocean tile beside it. */
function landBesideOcean(game: IGame) {
  return game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId &&
    game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
}

describe('MarsBot Lakefront Resorts (C35)', () => {
  describe('the printed card', () => {
    it('prints a white cube, no starting tag and no draft priority', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C35_LAKEFRONT_RESORTS);
      expect(info.original).eq(CardName.LAKEFRONT_RESORTS);
      expect(info.cardNumber).eq('C35');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).eq('cube-white');
      expect(info.trackCubes, 'the cube is on the CARD, never on a track').is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.requiresModules, 'no module condition is printed').is.undefined;
      expect(info.requiresAnyModule).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('is registered and answers only to its own hooks', () => {
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C35_LAKEFRONT_RESORTS);
      expect(corp).eq(MarsBotLakefrontResorts);
      expect(corp.setup, 'the SETUP box').is.a('function');
      expect(corp.onTilePlaced, 'the EFFECT box').is.a('function');
      expect(corp.beforeActionPhase, 'no before-action-phase box is printed').is.undefined;
      expect(corp.roundStart, 'no round-start box is printed').is.undefined;
      expect(corp.resolveBonusCard, 'it owns no bonus card').is.undefined;
    });
  });

  describe('the SETUP box', () => {
    it('places the white cube and sets the waterfront rate to 3 M€', () => {
      const [game, , bot] = lakefrontGame('-c35-setup');
      expect(cube(game), 'a white cube waits on the card').eq(1);
      expect(bot.oceanBonus, 'the printed 3 M€ instead of 2').eq(3);
    });

    it('another corporation leaves both alone', () => {
      const [game, , bot] = lakefrontGame('-c35-other', MarsBotCorpId.C01_CREDICOR);
      expect(cube(game)).eq(0);
      expect(bot.oceanBonus, 'the engine default').eq(2);
    });
  });

  describe('the EFFECT — the flip', () => {
    it('the FIRST ocean spends the cube and advances the building track', () => {
      const [game, human] = lakefrontGame('-c35-first');
      const track = buildingTrack(game);

      addOcean(human);

      expect(cube(game), 'the cube left the card').eq(0);
      expect(buildingTrack(game), 'and bought a step').is.greaterThan(track);
      expect(stat(game, 'lakefrontOceans')).eq(1);
      expect(stat(game, 'lakefrontSteps')).eq(1);
    });

    it('the SECOND ocean puts the cube back and buys nothing', () => {
      const [game, human] = lakefrontGame('-c35-second');
      addOcean(human);
      const track = buildingTrack(game);
      const steps = stat(game, 'lakefrontSteps');

      addOcean(human);

      expect(cube(game), 'the card is armed again').eq(1);
      expect(buildingTrack(game), 'the even ocean pays nothing').eq(track);
      expect(stat(game, 'lakefrontOceans')).eq(2);
      expect(stat(game, 'lakefrontSteps')).eq(steps);
    });

    it('the flips ALTERNATE — every odd one pays, whatever the oceans came from', () => {
      const [game, human] = lakefrontGame('-c35-alternating');

      // Four oceans laid at the table. The bot's own building track prints
      // ocean spaces, so a paid step can lay one MORE ocean and flip the card
      // again — which is the printed rule, not a special case. What holds in
      // every run is the alternation itself, so that is what is asserted.
      for (let i = 0; i < 4; i++) {
        addOcean(human);
        const flips = stat(game, 'lakefrontOceans');
        expect(cube(game), `after ${flips} flip(s) the cube is ${flips % 2 === 0 ? 'back' : 'spent'}`)
          .eq(flips % 2 === 0 ? 1 : 0);
        expect(stat(game, 'lakefrontSteps'), 'every odd flip bought a step').eq(Math.ceil(flips / 2));
      }
      expect(stat(game, 'lakefrontOceans'), 'four human oceans at least').is.at.least(4);
    });

    it('an ocean the paid step ITSELF lays flips the card straight back', () => {
      const [game, human] = lakefrontGame('-c35-cascade');
      // Building track space #2 prints an ocean, so a spend from #1 lands on
      // it, the bot lays an ocean — and that ocean is an ocean like any other.
      const track = game.automa!.board.tracks[THARSIS_TRACK.BUILDING];
      track.position = 1;
      const oceansOnBoard = () => game.board.spaces.filter(Board.isUncoveredOceanSpace).length;
      const before = oceansOnBoard();

      addOcean(human);

      expect(track.position, 'the spend advanced onto the ocean space').eq(2);
      expect(oceansOnBoard(), 'the human ocean plus the one the space laid').eq(before + 2);
      expect(stat(game, 'lakefrontOceans'), 'both of them flipped the card').eq(2);
      expect(stat(game, 'lakefrontSteps'), 'only the first flip spent a cube').eq(1);
      expect(cube(game), 'the second flip re-armed it').eq(1);
    });

    it('the bot\'s OWN ocean flips it exactly the same — the sentence names no placer', () => {
      const [game, , bot] = lakefrontGame('-c35-bot-ocean');
      const track = buildingTrack(game);

      addOcean(bot);

      expect(cube(game)).eq(0);
      expect(buildingTrack(game)).is.greaterThan(track);
      expect(stat(game, 'lakefrontOceans')).eq(1);
    });

    it('a city or a greenery is not an ocean — nothing flips', () => {
      const [game, human] = lakefrontGame('-c35-not-ocean');
      const track = buildingTrack(game);

      game.addCity(human, freeLand(game));
      game.addGreenery(human, freeLand(game));

      expect(cube(game), 'the cube never moved').eq(1);
      expect(buildingTrack(game)).eq(track);
      expect(stat(game, 'lakefrontOceans')).eq(0);
    });

    it('an OCEAN CITY laid over an existing ocean is not a NEW ocean', () => {
      const [game, human] = lakefrontGame('-c35-ocean-city');
      const ocean = addOcean(human); // …spends the cube
      expect(cube(game)).eq(0);
      const oceans = stat(game, 'lakefrontOceans');

      // The human twin reads the identical printed sentence through
      // `Board.isUncoveredOceanSpace`, so a tile that merely COUNTS as an
      // ocean over one that was already there flips nothing.
      game.addTile(human, ocean, {tileType: TileType.OCEAN_CITY});

      expect(cube(game), 'still empty — no re-arming happened').eq(0);
      expect(stat(game, 'lakefrontOceans')).eq(oceans);
    });

    it('another corporation ignores oceans entirely', () => {
      const [game, human] = lakefrontGame('-c35-ocean-other', MarsBotCorpId.C01_CREDICOR);
      const track = buildingTrack(game);

      addOcean(human);

      expect(buildingTrack(game)).eq(track);
      expect(game.automa!.corpStats['lakefrontOceans']).is.undefined;
    });

    it('a completed building track turns the spend into the official Failed Action', () => {
      const [game, human, bot] = lakefrontGame('-c35-maxed');
      const track = game.automa!.board.tracks[THARSIS_TRACK.BUILDING];
      track.position = track.maxPosition;
      const before = bot.megaCredits;

      addOcean(human);

      expect(track.position).eq(track.maxPosition);
      expect(cube(game), 'the cube was still spent — the card says «remove it»').eq(0);
      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(before + 5);
      expect(stat(game, 'lakefrontSteps'), 'a Failed Action is not a step it landed').eq(1);
    });
  });

  describe('the EFFECT — the waterfront rate', () => {
    it('pays 3 M€ per adjacent ocean for the bot\'s own tile, and counts the surcharge', () => {
      const [game, human, bot] = lakefrontGame('-c35-waterfront');
      addOcean(human);
      const space = landBesideOcean(game);
      expect(space, 'the board dealt a land space beside the ocean').is.not.undefined;
      const oceans = game.board.getAdjacentSpaces(space!).filter(Board.isOceanSpace).length;
      const before = bot.megaCredits;

      game.addGreenery(bot, space!);

      // The bot's covered-icon rule pays 1 M€ per icon, so the floor is the
      // waterfront money alone; what matters is the RATE, and the stat is the
      // honest measure of what the printed 3-instead-of-2 added.
      expect(bot.megaCredits - before, 'at least 3 M€ per neighbouring ocean').is.at.least(3 * oceans);
      expect(stat(game, 'lakefrontWaterfront')).eq(1);
      expect(stat(game, 'lakefrontExtraMc'), 'one extra M€ per ocean over the default rate').eq(oceans);
    });

    it('a tile away from water pays no waterfront money and counts nothing', () => {
      const [game, , bot] = lakefrontGame('-c35-inland');
      const inland = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId &&
        !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace))!;

      game.addGreenery(bot, inland);

      expect(stat(game, 'lakefrontWaterfront')).eq(0);
      expect(stat(game, 'lakefrontExtraMc')).eq(0);
    });

    it('the HUMAN keeps the ordinary 2 M€ rate', () => {
      const [game, human] = lakefrontGame('-c35-human-rate');
      expect(human.oceanBonus).eq(2);
      addOcean(human);
      const space = landBesideOcean(game)!;
      const oceans = game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
      const before = human.megaCredits;

      game.addCity(human, space);

      expect(human.megaCredits - before, 'the human is paid 2 M€ per ocean, plus the cell\'s own bonuses')
        .is.at.least(2 * oceans);
      expect(stat(game, 'lakefrontWaterfront'), 'the human\'s shoreline is not the bot\'s').eq(0);
    });
  });

  describe('state', () => {
    it('the cube, the rate and the counters survive a save/load round trip', () => {
      const [game, human] = lakefrontGame('-c35-serialize');
      addOcean(human); // spends the cube
      addOcean(human); // puts it back
      const oceans = stat(game, 'lakefrontOceans');
      const steps = stat(game, 'lakefrontSteps');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C35_LAKEFRONT_RESORTS);
      expect(restored.automa!.corpResources, 'the cube is back on the card').eq(1);
      expect(restored.players.find((p) => p.isMarsBot)!.oceanBonus, 'the standing rate is the player\'s own field').eq(3);
      expect(restored.automa!.corpStats['lakefrontOceans']).eq(oceans);
      expect(restored.automa!.corpStats['lakefrontSteps']).eq(steps);
    });
  });
});
