import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {Database} from '../database/Database';
import {isGameId} from '../../common/Types';
import {isAdminName} from '../../common/utils/adminName';
import {savesToDelete} from '../models/adminRollback';
import {AdminRollbackResult} from '../../common/models/AdminRollbackModel';
import {CampaignManager} from '../campaign/CampaignManager';

/**
 * POST /api/admin/rollback?id=<gameId>&saveId=<n>&name=<displayName>
 *
 * Rolls a game back to save `saveId`: deletes every persisted save above it and
 * reloads the game there (refreshing the cache + broadcasting a realtime
 * invalidation, so any connected player sees the rolled-back state immediately).
 *
 * The delete count is derived from the persisted save-id set ({@link savesToDelete}),
 * NOT `GameLoader.restoreGameAt` (whose count is off-by-one for an idle game).
 * Name-gated on ADMIN_NAME.
 */
export class ApiAdminRollback extends Handler {
  public static readonly INSTANCE = new ApiAdminRollback();
  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    if (!isAdminName(ctx.url.searchParams.get('name'))) {
      responses.notAuthorized(req, res);
      return;
    }

    const gameId = ctx.url.searchParams.get('id');
    if (gameId === null || !isGameId(gameId)) {
      responses.badRequest(req, res, 'invalid game id');
      return;
    }

    const targetSaveId = Number(ctx.url.searchParams.get('saveId'));
    if (!Number.isInteger(targetSaveId) || targetSaveId < 0) {
      responses.badRequest(req, res, 'invalid saveId');
      return;
    }

    try {
      // Confirm the game exists (and is tracked by the loader cache) before
      // touching the database.
      const before = await ctx.gameLoader.getGame(gameId);
      if (before === undefined) {
        responses.notFound(req, res, 'game not found');
        return;
      }

      const db = Database.getInstance();
      const saveIds = await db.getSaveIds(gameId);
      if (!saveIds.includes(targetSaveId)) {
        responses.badRequest(req, res, 'unknown save id');
        return;
      }

      const deletes = savesToDelete(saveIds, targetSaveId);

      // Campaign guard: rolling a mission back across its END boundary would
      // desync a committed campaign result. Refused once the NEXT mission
      // consumed it; otherwise the commit is revoked so the campaign rewinds
      // with the game (and recommits fresh if the game re-reaches END).
      const campaignMission = before.gameOptions.campaign !== undefined;
      if (campaignMission && deletes > 0) {
        const guard = await CampaignManager.getInstance().rollbackGuard(before);
        if (!guard.allowed) {
          responses.badRequest(req, res, guard.reason ?? 'campaign result already consumed');
          return;
        }
      }

      if (deletes > 0) {
        await db.deleteGameNbrSaves(gameId, deletes);
        if (campaignMission) {
          await CampaignManager.getInstance().revokeMissionResult(gameId, before.gameOptions.campaign?.campaignId);
        }
      }

      // Force a reload from the database (now truncated to the target save),
      // which re-adds the game to the cache and recovers a pending bot turn.
      const game = await ctx.gameLoader.getGame(gameId, /* forceLoad */ true);
      if (game === undefined) {
        responses.internalServerError(req, res, 'reload failed');
        return;
      }
      // Mirror restoreGameAt: bump the observable version + broadcast so any
      // connected player refetches and sees the rolled-back state.
      game.undoCount++;
      ctx.gameLoader.notifyGameStateChanged(game);

      const result: AdminRollbackResult = {
        id: gameId,
        saveId: targetSaveId,
        generation: game.getGeneration(),
        phase: game.phase,
        currentSaveId: game.lastSaveId,
        deletedSaves: deletes,
      };
      responses.writeJson(res, ctx, result);
    } catch (err) {
      responses.internalServerError(req, res, err);
    }
  }
}
