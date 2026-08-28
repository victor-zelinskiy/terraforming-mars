import * as responses from '../server/responses';
import {IPlayer} from '../IPlayer';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {InputResponse} from '../../common/inputs/InputResponse';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {runId} from '../utils/server-ids';
import {AppError} from '../server/AppError';
import {statusCode} from '../../common/http/statusCode';
import {InputError} from '../inputs/InputError';
import {isIProjectCard} from '../cards/IProjectCard';
import {AppErrorResponse, INVALID_RUN_ID} from '../../common/app/AppErrorId';
import {replayBatch} from '../inputs/deferredInputBatch';

/**
 * Submits an ORDERED ARRAY of input responses in one request — the mechanism
 * behind the action-preview rework's "single final submit". The action flow is
 * SEQUENTIAL on the server (`player.process` answers one `waitingFor` then
 * advances the deferred queue to the next), so the array is replayed in order:
 *   [ <pick the action card>, <pick the OR branch>, ...<each branch step> ]
 * The confirm modal collected every step up front, so the player sees no
 * follow-up modal spam.
 *
 * The replay itself — including what happens to a response whose prompt has not
 * been asked yet — lives in `inputs/deferredInputBatch.ts`, because the SINGLE
 * input route shares it: a prompt that jumps ahead of the card's own on-play
 * input (Olympus Conference &c.) must not throw the player's pre-collected
 * answer away. This route never mutates beyond what the same responses would do
 * one-at-a-time through `PlayerInput`.
 */

// Historic import site — `reconcileBatchResponse` now lives beside the replay
// it belongs to. Re-exported so the route stays the documented entry point.
export {reconcileBatchResponse} from '../inputs/deferredInputBatch';

export class PlayerInputBatch extends Handler {
  public static readonly INSTANCE = new PlayerInputBatch();

  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.url.searchParams.get('id');
    if (playerId === null) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isPlayerId(playerId)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }
    ctx.ipTracker.addParticipant(playerId, ctx.ip);
    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      responses.notFound(req, res);
      return;
    }
    let player: IPlayer | undefined;
    try {
      player = game.getPlayerById(playerId);
    } catch (err) {
      console.warn(`unable to find player ${playerId}`, err);
    }
    if (player === undefined) {
      responses.notFound(req, res);
      return;
    }
    return this.processBatch(req, res, ctx, player);
  }

  private processBatch(req: Request, res: Response, ctx: Context, player: IPlayer): Promise<void> {
    // Same per-request reset as PlayerInput.processInput.
    for (const card of player.tableau) {
      card.clearWarnings();
      if (isIProjectCard(card)) {
        card.additionalProjectCosts = undefined;
      }
    }
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (data) => {
        body += data.toString();
      });
      req.once('end', () => {
        try {
          const entity = JSON.parse(body);
          validateRunId(entity);
          const inputResponses: ReadonlyArray<InputResponse> = Array.isArray(entity.responses) ? entity.responses : [];
          replayBatch(player, inputResponses);
          responses.writeJson(res, ctx, Server.getPlayerModel(player));
          resolve();
        } catch (e) {
          if (!(e instanceof AppError || e instanceof InputError)) {
            console.warn('Error processing batch input from player', e);
          }
          res.writeHead(statusCode.badRequest, {
            'Content-Type': 'application/json',
          });
          const id = e instanceof AppError ? e.id : undefined;
          const message = e instanceof Error ? e.message : String(e);
          const response: AppErrorResponse = {
            id: id,
            message: message,
          };
          res.write(JSON.stringify(response));
          res.end();
          resolve();
        }
      });
    });
  }
}

function validateRunId(entity: any) {
  if (entity.runId !== undefined && runId !== undefined) {
    if (entity.runId !== runId) {
      throw new AppError(INVALID_RUN_ID, 'The server has restarted. Click OK to refresh this page.');
    }
  }
  delete entity.runId;
}
