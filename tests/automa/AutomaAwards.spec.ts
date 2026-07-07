import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaMilestonesAwards} from '../../src/server/automa/AutomaMilestonesAwards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {testAutomaGame} from './AutomaTestGame';

function award(game: IGame, name: string) {
  const a = game.awards.find((a) => a.name === name);
  expect(a, `award ${name} in game`).is.not.undefined;
  return a!;
}

function failedActions(game: IGame): number {
  return game.gameLog.filter((m) => m.message.includes('Failed Action')).length;
}

describe('AutomaMAEvaluation — Tharsis awards', () => {
  it('evaluates from the reference card: tracks, not cards', () => {
    const [game] = testAutomaGame();
    const tracks = game.automa!.board.tracks;
    tracks[THARSIS_TRACK.BUILDING].position = 3;
    tracks[THARSIS_TRACK.EVENT].position = 4;
    tracks[THARSIS_TRACK.SCIENCE].position = 6;
    tracks[THARSIS_TRACK.ENERGY].position = 2;
    tracks[THARSIS_TRACK.SPACE].position = 1;

    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Banker'), game)).eq(7); // Building + Event.
    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Scientist'), game)).eq(6);
    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Thermalist'), game)).eq(7); // Energy + 5.
    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Miner'), game)).eq(6); // Space + 5.
    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Landlord'), game)).eq(0); // No tiles yet.
  });

  it('Easy: every award value −5', () => {
    const [game] = testAutomaGame({difficulty: 'easy'});
    game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position = 6;
    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Scientist'), game)).eq(1);
    expect(AutomaMAEvaluation.botAwardScore(award(game, 'Banker'), game)).eq(-5);
  });

  it('AwardScorer consults the automa evaluation for the bot, the ordinary one for the human', () => {
    const [game, human, bot] = testAutomaGame();
    game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 3;
    human.heat = 4;
    const scorer = new AwardScorer(game, award(game, 'Thermalist'));
    expect(scorer.get(bot)).eq(8); // Track 3 + 5.
    expect(scorer.get(human)).eq(4); // Heat + heat production.
  });
});

describe('AutomaMilestonesAwards — Fund Award action', () => {
  it('funds the award it is most ahead in, free of charge', () => {
    const [game, /* human */, bot] = testAutomaGame();
    game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 10; // Thermalist 15 vs 0.
    AutomaMilestonesAwards.fundAwardAction(game);
    expect(game.fundedAwards).has.length(1);
    expect(game.fundedAwards[0].award.name).eq('Thermalist');
    expect(game.fundedAwards[0].player.id).eq(bot.id);
    expect(bot.megaCredits).eq(0); // Free.
  });

  it('ties break leftmost (Thermalist before Miner on the Tharsis row)', () => {
    const [game] = testAutomaGame();
    // Fresh game: Thermalist = Miner = +5 ahead; everything else tied at 0.
    AutomaMilestonesAwards.fundAwardAction(game);
    expect(game.fundedAwards[0].award.name).eq('Thermalist');
  });

  it('not strictly ahead on any award → Failed Action', () => {
    const [game, human, bot] = testAutomaGame();
    human.heat = 10; // Thermalist: human 10 > bot 5.
    human.steel = 10; // Miner: human 10 > bot 5.
    AutomaMilestonesAwards.fundAwardAction(game);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
    expect(game.fundedAwards).is.empty;
  });

  it('three awards already funded → Failed Action', () => {
    const [game, human, bot] = testAutomaGame();
    for (const name of ['Landlord', 'Banker', 'Scientist']) {
      game.fundedAwards.push({award: award(game, name), player: human});
    }
    AutomaMilestonesAwards.fundAwardAction(game);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
    expect(game.fundedAwards).has.length(3);
  });

  it('the endgame award scoring sees the bot through the reference card', () => {
    const [game, human, bot] = testAutomaGame();
    game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position = 5;
    game.fundAward(human, award(game, 'Scientist'));
    // Bot 5 vs human 0 science tags → the bot takes 1st place (5 VP); with two
    // players there is no 2nd place.
    expect(bot.getVictoryPoints().awards).eq(5);
    expect(human.getVictoryPoints().awards).eq(0);
  });
});
