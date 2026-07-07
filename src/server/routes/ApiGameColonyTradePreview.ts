import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {buildColonyTradePreview} from '../colonies/colonyTradePreview';

/**
 * Bounded READ-ONLY bridge for the colony-trade confirm surfaces (desktop
 * modal + console composer): the server-authoritative
 * {@link import('../../common/models/ColonyTradePreviewModel').ColonyTradePreviewModel}
 * for ONE colony from the trading player's perspective — track advance,
 * reward position, the M€ payment prompt, and every follow-up prompt (card
 * targets pre-collectable) in live order. Mirrors `ApiGameDeltaPreview`.
 *
 * `id` MUST be the trading player's own id — the preview embeds that player's
 * card-target candidates (their own tableau; no other player's private data).
 */
export class ApiGameColonyTradePreview extends Handler {
  public static readonly INSTANCE = new ApiGameColonyTradePreview();
  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (!id) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isPlayerId(id)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }
    const colonyName = ctx.url.searchParams.get('colony');
    if (colonyName === null || colonyName === '') {
      responses.badRequest(req, res, 'missing colony parameter');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res, 'game not found');
      return;
    }
    const player = game.players.find((p) => p.id === id);
    if (player === undefined) {
      responses.notFound(req, res, 'player not found');
      return;
    }
    const colony = game.colonies.find((c) => c.name === colonyName);
    if (colony === undefined) {
      responses.notFound(req, res, 'colony not found');
      return;
    }
    responses.writeJson(res, ctx, buildColonyTradePreview(player, colony));
  }
}
