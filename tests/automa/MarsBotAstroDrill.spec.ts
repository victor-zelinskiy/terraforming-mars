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

/** A live Astro Drill game with the corporation seated. */
function drillGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C19_ASTRO_DRILL): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the space track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.SPACE].position = position - 1;
}

function at(game: IGame, index: number): number {
  return game.automa!.board.tracks[index].position;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Astro Drill (C19)', () => {
  describe('the printed card', () => {
    it('prints no starting tag, a Space priority and the two cube colours', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C19_ASTRO_DRILL);
      expect(info.original).eq(CardName.ASTRODRILL);
      expect(info.cardNumber).eq('C19');
      expect(info.startingTags, 'the space symbol on the card is the DRAFT PRIORITY').is.empty;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SPACE]});
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      const cubes = info.trackCubes ?? [];
      expect(cubes.every((c) => c.tag === Tag.SPACE), 'every cube sits on the SPACE track').is.true;
      expect(cubes.filter((c) => c.cubeType === 'white').map((c) => c.position)).deep.eq([2, 4, 7, 10, 13]);
      expect(cubes.filter((c) => c.cubeType === 'black').map((c) => c.position)).deep.eq([5, 11, 16]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });

    it('states the effect in EXACTLY the words C14 uses — one rule, one phrasing', () => {
      const drill = marsBotCorpInfo(MarsBotCorpId.C19_ASTRO_DRILL);
      const luna = marsBotCorpInfo(MarsBotCorpId.C14_POINT_LUNA);
      const effectOf = (info: typeof drill) =>
        info.sections.find((s) => s.kind === 'effect')!.lines.map((l) => l.text);
      expect(effectOf(drill)).deep.eq(effectOf(luna));
      expect(drill.cubeLegend).deep.eq(luna.cubeLegend);
    });
  });

  describe('the SETUP box', () => {
    it('seeds eight cubes on the space track and nothing anywhere else', () => {
      const [game] = drillGame('-ad-setup');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(8);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.SPACE)).is.true;
      expect(cubes.filter((c) => c.cubeType === 'white')).has.length(5);
      expect(cubes.filter((c) => c.cubeType === 'black')).has.length(3);
    });

    it('another corporation seeds none', () => {
      const [game] = drillGame('-ad-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the EFFECT', () => {
    it('a WHITE cube advances the least-advanced track', () => {
      const [game] = drillGame('-ad-white');
      const automa = game.automa!;
      automa.board.tracks.forEach((t, i) => {
        t.position = i === THARSIS_TRACK.BIO ? 0 : 6;
      });
      armCube(game, 7); // Space #7 is a white cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(at(game, THARSIS_TRACK.BIO), 'the laggard moved').is.greaterThan(0);
      expect(stat(game, 'astroWhiteCubes')).eq(1);
      expect(stat(game, 'astroBlackCubes')).eq(0);
    });

    it('a BLACK cube advances the SPACE track — the very track it sits on', () => {
      const [game] = drillGame('-ad-black');
      armCube(game, 5); // Space #5 is a black cube; #6 prints a city.
      const before = at(game, THARSIS_TRACK.SPACE);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      // One step onto the cube, then the cube's own push: at least two.
      expect(at(game, THARSIS_TRACK.SPACE)).is.at.least(before + 2);
      expect(stat(game, 'astroBlackCubes')).eq(1);
      expect(stat(game, 'astroWhiteCubes')).eq(0);
    });

    it('a self-push chain terminates — every cube fires at most once', () => {
      const [game] = drillGame('-ad-chain');
      const automa = game.automa!;
      // Make SPACE the least-advanced track too, so a white cube also pushes
      // space: #4 white → space → #5 black → space → #6, and no cube re-arms.
      automa.board.tracks.forEach((t, i) => {
        t.position = i === THARSIS_TRACK.SPACE ? 3 : 12;
      });

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(stat(game, 'astroWhiteCubes')).eq(1);
      expect(stat(game, 'astroBlackCubes')).eq(1);
      expect(AutomaCorporations.cubeModels(game).filter((c) => c.spent)).has.length(2);
    });

    it('the space\'s own printed icon still resolves — no «instead of»', () => {
      const [game, , bot] = drillGame('-ad-addition');
      const tr = bot.terraformRating;
      armCube(game, 16); // Space #16 prints tr4 AND carries a black cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(bot.terraformRating, 'the printed TR still landed').is.at.least(tr + 4);
      expect(stat(game, 'astroBlackCubes')).eq(1);
    });

    it('a bare space between the cubes does nothing', () => {
      const [game] = drillGame('-ad-bare');
      armCube(game, 3); // Space #3 carries no cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(stat(game, 'astroSteps')).eq(0);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = drillGame('-ad-once');
      armCube(game, 2);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);
      const hits = stat(game, 'astroSteps');
      expect(hits).is.greaterThan(0);

      game.automa!.board.tracks[THARSIS_TRACK.SPACE].position = 1;
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(stat(game, 'astroSteps'), 'RB-B: a triggered cube never re-arms').eq(hits);
    });

    it('another corporation on the space track pushes nothing', () => {
      const [game] = drillGame('-ad-othercorp', MarsBotCorpId.C01_CREDICOR);
      armCube(game, 5);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);
      expect(game.automa!.corpStats['astroBlackCubes']).is.undefined;
    });
  });

  describe('state', () => {
    it('the spent cube and the counters survive a save/load round trip', () => {
      const [game] = drillGame('-ad-serialize');
      armCube(game, 2);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C19_ASTRO_DRILL);
      expect(restored.automa!.corpStats['astroWhiteCubes']).eq(1);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)).has.length(1);
    });
  });
});
