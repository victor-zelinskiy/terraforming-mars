import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MARSBOT_MAX_TRACK_POSITION, MARSBOT_SILVER_CUBE_MC, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** A live Cheung Shing Mars game with the corporation seated. */
function cheungGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C13_CHEUNG_SHING_MARS): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the building track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = position - 1;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Cheung Shing Mars (C13)', () => {
  describe('the printed card', () => {
    it('prints a building starting tag, a Building priority and cubes from #4 to the end', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C13_CHEUNG_SHING_MARS);
      expect(info.original).eq(CardName.CHEUNG_SHING_MARS);
      expect(info.cardNumber).eq('C13');
      expect(info.startingTags).deep.eq([Tag.BUILDING]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.BUILDING]});
      const cubes = info.trackCubes ?? [];
      expect(cubes.every((c) => c.cubeType === 'credit' && c.tag === Tag.BUILDING)).is.true;
      // «Every space starting with #4» — 4 … 18, nothing before, nothing after.
      expect(cubes.map((c) => c.position)).deep.eq(
        Array.from({length: MARSBOT_MAX_TRACK_POSITION - 3}, (_, i) => i + 4));
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('seeds one silver cube per building-track space from #4 on', () => {
      const [game] = cheungGame('-cs-setup');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(MARSBOT_MAX_TRACK_POSITION - 3);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.BUILDING && c.cubeType === 'credit')).is.true;
      expect(Math.min(...cubes.map((c) => c.position))).eq(4);
      expect(Math.max(...cubes.map((c) => c.position))).eq(MARSBOT_MAX_TRACK_POSITION);
    });

    it('the starting building tag never reaches a cube — the first three spaces are bare', () => {
      const [game] = cheungGame('-cs-start');
      // Tharsis building: 0 → 1 → 2 is where the printed starting tag lands.
      expect(game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position).is.lessThan(4);
      expect(stat(game, 'cheungCubesHit')).eq(0);
    });

    it('another corporation seeds no cubes', () => {
      const [game] = cheungGame('-cs-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the EFFECT — the cube becomes M€', () => {
    it('pays the silver cube\'s own value', () => {
      const [game, , bot] = cheungGame('-cs-pay');
      const before = bot.megaCredits;
      armCube(game, 4); // Building #4 prints nothing else.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(bot.megaCredits).eq(before + MARSBOT_SILVER_CUBE_MC);
      expect(stat(game, 'cheungCubesHit')).eq(1);
      expect(stat(game, 'cheungMc')).eq(MARSBOT_SILVER_CUBE_MC);
    });

    it('the space\'s printed icon still resolves — the card never says «instead of»', () => {
      const [game, , bot] = cheungGame('-cs-addition');
      const before = bot.terraformRating;
      armCube(game, 5); // Building #5 prints tr2 — and carries a cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(bot.terraformRating, 'the printed TR still landed').eq(before + 2);
      expect(stat(game, 'cheungCubesHit')).eq(1);
    });

    it('every step of a cascade collects its own cube', () => {
      const [game, , bot] = cheungGame('-cs-cascade');
      const before = bot.megaCredits;
      // Building #11 prints 'tag_1' (advance the space track) — the cascade
      // leaves the building track, so exactly two building cubes are on the
      // way: #11 itself and nothing else.
      armCube(game, 11);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(stat(game, 'cheungCubesHit')).eq(1);
      expect(bot.megaCredits).is.at.least(before + MARSBOT_SILVER_CUBE_MC);
    });

    it('a spent cube never pays twice, not even after a regression', () => {
      const [game, , bot] = cheungGame('-cs-once');
      armCube(game, 4);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const after = bot.megaCredits;

      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(stat(game, 'cheungCubesHit'), 'RB-B: a triggered cube never re-arms').eq(1);
      expect(bot.megaCredits).eq(after);
    });

    it('another corporation on the same track collects nothing', () => {
      const [game, , bot] = cheungGame('-cs-othercorp', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      armCube(game, 4);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['cheungCubesHit']).is.undefined;
    });
  });

  describe('state', () => {
    it('the spent cube and the counters survive a save/load round trip', () => {
      const [game] = cheungGame('-cs-serialize');
      armCube(game, 4);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C13_CHEUNG_SHING_MARS);
      expect(restored.automa!.corpStats['cheungMc']).eq(MARSBOT_SILVER_CUBE_MC);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)).has.length(1);
    });
  });
});
