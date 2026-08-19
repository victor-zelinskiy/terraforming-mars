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

const REWARD = 2;

/** A live game with Interplanetary Cinematics seated (setup already run). */
function icGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park a track at `position` so the next advance steps off it. */
function parkTrack(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position;
}

describe('MarsBot Interplanetary Cinematics (C04)', () => {
  describe('the printed card', () => {
    it('prints TWO event starting tags — never the human building tag', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS);
      expect(info.original).eq(CardName.INTERPLANETARY_CINEMATICS);
      expect(info.cardNumber).eq('C04');
      expect(info.startingTags).deep.eq([Tag.EVENT, Tag.EVENT]);
      // The card prints no draft priority, no cubes, no bonus card, no resource.
      expect(info.draftPriority).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.resource).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('the SETUP box only paints the building and event TRACKERS white', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS);
      expect(info.whiteMarkerTracks).deep.eq([Tag.BUILDING, Tag.EVENT]);
      const [game] = icGame('-markers');
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game))
        .deep.eq([THARSIS_TRACK.BUILDING, THARSIS_TRACK.EVENT]);
      // A reminder is not a cube: nothing was seeded on any space.
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });

    it('another corporation paints no white trackers', () => {
      const [game] = icGame('-nomarkers', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game)).is.empty;
    });
  });

  describe('«including the starting tags» — the two event tags pay at setup', () => {
    it('pays for every advance the two printed event tags produce', () => {
      const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS}, '-setup');
      const before = bot.megaCredits;
      game.playerIsFinishedWithResearchPhase(human);

      // Tharsis event track: 0 → 1 prints 'advance' (cascading to 2), then the
      // second tag climbs 2 → 3. Three advances, three payments.
      const automa = game.automa!;
      expect(automa.board.tracks[THARSIS_TRACK.EVENT].position).eq(3);
      expect(automa.corpStats['icTrackAdvances']).eq(3);
      expect(automa.corpStats['icMc']).eq(3 * REWARD);
      // At least the corporation's 6 — the third advance also lands on the
      // event track's printed ocean, whose covered bonus icons pay their own.
      expect(bot.megaCredits).is.at.least(before + 3 * REWARD);
    });
  });

  describe('the EFFECT — 2 M€ per building or event advance', () => {
    it('pays for a building-track advance', () => {
      const [game, , bot] = icGame('-building');
      const automa = game.automa!;
      const before = bot.megaCredits;
      const advancesBefore = automa.corpStats['icTrackAdvances'] ?? 0;
      parkTrack(game, THARSIS_TRACK.BUILDING, 0);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(bot.megaCredits).eq(before + REWARD);
      expect(automa.corpStats['icTrackAdvances']).eq(advancesBefore + 1);
    });

    it('pays for a building TAG resolved in an ordinary bot turn', () => {
      const [game, , bot] = icGame('-buildingtag');
      const before = bot.megaCredits;
      parkTrack(game, THARSIS_TRACK.BUILDING, 0);

      AutomaResolver.resolveTag(game, Tag.BUILDING);

      expect(bot.megaCredits).eq(before + REWARD);
    });

    it('pays for EVERY step of a cascade, not once per tag', () => {
      const [game, , bot] = icGame('-cascade');
      const automa = game.automa!;
      const before = bot.megaCredits;
      const advancesBefore = automa.corpStats['icTrackAdvances'] ?? 0;
      // Event #1 prints 'advance': one tag, two advances.
      parkTrack(game, THARSIS_TRACK.EVENT, 0);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EVENT);

      expect(automa.board.tracks[THARSIS_TRACK.EVENT].position).eq(2);
      expect(automa.corpStats['icTrackAdvances']).eq(advancesBefore + 2);
      expect(bot.megaCredits).eq(before + 2 * REWARD);
    });

    it('pays NOTHING for any other track', () => {
      const [game, , bot] = icGame('-othertrack');
      const automa = game.automa!;
      const before = bot.megaCredits;
      const advancesBefore = automa.corpStats['icTrackAdvances'] ?? 0;
      parkTrack(game, THARSIS_TRACK.SCIENCE, 0);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(bot.megaCredits).eq(before);
      expect(automa.corpStats['icTrackAdvances'] ?? 0).eq(advancesBefore);
    });

    it('pays nothing when the track cannot advance — a maxed track is a Failed Action', () => {
      const [game, , bot] = icGame('-maxed');
      const automa = game.automa!;
      const track = automa.board.tracks[THARSIS_TRACK.EVENT];
      const advancesBefore = automa.corpStats['icTrackAdvances'] ?? 0;
      parkTrack(game, THARSIS_TRACK.EVENT, track.maxPosition);
      const before = bot.megaCredits;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EVENT);

      // Only the official Failed Action compensation — no corporation payment.
      expect(bot.megaCredits).eq(before + 5);
      expect(automa.corpStats['icTrackAdvances'] ?? 0).eq(advancesBefore);
    });

    it('pays AGAIN after a regression — the effect is not a spent-once cube', () => {
      const [game, , bot] = icGame('-regress');
      const automa = game.automa!;
      parkTrack(game, THARSIS_TRACK.BUILDING, 0);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const afterFirst = bot.megaCredits;
      const advances = automa.corpStats['icTrackAdvances'] ?? 0;

      automa.board.tracks[THARSIS_TRACK.BUILDING].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(bot.megaCredits).eq(afterFirst + REWARD);
      expect(automa.corpStats['icTrackAdvances']).eq(advances + 1);
    });

    it('another corporation on the same tracks pays nothing', () => {
      const [game, , bot] = icGame('-othercorp', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      parkTrack(game, THARSIS_TRACK.BUILDING, 0);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['icTrackAdvances']).is.undefined;
    });
  });

  describe('presentation + state', () => {
    it('the payment is attributed to the corporation in the log', () => {
      const [game, , bot] = icGame('-log');
      parkTrack(game, THARSIS_TRACK.BUILDING, 0);
      const logBefore = game.gameLog.length;
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const lines = game.gameLog.slice(logBefore).map((l) => l.message);
      expect(lines.some((m) => m.includes('for advancing the building track'))).is.true;
      expect(bot.megaCredits).is.greaterThan(0);
    });

    it('the corp stats survive a save/load round trip', () => {
      const [game] = icGame('-serialize');
      const advances = game.automa!.corpStats['icTrackAdvances'] ?? 0;
      expect(advances).is.greaterThan(0);
      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.corporation).eq(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS);
      expect(restored.automa!.corpStats['icTrackAdvances']).eq(advances);
      // The white trackers are DERIVED from the card, never serialized.
      expect(AutomaCorporations.whiteMarkerTrackIndexes(restored))
        .deep.eq([THARSIS_TRACK.BUILDING, THARSIS_TRACK.EVENT]);
    });
  });
});
