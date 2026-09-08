import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Game} from '../Game';
import {GameSetup} from '../GameSetup';
import {Cloner} from '../database/Cloner';
import {Server} from '../models/ServerModel';
import {SerializedGame} from '../SerializedGame';
import {Request} from '../Request';
import {Response} from '../Response';
import {rollbackAuthorized} from '../models/adminRollback';
import {safeCast, isGameId, isPlayerId, isSpectatorId, PlayerId} from '../../common/Types';
import {generateRandomId} from '../utils/server-ids';
import {toID} from '../../common/utils/utils';

/**
 * POST /api/dev/load-game — boot a game from a SerializedGame FIXTURE.
 *
 * Phase 4 of docs/E2E_ARCHITECTURE_REWORK.md: reaching a state must cost
 * O(state), not O(game). A spec whose subject lives in generation 9 used to
 * PLAY nine generations of UI to get there; this door lets it post a
 * generated fixture (tests/e2e/fixtures/, produced by the real engine and
 * serialized by `game.serialize()`) and open the console already standing in
 * the state.
 *
 * Architecturally honest by construction:
 *  - the body goes through `Game.deserialize` — the SAME path every real
 *    save rides on load, so a fixture that drifted from the schema fails
 *    HERE with the deserializer's own error (surfaced in the 400), never as
 *    a mystery mid-spec;
 *  - ids are REMAPPED (fresh game/player/spectator ids via the Cloner's
 *    structural walk), so one fixture can boot any number of concurrent
 *    games without colliding;
 *  - gated by the same loopback/ADMIN_NAME door as the rollback tools — a
 *    remote client cannot inject states.
 */
export class ApiDevLoadGame extends Handler {
  public static readonly INSTANCE = new ApiDevLoadGame();
  private constructor() {
    super();
  }

  public override post(req: Request, res: Response, ctx: Context): Promise<void> {
    return new Promise((resolve) => {
      if (!rollbackAuthorized(ctx.ip, ctx.url.searchParams.get('name'))) {
        responses.notAuthorized(req, res);
        resolve();
        return;
      }
      let body = '';
      req.on('data', (data) => {
        body += data.toString();
      });
      req.once('end', () => {
        try {
          const serialized = JSON.parse(body) as SerializedGame;
          if (typeof serialized.id !== 'string' || !Array.isArray(serialized.players) || serialized.players.length === 0) {
            responses.badRequest(req, res, 'not a SerializedGame (id/players missing)');
            resolve();
            return;
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
          ctx.gameLoader.add(game);
          responses.writeJson(res, ctx, Server.getSimpleGameModel(game));
        } catch (error) {
          // The deserializer's own message IS the diagnosis (schema drift in a
          // fixture must fail loudly and namefully).
          responses.badRequest(req, res,
            `fixture rejected: ${error instanceof Error ? error.message : String(error)}`);
        }
        resolve();
      });
    });
  }
}
