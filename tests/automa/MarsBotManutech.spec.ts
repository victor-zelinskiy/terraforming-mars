import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {FAILED_ACTION_MC, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaTurnLog} from '../../src/server/automa/AutomaTurnLog';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** The columns the printed reminder cubes stand above. */
const COLUMNS = [5, 12];

/** A live Manutech game. */
function manutechGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C29_MANUTECH,
  options: Record<string, unknown> = {}): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, ...options}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

/** Park a track one space below `position` so the next advance lands on it. */
function armLanding(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position - 1;
}

function positionOf(game: IGame, trackIndex: number): number {
  return game.automa!.board.tracks[trackIndex].position;
}

describe('MarsBot Manutech (C29)', () => {
  describe('the printed card', () => {
    it('prints a building starting tag, no priority plate and no module condition', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C29_MANUTECH);
      expect(info.original).eq(CardName.MANUTECH);
      expect(info.cardNumber).eq('C29');
      expect(info.startingTags).deep.eq([Tag.BUILDING]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.requiresModules, 'the effect names Venus but does not require it').is.undefined;
      expect(info.requiresAnyModule).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes, 'the black cube is a REMINDER, not a cube on a space').is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('marks COLUMNS, and the reminder names what it reminds of', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C29_MANUTECH);
      expect(info.reminderColumns).deep.eq(COLUMNS);
      expect(info.columnLegend, 'a reminder always names its effect').is.a('string').and.not.empty;
      expect(info.whiteMarkerTracks, 'a COLUMN reminder is not a per-track marker').is.undefined;
    });

    it('its starting tag opens the game one space up the building track — and that is not a marked column', () => {
      const [game] = manutechGame('-mt-start');
      expect(positionOf(game, THARSIS_TRACK.BUILDING)).eq(1);
      expect(game.automa!.corpStats['manutechTriggers'], 'space #1 is not #5 or #12').is.undefined;
    });
  });

  describe('the EFFECT — one more space, and it resolves too', () => {
    it('reaching #5 takes the track one further, and the new space fires', () => {
      const [game] = manutechGame('-mt-five');
      const temperature = game.getTemperature();
      armLanding(game, THARSIS_TRACK.BUILDING, 5); // #5 is +2 TR, #6 raises the temperature.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(positionOf(game, THARSIS_TRACK.BUILDING), 'one space past the marked column').eq(6);
      expect(game.getTemperature(), 'and #6 resolved — «resolve that one as well»').is.greaterThan(temperature);
      expect(stat(game, 'manutechTriggers')).eq(1);
      expect(stat(game, 'manutechSteps')).eq(1);
    });

    it('reaching #12 does the same at the other reminder', () => {
      const [game] = manutechGame('-mt-twelve');
      armLanding(game, THARSIS_TRACK.BUILDING, 12); // #12 places an ocean; #13 is bare.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(positionOf(game, THARSIS_TRACK.BUILDING)).eq(13);
      expect(stat(game, 'manutechTriggers')).eq(1);
    });

    it('an ordinary space is left alone', () => {
      const [game] = manutechGame('-mt-plain');
      armLanding(game, THARSIS_TRACK.BUILDING, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(positionOf(game, THARSIS_TRACK.BUILDING)).eq(3);
      expect(game.automa!.corpStats['manutechTriggers']).is.undefined;
    });

    it('«including Venus» — its own track is no exception', () => {
      const [game] = manutechGame('-mt-venus', MarsBotCorpId.C29_MANUTECH, {venusNextExtension: true});
      const venus = game.getVenusScaleLevel();
      armLanding(game, VENUS_TRACK_INDEX, 5); // Venus #5 raises Venus; #6 is bare.

      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(game.getVenusScaleLevel(), 'the space itself resolved').is.greaterThan(venus);
      expect(positionOf(game, VENUS_TRACK_INDEX), 'and the corporation pushed it one further').eq(6);
      expect(stat(game, 'manutechSteps')).eq(1);
    });

    it('another corporation reaches the same column and nothing happens', () => {
      const [game] = manutechGame('-mt-other', MarsBotCorpId.C01_CREDICOR);
      armLanding(game, THARSIS_TRACK.BUILDING, 5);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(positionOf(game, THARSIS_TRACK.BUILDING)).eq(5);
      expect(game.automa!.corpStats['manutechTriggers']).is.undefined;
    });
  });

  describe('«AFTER resolving the effect» — the printed order', () => {
    it('the space\'s own icon runs FIRST, and the push starts from wherever the marker then is', () => {
      // The event track is where this is visible: #5 is «advance», so the
      // printed icon has already carried the marker to #6 by the time the
      // corporation acts. It then pushes from THERE — to #7 («advance»),
      // which cascades to #8 — not back to #6.
      const [game] = manutechGame('-mt-order');
      armLanding(game, THARSIS_TRACK.EVENT, 5);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EVENT);

      expect(positionOf(game, THARSIS_TRACK.EVENT), 'landed #5 → icon to #6 → push to #7 → its icon to #8').eq(8);
      expect(stat(game, 'manutechTriggers'), 'and the trigger was the LANDING, not where the chain ended').eq(1);
    });

    it('a track already at its end takes the ordinary Failed Action', () => {
      // Venus #12 is that track's LAST space, so its reminder can only ever
      // resolve this way — the shared rule, restated nowhere.
      const [game, , bot] = manutechGame('-mt-maxed', MarsBotCorpId.C29_MANUTECH, {venusNextExtension: true});
      armLanding(game, VENUS_TRACK_INDEX, 12);
      const mc = bot.megaCredits;

      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(positionOf(game, VENUS_TRACK_INDEX)).eq(12);
      expect(bot.megaCredits - mc, 'the Failed Action paid instead').eq(FAILED_ACTION_MC);
      expect(stat(game, 'manutechTriggers'), 'the column was still reached').eq(1);
      expect(stat(game, 'manutechSteps'), 'but no space was taken').eq(0);
    });

    it('a REGRESSED re-advance still triggers, though the space\'s own action stays suppressed', () => {
      // The regression rule silences the SPACE's printed icon, not a
      // corporation clause triggered by the move (the C04 reading) — and the
      // physical tell agrees: a spent cube leaves the mat, this reminder
      // never does.
      const [game] = manutechGame('-mt-regressed');
      armLanding(game, THARSIS_TRACK.BUILDING, 5);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const temperature = game.getTemperature(); // #6 raised it once.
      const track = game.automa!.board.tracks[THARSIS_TRACK.BUILDING];
      track.regress();
      track.regress();

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(track.position, 'pushed to #6 again').eq(6);
      expect(game.getTemperature(), '#6 did NOT fire a second time').eq(temperature);
      expect(stat(game, 'manutechTriggers'), 'but the corporation did').eq(2);
    });
  });

  describe('the turn review', () => {
    it('records the extra advance as the CORPORATION\'s, one level deeper than the tag\'s', () => {
      const [game] = manutechGame('-mt-review');
      AutomaTurnLog.begin(game);
      AutomaTurnLog.setCause(game, {kind: 'tag', index: 0});
      armLanding(game, THARSIS_TRACK.BUILDING, 5);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      const advances = game.automa!.turnRecording!.steps
        .flatMap((step) => step.kind === 'advance' ? [step] : []);
      expect(advances).has.length(2);
      expect(advances[0].from).eq(4);
      expect(advances[0].to).eq(5);
      expect(advances[0].cause, 'the tag put it on the column').deep.eq({kind: 'tag', index: 0});
      expect(advances[0].depth, 'a tag\'s own advance is the root').is.undefined;
      expect(advances[1].from).eq(5);
      expect(advances[1].to).eq(6);
      expect(advances[1].cause, 'the extra space is the corporation\'s').deep.eq({kind: 'corporation'});
      expect(advances[1].depth, 'and it inherits the resolver\'s depth, so the runaway guard keeps counting').eq(1);
      expect(AutomaTurnLog.getCause(game), 'the surrounding cause is restored, never clobbered')
        .deep.eq({kind: 'tag', index: 0});
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game] = manutechGame('-mt-serialize');
      armLanding(game, THARSIS_TRACK.BUILDING, 5);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C29_MANUTECH);
      expect(restored.automa!.corpStats['manutechSteps']).eq(1);
      expect(restored.automa!.board.tracks[THARSIS_TRACK.BUILDING].position).eq(6);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = manutechGame('-mt-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C29_MANUTECH);
    });
  });
});
