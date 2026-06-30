import {Color} from '../../common/Color';
import {PlayerId} from '../../common/Types';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {LogMessageDataType} from '../../common/logs/LogMessageDataType';
import {PlayerColorOverrideResult} from '../../common/models/JoinableGameModel';

/**
 * Reconcile a seat's cube colour with the colour the player chose in their
 * Premium-Main-Menu identity. Keyed by the seat's stable `PlayerId` (which the
 * caller already authenticated by loading the game from it), so there is NO
 * name ambiguity at override time — the ambiguity case is handled earlier when
 * the joinable-games list refuses to hand out a join id for a game with two
 * same-named seats.
 *
 * Mutates the game in place and returns the outcome; the CALLER persists on
 * 'updated'. This is intentionally isolated so a future account-id identity can
 * reuse the same migration without touching the matching logic.
 *
 * SAFETY — why a mid-game colour change is sound here. Colours are unique per
 * game, so an old→new rewrite is unambiguous. Three structures persist a colour
 * (verified by auditing every serialized `Color`): the player's own
 * `player.color`, the `scaleBonusClaims` map values, and the `PLAYER` tokens in
 * `game.gameLog`. Everything else (tiles, milestones, awards, colonies, turmoil
 * delegates, passed/done sets, …) references players by `PlayerId`, so it is
 * untouched. We migrate exactly those three so logs / scale-bonus ownership /
 * UI stay consistent — which is what "consistent everywhere" requires.
 */
export function ensurePlayerColorForGame(
  game: IGame,
  playerId: PlayerId,
  desiredColor: Color,
): PlayerColorOverrideResult {
  let player: IPlayer;
  try {
    player = game.getPlayerById(playerId);
  } catch {
    return {status: 'not-found', message: 'This game is no longer available.'};
  }

  const previousColor = player.color;
  if (previousColor === desiredColor) {
    return {status: 'noop', color: desiredColor, previousColor};
  }

  // Player colours must stay unique within a game.
  const conflict = game.players.some((p) => p.id !== player.id && p.color === desiredColor);
  if (conflict) {
    return {
      status: 'conflict',
      color: previousColor,
      previousColor,
      message: 'Color is already used by another player in this game.',
    };
  }

  player.color = desiredColor;
  migrateColorReferences(game, previousColor, desiredColor);

  return {status: 'updated', color: desiredColor, previousColor};
}

/**
 * Rewrite the ONLY two persisted, colour-keyed structures other than the
 * player's own field. Unambiguous because `from` uniquely identified this
 * player throughout the game (colours are unique) and `to` is verified free of
 * conflicts by the caller before this runs.
 */
function migrateColorReferences(game: IGame, from: Color, to: Color): void {
  // 1. Game log — every PLAYER token stores a Color, not a PlayerId.
  for (const message of game.gameLog) {
    for (const datum of message.data) {
      if (datum !== undefined && datum.type === LogMessageDataType.PLAYER && datum.value === from) {
        datum.value = to;
      }
    }
  }

  // 2. Scale-bonus claims: Map<'<scale>-<step>', Color>.
  for (const [key, value] of game.scaleBonusClaims) {
    if (value === from) {
      game.scaleBonusClaims.set(key, to);
    }
  }
}
