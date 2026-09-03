import * as responses from '../server/responses';
import {Database} from '../database/Database';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {LoadGameFormModel} from '../../common/models/LoadGameFormModel';
import {Request} from '../Request';
import {Response} from '../Response';
import {GameId, isGameId, isPlayerId, isSpectatorId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';

export class LoadGame extends Handler {
  public static readonly INSTANCE = new LoadGame();
  private constructor() {
    super();
  }

  private async getGameId(id: string): Promise<GameId | undefined> {
    if (isGameId(id)) {
      return id;
    }
    if (isPlayerId(id) || isSpectatorId(id)) {
      console.log(`Finding game for player/spectator ${id}`);
      return await Database.getInstance().getGameId(id);
    }
    return undefined;
  }

  public override put(req: Request, res: Response, ctx: Context): Promise<void> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', function(data) {
        body += data.toString();
      });
      req.once('end', async () => {
        try {
          const gameReq: LoadGameFormModel = JSON.parse(body);

          const gameId = await this.getGameId(gameReq.gameId);
          if (gameId === undefined) {
            throw new Error('Invalid game id');
          }
          // This should probably be behind some kind of verification that prevents just
          // anyone from rolling back a large number of steps.
          const rollbackCount = gameReq.rollbackCount;
          if (rollbackCount > 0) {
            // Campaign guard: same contract as ApiAdminRollback — a rollback
            // across a mission's committed END is refused once the next
            // mission consumed the result, and revokes the commit otherwise.
            const current = await ctx.gameLoader.getGame(gameId);
            if (current !== undefined && current.gameOptions.campaign !== undefined) {
              const guard = await CampaignManager.getInstance().rollbackGuard(current);
              if (!guard.allowed) {
                responses.badRequest(req, res, guard.reason ?? 'campaign result already consumed');
                resolve();
                return;
              }
            }
            // Awaited: the reload below reads the state this leaves behind, and on
            // a backend that has to rewrite its current-state file (LocalFilesystem)
            // an unawaited trim lands after the read and the rollback is lost.
            await Database.getInstance().deleteGameNbrSaves(gameId, rollbackCount);
            if (current !== undefined && current.gameOptions.campaign !== undefined) {
              await CampaignManager.getInstance().revokeMissionResult(gameId, current.gameOptions.campaign.campaignId);
            }
          }
          const game = await ctx.gameLoader.getGame(gameId, /* bypassCache */ true);
          if (game === undefined) {
            console.warn(`unable to find ${gameId} in database`);
            responses.notFound(req, res, 'game_id not found');
          } else {
            responses.writeJson(res, ctx, Server.getSimpleGameModel(game));
          }
        } catch (error) {
          responses.internalServerError(req, res, error);
        }
        resolve();
      });
    });
  }
}
