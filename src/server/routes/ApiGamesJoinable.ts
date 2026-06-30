import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {JoinableGameSummary} from '../../common/models/JoinableGameModel';
import {getJoinableGameSummary} from '../models/joinableGames';
import {normalizePlayerName} from '../../common/utils/playerName';

/**
 * GET /api/games/joinable?name=<displayName>
 *
 * Lists every UNFINISHED game in which a player's normalized name matches the
 * given name, newest-first. Powers the premium main-menu "join games" panel.
 *
 * No serverId gate: the result is name-scoped and exposes only board-public
 * information (game name, map, enabled expansions, player names + colours) plus
 * the requester's OWN seat link (see {@link getJoinableGameSummary}).
 *
 * NOTE on cost: this scans every known game (load-then-filter), mirroring the
 * admin overview. That is fine for a self-hosted fork and is deliberately kept
 * behind this one route so it can later be replaced by an indexed
 * name→game query (or an account-id index) without touching the client.
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

    const ledger = await ctx.gameLoader.getIds();
    if (ledger === undefined) {
      responses.writeJson(res, ctx, []);
      return;
    }

    const summaries: Array<JoinableGameSummary> = [];
    for (const {gameId} of ledger) {
      try {
        const game = await ctx.gameLoader.getGame(gameId);
        if (game === undefined) {
          continue;
        }
        const summary = getJoinableGameSummary(game, normalized);
        if (summary !== undefined) {
          summaries.push(summary);
        }
      } catch (err) {
        console.warn(`ApiGamesJoinable: skipping game ${gameId}`, err);
      }
    }

    summaries.sort((a, b) => b.createdTimeMs - a.createdTimeMs);
    responses.writeJson(res, ctx, summaries);
  }
}
