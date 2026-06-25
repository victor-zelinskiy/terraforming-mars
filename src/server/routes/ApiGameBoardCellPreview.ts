import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId, isSpectatorId, isSpaceId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {Color, PLAYER_COLORS} from '../../common/Color';
import {boardCellInfo, boardCellPreview} from '../boards/BoardInformationEngine';
import {BoardPlacementKind} from '../../common/boards/BoardInformationFacts';

const PLACEMENT_KINDS: ReadonlyArray<BoardPlacementKind> = [
  'land', 'ocean', 'greenery', 'city', 'away-from-cities', 'isolated',
  'volcanic', 'upgradeable-ocean', 'upgradeable-ocean-new-holland',
];

/**
 * Bounded read-only bridge for the premium BoardInformation layer. Returns the
 * explainable facts for ONE cell — `BoardCellInfo` (hover, no `kind`) or
 * `BoardPlacementPreview` (active placement, with `kind`). Deterministic; NEVER
 * mutates game state (`BoardInformationEngine` only reads + builds plain models).
 *
 * `id` is the VIEWER's own player/spectator id (auth, like every other game
 * route). `color` picks WHOSE perspective the facts are computed for (the
 * displayed player / the placing player) — defaults to the requesting player.
 * The board is OPEN information, so any player's perspective is fetchable; no
 * per-player redaction is needed.
 */
export class ApiGameBoardCellPreview extends Handler {
  public static readonly INSTANCE = new ApiGameBoardCellPreview();
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
    const spaceId = ctx.url.searchParams.get('space');
    if (spaceId === null || !isSpaceId(spaceId)) {
      responses.badRequest(req, res, 'missing or invalid space parameter');
      return;
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      responses.notFound(req, res, 'game not found');
      return;
    }

    const colorParam = ctx.url.searchParams.get('color');
    let player = (colorParam !== null && (PLAYER_COLORS as ReadonlyArray<string>).includes(colorParam)) ?
      game.players.find((p) => p.color === colorParam as Color) :
      (isPlayerId(id) ? game.players.find((p) => p.id === id) : undefined);
    if (player === undefined) {
      player = game.players[0];
    }
    if (player === undefined) {
      responses.notFound(req, res, 'player not found');
      return;
    }

    let space;
    try {
      space = game.board.getSpaceOrThrow(spaceId);
    } catch {
      responses.notFound(req, res, 'space not found');
      return;
    }

    const kindParam = ctx.url.searchParams.get('kind');
    if (kindParam !== null && PLACEMENT_KINDS.includes(kindParam as BoardPlacementKind)) {
      responses.writeJson(res, ctx, boardCellPreview(player, space, kindParam as BoardPlacementKind));
    } else {
      responses.writeJson(res, ctx, boardCellInfo(player, space));
    }
  }
}
