// Campaign mode routes — the campaign model + creator actions.
//
// GET  /api/campaign?id=<campaignId>&name=<viewerName>   → CampaignModel (per-viewer)
// POST /api/campaign?id=<campaignId>&name=<viewerName>   body {action: 'abandon' | 'repair', slot?}
//
// Auth model: the same name-scoped trust as /api/games/joinable — the campaign
// map is a lobby-level surface. Anything PRIVATE (carried card identities) is
// additionally gated to the viewer's own seat by CampaignManager.getModel, and
// the carryover SUBMIT requires the mission PlayerId bearer token instead
// (ApiCampaignCarryover).

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isCampaignId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';

export function readRequestBody(req: Request): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (data) => {
      body += data.toString();
    });
    req.once('end', () => resolve(body));
  });
}

export class ApiCampaign extends Handler {
  public static readonly INSTANCE = new ApiCampaign();

  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    const name = ctx.url.searchParams.get('name') ?? undefined;
    if (id === null || !isCampaignId(id)) {
      responses.badRequest(req, res, 'invalid campaign id');
      return;
    }
    const manager = CampaignManager.getInstance();
    const campaign = await manager.load(id);
    if (campaign === undefined) {
      responses.notFound(req, res, 'campaign not found');
      return;
    }
    responses.writeJson(res, ctx, manager.getModel(campaign, name));
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    const name = ctx.url.searchParams.get('name') ?? '';
    if (id === null || !isCampaignId(id)) {
      responses.badRequest(req, res, 'invalid campaign id');
      return;
    }
    const body = await readRequestBody(req);
    try {
      const parsed = JSON.parse(body) as {action?: string, slot?: number};
      const manager = CampaignManager.getInstance();
      let campaign;
      switch (parsed.action) {
      case 'abandon':
        campaign = await manager.abandon(id, name);
        break;
      case 'repair':
        campaign = await manager.repairSlotBoard(id, name, Number(parsed.slot));
        break;
      default:
        responses.badRequest(req, res, 'unknown action');
        return;
      }
      responses.writeJson(res, ctx, manager.getModel(campaign, name));
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'invalid request');
    }
  }
}
