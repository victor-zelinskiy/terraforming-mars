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

/**
 * Submits an ORDERED ARRAY of input responses in one request — the mechanism
 * behind the action-preview rework's "single final submit". The action flow is
 * SEQUENTIAL on the server (`player.process` answers one `waitingFor` then
 * advances the deferred queue to the next), so the array is replayed in order:
 *   [ <pick the action card>, <pick the OR branch>, ...<each branch step> ]
 * The confirm modal collected every step up front, so the player sees no
 * follow-up modal spam.
 *
 * GRACEFUL FALLBACK: each `player.process` validates server-side and restores
 * its `waitingFor` on failure. If a LATER response doesn't match the live
 * `waitingFor` (state drifted from the preview, or a step we couldn't pre-collect
 * — e.g. board placement / payment), the loop stops and returns the current
 * model; the leftover `waitingFor` renders through the existing client routing
 * (PlacementBanner / modal). The FIRST response failing (the action pick itself)
 * is a real error and is rethrown. This route never mutates beyond what the same
 * responses would do one-at-a-time through `PlayerInput`.
 */
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
      card.warnings.clear();
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
          for (let i = 0; i < inputResponses.length; i++) {
            if (player.getWaitingFor() === undefined) {
              // The action already fully resolved server-side (e.g. an
              // auto-selected single branch with no further steps). Stop.
              break;
            }
            try {
              player.process(inputResponses[i]);
            } catch (e) {
              if (i === 0) {
                throw e; // the action pick itself failed — surface it.
              }
              break; // a later step diverged — leave the leftover prompt for the client.
            }
          }
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
