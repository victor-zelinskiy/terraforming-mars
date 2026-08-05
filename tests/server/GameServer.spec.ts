import {expect} from 'chai';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import {AddressInfo} from 'net';
import WebSocket from 'ws';
import {startGameServer, RunningGameServer} from '../../src/server/GameServer';
import {LocalFilesystem} from '../../src/server/database/LocalFilesystem';
import {GameLoader} from '../../src/server/database/GameLoader';
import {clientHello, subscribeGame, parseServerMessage, ServerMessageType} from '../../src/common/realtime/Protocol';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {testGame} from '../TestGame';

/**
 * The game-server LIBRARY (docs/EMBEDDED_SERVER.md §4): the same start()
 * sequence the CLI and the desktop EMBEDDED server share. This is the guard for
 * the server.ts refactor — it boots a real HTTP server on an ephemeral port
 * over a real LocalFilesystem db (the embedded configuration), round-trips the
 * REST surface, receives a realtime invalidation over a real WebSocket, and
 * proves stop() + restartability (the embedded respawn path).
 */
describe('GameServer', () => {
  let tmpDir: string;
  let running: RunningGameServer;

  before(async function() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-gameserver-'));
    LocalFilesystem.quiet = true;
    setTestDatabase(new LocalFilesystem(path.join(tmpDir, 'deep', 'db', 'files')));
    running = await startGameServer({port: 0, host: '127.0.0.1', enableBotScheduler: false, collectDefaultMetrics: false});
  });

  after(async function() {
    await running.stop();
    restoreTestDatabase();
    LocalFilesystem.quiet = false;
  });

  const url = (p: string) => `http://127.0.0.1:${running.port}/${p}`;

  it('boots on an ephemeral port and serves the API', async function() {
    expect(running.port).to.be.greaterThan(0);
    const res = await fetch(url('api/games/joinable?name=nobody'));
    expect(res.status).to.eq(200);
    expect(await res.json()).to.deep.eq([]);
  });

  it('nested LocalFilesystem folders self-create (recursive mkdir)', function() {
    expect(fs.existsSync(path.join(tmpDir, 'deep', 'db', 'files', 'history'))).to.eq(true);
  });

  it('serves a full PlayerViewModel for a live game', async function() {
    const [game, player] = testGame(2, {}, ';gameserver-spec');
    GameLoader.getInstance().add(game);
    const res = await fetch(url(`api/player?id=${player.id}`));
    expect(res.status).to.eq(200);
    const model = await res.json() as {id: string, game: {gameAge: number}, thisPlayer: {color: string}};
    expect(model.id).to.eq(player.id);
    expect(model.thisPlayer.color).to.eq(player.color);
    expect(model.game).to.not.eq(undefined);
  });

  it('realtime gateway: subscribe by participant token, invalidation on save', async function() {
    const [game, player] = testGame(2, {}, ';gameserver-rt');
    GameLoader.getInstance().add(game);

    const ws = new WebSocket(`ws://127.0.0.1:${running.port}/ws`);
    const invalidated = new Promise<{gameAge: number}>((resolve, reject) => {
      // Under mocha's default 2s budget — this names the failure before mocha does.
      const timer = setTimeout(() => reject(new Error('no GAME_STATE_INVALIDATED within 1.8s')), 1800);
      ws.on('message', (raw: Buffer) => {
        const message = parseServerMessage(raw.toString());
        if (message === undefined) {
          return;
        }
        if (message.type === ServerMessageType.HELLO) {
          ws.send(JSON.stringify(subscribeGame(player.id)));
        } else if (message.type === ServerMessageType.SUBSCRIBED) {
          // Subscription confirmed — a save must now broadcast to the room.
          void GameLoader.getInstance().saveGame(game);
        } else if (message.type === ServerMessageType.INVALIDATED) {
          clearTimeout(timer);
          resolve(message as unknown as {gameAge: number});
        }
      });
      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    ws.on('open', () => ws.send(JSON.stringify(clientHello('spec', player.id))));

    try {
      const message = await invalidated;
      expect(message.gameAge).to.be.a('number');
    } finally {
      ws.close();
    }
  });

  it('stop() releases the port; a second start works (embedded respawn path)', async function() {
    const port = running.port;
    await running.stop();
    // The port answers nothing anymore.
    let refused = false;
    try {
      await fetch(`http://127.0.0.1:${port}/api/games/joinable?name=x`, {signal: AbortSignal.timeout(1000)});
    } catch {
      refused = true;
    }
    expect(refused, 'stopped server must refuse connections').to.eq(true);
    // Same process, fresh start — the sessions/metrics once-guards must hold.
    running = await startGameServer({port: 0, host: '127.0.0.1', enableBotScheduler: false, collectDefaultMetrics: false});
    const res = await fetch(url('api/games/joinable?name=nobody'));
    expect(res.status).to.eq(200);
  });

  it('EADDRINUSE retry still gets the realtime gateway (embedded fallback path)', async function() {
    // Occupy a port so the first start fails INSIDE listen() — exactly the
    // embedded main's preferred-port collision (embeddedServerMain.ts).
    const blocker = http.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const busyPort = (blocker.address() as AddressInfo).port;

    let code: string | undefined;
    try {
      await startGameServer({port: busyPort, host: '127.0.0.1', enableBotScheduler: false, collectDefaultMetrics: false});
    } catch (err) {
      code = (err as {code?: string}).code;
    }
    expect(code, 'a busy port must reject with EADDRINUSE').to.eq('EADDRINUSE');

    // The fallback: retry on an ephemeral port. The gateway must live on the
    // server that actually listens — otherwise Node routes the handshake to the
    // request handler and answers 404, and realtime is silently dead.
    const retry = await startGameServer({port: 0, host: '127.0.0.1', enableBotScheduler: false, collectDefaultMetrics: false});
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${retry.port}/ws`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no WebSocket handshake within 1.8s')), 1800);
        ws.on('open', () => {
          clearTimeout(timer);
          resolve();
        });
        ws.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      ws.close();
    } finally {
      // stop() closes the process-wide realtime singleton (detaching EVERY
      // server it holds, `running` included) — so this stays the last test here.
      await retry.stop();
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  }).timeout(10_000); // two full startGameServer sequences (one of them failing)
});
