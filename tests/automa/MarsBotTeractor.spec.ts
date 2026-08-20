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

const SETUP_MC = 25;
const REWARD = 2;

/** A live Teractor game with the corporation seated (setup already run). */
function teractorGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C09_TERACTOR): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park a track at `position` so the next advance steps off it. */
function parkTrack(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Teractor (C09)', () => {
  describe('the printed card', () => {
    it('prints an Earth draft priority, no starting tags, and the white tracker', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C09_TERACTOR);
      expect(info.original).eq(CardName.TERACTOR);
      expect(info.cardNumber).eq('C09');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.EARTH]});
      expect(info.whiteMarkerTracks).deep.eq([Tag.EARTH]);
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('hands MarsBot 25 M€ and paints the Earth tracker white', () => {
      const [game, , bot] = teractorGame('-tr-setup');
      // No starting tags, so nothing else could have moved a track or paid it.
      expect(bot.megaCredits).eq(SETUP_MC);
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game)).deep.eq([THARSIS_TRACK.EARTH]);
      expect(stat(game, 'teractorAdvances'), 'the gift is not an advance').eq(0);
    });

    it('another corporation gets neither the money nor the marker', () => {
      const [game, , bot] = teractorGame('-tr-other', MarsBotCorpId.C01_CREDICOR);
      expect(bot.megaCredits).eq(0);
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game)).is.empty;
    });
  });

  describe('the EFFECT — 2 M€ per Earth-track advance', () => {
    it('pays for an Earth-track advance', () => {
      const [game, , bot] = teractorGame('-tr-earth');
      const before = bot.megaCredits;
      parkTrack(game, THARSIS_TRACK.EARTH, 2); // #3 prints nothing.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(bot.megaCredits).eq(before + REWARD);
      expect(stat(game, 'teractorAdvances')).eq(1);
      expect(stat(game, 'teractorMc')).eq(REWARD);
    });

    it('pays for an EARTH TAG resolved in an ordinary bot turn', () => {
      const [game, , bot] = teractorGame('-tr-tag');
      const before = bot.megaCredits;
      parkTrack(game, THARSIS_TRACK.EARTH, 2);

      AutomaResolver.resolveTag(game, Tag.EARTH);

      expect(bot.megaCredits).eq(before + REWARD);
    });

    it('pays for a CITY tag too — the trigger is the TRACK, not the tag', () => {
      const [game, , bot] = teractorGame('-tr-city');
      const before = bot.megaCredits;
      // On Tharsis the Earth track carries both the Earth and the city tag.
      parkTrack(game, THARSIS_TRACK.EARTH, 2);

      AutomaResolver.resolveTag(game, Tag.CITY);

      expect(bot.megaCredits).eq(before + REWARD);
      expect(stat(game, 'teractorAdvances')).eq(1);
    });

    it('pays for EVERY step of a cascade', () => {
      const [game, , bot] = teractorGame('-tr-cascade');
      const before = bot.megaCredits;
      // Earth #15 prints 'advance' and #16 is blank: one tag, two steps, and
      // nothing else on the way that could also pay the bot.
      parkTrack(game, THARSIS_TRACK.EARTH, 14);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(game.automa!.board.tracks[THARSIS_TRACK.EARTH].position).eq(16);
      expect(stat(game, 'teractorAdvances')).eq(2);
      expect(bot.megaCredits).eq(before + 2 * REWARD);
    });

    it('pays NOTHING for any other track', () => {
      const [game, , bot] = teractorGame('-tr-othertrack');
      const before = bot.megaCredits;
      parkTrack(game, THARSIS_TRACK.SCIENCE, 0);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'teractorAdvances')).eq(0);
    });

    it('pays nothing when the track cannot advance — a maxed track is a Failed Action', () => {
      const [game, , bot] = teractorGame('-tr-maxed');
      const track = game.automa!.board.tracks[THARSIS_TRACK.EARTH];
      parkTrack(game, THARSIS_TRACK.EARTH, track.maxPosition);
      const before = bot.megaCredits;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(bot.megaCredits, 'only the Failed Action compensation').eq(before + 5);
      expect(stat(game, 'teractorAdvances')).eq(0);
    });

    it('another corporation on the Earth track pays nothing', () => {
      const [game, , bot] = teractorGame('-tr-otherscorp', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      parkTrack(game, THARSIS_TRACK.EARTH, 2);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['teractorAdvances']).is.undefined;
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game] = teractorGame('-tr-serialize');
      parkTrack(game, THARSIS_TRACK.EARTH, 2);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);
      const advances = stat(game, 'teractorAdvances');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C09_TERACTOR);
      expect(restored.automa!.corpStats['teractorAdvances']).eq(advances);
      // The white tracker is DERIVED from the card, never serialized.
      expect(AutomaCorporations.whiteMarkerTrackIndexes(restored)).deep.eq([THARSIS_TRACK.EARTH]);
    });
  });
});
