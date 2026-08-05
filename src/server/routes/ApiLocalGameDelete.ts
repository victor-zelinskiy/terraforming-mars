import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {GameId, isGameId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {IGame} from '../IGame';
import {RealtimeHub} from '../server/realtime/RealtimeHub';

/**
 * Host-as-server (docs/EMBEDDED_SERVER.md): deletion of LOCAL games.
 *
 * POST api/local-game-delete?id=<gameId>  — delete one game
 * POST api/local-game-delete?all=1        — delete EVERY game in the database
 *
 * Authorization is the CONNECTION, not a token: only loopback requests are
 * accepted. The host machine owns its local game files (the same way it owns
 * them on disk); a LAN guest — who legitimately holds a seat token — must NOT
 * be able to erase the host's library, so participant-token auth is deliberately
 * not offered here. On a hosted deployment the route is inert for the public
 * (nobody reaches it over loopback) and admins already have api/game/delete.
 *
 * Every deletion broadcasts a realtime invalidation to the game's room, so a
 * LAN guest sitting INSIDE the game refetches immediately, gets a 404 and sees
 * the game is gone — instead of discovering it on their next poll.
 */
export class ApiLocalGameDelete extends Handler {
  public static readonly INSTANCE = new ApiLocalGameDelete();
  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    if (!isLoopbackIp(ctx.ip)) {
      responses.notAuthorized(req, res);
      return;
    }

    if (ctx.url.searchParams.get('all') === '1') {
      const deleted = await this.deleteAll(ctx);
      responses.writeJson(res, ctx, {deleted});
      return;
    }

    const gameId = ctx.url.searchParams.get('id');
    if (!gameId) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isGameId(gameId)) {
      responses.badRequest(req, res, 'invalid game id');
      return;
    }
    const game = await ctx.gameLoader.getGame(gameId);
    if (game === undefined) {
      responses.notFound(req, res, 'game not found');
      return;
    }
    try {
      await this.deleteAndNotify(ctx, game);
    } catch (err) {
      responses.internalServerError(req, res, err);
      return;
    }
    responses.writeJson(res, ctx, {deleted: [gameId]});
  }

  private async deleteAll(ctx: Context): Promise<Array<GameId>> {
    const deleted: Array<GameId> = [];
    const entries = await ctx.gameLoader.getIds();
    for (const entry of entries) {
      try {
        const game = await ctx.gameLoader.getGame(entry.gameId);
        if (game !== undefined) {
          await this.deleteAndNotify(ctx, game);
        } else {
          // Unloadable (corrupt / mid-migration) — "delete all" still means the
          // files go away.
          await ctx.gameLoader.deleteGame(entry.gameId);
        }
        deleted.push(entry.gameId);
      } catch (err) {
        console.error(`local-delete: failed to delete ${entry.gameId}`, err);
      }
    }
    return deleted;
  }

  private async deleteAndNotify(ctx: Context, game: IGame): Promise<void> {
    // Capture the cursor BEFORE deletion (the loader evicts the instance).
    const invalidation = {
      gameId: game.id,
      // One past the last known age, so every subscriber's cursor reads "newer"
      // and the wake → refetch → 404 chain fires immediately.
      gameAge: game.gameAge + 1,
      undoCount: game.undoCount,
      phase: game.phase,
    };
    await ctx.gameLoader.deleteGame(game.id);
    try {
      RealtimeHub.getInstance().invalidate(invalidation);
    } catch (err) {
      // Best-effort — a broadcast failure must never fail the deletion.
      console.error('local-delete: realtime invalidate failed', err);
    }
  }
}

/**
 * True for a request that arrived over the loopback interface. `ctx.ip` comes
 * from `getIPAddress`: socket addresses are wrapped in `!…!`; a Heroku-style
 * x-forwarded-for value arrives bare (and is never loopback in practice).
 */
export function isLoopbackIp(ip: string): boolean {
  const bare = ip.replace(/^!|!$/g, '').toLowerCase();
  return bare === '::1' || bare.startsWith('127.') || bare.startsWith('::ffff:127.');
}
