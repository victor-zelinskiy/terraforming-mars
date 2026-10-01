import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {buildColonyTradePreview, buildFleetDockPreview} from '../colonies/colonyTradePreview';
import {isFleetDockCard} from '../colonies/FleetDock';
import {MAX_COLONY_TRACK_POSITION} from '../../common/constants';

/**
 * Bounded READ-ONLY bridge for the colony-trade confirm surfaces (desktop
 * modal + console composer): the server-authoritative
 * {@link import('../../common/models/ColonyTradePreviewModel').ColonyTradePreviewModel}
 * for ONE colony from the trading player's perspective — track advance,
 * reward position, the M€ payment prompt, and every follow-up prompt (card
 * targets pre-collectable) in live order. Mirrors `ApiGameDeltaPreview`.
 *
 * `?dock=<card>` asks the same question about a trade whose destination is a
 * fleet-dock CARD of the player's own
 * ({@link import('../../common/models/ColonyTradePreviewModel').FleetDockPreviewModel});
 * `colony` and `dock` are mutually exclusive.
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
    // ONE destination per ask: a colony tile (`colony`) or a fleet-dock card
    // (`dock` — the trade whose fleet goes to a card). Both at once, or
    // neither, is a malformed request.
    const colonyName = ctx.url.searchParams.get('colony') ?? '';
    const dockName = ctx.url.searchParams.get('dock') ?? '';
    if (colonyName === '' && dockName === '') {
      responses.badRequest(req, res, 'missing colony parameter');
      return;
    }
    if (colonyName !== '' && dockName !== '') {
      responses.badRequest(req, res, 'colony and dock are mutually exclusive');
      return;
    }
    // The CHOSEN payment path's own track advance (the Unity action's «advance
    // 1 step first» — `OptionMetadata.tradeOffset`); absent = the default path.
    const offsetRaw = ctx.url.searchParams.get('offset');
    const offset = offsetRaw === null || offsetRaw === '' ? 0 : Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0 || offset > MAX_COLONY_TRACK_POSITION) {
      responses.badRequest(req, res, 'invalid offset parameter');
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
    if (dockName !== '') {
      // The dock is the asking player's OWN played card (only the owner trades
      // with it). A card that is not in their tableau, or is no dock, is an
      // expired / never-valid SUBJECT — the preview family's 204, not an error.
      const card = player.tableau.asArray().find((c) => c.name === dockName);
      if (card === undefined || !isFleetDockCard(card)) {
        responses.noPreview(res, 'no such fleet dock in the tableau');
        return;
      }
      responses.writeJson(res, ctx, buildFleetDockPreview(player, card));
      return;
    }
    const colony = game.colonies.find((c) => c.name === colonyName);
    if (colony === undefined) {
      // NOT IN THE GAME = NOTHING TO PREVIEW, and that is an ordinary state, not
      // an error: an add-a-tile catalog (Aridor's first action, Maria) offers
      // colonies out of `discardedColonies`, which have no track, no cubes and
      // no trade. See `responses.noPreview`.
      responses.noPreview(res, 'colony not in the game');
      return;
    }
    responses.writeJson(res, ctx, buildColonyTradePreview(player, colony, offset));
  }
}
