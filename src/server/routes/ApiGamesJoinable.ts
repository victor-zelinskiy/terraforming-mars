import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {JoinableGameStatus, JoinableGameSummary} from '../../common/models/JoinableGameModel';
import {joinableSummaryFromRecord} from '../models/joinableGames';
import {LobbyIndex} from '../models/lobbyIndex';
import {normalizePlayerName} from '../../common/utils/playerName';

/**
 * GET /api/games/joinable?name=<displayName>[&status=active|finished]
 *
 * Lists every game in which a player's normalized name matches the given name,
 * newest-first. Powers the premium main-menu "join games" panel.
 *
 * `status` picks the SLICE (default `active`): `active` = the unfinished games
 * (the join list proper), `finished` = the ARCHIVE the console menu toggles to,
 * whose rows are opened to review the result — the console lands on the settled
 * final scoring, where the count can be replayed. Both slices scan the same
 * ledger, so the console asks for the archive lazily (first toggle) and keeps
 * polling only the active one.
 *
 * No serverId gate: the result is name-scoped and exposes only board-public
 * information (game name, map, enabled expansions, player names + colours) plus
 * the requester's OWN seat link (see {@link joinableSummaryFromRecord}).
 *
 * COST: the scan runs over the LOBBY INDEX (`models/lobbyIndex.ts`), never over
 * freshly deserialized games — a resident game is re-derived for free, a cold
 * one is read once in its serialized form and cached until it changes. That
 * matters beyond CPU: this route is what a LAN guest PROBES (with a timeout),
 * and the old load-every-game scan could outlast that timeout on a real
 * library, which listed the host's games as «none» instead of «slow».
 *
 * PUSH: every change to the index bumps its revision, which the realtime lobby
 * room broadcasts (`RealtimeHub.invalidateLobby`) — so a client re-asks this
 * route when something actually changed instead of polling to find out.
 */
export class ApiGamesJoinable extends Handler {
  public static readonly INSTANCE = new ApiGamesJoinable();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const normalized = normalizePlayerName(ctx.url.searchParams.get('name') ?? '');
    if (normalized.length === 0) {
      responses.writeJson(res, ctx, []);
      return;
    }
    // Anything but the explicit 'finished' means the default (active) slice —
    // an unknown value can never widen what a caller sees.
    const status: JoinableGameStatus = ctx.url.searchParams.get('status') === 'finished' ? 'finished' : 'active';

    const records = await LobbyIndex.getInstance().snapshot(ctx.gameLoader);
    const summaries: Array<JoinableGameSummary> = [];
    for (const record of records) {
      const summary = joinableSummaryFromRecord(record, normalized, status);
      if (summary !== undefined) {
        summaries.push(summary);
      }
    }

    // The index already yields newest-first; sorting again keeps this route's
    // contract true of its own output rather than of someone else's ordering.
    summaries.sort((a, b) => b.createdTimeMs - a.createdTimeMs);
    responses.writeJson(res, ctx, summaries);
  }
}
