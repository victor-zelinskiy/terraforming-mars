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

/**
 * The human players of an automa game, in a STABLE order (generation order).
 * In the official solo mode this is simply [the human], so every consumer
 * runs ONE code path for both modes.
 */
export function humansOf(game: IGame): ReadonlyArray<IPlayer> {
  return game.playersInGenerationOrder.filter((p) => !p.isMarsBot);
}

/**
 * The §12 Q9 victim canon: the candidate with the highest score; ties resolve
 * RANDOMLY among the tied candidates via the game's SEEDED rng (the same
 * source the bot's flips and draft picks use) — fair between players, yet
 * deterministic within a game and replay-safe. A fixed tie order (e.g. "next
 * after the bot") would systematically punish one seat. Undefined for an
 * empty candidate list. Bot-owned — never a prompt.
 */
export function pickVictim<T>(game: IGame, candidates: ReadonlyArray<T>, score: (candidate: T) => number): T | undefined {
  let bestScore = -Infinity;
  let tied: Array<T> = [];
  for (const candidate of candidates) {
    const s = score(candidate);
    if (s > bestScore) {
      bestScore = s;
      tied = [candidate];
    } else if (s === bestScore) {
      tied.push(candidate);
    }
  }
  if (tied.length === 0) {
    return undefined;
  }
  return tied.length === 1 ? tied[0] : tied[game.rng.nextInt(tied.length)];
}
