import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {NewGameConfig} from '../../common/game/NewGameConfig';
import {Expansion} from '../../common/cards/GameModule';
import {gameOptionsFromNewGameConfig} from '../game/newGameConfigToOptions';
import {deckCompositionOf} from '../deckComposition';

/** The most seats the creator offers (6 humans, or 4 humans + MarsBot) — a larger body is not a creator's. */
const MAX_HUMANS = 6;

/** A creator config can be read for its decks — the fields `deckCompositionOf` needs are present and sane. */
export function isDeckCompositionRequest(body: unknown): body is NewGameConfig {
  if (body === null || typeof body !== 'object') {
    return false;
  }
  const config = body as Partial<NewGameConfig>;
  return Array.isArray(config.players) && config.players.length >= 1 && config.players.length <= MAX_HUMANS &&
    config.expansions !== null && typeof config.expansions === 'object';
}

/**
 * WHAT THE PARTY'S DECKS WILL HOLD — `PUT /api/deck-composition` (T04 «the deck is
 * visible before launch»). The body is the creator's launch body (`NewGameConfig`, the
 * same `buildCreateGamePayloadFromPremiumState` output `POST /api/creategame` takes);
 * the options are derived by the SAME mapping the launch runs
 * (`gameOptionsFromNewGameConfig`), and a contribution toggles one expansion through it
 * too — so the creator's numbers are the launched game's decks by construction.
 *
 * READ-ONLY and table-free: no game is built, nothing is stored, `ctx.gameLoader` and the
 * database are never touched (guarded). PUT because the body is a document, not a
 * creation; the answer is memoized per canonical options (`deckComposition.ts`).
 */
export class ApiDeckComposition extends Handler {
  public static readonly INSTANCE = new ApiDeckComposition();

  public override put(req: Request, res: Response, ctx: Context): Promise<void> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (data) => {
        body += data.toString();
      });
      req.once('end', () => {
        try {
          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = undefined;
          }
          if (!isDeckCompositionRequest(parsed)) {
            responses.badRequest(req, res, 'not a creator config');
            resolve();
            return;
          }
          const config = parsed;
          const optionsWith = (expansions: Record<Expansion, boolean>) => gameOptionsFromNewGameConfig({...config, expansions}, config.board);
          const model = deckCompositionOf(
            optionsWith(config.expansions),
            {humans: config.players.length, bot: config.automa !== undefined},
            (_options, expansion, on) => optionsWith({...config.expansions, [expansion]: on}),
          );
          responses.writeJson(res, ctx, model);
        } catch (error) {
          responses.internalServerError(req, res, error);
        }
        resolve();
      });
    });
  }
}
