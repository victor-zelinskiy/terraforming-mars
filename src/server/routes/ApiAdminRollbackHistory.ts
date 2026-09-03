import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {Database} from '../database/Database';
import {isGameId} from '../../common/Types';
import {rollbackAuthorized, serializedSaveEntry} from '../models/adminRollback';
import {AdminRollbackHistory, AdminRollbackSave} from '../../common/models/AdminRollbackModel';

/**
 * GET /api/admin/rollback/history?id=<gameId>&name=<displayName>
 *
 * Returns the full save history of one game — one {@link AdminRollbackSave} per
 * persisted save (its generation + phase), ascending by save id. The client
 * derives the generation quick-picks (first save of each generation) and the
 * save slider from this. Gated by {@link rollbackAuthorized} (loopback
 * connection, or the ADMIN_NAME dev door).
 *
 * COST: reads + parses every save version once. That is O(saves) full JSON
 * parses; acceptable for a manually-triggered dev tool on one selected game.
 */
export class ApiAdminRollbackHistory extends Handler {
  public static readonly INSTANCE = new ApiAdminRollbackHistory();
  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    if (!rollbackAuthorized(ctx.ip, ctx.url.searchParams.get('name'))) {
      responses.notAuthorized(req, res);
      return;
    }

    const gameId = ctx.url.searchParams.get('id');
    if (gameId === null || !isGameId(gameId)) {
      responses.badRequest(req, res, 'invalid game id');
      return;
    }

    try {
      const db = Database.getInstance();
      const saveIds = [...await db.getSaveIds(gameId)].sort((a, b) => a - b);
      if (saveIds.length === 0) {
        responses.notFound(req, res, 'game not found');
        return;
      }

      const saves: Array<AdminRollbackSave> = [];
      let name = gameId as string;
      for (const saveId of saveIds) {
        const serialized = await db.getGameVersion(gameId, saveId);
        saves.push(serializedSaveEntry(serialized, saveId));
        // The freshest save carries the current name.
        name = serialized.name ?? name;
      }

      const last = saves[saves.length - 1];
      const history: AdminRollbackHistory = {
        id: gameId,
        name,
        currentSaveId: last.saveId,
        currentGeneration: last.generation,
        saves,
      };
      responses.writeJson(res, ctx, history);
    } catch (err) {
      console.error(err);
      responses.badRequest(req, res, 'could not load game history');
    }
  }
}
