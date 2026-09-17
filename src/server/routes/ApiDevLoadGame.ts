import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Server} from '../models/ServerModel';
import {SerializedGame} from '../SerializedGame';
import {Request} from '../Request';
import {Response} from '../Response';
import {rollbackAuthorized} from '../models/adminRollback';
import {bootFixtureGame, FixtureShapeError} from './devFixtureBoot';

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
 * Architecturally honest by construction (`bootFixtureGame`): the body goes
 * through `Game.deserialize` — the SAME path every real save rides on load,
 * so a fixture that drifted from the schema fails HERE with the
 * deserializer's own error (surfaced in the 400) — and ids are REMAPPED, so
 * one fixture can boot any number of concurrent games without colliding.
 * Gated by the same loopback/ADMIN_NAME door as the rollback tools — a remote
 * client cannot inject states.
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
        let serialized: SerializedGame;
        try {
          serialized = JSON.parse(body) as SerializedGame;
        } catch (error) {
          responses.badRequest(req, res, `fixture rejected: ${error instanceof Error ? error.message : String(error)}`);
          resolve();
          return;
        }
        bootFixtureGame(serialized, ctx.gameLoader).then((game) => {
          responses.writeJson(res, ctx, Server.getSimpleGameModel(game));
        }, (error) => {
          // The deserializer's own message IS the diagnosis (schema drift in a
          // fixture must fail loudly and namefully).
          responses.badRequest(req, res, error instanceof FixtureShapeError ?
            error.message :
            `fixture rejected: ${error instanceof Error ? error.message : String(error)}`);
        }).finally(resolve);
      });
    });
  }
}
