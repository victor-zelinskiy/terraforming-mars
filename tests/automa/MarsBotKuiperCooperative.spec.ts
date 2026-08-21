import {expect} from 'chai';
import * as constants from '../../src/common/constants';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotKuiperCooperative} from '../../src/server/automa/corps/MarsBotKuiperCooperative';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** A live Kuiper Cooperative game with the corporation seated (setup already run). */
function kuiperGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C41_KUIPER_COOPERATIVE): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the space track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.SPACE].position = position - 1;
}

function oceans(game: IGame): number {
  return game.board.getOceanSpaces().length;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Kuiper Cooperative (C41)', () => {
  describe('the printed card', () => {
    it('prints BOTH a space starting tag and a Space priority, plus six cubes on that one track', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C41_KUIPER_COOPERATIVE);
      expect(info.original).eq(CardName.KUIPER_COOPERATIVE);
      expect(info.cardNumber).eq('C41');
      // The corner box carries the tag AND the plate carries the priority —
      // the C11 shape, unlike C19 whose corner is empty.
      expect(info.startingTags).deep.eq([Tag.SPACE]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SPACE]});
      expect(info.resource, 'nothing is stored on the card').is.undefined;
      expect(info.corpBonusCards).is.empty;
      const cubes = info.trackCubes ?? [];
      expect(cubes.every((c) => c.tag === Tag.SPACE), 'every cube sits on the SPACE track').is.true;
      expect(cubes.filter((c) => c.cubeType === 'white').map((c) => c.position)).deep.eq([4, 8, 12]);
      expect(cubes.filter((c) => c.cubeType === 'black').map((c) => c.position)).deep.eq([7, 10, 14]);
      expect(info.cubeLegend?.white, 'each colour names its own outcome').is.a('string');
      expect(info.cubeLegend?.black).is.a('string');
      expect(info.cubeLegend?.white).does.not.eq(info.cubeLegend?.black);
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });

    it('shares C19\'s printed SETUP sentences — one phrasing, different numbers', () => {
      const setupOf = (id: MarsBotCorpId) => marsBotCorpInfo(id).sections
        .find((s) => s.kind === 'setup')!.lines.map((l) => l.text);
      expect(setupOf(MarsBotCorpId.C41_KUIPER_COOPERATIVE).sort())
        .deep.eq(setupOf(MarsBotCorpId.C19_ASTRO_DRILL).sort());
    });

    it('is registered and answers only to its cube hook', () => {
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C41_KUIPER_COOPERATIVE);
      expect(corp).eq(MarsBotKuiperCooperative);
      expect(corp.onTrackCubeTrigger, 'the EFFECT box').is.a('function');
      expect(corp.setup, 'the cubes are DATA — no setup code').is.undefined;
      expect(corp.beforeActionPhase, 'no before-action-phase box is printed').is.undefined;
      expect(corp.onTagResolved).is.undefined;
      expect(corp.resolveBonusCard).is.undefined;
    });

    it('the cubes are DATA — the mat reads them from the card, and only the SPENT set is state', () => {
      const [game] = kuiperGame('-c41-seed');
      // Nothing is «seeded» into the game: the positions live on the printed
      // card and the framework only remembers which cubes have fired.
      expect(marsBotCorpInfo(game.automa!.corporation!).trackCubes ?? []).has.length(6);
      expect(game.automa!.corpCubesTriggered, 'nothing has fired yet').is.empty;
    });
  });

  describe('the EFFECT — a white cube raises the temperature', () => {
    it('one step, through the shared raise', () => {
      const [game] = kuiperGame('-c41-white');
      armCube(game, 4);
      const temperature = game.getTemperature();

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(game.getTemperature(), 'the shared raise moved it 2 °C').eq(temperature + 2);
      expect(stat(game, 'kuiperWhiteCubes')).eq(1);
      expect(stat(game, 'kuiperTemperatureSteps')).eq(1);
      expect(stat(game, 'kuiperBlackCubes')).eq(0);
    });

    it('a completed temperature turns it into the official Failed Action', () => {
      const [game, , bot] = kuiperGame('-c41-white-maxed');
      (game as any).temperature = constants.MAX_TEMPERATURE;
      armCube(game, 4);
      const mc = bot.megaCredits;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(mc + 5);
      expect(stat(game, 'kuiperWhiteCubes'), 'the cube still fired').eq(1);
      expect(stat(game, 'kuiperTemperatureSteps'), 'but nothing moved').eq(0);
    });
  });

  describe('the EFFECT — a black cube places an ocean', () => {
    it('lays a tile through the shared placer', () => {
      const [game] = kuiperGame('-c41-black');
      armCube(game, 7);
      const before = oceans(game);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(oceans(game)).eq(before + 1);
      expect(stat(game, 'kuiperBlackCubes')).eq(1);
      expect(stat(game, 'kuiperOceans')).eq(1);
      expect(stat(game, 'kuiperWhiteCubes')).eq(0);
    });

    it('a completed ocean count turns it into the official Failed Action', () => {
      const [game, human, bot] = kuiperGame('-c41-black-maxed');
      while (oceans(game) < constants.MAX_OCEAN_TILES) {
        game.addOcean(human, game.board.getAvailableSpacesForOcean(human)[0]);
      }
      armCube(game, 7);
      const mc = bot.megaCredits;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(oceans(game)).eq(constants.MAX_OCEAN_TILES);
      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(mc + 5);
      expect(stat(game, 'kuiperBlackCubes'), 'the cube still fired').eq(1);
      expect(stat(game, 'kuiperOceans'), 'but no ocean went down').eq(0);
    });
  });

  describe('the EFFECT — its shared rules', () => {
    it('neither colour says «instead of», so the space keeps its printed icon', () => {
      // Space #14 prints a temperature raise AND carries a black cube.
      const [game] = kuiperGame('-c41-and-not-instead');
      armCube(game, 14);
      const temperature = game.getTemperature();
      const before = oceans(game);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(oceans(game), 'the cube laid its ocean').eq(before + 1);
      expect(game.getTemperature(), 'and the space still raised the temperature').is.greaterThan(temperature);
    });

    it('a cube fires at most ONCE — a regressed track does not re-arm it', () => {
      const [game] = kuiperGame('-c41-once');
      armCube(game, 4);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);
      expect(stat(game, 'kuiperWhiteCubes')).eq(1);

      game.automa!.board.tracks[THARSIS_TRACK.SPACE].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(stat(game, 'kuiperWhiteCubes'), 'the spent cube is gone for good').eq(1);
    });

    it('a space with no cube of this corporation does nothing extra', () => {
      const [game] = kuiperGame('-c41-empty-space');
      armCube(game, 6); // no cube on #6

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(stat(game, 'kuiperWhiteCubes')).eq(0);
      expect(stat(game, 'kuiperBlackCubes')).eq(0);
    });

    it('another corporation has no cubes at all', () => {
      const [game] = kuiperGame('-c41-other', MarsBotCorpId.C01_CREDICOR);
      expect(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).trackCubes).is.undefined;
      armCube(game, 4);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(game.automa!.corpStats['kuiperWhiteCubes']).is.undefined;
    });
  });

  describe('state', () => {
    it('the spent cubes and the counters survive a save/load round trip', () => {
      const [game] = kuiperGame('-c41-serialize');
      armCube(game, 4);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);
      const white = stat(game, 'kuiperWhiteCubes');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C41_KUIPER_COOPERATIVE);
      expect(restored.automa!.corpStats['kuiperWhiteCubes']).eq(white);
      expect(restored.automa!.corpCubesTriggered, 'the spent cube stays spent').is.not.empty;
    });
  });
});
