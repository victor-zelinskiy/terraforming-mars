import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {GameOptions} from '../../src/server/game/GameOptions';
import {DifficultyLevel} from '../../src/common/automa/AutomaTypes';
import {TestPlayer} from '../TestPlayer';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {marsBotOf} from '../../src/server/automa/AutomaSetup';

export type AutomaTestOptions = Partial<GameOptions> & {
  difficulty?: DifficultyLevel;
  /** Keep the human's SelectInitialCards prompt (default: popped, like testGame). */
  keepInitialCardSelection?: boolean;
};

/**
 * Creates a solo-vs-MarsBot game for testing: one human (TestPlayer, blue) +
 * the bot the engine seats itself. Returns [game, human, bot].
 */
export function testAutomaGame(customOptions?: AutomaTestOptions, idSuffix = ''): [IGame, TestPlayer, IPlayer] {
  const {difficulty, keepInitialCardSelection, ...gameOptions} = customOptions ?? {};
  const human = TestPlayer.BLUE.newPlayer({name: 'player1', idSuffix});
  const game = Game.newInstance(`game-id${idSuffix}`, [human], human, `spectator-id${idSuffix}`, {
    automa: {difficulty: difficulty ?? 'normal'},
    ...gameOptions,
  });
  if (keepInitialCardSelection !== true) {
    if (human.getWaitingFor() instanceof SelectInitialCards) {
      human.popWaitingFor();
    }
  }
  return [game, human, marsBotOf(game)];
}
