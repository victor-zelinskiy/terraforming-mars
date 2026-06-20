import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {RematchManager} from '../rematch/RematchManager';
import {RematchAction} from '../../common/models/RematchModel';

const ACTIONS: ReadonlyArray<RematchAction> = ['offer', 'accept', 'decline', 'cancel'];

function isRematchAction(s: string | null): s is RematchAction {
  return s !== null && (ACTIONS as ReadonlyArray<string>).includes(s);
}

/**
 * Rematch coordination for a finished game.
 *
 *  GET  ?id=<participantId>                  → the per-viewer RematchModel.
 *  POST ?id=<playerId>&action=<offer|accept|decline|cancel>
 *
 * GET works for any participant (players + spectators) so everyone can poll the
 * shared offer state. POST is players-only (spectators can't vote). The whole
 * state lives in RematchManager — see its doc comment.
 */
export class ApiGameRematch extends Handler {
  public static readonly INSTANCE = new ApiGameRematch();

  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (id === null || (!isPlayerId(id) && !isSpectatorId(id))) {
      responses.badRequest(req, res, 'invalid id');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res);
      return;
    }
    responses.writeJson(res, ctx, RematchManager.getInstance().getModel(game, id));
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (id === null || !isPlayerId(id)) {
      responses.badRequest(req, res, 'only players may act on a rematch');
      return;
    }
    const action = ctx.url.searchParams.get('action');
    if (!isRematchAction(action)) {
      responses.badRequest(req, res, 'invalid action');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res);
      return;
    }
    let color;
    try {
      color = game.getPlayerById(id).color;
    } catch {
      responses.notFound(req, res);
      return;
    }

    const manager = RematchManager.getInstance();
    switch (action) {
    case 'offer':
      await manager.offer(game, color, ctx.gameLoader);
      break;
    case 'accept':
      await manager.accept(game, color, ctx.gameLoader);
      break;
    case 'decline':
      manager.decline(game, color);
      break;
    case 'cancel':
      manager.cancel(game, color);
      break;
    }
    responses.writeJson(res, ctx, manager.getModel(game, id));
  }
}
