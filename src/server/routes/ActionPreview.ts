import * as responses from '../server/responses';
import {isPlayerId} from '../../common/Types';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {CardName} from '../../common/cards/CardName';
import {isIActionCard} from '../cards/ICard';
import {actionPreview} from '../models/actionPreview';

/**
 * READ-ONLY preview of a played action card's activation, fetched by the client
 * when the action confirmation modal opens. Returns the action's branches + the
 * per-branch choice steps so the player makes every choice INSIDE the modal,
 * before the final submit. This handler is GET-only and NEVER mutates game state
 * — `actionPreview()` only reads + builds plain models.
 */
export class ActionPreview extends Handler {
  public static readonly INSTANCE = new ActionPreview();

  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.url.searchParams.get('id');
    const cardName = ctx.url.searchParams.get('card');
    if (playerId === null || cardName === null) {
      responses.badRequest(req, res, 'missing id or card parameter');
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
      const card = player.tableau.get(cardName as CardName);
      if (card === undefined || !isIActionCard(card)) {
        responses.notFound(req, res, 'action card not found');
        return;
      }
      responses.writeJson(res, ctx, actionPreview(player, card));
    } catch (err) {
      console.warn(`unable to build action preview for ${playerId}`, err);
      responses.notFound(req, res, 'player not found');
    }
  }
}
