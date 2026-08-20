import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** A live Point Luna game with the corporation seated. */
function lunaGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C14_POINT_LUNA): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the Earth track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.EARTH].position = position - 1;
}

function at(game: IGame, index: number): number {
  return game.automa!.board.tracks[index].position;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Point Luna (C14)', () => {
  describe('the printed card', () => {
    it('prints a space starting tag, an Earth priority and the alternating cubes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C14_POINT_LUNA);
      expect(info.original).eq(CardName.POINT_LUNA);
      expect(info.cardNumber).eq('C14');
      expect(info.startingTags).deep.eq([Tag.SPACE]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.EARTH]});
      const cubes = info.trackCubes ?? [];
      expect(cubes.every((c) => c.tag === Tag.EARTH), 'every cube sits on the EARTH track').is.true;
      expect(cubes.filter((c) => c.cubeType === 'white').map((c) => c.position)).deep.eq([1, 5, 9, 13, 17]);
      expect(cubes.filter((c) => c.cubeType === 'black').map((c) => c.position)).deep.eq([3, 7, 11, 15]);
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('seeds nine cubes on the Earth track and nothing anywhere else', () => {
      const [game] = lunaGame('-pl14-setup');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(9);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.EARTH)).is.true;
      expect(cubes.filter((c) => c.cubeType === 'white')).has.length(5);
      expect(cubes.filter((c) => c.cubeType === 'black')).has.length(4);
    });

    it('another corporation seeds none', () => {
      const [game] = lunaGame('-pl14-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the EFFECT — an Earth cube pushes ANOTHER track', () => {
    it('a WHITE cube advances the least-advanced track', () => {
      const [game] = lunaGame('-pl14-white');
      const automa = game.automa!;
      // Make one track unambiguously the laggard, and give the Earth track a
      // cube to step onto.
      automa.board.tracks.forEach((t, i) => {
        t.position = i === THARSIS_TRACK.SCIENCE ? 0 : 5;
      });
      armCube(game, 5); // Earth #5 is a white cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(at(game, THARSIS_TRACK.SCIENCE), 'the laggard moved').is.greaterThan(0);
      expect(stat(game, 'lunaWhiteCubes')).eq(1);
      expect(stat(game, 'lunaBlackCubes')).eq(0);
    });

    it('a BLACK cube advances the space track', () => {
      const [game] = lunaGame('-pl14-black');
      const space = at(game, THARSIS_TRACK.SPACE);
      armCube(game, 3); // Earth #3 is a black cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(at(game, THARSIS_TRACK.SPACE)).is.greaterThan(space);
      expect(stat(game, 'lunaBlackCubes')).eq(1);
      expect(stat(game, 'lunaWhiteCubes')).eq(0);
    });

    it('the Earth space\'s own printed icon still resolves — no «instead of»', () => {
      const [game, , bot] = lunaGame('-pl14-addition');
      const tr = bot.terraformRating;
      // Earth #13 prints tr4 AND carries a white cube.
      armCube(game, 13);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(bot.terraformRating, 'the printed TR still landed').is.at.least(tr + 4);
      expect(stat(game, 'lunaWhiteCubes')).eq(1);
    });

    it('a bare Earth space between the cubes does nothing', () => {
      const [game] = lunaGame('-pl14-bare');
      armCube(game, 2); // Earth #2 carries no cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(stat(game, 'lunaSteps')).eq(0);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = lunaGame('-pl14-once');
      armCube(game, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);
      expect(stat(game, 'lunaBlackCubes')).eq(1);

      game.automa!.board.tracks[THARSIS_TRACK.EARTH].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(stat(game, 'lunaBlackCubes'), 'RB-B: a triggered cube never re-arms').eq(1);
    });

    it('another corporation on the Earth track pushes nothing', () => {
      const [game] = lunaGame('-pl14-othercorp', MarsBotCorpId.C01_CREDICOR);
      const space = at(game, THARSIS_TRACK.SPACE);
      armCube(game, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);
      expect(at(game, THARSIS_TRACK.SPACE)).eq(space);
      expect(game.automa!.corpStats['lunaBlackCubes']).is.undefined;
    });
  });

  describe('state', () => {
    it('the spent cube and the counters survive a save/load round trip', () => {
      const [game] = lunaGame('-pl14-serialize');
      armCube(game, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C14_POINT_LUNA);
      expect(restored.automa!.corpStats['lunaBlackCubes']).eq(1);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)).has.length(1);
    });
  });
});
