import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {BotTurnScheduler} from '../automa/BotTurnScheduler';

/**
 * MarsBot-turn notification ack.
 *
 *   POST ?id=<participantId>&key=<turnKey>
 *
 * A client reports it has finished presenting a bot-turn notification (the
 * player dismissed it, its TTL expired, or they opened its review). The ack is
 * a SOFT, best-effort signal: the server uses it only to decide whether to
 * extend the bounded idle before the NEXT bot turn (so the player isn't spammed
 * by a rapid chain of bot turns). It never gates the turn on the client — a
 * missing/lost ack is bounded by the scheduler's max delay, and an ack for a
 * turn the scheduler no longer tracks is a harmless no-op. Accepts any
 * participant (a spectator ack is simply ignored — spectators don't pace a
 * turn). The ack does not mutate game state, so no realtime broadcast.
 */
export class ApiBotTurnAck extends Handler {
  public static readonly INSTANCE = new ApiBotTurnAck();

  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (id === null || (!isPlayerId(id) && !isSpectatorId(id))) {
      responses.badRequest(req, res, 'invalid id');
      return;
    }
    const key = ctx.url.searchParams.get('key');
    if (key === null || key === '') {
      responses.badRequest(req, res, 'missing key');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res);
      return;
    }
    BotTurnScheduler.getInstance().ack(game.id, id, key);
    responses.writeJson(res, ctx, {ok: true});
  }
}
