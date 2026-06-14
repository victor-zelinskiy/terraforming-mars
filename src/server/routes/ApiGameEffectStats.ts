import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {Color, PLAYER_COLORS} from '../../common/Color';
import {EffectOverlayStat, effectOverlayStats} from '../../common/events/aggregate';

/**
 * Bounded data bridge for the premium "Эффекты" overlay's per-effect summary.
 * Returns the WHOLE-GAME aggregated {@link EffectOverlayStat}[] for ONE player's
 * owned cards / corporations — the lightweight "what did each effect do this
 * game" projection, NOT the raw event stream and NOT endgame analytics.
 *
 * `id` is the VIEWER's own player/spectator id (auth, like every other game
 * route); `color` picks WHOSE effects to aggregate. Like the journal events,
 * the in-scope economy facts (discounts / resource / card-resource / TR / draw /
 * trigger counts) are OPEN information, so an opponent's effect stats are
 * fetchable too — no per-player redaction needed.
 */
export class ApiGameEffectStats extends Handler {
  public static readonly INSTANCE = new ApiGameEffectStats();
  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (!id) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isPlayerId(id) && !isSpectatorId(id)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }
    const color = ctx.url.searchParams.get('color');
    if (color === null || !(PLAYER_COLORS as ReadonlyArray<string>).includes(color)) {
      responses.badRequest(req, res, 'missing or invalid color parameter');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res, 'game not found');
      return;
    }
    const stats: ReadonlyArray<EffectOverlayStat> = effectOverlayStats(game.events.events, color as Color);
    responses.writeJson(res, ctx, stats);
  }
}
