import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {Color, PLAYER_COLORS} from '../../common/Color';
import {DeltaProjectExpansion} from '../delta/DeltaProjectExpansion';
import {DeltaTrackPreviewModel} from '../../common/models/DeltaTrackPreviewModel';

/**
 * Bounded planning bridge for the premium "Гидросеть" (Delta Project) overlay
 * action-zone. Returns the server-authoritative {@link DeltaTrackPreviewModel}
 * for ONE player — current position, available energy, used-this-generation,
 * and every energy-reachable destination with legality + tag breakdown + VP
 * occupancy — so the UI never re-derives the wild-tag / occupancy rules.
 *
 * `id` is the VIEWER's own player/spectator id (auth, like every other game
 * route); `color` picks WHOSE preview. Track positions are open information, so
 * any player's preview is fetchable (no per-player redaction needed).
 */
export class ApiGameDeltaPreview extends Handler {
  public static readonly INSTANCE = new ApiGameDeltaPreview();
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
    const player = game.players.find((p) => p.color === color as Color);
    if (player === undefined) {
      responses.notFound(req, res, 'player not found');
      return;
    }
    const preview: DeltaTrackPreviewModel = DeltaProjectExpansion.getPreview(player);
    responses.writeJson(res, ctx, preview);
  }
}
