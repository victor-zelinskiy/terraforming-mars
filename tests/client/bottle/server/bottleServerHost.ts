/*
 * THE BOTTLE'S SERVER SIDE — the REAL game server, in the client runner's own process (FREEZE ZERO · B3, the spike).
 *
 * This file is NOT part of the webpack bundle: the client side of the bottle (`../bottleNode.ts`) loads it with Node's
 * own `require`, through tsx — exactly how the server runner (`mocha --import=tsx`) loads the engine. So the two sides
 * are two module graphs in one process, as they are two processes in the product: the client's `src/common` is the
 * bundle's, the server's is this graph's, and the only thing that crosses is JSON through `request()`.
 *
 * WHAT IS REAL: the `Game`, the routes — a request enters `processRequest` of `src/server/server/requestProcessor.ts`
 * (the router, the CORS door, the handler's own validation, `Server.getPlayerModel`'s serialisation) — and
 * `Game.deserialize` for a fixture (`bootFixtureGame`, the body of `/api/dev/load-game`).
 * WHAT IS NOT: the HTTP socket (a request object that hands its body over, a response that collects), the database
 * (the unit suite's fake of `tests/testing/setup.ts` — nothing is persisted, so UNDO is not served), the WebSocket
 * (`onInvalidate` hands the hub's wake to the bottle instead).
 */
import '../../../testing/setup';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {EventEmitter} from 'events';
import type * as http from 'http';
import {processRequest} from '../../../../src/server/server/requestProcessor';
import {setTestGameLoader} from '../../../testing/setup';
import {IGameLoader} from '../../../../src/server/database/IGameLoader';
import {GameIdLedger} from '../../../../src/server/database/IDatabase';
import {IGame} from '../../../../src/server/IGame';
import {Game} from '../../../../src/server/Game';
import {GameOptions} from '../../../../src/server/game/GameOptions';
import {SerializedGame} from '../../../../src/server/SerializedGame';
import {bootFixtureGame} from '../../../../src/server/routes/devFixtureBoot';
import {GameId, isGameId, PlayerId, SpectatorId} from '../../../../src/common/Types';
import {InputResponse} from '../../../../src/common/inputs/InputResponse';
import {PlayerInputModel} from '../../../../src/common/models/PlayerInputModel';
import {Request} from '../../../../src/server/Request';
import {Response} from '../../../../src/server/Response';
import {testGame} from '../../../TestGame';
import {SeededRandom} from '../../../../src/common/utils/Random';

/** What the client side reads of a booted table — plain data only (nothing of the engine crosses). */
export type BottleTable = {
  gameId: string,
  /** The seats, in player order: the private id a page is opened with, and the colour. */
  seats: Array<{id: string, color: string, name: string}>,
};

export type BottleAnswer = {status: number, headers: Record<string, string>, body: string};

/** The loader the routes read (`GameLoader.getInstance()`): games in memory, every state change told to the bottle. */
class BottleGameLoader implements IGameLoader {
  public readonly games = new Map<GameId, IGame>();
  public readonly invalidations: Array<(gameId: string, gameAge: number) => void> = [];
  add(game: IGame): Promise<void> {
    this.games.set(game.id, game);
    return Promise.resolve();
  }
  getIds(): Promise<Array<GameIdLedger>> {
    return Promise.resolve([...this.games.keys()].map((gameId) => ({gameId, participantIds: []})));
  }
  peek(gameId: GameId): IGame | undefined {
    return this.games.get(gameId);
  }
  getGame(id: GameId | PlayerId | SpectatorId): Promise<IGame | undefined> {
    if (isGameId(id)) {
      return Promise.resolve(this.games.get(id));
    }
    for (const game of this.games.values()) {
      if (game.playersInGenerationOrder.some((player) => player.id === id) || game.spectatorId === id) {
        return Promise.resolve(game);
      }
    }
    return Promise.resolve(undefined);
  }
  restoreGameAt(): Promise<Game> {
    return Promise.reject(new Error('the bottle keeps no saves — undo is not served (the spike)'));
  }
  mark(): void {}
  completeGame(): Promise<void> {
    return Promise.resolve();
  }
  deleteGame(gameId: GameId): Promise<void> {
    this.games.delete(gameId);
    return Promise.resolve();
  }
  saveGame(game: IGame): Promise<void> {
    this.notifyGameStateChanged(game);
    return Promise.resolve();
  }
  maintenance(): Promise<void> {
    return Promise.resolve();
  }
  notifyGameStateChanged(game: IGame): void {
    for (const listener of [...this.invalidations]) {
      listener(game.id, game.gameAge);
    }
  }
}

const loader = new BottleGameLoader();
setTestGameLoader(loader);
// The field recorder's drop box (`/api/field-log`) APPENDS A FILE under `<cwd>/db` — the route's own override sends a
// bottle's posts to the OS temp folder (the route still runs; nothing is written into the repository).
process.env.TM_FIELD_LOG_DIR ??= path.join(os.tmpdir(), 'tm-bottle-field-log');

/** A request whose body is handed over the moment the handler asks for it (a route attaches `data` / `end` after an await). */
class BottleRequest implements Request {
  public headers: http.IncomingHttpHeaders = {host: 'bottle.local'};
  public socket = {address: () => '127.0.0.1'};
  private readonly emitter = new EventEmitter();
  constructor(public method: string, public url: string, private readonly body: string | undefined) {}
  on(type: 'data', cb: (dat: Buffer) => void): void {
    this.emitter.on(type, cb);
  }
  once(type: 'end', cb: () => void): void {
    this.emitter.once(type, cb);
    queueMicrotask(() => {
      if (this.body !== undefined) {
        this.emitter.emit('data', Buffer.from(this.body, 'utf8'));
      }
      this.emitter.emit('end');
    });
  }
}

class BottleResponse {
  public statusCode = 200;
  public readonly headers: Record<string, string> = {};
  public content = '';
  public readonly ended: Promise<void>;
  private finish: () => void = () => {};
  constructor() {
    this.ended = new Promise((resolve) => {
      this.finish = resolve;
    });
  }
  setHeader(key: string, value: string | number | ReadonlyArray<string>): this {
    this.headers[key.toLowerCase()] = String(value);
    return this;
  }
  write(content: string | Buffer): boolean {
    this.content += content.toString();
    return true;
  }
  writeHead(statusCode: number, headers?: unknown): this {
    this.statusCode = statusCode;
    if (headers !== undefined && typeof headers === 'object' && headers !== null) {
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        this.headers[key.toLowerCase()] = String(value);
      }
    }
    return this;
  }
  end(content?: string | Buffer): void {
    if (content !== undefined) {
      this.content += content.toString();
    }
    this.finish();
  }
}

/** ONE REQUEST through the server's own door. `url` is what the page asked for (`api/player?id=…`, with or without the slash). */
export async function request(method: string, url: string, body?: string): Promise<BottleAnswer> {
  const req = new BottleRequest(method.toUpperCase(), url.startsWith('/') ? url : '/' + url, body);
  const res = new BottleResponse();
  processRequest(req, res as unknown as Response);
  await res.ended;
  return {status: res.statusCode, headers: res.headers, body: res.content};
}

function tableOf(game: IGame): BottleTable {
  return {
    gameId: game.id,
    seats: game.players.map((player) => ({id: player.id, color: player.color, name: player.name})),
  };
}

/** A fresh table through the engine's own start (`testGame`): the initial-cards prompt stands unless told otherwise. */
export function bootNewGame(seats: number, options: Partial<GameOptions> & {skipInitialCardSelection?: boolean}, idSuffix: string): BottleTable {
  const [game] = testGame(seats, {skipInitialCardSelection: false, ...options}, idSuffix);
  loader.games.set(game.id, game);
  return tableOf(game);
}

/** An e2e fixture (`tests/e2e/fixtures/<name>.json`) through `Game.deserialize` — the body of `/api/dev/load-game`. */
export async function bootFixture(name: string): Promise<BottleTable> {
  const file = path.resolve(process.cwd(), 'tests/e2e/fixtures', name.endsWith('.json') ? name : name + '.json');
  const serialized = JSON.parse(fs.readFileSync(file, 'utf8')) as SerializedGame;
  const game = await bootFixtureGame(serialized, loader);
  return tableOf(game);
}

export function fixtureNames(): Array<string> {
  return fs.readdirSync(path.resolve(process.cwd(), 'tests/e2e/fixtures'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

/** The hub's wake (what the WebSocket carries in the product): told to the bottle, which decides when the page hears it. */
export function onInvalidate(listener: (gameId: string, gameAge: number) => void): () => void {
  loader.invalidations.push(listener);
  return () => {
    const at = loader.invalidations.indexOf(listener);
    if (at >= 0) {
      loader.invalidations.splice(at, 1);
    }
  };
}

/** THE SERVER'S TRUTH about a seat — read straight off the engine (never through the page). */
export function seatTruth(playerId: string): {waitingFor: string | undefined, promptId: number | undefined, gameAge: number, phase: string, generation: number} {
  for (const game of loader.games.values()) {
    const player = game.players.find((candidate) => candidate.id === playerId);
    if (player !== undefined) {
      const waitingFor = player.getWaitingFor();
      return {
        waitingFor: waitingFor?.type,
        promptId: waitingFor !== undefined ? player.waitingForSerial : undefined,
        gameAge: game.gameAge,
        phase: game.phase,
        generation: game.generation,
      };
    }
  }
  throw new Error(`no seat ${playerId} in the bottle`);
}

/** ANOTHER SEAT'S MOVE, through the same door a page uses (`/player/input`) — the server's own validation runs. */
export async function answerAs(playerId: string, response: InputResponse): Promise<BottleAnswer> {
  const truth = seatTruth(playerId);
  return request('POST', `/player/input?id=${playerId}`, JSON.stringify({promptId: truth.promptId, ...response}));
}

/** The plainest legal answer to a question, read off the MODEL the seat's page would get (never off the engine's objects). */
function plainestAnswer(model: PlayerInputModel): InputResponse {
  switch (model.type) {
  case 'option':
    return {type: 'option'};
  case 'card':
    return {type: 'card', cards: model.cards.slice(0, model.min).map((card) => card.name)};
  case 'initialCards':
    return {type: 'initialCards', responses: model.options.map(plainestAnswer)};
  case 'and':
    return {type: 'and', responses: model.options.map(plainestAnswer)};
  case 'or':
    return {type: 'or', index: 0, response: plainestAnswer(model.options[0])};
  case 'amount':
    return {type: 'amount', amount: model.min};
  case 'space':
    return {type: 'space', spaceId: model.spaces[0]};
  case 'player':
    return {type: 'player', player: model.players[0]};
  default:
    throw new Error(`the bottle has no plain answer for a «${model.type}» question (the spike)`);
  }
}

/**
 * ANOTHER SEAT'S MOVE — the plainest one the server will take: PASS when the seat stands on its action menu (the
 * option the engine itself marks — `warnings: ['pass']`, never a title), otherwise the plainest legal answer to
 * whatever it is asked. Through `/player/input`, like a page. `undefined` when the seat is asked nothing.
 */
export async function otherSeatMoves(playerId: string): Promise<{did: string, answer: BottleAnswer} | undefined> {
  const view = await request('GET', `/api/player?id=${playerId}`);
  const model = (JSON.parse(view.body) as {waitingFor?: PlayerInputModel}).waitingFor;
  if (model === undefined) {
    return undefined;
  }
  if (model.type === 'or') {
    const pass = model.options.findIndex((option) => option.type === 'option' && option.warnings?.includes('pass') === true);
    if (pass >= 0) {
      return {did: 'pass', answer: await answerAs(playerId, {type: 'or', index: pass, response: {type: 'option'}})};
    }
  }
  return {did: model.type, answer: await answerAs(playerId, plainestAnswer(model))};
}

/**
 * A TIMER OF THE SERVER'S OWN MODULE GRAPH (what `BotTurnScheduler` arms — `setTimeout` / `Date.now` read off the
 * global at the call): armed here, on this side; the returned reader says after how many ms OF `Date.now` it fired
 * (`undefined` while it has not).
 */
export function armServerTimer(ms: number): () => number | undefined {
  const armedAt = Date.now();
  let firedAfter: number | undefined;
  setTimeout(() => {
    firedAfter = Date.now() - armedAt;
  }, ms);
  return () => firedAfter;
}

/** Forget every table (between specs). */
export function reset(): void {
  loader.games.clear();
  loader.invalidations.length = 0;
}

/** `Math.random` of the whole process, seeded — ids, shuffles a spec did not seed, the client's cosmetic rolls. */
export function seedProcessRandom(seed: number): () => void {
  const real = Math.random;
  const rng = new SeededRandom(seed);
  Math.random = () => rng.next();
  return () => {
    Math.random = real;
  };
}
