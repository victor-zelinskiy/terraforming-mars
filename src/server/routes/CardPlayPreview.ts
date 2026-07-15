import * as responses from '../server/responses';
import {isPlayerId} from '../../common/Types';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {CardName} from '../../common/cards/CardName';
import {cardPlayPreview, previewableCard} from '../models/cardPlayPreview';

/**
 * READ-ONLY preview of PLAYING a project card, fetched by the client when the
 * "РАЗЫГРАТЬ КАРТУ" modal opens. Returns the card's on-play effects + the
 * interactive choice steps so the player makes every choice INSIDE the modal,
 * before the final batch submit. GET-only; NEVER mutates game state —
 * `cardPlayPreview()` only reads + builds plain models.
 *
 * The card is resolved from `getPlayableCards()` (the player's hand PLUS cards
 * hosted on Self-replicating Robots, filtered by `canPlay`) — NOT the tableau —
 * a play preview is for a card the player can play right now. A card that isn't
 * currently playable returns `notFound`, which correctly gates an illegal preview.
 *
 * Three START-OF-GAME sources resolve too — all played straight from the
 * opening ceremony (no play modal), all previewed by the console's start scene
 * so they carry the same premium on-play reward beat:
 *   - PRELUDES in the player's own prelude hand;
 *   - the CHOSEN but not-yet-played CORPORATION (`pickedCorporationCard` — the
 *     deferred `corporationPlay` window);
 *   - a corporation OFFERED BY THE LIVE PROMPT (Merger's `corporationSelection`
 *     — its dealt corps are local to `bespokePlay`, so the ONLY honest handle
 *     is the prompt the server is showing this player right now).
 * All are the player's OWN cards (the id check above already authorized them),
 * the prompt-sourced path is gated on the explicit `corporationSelection`
 * marker, and the preview is read-only — so this leaks nothing.
 */
export class CardPlayPreview extends Handler {
  public static readonly INSTANCE = new CardPlayPreview();

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
      const card = previewableCard(player, cardName as CardName);
      if (card === undefined) {
        responses.notFound(req, res, 'playable card not found');
        return;
      }
      responses.writeJson(res, ctx, cardPlayPreview(player, card));
    } catch (err) {
      console.warn(`unable to build card play preview for ${playerId}`, err);
      responses.notFound(req, res, 'player not found');
    }
  }
}
