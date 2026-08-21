import {expect} from 'chai';
import * as constants from '../../src/common/constants';
import {CardName} from '../../src/common/cards/CardName';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Board} from '../../src/server/boards/Board';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotPristar} from '../../src/server/automa/corps/MarsBotPristar';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaTerraformer} from '../../src/server/automa/AutomaTerraformer';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {pushNearestBonus} from '../../src/server/automa/AutomaNearBonusPush';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const TR_GAIN = 1;
const MC_GAIN = 6;

/**
 * A live Pristar game. ⚠️ Its Before-Action-Phase box has ALREADY resolved
 * once by the time the first action phase begins — RB-B resolves those boxes
 * after setup too, and the shared gate does it at the research → action
 * transition. That is exactly why this card prints no SETUP box, and it means
 * every counter here must be read as a DELTA.
 */
function pristarGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C36_PRISTAR): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, venusNextExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Run the printed box directly — the once-per-generation gate is its own concern. */
function runBox(game: IGame, corporation: MarsBotCorpId = MarsBotCorpId.C36_PRISTAR) {
  AutomaCorporations.corpFor(corporation).beforeActionPhase?.(game);
}

function cube(game: IGame): number {
  return game.automa!.corpResources;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function oceans(game: IGame): number {
  return game.board.spaces.filter(Board.isUncoveredOceanSpace).length;
}

describe('MarsBot Pristar (C36)', () => {
  describe('the printed card', () => {
    it('prints a white cube, an effect and a before-action-phase box — and NO setup', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C36_PRISTAR);
      expect(info.original).eq(CardName.PRISTAR);
      expect(info.cardNumber).eq('C36');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).eq('cube-white');
      expect(info.trackCubes, 'the cube is on the CARD, never on a track').is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.requiresModules, 'no module condition is printed').is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['effect', 'beforeActionPhase']);
    });

    it('is registered and answers only to its own hooks', () => {
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C36_PRISTAR);
      expect(corp).eq(MarsBotPristar);
      expect(corp.setup, 'the card prints no SETUP box').is.undefined;
      expect(corp.beforeActionPhase, 'the box that arms it').is.a('function');
      expect(corp.onWouldRaiseParameter, 'the box that replaces an action').is.a('function');
      expect(corp.onTilePlaced, 'it watches no tile').is.undefined;
      expect(corp.onTrackAdvance, 'nor a track').is.undefined;
    });
  });

  describe('the BEFORE ACTION PHASE box', () => {
    it('the first action phase already finds the card armed — which is why it prints no SETUP box', () => {
      const [game] = pristarGame('-c36-arm');
      // Nothing was run by hand here: the shared gate resolved the box on the
      // way into the action phase.
      expect(cube(game), 'a white cube is on the card from generation 1').eq(1);
      expect(stat(game, 'pristarCubes')).eq(1);
    });

    it('arms an empty card with one cube', () => {
      const [game] = pristarGame('-c36-arm-empty');
      game.automa!.corpResources = 0;
      const cubes = stat(game, 'pristarCubes');

      runBox(game);

      expect(cube(game)).eq(1);
      expect(stat(game, 'pristarCubes')).eq(cubes + 1);
    });

    it('«if there isn\'t one already» — a standing cube is never doubled', () => {
      const [game] = pristarGame('-c36-no-double');
      runBox(game);
      runBox(game);
      runBox(game);
      expect(cube(game), 'still exactly one').eq(1);
      expect(stat(game, 'pristarCubes'), 'and none of those calls counted a second cube').eq(1);
    });

    it('re-arms the card once it has been spent', () => {
      const [game] = pristarGame('-c36-rearm');
      AutomaTerraformer.raiseTemperature(game);
      expect(cube(game)).eq(0);
      const cubes = stat(game, 'pristarCubes');

      runBox(game);

      expect(cube(game), 'the next generation is armed again').eq(1);
      expect(stat(game, 'pristarCubes')).eq(cubes + 1);
    });
  });

  describe('the EFFECT — each of the four printed actions', () => {
    it('TEMPERATURE: the raise is skipped and paid for instead', () => {
      const [game, , bot] = pristarGame('-c36-temperature');
      const temperature = game.getTemperature();
      const tr = bot.terraformRating;
      const mc = bot.megaCredits;

      AutomaTerraformer.raiseTemperature(game);

      expect(game.getTemperature(), 'Mars was left alone').eq(temperature);
      expect(bot.terraformRating).eq(tr + TR_GAIN);
      expect(bot.megaCredits).eq(mc + MC_GAIN);
      expect(cube(game)).eq(0);
      expect(stat(game, 'pristarConversions')).eq(1);
      expect(stat(game, 'pristarMc')).eq(MC_GAIN);
      expect(stat(game, 'pristarSkippedTemperature')).eq(1);
    });

    it('OCEAN: the tile is never placed', () => {
      const [game, , bot] = pristarGame('-c36-ocean');
      runBox(game);
      const before = oceans(game);
      const mc = bot.megaCredits;

      AutomaTilePlacer.placeOcean(game);

      expect(oceans(game), 'no ocean went down').eq(before);
      expect(bot.megaCredits).eq(mc + MC_GAIN);
      expect(stat(game, 'pristarSkippedOcean')).eq(1);
    });

    it('VENUS: the track space pays instead of raising it', () => {
      const [game, , bot] = pristarGame('-c36-venus');
      runBox(game);
      const venus = game.getVenusScaleLevel();
      const mc = bot.megaCredits;

      AutomaResolver.performTrackAction(game, 'venus', THARSIS_TRACK.SPACE);

      expect(game.getVenusScaleLevel()).eq(venus);
      expect(bot.megaCredits).eq(mc + MC_GAIN);
      expect(stat(game, 'pristarSkippedVenus')).eq(1);
    });

    it('OXYGEN: the near-bonus card\'s printed raise is replaced, the greenery still stands', () => {
      const [game, , bot] = pristarGame('-c36-oxygen');
      runBox(game);
      // Put oxygen 1 step from its 8% bonus so the ladder picks that branch.
      (game as any).oxygenLevel = constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS - 1;
      const oxygen = game.getOxygenLevel();
      const greeneries = game.board.spaces.filter(Board.isGreenerySpace).length;
      const mc = bot.megaCredits;

      const branch = pushNearestBonus(game, 'ocean');

      expect(branch, 'the oxygen branch fired').eq('oxygen');
      expect(game.board.spaces.filter(Board.isGreenerySpace).length,
        'the greenery is a TILE — no printed sentence of this card skips one').eq(greeneries + 1);
      expect(game.getOxygenLevel(),
        'only the tile\'s own step moved oxygen; the printed raise on top of it was replaced').eq(oxygen + 1);
      expect(bot.megaCredits).is.at.least(mc + MC_GAIN);
      expect(stat(game, 'pristarSkippedOxygen')).eq(1);
    });
  });

  describe('the EFFECT — its limits', () => {
    it('an unarmed card changes nothing at all', () => {
      const [game, , bot] = pristarGame('-c36-unarmed');
      game.automa!.corpResources = 0; // spent, and the next generation not yet begun
      const temperature = game.getTemperature();
      const mc = bot.megaCredits;

      AutomaTerraformer.raiseTemperature(game);

      expect(game.getTemperature(), 'the bot terraformed as usual').is.greaterThan(temperature);
      expect(bot.megaCredits).eq(mc);
      expect(stat(game, 'pristarConversions')).eq(0);
    });

    it('ONE action per cube — the second raise of the same generation goes through', () => {
      const [game] = pristarGame('-c36-once');
      runBox(game);
      AutomaTerraformer.raiseTemperature(game);
      const temperature = game.getTemperature();

      AutomaTerraformer.raiseTemperature(game);

      expect(game.getTemperature(), 'the cube is gone — Mars warms').is.greaterThan(temperature);
      expect(stat(game, 'pristarConversions')).eq(1);
    });

    it('a GREENERY is not one of the four — its oxygen is a tile\'s consequence', () => {
      const [game, , bot] = pristarGame('-c36-greenery');
      runBox(game);
      const oxygen = game.getOxygenLevel();
      const mc = bot.megaCredits;

      AutomaTilePlacer.placeGreenery(game);

      expect(game.getOxygenLevel(), 'the tile raised oxygen exactly as always').eq(oxygen + 1);
      expect(cube(game), 'and the cube was not touched').eq(1);
      expect(bot.megaCredits, 'no conversion happened (placement bonuses aside)').is.at.most(mc + 5);
      expect(stat(game, 'pristarConversions')).eq(0);
    });

    it('a CITY is not one of the four either', () => {
      const [game] = pristarGame('-c36-city');
      runBox(game);

      AutomaTilePlacer.placeCity(game);

      expect(cube(game)).eq(1);
      expect(stat(game, 'pristarConversions')).eq(0);
    });

    it('a COMPLETED parameter is still a conversion, not a Failed Action', () => {
      const [game, , bot] = pristarGame('-c36-maxed');
      runBox(game);
      (game as any).temperature = constants.MAX_TEMPERATURE;
      const tr = bot.terraformRating;
      const mc = bot.megaCredits;

      AutomaTerraformer.raiseTemperature(game);

      // «When MarsBot WOULD raise …» names the instruction, not its
      // feasibility — the replaced action never reaches the maxed check.
      expect(bot.terraformRating).eq(tr + TR_GAIN);
      expect(bot.megaCredits).eq(mc + MC_GAIN);
      expect(stat(game, 'pristarConversions')).eq(1);
    });

    it('another corporation terraforms normally', () => {
      const [game, , bot] = pristarGame('-c36-other', MarsBotCorpId.C01_CREDICOR);
      runBox(game, MarsBotCorpId.C01_CREDICOR);
      const temperature = game.getTemperature();
      const mc = bot.megaCredits;

      AutomaTerraformer.raiseTemperature(game);

      expect(game.getTemperature()).is.greaterThan(temperature);
      expect(bot.megaCredits).eq(mc);
      expect(game.automa!.corpStats['pristarConversions']).is.undefined;
    });
  });

  describe('state', () => {
    it('the cube and the counters survive a save/load round trip', () => {
      const [game] = pristarGame('-c36-serialize');
      runBox(game);
      AutomaTerraformer.raiseTemperature(game);
      runBox(game);
      const conversions = stat(game, 'pristarConversions');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C36_PRISTAR);
      expect(restored.automa!.corpResources, 'the re-armed cube').eq(1);
      expect(restored.automa!.corpStats['pristarConversions']).eq(conversions);
      expect(restored.automa!.corpStats['pristarMc']).eq(MC_GAIN);
    });
  });
});
