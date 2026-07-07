import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';

/**
 * The one MarsBot player of an automa game. Throws when called on an ordinary
 * game. Lives in its own tiny module (interface imports only) so deep engine
 * modules (Player, Production, Counter) can reach it without pulling
 * AutomaSetup → Player into their module-initialization chain.
 */
export function marsBotOf(game: IGame): IPlayer {
  const bot = game.players.find((p) => p.isMarsBot);
  if (bot === undefined) {
    throw new Error('This game has no MarsBot player');
  }
  return bot;
}
