import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {GameEvent} from '../../common/events/GameEvent';

/**
 * Bounded data bridge for the premium journal's event-driven children. Returns
 * ONLY the structured {@link GameEvent}s of the REQUESTED generation (sliced
 * exactly like `/api/game/logs`), so the client can render children as
 * source → impact without ever pulling the full game-long event stream.
 *
 * The in-scope event types are public economy facts (resource/production/
 * card-resource/TR/draw/discount/payment/tile/effect-triggered/copied-action),
 * so no per-player redaction is needed — unlike text logs, no GameEvent is
 * reserved-for a single player.
 */
export class ApiGameJournalEvents extends Handler {
  public static readonly INSTANCE = new ApiGameJournalEvents();
  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (!id) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isPlayerId(id) && !isSpectatorId(id)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res, 'game not found');
      return;
    }
    const generation = ctx.url.searchParams.get('generation');
    const events: ReadonlyArray<GameEvent> = generation === null ?
      [] :
      game.events.events.filter((e) => e.generation === Number(generation));
    responses.writeJson(res, ctx, events);
  }
}
