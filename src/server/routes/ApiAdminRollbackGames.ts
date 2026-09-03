import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {buildAdminGameSummary, rollbackAuthorized} from '../models/adminRollback';
import {AdminRollbackGameSummary} from '../../common/models/AdminRollbackModel';

/**
 * GET /api/admin/rollback/games?name=<displayName>
 *
 * Lists EVERY known game with its FRESH generation (from the authoritative
 * in-memory instance), newest-created first — the dev-only rollback picker.
 *
 * Gated by {@link rollbackAuthorized}: a LOOPBACK connection (the machine's
 * owner and their local games) or the ADMIN_NAME soft identity (the dev door;
 * the name is not authenticated, matching the fork's name-based identity model
 * — the underlying rollback capability already exists ungated via LOAD_GAME).
 * Like ApiGamesJoinable this scans every game (load-then-map) — fine for a
 * self-hosted fork.
 */
export class ApiAdminRollbackGames extends Handler {
  public static readonly INSTANCE = new ApiAdminRollbackGames();
  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    if (!rollbackAuthorized(ctx.ip, ctx.url.searchParams.get('name'))) {
      responses.notAuthorized(req, res);
      return;
    }

    const ledger = await ctx.gameLoader.getIds();
    if (ledger === undefined) {
      responses.writeJson(res, ctx, []);
      return;
    }

    const summaries: Array<AdminRollbackGameSummary> = [];
    for (const {gameId} of ledger) {
      try {
        const game = await ctx.gameLoader.getGame(gameId);
        if (game !== undefined) {
          summaries.push(buildAdminGameSummary(game));
        }
      } catch (err) {
        console.warn(`ApiAdminRollbackGames: skipping game ${gameId}`, err);
      }
    }

    summaries.sort((a, b) => b.createdTimeMs - a.createdTimeMs);
    responses.writeJson(res, ctx, summaries);
  }
}
