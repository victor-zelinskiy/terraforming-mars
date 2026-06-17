import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId, isSpectatorId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {CardName} from '../../common/cards/CardName';
import {EndgameFact, buildEndgameFacts} from '../../common/events/endgameFacts';
import {isIActionCard} from '../cards/ICard';

/**
 * DEV/DEBUG visibility for the analysis-ready Fact Engine — returns the typed
 * {@link EndgameFact}[] for a game so a developer can SEE, on a real game, which facts
 * were born (and their severity / confidence / metrics / related events) before the
 * endgame analyzer is built on top. Reads the existing event stream (the single source
 * of truth); `cardHasAction` is derived from the game's own played cards so
 * engine-timing ("built but never activated") works. NO private info: facts carry
 * counts + structured numbers, never private card names / hands.
 *
 * Filters (optional query params): `player`, `type`, `confidence`, `tag`, `generation`,
 * `minSeverity` — applied server-side so the debug client stays trivial.
 */
export class ApiGameEndgameFacts extends Handler {
  public static readonly INSTANCE = new ApiGameEndgameFacts();
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

    // Which played cards are activatable actions (for the "built but not activated"
    // engine-timing facts) — derived from the game's own cards, not a parsed name list.
    const actionCards = new Set<CardName>();
    for (const player of game.players) {
      for (const card of player.tableau) {
        if (isIActionCard(card)) {
          actionCards.add(card.name);
        }
      }
    }

    let facts: ReadonlyArray<EndgameFact> = buildEndgameFacts(game.events.events, {
      cardHasAction: (card) => actionCards.has(card),
      finalGeneration: game.generation,
    });

    const params = ctx.url.searchParams;
    const player = params.get('player');
    const type = params.get('type');
    const confidence = params.get('confidence');
    const tag = params.get('tag');
    const generation = params.get('generation');
    const minSeverity = params.get('minSeverity');
    if (player !== null) {
      facts = facts.filter((f) => f.player === player);
    }
    if (type !== null) {
      facts = facts.filter((f) => f.type === type);
    }
    if (confidence !== null) {
      facts = facts.filter((f) => f.confidence === confidence);
    }
    if (tag !== null) {
      facts = facts.filter((f) => f.tags.includes(tag as EndgameFact['tags'][number]));
    }
    if (generation !== null) {
      const g = Number(generation);
      facts = facts.filter((f) => f.generation === g);
    }
    if (minSeverity !== null) {
      const s = Number(minSeverity);
      facts = facts.filter((f) => f.severity >= s);
    }

    responses.writeJson(res, ctx, facts);
  }
}
