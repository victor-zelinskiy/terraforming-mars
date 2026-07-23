import * as responses from '../server/responses';
import {IPlayer} from '../IPlayer';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {InputResponse, isOrOptionsResponse} from '../../common/inputs/InputResponse';
import {PlayerInput} from '../PlayerInput';
import {OrOptions} from '../inputs/OrOptions';
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

/**
 * Reconcile a PRE-COLLECTED batch response with the input ACTUALLY waiting.
 *
 * The action-preview batch is assembled from a preview whose branches model a
 * card's `action()` as an OrOptions (each branch is given a runtime OR index).
 * But a card's `action()` COLLAPSES a multi-branch OrOptions to a BARE input at
 * runtime when only ONE branch is live — e.g. Factorum returns the bare
 * "Spend 3 M€ to draw a building card" SelectOption (not an OrOptions) once the
 * player already has energy. The pre-collected `{type:'or', index, response}`
 * then can't process against the bare input: the batch stops and the bare input
 * surfaces as a REDUNDANT follow-up modal, right after the player confirmed.
 *
 * This reconciles the wrap/no-wrap ambiguity WITHOUT changing any game logic —
 * it only reshapes the pre-collected response to the live input:
 *  - an OR-wrapped response against a NON-OrOptions input → UNWRAP to the inner
 *    response (the server already picked the sole live option; the OR index is
 *    irrelevant, only the inner response matters);
 *  - a bare response against a SINGLE-option OrOptions → WRAP it (index 0).
 * Every OTHER mismatch is a genuine divergence and is left to fail, so the
 * batch's graceful fallback still surfaces the real leftover prompt.
 *
 * Affects BOTH platforms (desktop `submitCardActionBatch` + console composer
 * both post here). Pure + unit-tested (tests/routes/PlayerInputBatch.spec.ts).
 */
export function reconcileBatchResponse(response: InputResponse, input: PlayerInput): InputResponse {
  if (input.type !== 'or' && isOrOptionsResponse(response)) {
    return response.response;
  }
  if (input.type === 'or' && !isOrOptionsResponse(response) && (input as OrOptions).options.length === 1) {
    return {type: 'or', index: 0, response};
  }
  return response;
}

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
          for (let i = 0; i < inputResponses.length; i++) {
            const waitingFor = player.getWaitingFor();
            if (waitingFor === undefined) {
              // The action already fully resolved server-side (e.g. an
              // auto-selected single branch with no further steps). Stop.
              break;
            }
            try {
              // Reshape a pre-collected OR-wrapper to the live input shape when
              // the card's action() collapsed to a bare input (Factorum &c.),
              // so the confirmed step lands instead of popping a redundant modal.
              player.process(reconcileBatchResponse(inputResponses[i], waitingFor));
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
