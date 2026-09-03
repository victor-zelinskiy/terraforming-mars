// Campaign mode — durable-idempotent campaign creation.
//
// POST /api/campaign/create   body {key: string, name: string, config: NewGameConfig}
//
// `key` is the client-generated idempotency key: the CampaignId derives from
// it (sha256), so a retry after a lost response / server restart converges on
// the SAME campaign. Unlike game creation, the campaign is PERSISTED before
// the response is written. `name` is the creator's display name — it must
// match seat 0. Shares the create-game quota.

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {NewGameConfig} from '../../common/game/NewGameConfig';
import {normalizePlayerName} from '../../common/utils/playerName';
import {CampaignManager} from '../campaign/CampaignManager';
import {readRequestBody} from './ApiCampaign';

export class ApiCampaignCreate extends Handler {
  public static readonly INSTANCE = new ApiCampaignCreate();

  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const body = await readRequestBody(req);
    try {
      const parsed = JSON.parse(body) as {key?: string, name?: string, config?: NewGameConfig};
      if (typeof parsed.key !== 'string' || parsed.key.length < 8) {
        responses.badRequest(req, res, 'missing idempotency key');
        return;
      }
      if (parsed.config === undefined || !Array.isArray(parsed.config.players)) {
        responses.badRequest(req, res, 'missing campaign config');
        return;
      }
      const creatorName = parsed.name ?? parsed.config.players[0]?.name ?? '';
      // Seat 0 is the creator: the launcher identity must BE the first seat,
      // or the launch capability lands on the wrong participant.
      if (normalizePlayerName(parsed.config.players[0]?.name ?? '') !== normalizePlayerName(creatorName)) {
        responses.badRequest(req, res, 'the creator must occupy the first seat');
        return;
      }
      const manager = CampaignManager.getInstance();
      const campaign = await manager.createCampaign(parsed.key, parsed.config);
      responses.writeJson(res, ctx, manager.getModel(campaign, creatorName));
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'invalid request');
    }
  }
}
