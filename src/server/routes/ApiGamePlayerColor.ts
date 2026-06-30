import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {isPlayerId} from '../../common/Types';
import {Color, PLAYER_COLORS} from '../../common/Color';
import {PlayerColorOverrideResult} from '../../common/models/JoinableGameModel';
import {ensurePlayerColorForGame} from '../game/ensurePlayerColor';

/**
 * POST /api/game/player-color?id=<playerId>&color=<color>
 *
 * Reconciles the seat identified by `id` with the cube colour the player chose
 * in their Premium-Main-Menu identity. Possessing the seat's `PlayerId` (the
 * private join link) IS the authorization — the same model as player input.
 *
 * The override target is the seat itself (by id), so there is no name ambiguity
 * here; the joinable-games list already refuses to hand out an id for an
 * ambiguous game. Returns a {@link PlayerColorOverrideResult} (noop / updated /
 * conflict / not-found) — the client renders the premium outcome.
 */
export class ApiGamePlayerColor extends Handler {
  public static readonly INSTANCE = new ApiGamePlayerColor();
  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.url.searchParams.get('id');
    if (playerId === null || !isPlayerId(playerId)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }

    const color = ctx.url.searchParams.get('color') as Color | null;
    if (color === null || !(PLAYER_COLORS as ReadonlyArray<string>).includes(color)) {
      responses.badRequest(req, res, 'invalid color');
      return;
    }

    ctx.ipTracker.addParticipant(playerId, ctx.ip);

    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      const result: PlayerColorOverrideResult = {status: 'not-found', message: 'This game is no longer available.'};
      responses.writeJson(res, ctx, result);
      return;
    }

    const result = ensurePlayerColorForGame(game, playerId, color);

    if (result.status === 'updated') {
      try {
        await ctx.gameLoader.saveGame(game);
      } catch (err) {
        console.error('ApiGamePlayerColor: failed to persist colour change', err);
        const errResult: PlayerColorOverrideResult = {status: 'error', message: 'Could not update the player color.'};
        responses.writeJson(res, ctx, errResult);
        return;
      }
    }

    responses.writeJson(res, ctx, result);
  }
}
