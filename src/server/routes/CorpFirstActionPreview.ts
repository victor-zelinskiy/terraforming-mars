import * as responses from '../server/responses';
import {isPlayerId} from '../../common/Types';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {CardName} from '../../common/cards/CardName';
import {corpFirstActionPreview, previewableFirstActionCorp} from '../models/corpFirstActionPreview';

/**
 * READ-ONLY preview of a corporation's MANDATORY FIRST ACTION, fetched by the
 * console's dedicated first-action confirm modal when the
 * `corporationInitialAction` prompt is live. Returns the action's effect chips
 * + the honest post-confirm follow-up steps (`ActionPreview` — the same model
 * the card-play preview uses). GET-only; NEVER mutates game state.
 *
 * The corporation is resolved from `player.pendingInitialActions` — the SAME
 * list the `corporationInitialAction` OrOptions is built from — so only a corp
 * the player still owes the action for can be previewed; anything else answers
 * `notFound`. It is the player's OWN corporation (the id check authorizes
 * them) and the preview is read-only, so this leaks nothing.
 */
export class CorpFirstActionPreview extends Handler {
  public static readonly INSTANCE = new CorpFirstActionPreview();

  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.url.searchParams.get('id');
    const corpName = ctx.url.searchParams.get('corp');
    if (playerId === null || corpName === null) {
      responses.badRequest(req, res, 'missing id or corp parameter');
      return;
    }
    if (!isPlayerId(playerId)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }
    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      responses.notFound(req, res, 'game not found');
      return;
    }
    try {
      const player = game.getPlayerById(playerId);
      if (!this.isUser(player.user, ctx)) {
        responses.notAuthorized(req, res);
        return;
      }
      const corp = previewableFirstActionCorp(player, corpName as CardName);
      if (corp === undefined) {
        responses.notFound(req, res, 'pending first-action corporation not found');
        return;
      }
      responses.writeJson(res, ctx, corpFirstActionPreview(player, corp));
    } catch (err) {
      console.warn(`unable to build corp first-action preview for ${playerId}`, err);
      responses.notFound(req, res, 'player not found');
    }
  }
}
