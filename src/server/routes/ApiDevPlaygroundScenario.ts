import * as fs from 'fs';
import * as path from 'path';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {SerializedGame} from '../SerializedGame';
import {rollbackAuthorized} from '../models/adminRollback';
import {bootFixtureGame} from './devFixtureBoot';
import {isPlaygroundScenarioName, PlaygroundScenarioBoot} from '../../common/models/PlaygroundScenarioModel';

/**
 * POST /api/dev/playground-scenario?name=<fixture> — a LIVE SCENARIO of the
 * «Полигон» stands: boot one of the ENGINE-GENERATED fixtures
 * (`tests/e2e/fixtures/<name>.json`, written by the fixture generator through
 * the real engine) as a fresh game and hand back the seat to open — so a stand
 * can put the player into a REAL political phase (the winner's placement with
 * its dossier, its cascade, the other seat's payout, the results scene)
 * instead of a picture of one.
 *
 *  - the name is WHITELISTED by shape (`isPlaygroundScenarioName` — a
 *    parliament fixture, nothing path-like), never a path;
 *  - the fixture file lives in the repository's test tree: a build without it
 *    (a packaged app) answers 404 with the reason, and the stand says so;
 *  - the same loopback / ADMIN_NAME gate as the other dev doors;
 *  - the seat to open is the first of the table's GENERATION order — the seat
 *    every fixture arranges as its viewer (the one the e2e boots).
 */
export class ApiDevPlaygroundScenario extends Handler {
  public static readonly INSTANCE = new ApiDevPlaygroundScenario();
  private constructor() {
    super();
  }

  /** Where the engine-generated fixtures live (the repository's e2e tree). */
  public static fixturesDir = path.resolve('tests', 'e2e', 'fixtures');

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    if (!rollbackAuthorized(ctx.ip, ctx.url.searchParams.get('name'))) {
      responses.notAuthorized(req, res);
      return;
    }
    const scenario = ctx.url.searchParams.get('scenario') ?? '';
    if (!isPlaygroundScenarioName(scenario)) {
      responses.badRequest(req, res, 'unknown playground scenario');
      return;
    }
    const file = path.join(ApiDevPlaygroundScenario.fixturesDir, `${scenario}.json`);
    let serialized: SerializedGame;
    try {
      serialized = JSON.parse(await fs.promises.readFile(file, 'utf8')) as SerializedGame;
    } catch {
      responses.notFound(req, res, 'This scenario is not available in this build');
      return;
    }
    try {
      const game = await bootFixtureGame(serialized, ctx.gameLoader);
      const viewer = game.playersInGenerationOrder[0];
      const boot: PlaygroundScenarioBoot = {gameId: game.id, playerId: viewer.id, seats: game.playersInGenerationOrder.map((p) => p.id)};
      responses.writeJson(res, ctx, boot);
    } catch (error) {
      responses.badRequest(req, res, `scenario rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
