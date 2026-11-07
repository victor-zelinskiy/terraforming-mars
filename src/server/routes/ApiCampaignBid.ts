// Campaign «ТЕНДЕРЫ» — one seat's pick at the interlude's BIDDING.
//
// POST /api/campaign/bid?id=<campaignId>
//   body {playerId: PlayerId, instance: string}   → CampaignModel (owner view)
//
// AUTH: the bearer token is the picker's PlayerId in the SOURCE mission — the
// same credential the carryover takes. The server decides whose turn it is,
// refuses a card that is not on the table, applies the bot's picks that
// follow, and closes the bidding when the last picker has picked. Idempotent
// enough for a retry: a second identical pick after the first landed is
// refused as «not your turn», and the client re-reads the model.

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isCampaignId, isPlayerId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';
import {readRequestBody} from './ApiCampaign';

export class ApiCampaignBid extends Handler {
  public static readonly INSTANCE = new ApiCampaignBid();

  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (id === null || !isCampaignId(id)) {
      responses.badRequest(req, res, 'invalid campaign id');
      return;
    }
    const body = await readRequestBody(req);
    try {
      const parsed = JSON.parse(body) as {playerId?: string, instance?: string};
      if (typeof parsed.playerId !== 'string' || !isPlayerId(parsed.playerId)) {
        responses.badRequest(req, res, 'invalid player id');
        return;
      }
      if (typeof parsed.instance !== 'string' || parsed.instance.length === 0) {
        responses.badRequest(req, res, 'invalid tender instance');
        return;
      }
      const manager = CampaignManager.getInstance();
      const {campaign, viewerName} = await manager.submitBid(id, parsed.playerId, parsed.instance);
      responses.writeJson(res, ctx, manager.getModel(campaign, viewerName));
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'invalid request');
    }
  }
}
