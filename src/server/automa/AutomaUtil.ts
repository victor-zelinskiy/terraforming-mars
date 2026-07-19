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
 * The human players of an automa game in the CANONICAL tie order of the
 * victim-selection rule (docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md §12 Q9):
 * generation order starting from the seat AFTER the bot, wrapping. In the
 * official solo mode this is simply [the human], so every consumer runs ONE
 * code path for both modes.
 */
export function humansInTieOrder(game: IGame): ReadonlyArray<IPlayer> {
  const players = game.playersInGenerationOrder;
  const botIndex = players.findIndex((p) => p.isMarsBot);
  if (botIndex === -1) {
    throw new Error('This game has no MarsBot player');
  }
  const rotated = [...players.slice(botIndex + 1), ...players.slice(0, botIndex)];
  return rotated.filter((p) => !p.isMarsBot);
}

/**
 * The §12 Q9 victim canon: the candidate with the STRICTLY highest score;
 * ties resolve to the earliest candidate in the given order (callers pass
 * `humansInTieOrder` — the next human after the bot wins ties). Undefined for
 * an empty candidate list. Deterministic and bot-owned — never a prompt.
 */
export function pickVictim<T>(candidates: ReadonlyArray<T>, score: (candidate: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const s = score(candidate);
    if (s > bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  return best;
}
