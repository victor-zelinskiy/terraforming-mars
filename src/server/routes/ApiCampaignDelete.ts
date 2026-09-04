// Campaign CASCADE delete — the campaign document AND every mission game it
// verifiably owns.
//
// POST /api/campaign/delete?id=<campaignId>&name=<viewerName> → {campaignId, deletedGames}
//
// Auth model: the campaign family's name-scoped trust (same as abandon/repair)
// — the CREATOR seat (index 0) or the ADMIN_NAME identity; enforced inside
// CampaignManager.deleteCampaign, which also owns idempotency and the
// crash-recoverable tombstone ordering. An authorization failure answers 400
// with the reason, matching the rest of the campaign POST family.

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isCampaignId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';

export class ApiCampaignDelete extends Handler {
  public static readonly INSTANCE = new ApiCampaignDelete();

  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    const name = ctx.url.searchParams.get('name') ?? '';
    if (id === null || !isCampaignId(id)) {
      responses.badRequest(req, res, 'invalid campaign id');
      return;
    }
    try {
      const result = await CampaignManager.getInstance().deleteCampaign(id, name);
      responses.writeJson(res, ctx, {campaignId: id, deletedGames: result.deletedGames});
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'delete failed');
    }
  }
}
