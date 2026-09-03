import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Database} from '../database/Database';
import {BoardName} from '../../common/boards/BoardName';
import {RandomBoardOption} from '../../common/boards/RandomBoardOption';
import {RandomBoardContext, boardOptions as resolveBoardOptions} from '../boards/randomBoard';
import {gameOptionsFromNewGameConfig} from '../game/newGameConfigToOptions';
import {Cloner} from '../database/Cloner';
import {Game} from '../Game';
import {GameOptions} from '../game/GameOptions';
import {Player} from '../Player';
import {Server} from '../models/ServerModel';
import {NewGameConfig} from '../../common/game/NewGameConfig';
import {safeCast, isGameId, isSpectatorId, isPlayerId} from '../../common/Types';
import {generateRandomId} from '../utils/server-ids';
import {IGame} from '../IGame';
import {Request} from '../Request';
import {Response} from '../Response';
import {QuotaConfig, QuotaHandler} from '../server/QuotaHandler';
import {durationToMilliseconds} from '../utils/durations';

function getQuotaConfig(): QuotaConfig {
  const defaultQuota = {limit: 1, perMs: 1}; // Effectively, no limit.
  const val = process.env.GAME_QUOTA;
  try {
    if (val !== undefined) {
      const struct = JSON.parse(val);
      let {limit} = struct;
      const {per} = struct;
      if (limit === undefined) {
        throw new Error('limit is absent');
      }
      limit = Number.parseInt(limit);
      if (isNaN(limit)) {
        throw new Error('limit is invalid');
      }
      if (per === undefined) {
        throw new Error('per is absent');
      }
      const perMs = durationToMilliseconds(per);
      if (isNaN(perMs)) {
        throw new Error('perMillis is invalid');
      }
      return {limit, perMs};
    }
    return defaultQuota;
  } catch (e) {
    console.warn('While initialzing quota:', (e instanceof Error ? e.message : e));
    return defaultQuota;
  }
}

export class ApiCreateGame extends Handler {
  public static readonly INSTANCE = new ApiCreateGame();
  private quotaHandler;

  public constructor(quotaConfig: QuotaConfig = getQuotaConfig()) {
    super();
    this.quotaHandler = new QuotaHandler(quotaConfig);
  }

  // Board-pool resolution lives in `../boards/randomBoard` so the rematch flow
  // can re-roll a random board exactly the way the create form does. This static
  // is kept (delegating) because tests reference it.
  public static boardOptions(board: RandomBoardOption | BoardName, context: RandomBoardContext = {}): Array<BoardName> {
    return resolveBoardOptions(board, context);
  }

  // TODO(kberg): much of this code can be moved outside of handler, and that
  // would be better.
  public override post(req: Request, res: Response, ctx: Context): Promise<void> {
    return new Promise((resolve) => {
      if (this.quotaHandler.measure(ctx) === false) {
        responses.quotaExceeded(req, res);
        resolve();
        return;
      }

      let body = '';
      req.on('data', function(data) {
        body += data.toString();
      });
      req.once('end', async () => {
        try {
          const gameReq = JSON.parse(body) as NewGameConfig;
          const gameId = safeCast(generateRandomId('g'), isGameId);
          const spectatorId = safeCast(generateRandomId('s'), isSpectatorId);
          const players = gameReq.players.map((p) => {
            return new Player(
              p.name,
              p.color,
              p.beginner,
              Number(p.handicap), // For some reason handicap is coming up a string.
              safeCast(generateRandomId('p'), isPlayerId),
            );
          });
          let firstPlayerIdx = 0;
          for (let i = 0; i < gameReq.players.length; i++) {
            if (gameReq.players[i].first === true) {
              firstPlayerIdx = i;
              break;
            }
          }

          const requestedBoard = gameReq.board;
          // A MarsBot game rolls only from the boards the bot has an adaptation
          // for — an unrestricted roll could land on a board the automa
          // validation rejects and 500 the whole creation.
          const boards = ApiCreateGame.boardOptions(requestedBoard, {automa: gameReq.automa !== undefined});
          gameReq.board = boards[Math.floor(Math.random() * boards.length)];

          // The full option mapping lives in newGameConfigToOptions so campaign
          // mission creation derives options through the SAME code path. It
          // never maps `campaign` — a client cannot forge a mission contract.
          const gameOptions: GameOptions = gameOptionsFromNewGameConfig(gameReq, requestedBoard);

          let game: IGame;
          if (gameOptions.clonedGamedId !== undefined && !gameOptions.clonedGamedId.startsWith('#')) {
            const serialized = await Database.getInstance().getGameVersion(gameOptions.clonedGamedId, 0);
            game = Cloner.clone(gameId, players, firstPlayerIdx, serialized);
          } else {
            const seed = Math.random();
            game = Game.newInstance(gameId, players, players[firstPlayerIdx], spectatorId, gameOptions, seed);
          }
          ctx.gameLoader.add(game);
          responses.writeJson(res, ctx, Server.getSimpleGameModel(game));
        } catch (error) {
          responses.internalServerError(req, res, error);
        }
        resolve();
      });
    });
  }
}
