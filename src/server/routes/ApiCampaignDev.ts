// Campaign mode — DEV/admin fast-forward (name-gated on ADMIN_NAME, the same
// soft gate as the rollback tool). Fabricates a committed result for the
// campaign's current slot so missions 2–4 and the final scoring are testable
// without playing four full games.
//
// POST /api/campaign/dev?name=admin
//   body {campaignId, placements: number[] /* seats in place order */}

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {CardName} from '../../common/cards/CardName';
import {isCampaignId} from '../../common/Types';
import {isAdminName} from '../../common/utils/adminName';
import {CampaignManager} from '../campaign/CampaignManager';
import {readRequestBody} from './ApiCampaign';

export class ApiCampaignDev extends Handler {
  public static readonly INSTANCE = new ApiCampaignDev();

  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const name = ctx.url.searchParams.get('name') ?? '';
    if (!isAdminName(name)) {
      responses.notAuthorized(req, res);
      return;
    }
    const body = await readRequestBody(req);
    try {
      const parsed = JSON.parse(body) as {campaignId?: string, placements?: Array<number>, lineages?: Record<number, Array<CardName>>, carryover?: Record<number, Array<CardName>>, carryoverPending?: boolean};
      if (typeof parsed.campaignId !== 'string' || !isCampaignId(parsed.campaignId)) {
        responses.badRequest(req, res, 'invalid campaign id');
        return;
      }
      if (!Array.isArray(parsed.placements)) {
        responses.badRequest(req, res, 'invalid placements');
        return;
      }
      const manager = CampaignManager.getInstance();
      const campaign = await manager.devCommit(parsed.campaignId, parsed.placements,
        {lineages: parsed.lineages, carryover: parsed.carryover, carryoverPending: parsed.carryoverPending === true});
      responses.writeJson(res, ctx, manager.getModel(campaign, undefined));
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'invalid request');
    }
  }
}
