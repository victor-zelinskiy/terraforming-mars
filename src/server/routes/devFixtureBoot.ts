import {Game} from '../Game';
import {IGame} from '../IGame';
import {GameSetup} from '../GameSetup';
import {Cloner} from '../database/Cloner';
import {SerializedGame} from '../SerializedGame';
import {IGameLoader} from '../database/IGameLoader';
import {safeCast, isGameId, isPlayerId, isSpectatorId, PlayerId} from '../../common/Types';
import {generateRandomId} from '../utils/server-ids';
import {toID} from '../../common/utils/utils';

/**
 * BOOT A SERIALIZED FIXTURE as a fresh, live game — the one body behind the
 * dev doors (`/api/dev/load-game` posts a SerializedGame, the playground's
 * live scenarios name an engine-generated fixture).
 *
 *  - ids are REMAPPED (fresh game/player/spectator ids through the Cloner's
 *    structural walk), so one fixture can boot any number of concurrent games;
 *  - the body rides `Game.deserialize` — the SAME path every real save rides,
 *    so a fixture that drifted from the schema fails with the deserializer's
 *    own message;
 *  - the game is registered with the loader, ready for its players' pages.
 *
 * The caller owns the authorization (both doors are loopback / ADMIN_NAME gated).
 */
export async function bootFixtureGame(serialized: SerializedGame, gameLoader: IGameLoader): Promise<IGame> {
  if (typeof serialized.id !== 'string' || !Array.isArray(serialized.players) || serialized.players.length === 0) {
    throw new FixtureShapeError('not a SerializedGame (id/players missing)');
  }
  const oldGameId = serialized.id;
  const oldPlayerIds: Array<PlayerId> = serialized.players.map(toID);
  const newGameId = safeCast(generateRandomId('g'), isGameId);
  const newPlayerIds = oldPlayerIds.map(() => safeCast(generateRandomId('p'), isPlayerId));
  Cloner.replacePlayerIds(serialized, oldPlayerIds, newPlayerIds);
  if (oldPlayerIds.length === 1) {
    // The solo neutral player's id derives from the game id and is not
    // serialized — same special case the Cloner carries.
    Cloner.replacePlayerIds(
      serialized,
      [GameSetup.neutralPlayerFor(oldGameId).id],
      [GameSetup.neutralPlayerFor(newGameId).id]);
  }
  serialized.id = newGameId;
  serialized.spectatorId = safeCast(generateRandomId('s'), isSpectatorId);
  serialized.createdTimeMs = new Date().getTime();
  const game = Game.deserialize(serialized);
  await gameLoader.add(game);
  return game;
}

/** A body that is not a SerializedGame at all (distinct from a deserializer refusal). */
export class FixtureShapeError extends Error {}
