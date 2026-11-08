// Campaign «ТЕНДЕРЫ» — one seat ACTIVATES a legacy-window tender on the
// carryover step into the finale («Расширенное наследие» opens a legacy seat,
// «Продление программы» opens the prelude band).
//
// POST /api/campaign/tender?id=<campaignId>
//   body {playerId: PlayerId, instance: string}   → CampaignModel (owner view)
//
// AUTH: the bearer token is the seat's PlayerId in the SOURCE mission — the
// carryover's own credential. The server judges the window (the interlude
// before the finale, the bidding over, the selection not yet consumed), the
// holding (held, legacy window, a played prelude for the extension) and marks
// it executed at once — irreversible by design: an activation is a decision,
// and the seat's limit reads the executed copies from here on.

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isCampaignId, isPlayerId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';
import {readRequestBody} from './ApiCampaign';

export class ApiCampaignTender extends Handler {
  public static readonly INSTANCE = new ApiCampaignTender();

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
      const {campaign, viewerName} = await manager.executeLegacyTender(id, parsed.playerId, parsed.instance);
      responses.writeJson(res, ctx, manager.getModel(campaign, viewerName));
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'invalid request');
    }
  }
}
