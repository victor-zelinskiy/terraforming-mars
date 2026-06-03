import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isGameId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * Permanently deletes a game from the database.
 *
 * Only reachable from the administrative games-overview page (it validates the
 * server id). After this resolves the game no longer appears in the overview
 * and is no longer accessible.
 */
export class ApiGameDelete extends Handler {
  public static readonly INSTANCE = new ApiGameDelete();
  private constructor() {
    super({validateServerId: true});
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const gameId = ctx.url.searchParams.get('id');
    if (!gameId) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isGameId(gameId)) {
      responses.badRequest(req, res, 'invalid game id');
      return;
    }

    try {
      await ctx.gameLoader.deleteGame(gameId);
    } catch (err) {
      responses.internalServerError(req, res, err);
      return;
    }
    responses.writeJson(res, ctx, {gameId});
  }
}
