import * as responses from '../server/responses';
import {IPlayer} from '../IPlayer';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * Acknowledge that the player has "taken" a batch of cards shown in the draw
 * reveal modal, clearing it from the player's transient reveal queue so it
 * does not re-show on the next poll. The cards are ALREADY in the player's
 * hand (the server added them at draw time) — this only controls the modal.
 *
 * Query: ?id=<playerId>&revealId=<n>|all
 *
 * Returns the fresh PlayerViewModel (same shape as PlayerInput) so the client
 * reconciles the now-cleared reveal in the same round-trip.
 */
export class AcknowledgeDraw extends Handler {
  public static readonly INSTANCE = new AcknowledgeDraw();

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

    const revealId = ctx.url.searchParams.get('revealId');
    if (revealId === 'all') {
      player.acknowledgeCardDrawReveals('all');
    } else {
      const id = Number(revealId);
      if (Number.isInteger(id)) {
        player.acknowledgeCardDrawReveals(id);
      }
    }

    // Not persisted to the database — the reveal queue is transient.
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
