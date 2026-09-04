// «Мои кампании» — the participant-scoped campaign LIST.
//
// GET /api/campaigns?name=<viewerName> → Array<CampaignSummaryModel>
//
// Auth model: the same name-scoped trust as /api/games/joinable — a lobby
// surface. An empty name answers an empty list (200), mirroring the joinable
// route. The summary projection is SAFE by construction (no card identities,
// no finalHands, no PlayerIds) — see common/campaign/CampaignSummary.ts.
//
// Live-turn context («ваш ход» on an active mission) comes from the lobby
// index snapshot — the cheap per-game record, never a Game deserialize.

import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {Color} from '../../common/Color';
import {GameId} from '../../common/Types';
import {normalizePlayerName} from '../../common/utils/playerName';
import {CampaignManager} from '../campaign/CampaignManager';
import {LobbyIndex} from '../models/lobbyIndex';

export class ApiCampaigns extends Handler {
  public static readonly INSTANCE = new ApiCampaigns();

  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const name = ctx.url.searchParams.get('name') ?? '';
    if (normalizePlayerName(name) === '') {
      responses.writeJson(res, ctx, []);
      return;
    }
    let activeColorByGame: Map<GameId, Color> | undefined = undefined;
    try {
      const records = await LobbyIndex.getInstance().snapshot(ctx.gameLoader);
      activeColorByGame = new Map(records.filter((r) => !r.finished).map((r) => [r.id, r.activePlayerColor]));
    } catch (err) {
      // Turn context is an enhancement — the list must answer without it.
      activeColorByGame = undefined;
    }
    const summaries = await CampaignManager.getInstance().listSummaries(name, activeColorByGame);
    responses.writeJson(res, ctx, summaries);
  }
}
