// Campaign mode — mission launch (creator-only, order-gated, idempotent).
//
// POST /api/campaign/launch?id=<campaignId>&name=<creatorName>
//   → {gameId, yourPlayerId, model}
//
// Idempotent by construction: a double-submit / refresh / second creator
// client converges on the one existing mission game (CampaignManager holds
// the in-process lock; the persisted slot.gameId is the durable half).

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isCampaignId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';

export class ApiCampaignLaunch extends Handler {
  public static readonly INSTANCE = new ApiCampaignLaunch();

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
      const manager = CampaignManager.getInstance();
      const {campaign, gameId, yourPlayerId} = await manager.launchMission(id, name);
      responses.writeJson(res, ctx, {
        gameId,
        yourPlayerId,
        model: manager.getModel(campaign, name),
      });
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'launch failed');
    }
  }
}
