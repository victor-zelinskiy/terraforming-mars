import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {Color, PLAYER_COLORS} from '../../common/Color';
import {EffectOverlayStat, actionOverlayStats} from '../../common/events/aggregate';

/**
 * Bounded data bridge for the premium "ДЕЙСТВИЯ" overlay's per-action usage summary
 * (the action twin of {@link ApiGameEffectStats}). Returns the WHOLE-GAME aggregated
 * {@link EffectOverlayStat}[] for ONE player's owned cards / corporations, scoped to
 * what their blue-card / corp / CEO ACTIONS accomplished (the root-action category
 * tells action usage apart from on-PLAY gains). NOT the raw stream.
 *
 * `id` is the VIEWER's own id (auth, like every other game route); `color` picks
 * WHOSE actions to aggregate. Action results are OPEN information (resources gained,
 * cards drawn, parameters raised), so an opponent's action stats are fetchable too.
 */
export class ApiGameActionStats extends Handler {
  public static readonly INSTANCE = new ApiGameActionStats();
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
    const stats: ReadonlyArray<EffectOverlayStat> = actionOverlayStats(game.events.events, color as Color);
    responses.writeJson(res, ctx, stats);
  }
}
