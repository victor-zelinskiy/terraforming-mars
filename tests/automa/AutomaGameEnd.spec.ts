import {expect} from 'chai';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {AutomaGameEnd} from '../../src/server/automa/AutomaGameEnd';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {setOxygenLevel} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

function playGenerationToEnd(game: IGame, human: TestPlayer) {
  game.playerIsFinishedWithResearchPhase(human);
  game.automa!.actionDeck = [];
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions();
}

describe('Automa game end', () => {
  it('entering generation 20 is an instant MarsBot win', () => {
    const [game, human] = testAutomaGame();
    game.generation = 19;
    playGenerationToEnd(game, human);
    expect(game.phase).eq('end');
    expect(game.automa!.instantWin).is.true;
    expect(game.gameLog.some((m) => m.message.includes('instantly wins'))).is.true;
  });

  it('with Prelude the instant-loss round is 18', () => {
    const [game, human] = testAutomaGame({preludeExtension: true});
    game.generation = 17;
    if (human.preludeCardsInHand.length > 0) {
      human.preludeCardsInHand = [];
    }
    playGenerationToEnd(game, human);
    expect(game.phase).eq('end');
    expect(game.automa!.instantWin).is.true;
  });

  it('generation 19 (base) plays on normally', () => {
    const [game, human] = testAutomaGame();
    game.generation = 18;
    playGenerationToEnd(game, human);
    expect(game.generation).eq(19);
    expect(game.phase).eq('research');
    expect(game.automa!.instantWin).is.false;
  });

  describe('final greeneries from tracks', () => {
    it('every track whose next space is a greenery action advances and places one', () => {
      const [game, /* human */, bot] = testAutomaGame();
      setOxygenLevel(game, 14); // Game end: oxygen is maxed.
      const tracks = game.automa!.board.tracks;
      tracks[THARSIS_TRACK.BUILDING].position = 7; // Building[8] = greenery.
      tracks[THARSIS_TRACK.BIO].position = 2; // Plant[3] = greenery.
      tracks[THARSIS_TRACK.SCIENCE].position = 5; // Science[6] = greenery.
      tracks[THARSIS_TRACK.SPACE].position = 1; // Space[2] = undefined — not eligible.

      AutomaGameEnd.placeFinalGreeneries(game);

      const greeneries = game.board.spaces.filter((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id);
      expect(greeneries).has.length(3);
      // The trackers genuinely moved — award evaluations see the new positions.
      expect(tracks[THARSIS_TRACK.BUILDING].position).eq(8);
      expect(tracks[THARSIS_TRACK.BIO].position).eq(3);
      expect(tracks[THARSIS_TRACK.SCIENCE].position).eq(6);
      expect(tracks[THARSIS_TRACK.SPACE].position).eq(1);
      // Maxed oxygen: no TR from the final greeneries.
      expect(bot.terraformRating).eq(20);
    });

    it('a regression marker on the next greenery space suppresses that track', () => {
      const [game, /* human */, bot] = testAutomaGame();
      setOxygenLevel(game, 14);
      const track = game.automa!.board.tracks[THARSIS_TRACK.BUILDING];
      track.position = 8; // On the greenery space…
      track.regress(); // …regressed off it: marker on 8, position 7.

      AutomaGameEnd.placeFinalGreeneries(game);
      expect(game.board.spaces.filter((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id)).is.empty;
      expect(track.position).eq(7); // The tracker did not move either.
    });

    it('each final greenery lands inside a live event scope (the unscoped-door tripwire stays quiet)', () => {
      // Field report 2026-09-05: with a human onTilePlaced card in play
      // (Mining Guild), the bot's final greeneries hit Game.addTile's
      // unscoped-door tripwire and the passive payout's chain orphaned —
      // the owner's notification was silently withheld until the 90 s leak
      // release. THROW_STATE_ERRORS promotes that warn to a throw, so this
      // spec fails loudly if the scope is ever dropped again.
      const [game, human, bot] = testAutomaGame();
      setOxygenLevel(game, 14);
      human.playedCards.push(new RoverConstruction());
      game.automa!.board.tracks[THARSIS_TRACK.BIO].position = 2;
      const saved = process.env.THROW_STATE_ERRORS;
      process.env.THROW_STATE_ERRORS = '1';
      try {
        expect(() => AutomaGameEnd.placeFinalGreeneries(game)).to.not.throw();
      } finally {
        if (saved === undefined) {
          delete process.env.THROW_STATE_ERRORS;
        } else {
          process.env.THROW_STATE_ERRORS = saved;
        }
      }
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id)).is.true;
    });

    it('the whole final-greenery phase runs in the bot\'s slot without any prompt', () => {
      const [game, /* human */, bot] = testAutomaGame();
      setOxygenLevel(game, 14);
      game.automa!.board.tracks[THARSIS_TRACK.BIO].position = 2;
      game.takeNextFinalGreeneryAction();
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id)).is.true;
      expect(bot.getWaitingFor()).is.undefined;
      expect(game.phase).eq('end');
    });
  });
});
