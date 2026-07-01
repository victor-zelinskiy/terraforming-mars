import {GameLoader} from '@/server/database/GameLoader';
import {isPlayerId, isSpectatorId} from '@/common/Types';
import {SubscriptionResolver} from './RealtimeHub';

/**
 * Production subscription resolver: maps a private participant token to its game
 * using the SAME identity path the REST API uses (GameLoader's participant
 * index). The bearer token IS the authorization — exactly as for `?id=` on
 * every REST route today. Anything that doesn't resolve to a game the token
 * belongs to is rejected (returns undefined).
 *
 * Wired onto the singleton hub from server.ts, so RealtimeHub itself never
 * imports GameLoader (keeps the Phase 3 GameLoader -> invalidate path acyclic).
 */
export const gameLoaderSubscriptionResolver: SubscriptionResolver = async (participantId) => {
  if (!isPlayerId(participantId) && !isSpectatorId(participantId)) {
    return undefined;
  }
  const game = await GameLoader.getInstance().getGame(participantId);
  if (game === undefined) {
    return undefined;
  }
  // Belt-and-braces: confirm the token really belongs to this resolved game.
  if (isPlayerId(participantId)) {
    try {
      game.getPlayerById(participantId);
    } catch {
      return undefined;
    }
  } else if (game.spectatorId !== participantId) {
    return undefined;
  }
  return {gameId: game.id, gameAge: game.gameAge, undoCount: game.undoCount};
};
