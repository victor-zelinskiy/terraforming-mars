// Campaign mode — the project carryover selection («Наследие проектов»).
//
// POST /api/campaign/carryover?id=<campaignId>
//   body {playerId: PlayerId, cards: CardName[]}   → CampaignModel (owner view)
//
// AUTH: the bearer token is the OWNER's PlayerId in the SOURCE mission — the
// strongest credential the participant holds (they just played that game).
// The server re-validates every card against the recorded terminal hand;
// duplicates, >2, forged names and other players' cards are rejected.
// Idempotent: re-submitting the same selection is a no-op; the selection is
// revisable until the next mission launch consumes it.

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {CardName} from '../../common/cards/CardName';
import {isCampaignId, isPlayerId} from '../../common/Types';
import {CampaignManager} from '../campaign/CampaignManager';
import {readRequestBody} from './ApiCampaign';

export class ApiCampaignCarryover extends Handler {
  public static readonly INSTANCE = new ApiCampaignCarryover();

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
      const parsed = JSON.parse(body) as {playerId?: string, cards?: Array<CardName>};
      if (typeof parsed.playerId !== 'string' || !isPlayerId(parsed.playerId)) {
        responses.badRequest(req, res, 'invalid player id');
        return;
      }
      if (!Array.isArray(parsed.cards) || parsed.cards.some((c) => typeof c !== 'string')) {
        responses.badRequest(req, res, 'invalid cards');
        return;
      }
      const manager = CampaignManager.getInstance();
      const campaign = await manager.submitCarryover(id, parsed.playerId, parsed.cards);
      // The response is the OWNER's view: resolve the viewer by their seat.
      const seatEntry = campaign.carryover !== undefined ?
        Object.entries(campaign.missions[campaign.carryover.sourceSlot].playerIds ?? {})
          .find(([, pid]) => pid === parsed.playerId) : undefined;
      const seatIndex = seatEntry !== undefined ? Number(seatEntry[0]) : undefined;
      const viewerName = seatIndex !== undefined ? campaign.seats[seatIndex]?.name : undefined;
      responses.writeJson(res, ctx, manager.getModel(campaign, viewerName));
    } catch (err) {
      responses.badRequest(req, res, err instanceof Error ? err.message : 'invalid request');
    }
  }
}
