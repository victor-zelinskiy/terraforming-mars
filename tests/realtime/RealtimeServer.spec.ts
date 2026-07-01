import {expect} from 'chai';
import * as http from 'http';
import {once} from 'events';
import {AddressInfo} from 'net';
import {WebSocket} from 'ws';
import {RealtimeServer, realtimeEnabled} from '../../src/server/server/realtime/RealtimeServer';
import {RealtimeHub, SubscriptionResolver} from '../../src/server/server/realtime/RealtimeHub';
import {GameId} from '../../src/common/Types';
import {
  GameStateInvalidatedMessage,
  ServerErrorMessage,
  ServerMessageType,
  SubscribedMessage,
  clientHello,
  clientPing,
  parseServerMessage,
  resumeGame,
  serializeMessage,
  subscribeGame,
} from '../../src/common/realtime/Protocol';

const G1 = 'g-1' as GameId;
const resolver: SubscriptionResolver = async (participantId) =>
  (participantId === 'p-1' || participantId === 'p-2') ? {gameId: G1, gameAge: 5, undoCount: 2} : undefined;

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => ws.once('message', (data) => resolve(data.toString())));
}

/**
 * Buffers all incoming messages so a test can reliably await the Nth one, even
 * when the server sends several back-to-back (e.g. resume: SUBSCRIBED then
 * INVALIDATED) that would race a per-message `once` listener.
 */
function collectMessages(ws: WebSocket): {messages: Array<string>, waitFor(n: number): Promise<void>} {
  const messages: Array<string> = [];
  let need = 0;
  let resolver: (() => void) | undefined;
  ws.on('message', (data) => {
    messages.push(data.toString());
    if (resolver !== undefined && messages.length >= need) {
      const resolve = resolver;
      resolver = undefined;
      resolve();
    }
  });
  return {
    messages,
    waitFor(n: number): Promise<void> {
      if (messages.length >= n) {
        return Promise.resolve();
      }
      need = n;
      return new Promise((resolve) => {
        resolver = resolve;
      });
    },
  };
}

describe('realtime/RealtimeServer', () => {
  let server: http.Server;
  let realtime: RealtimeServer;
  let hub: RealtimeHub;
  let port: number;
  const clients: Array<WebSocket> = [];

  beforeEach(async () => {
    server = http.createServer();
    hub = RealtimeHub.newInstanceForTesting(resolver);
    realtime = RealtimeServer.newInstanceForTesting(hub);
    realtime.attach(server, {enabled: true});
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const ws of clients) {
      try {
        ws.terminate();
      } catch {
        // ignore
      }
    }
    clients.length = 0;
    realtime.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function connect(path = '/ws'): WebSocket {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    clients.push(ws);
    return ws;
  }

  it('accepts a connection and replies to hello with SERVER_HELLO', async () => {
    const ws = connect();
    await once(ws, 'open');
    expect(realtime.getActiveConnectionCount()).to.eq(1);

    ws.send(serializeMessage(clientHello('test-client', 'p-test')));
    const hello = parseServerMessage(await nextMessage(ws));
    expect(hello?.type).to.eq(ServerMessageType.HELLO);
    expect(hello).to.have.property('serverVersion');
  });

  it('replies to a ping with a PONG that echoes correlationId', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage({...clientPing(), correlationId: 'abc-1'}));
    const pong = parseServerMessage(await nextMessage(ws));
    expect(pong?.type).to.eq(ServerMessageType.PONG);
    expect(pong?.correlationId).to.eq('abc-1');
  });

  it('replies with an ERROR on a malformed message', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send('not a protocol message');
    const err = parseServerMessage(await nextMessage(ws)) as ServerErrorMessage | undefined;
    expect(err?.type).to.eq(ServerMessageType.ERROR);
    expect(err?.code).to.eq('bad-message');
  });

  it('rejects an upgrade on a non-/ws path', async () => {
    const ws = connect('/not-ws');
    let opened = false;
    ws.on('open', () => {
      opened = true;
    });
    await once(ws, 'error').catch(() => undefined);
    expect(opened).to.be.false;
    expect(realtime.getActiveConnectionCount()).to.eq(0);
  });

  it('drops the connection count when a client disconnects', async () => {
    const ws = connect();
    await once(ws, 'open');
    expect(realtime.getActiveConnectionCount()).to.eq(1);
    ws.close();
    await once(ws, 'close');
    // Give the server's close handler a tick to run.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(realtime.getActiveConnectionCount()).to.eq(0);
  });

  it('subscribes a valid token and acks SUBSCRIBED with the version cursor', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage(subscribeGame('p-1')));
    const ack = parseServerMessage(await nextMessage(ws)) as SubscribedMessage | undefined;
    expect(ack?.type).to.eq(ServerMessageType.SUBSCRIBED);
    expect(ack?.gameAge).to.eq(5);
    expect(ack?.undoCount).to.eq(2);
    expect(hub.roomSize(G1)).to.eq(1);
  });

  it('rejects an unauthorized subscribe with an ERROR and joins no room', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage(subscribeGame('p-bad')));
    const err = parseServerMessage(await nextMessage(ws)) as ServerErrorMessage | undefined;
    expect(err?.type).to.eq(ServerMessageType.ERROR);
    expect(err?.code).to.eq('subscribe-rejected');
    expect(hub.getRoomCount()).to.eq(0);
  });

  it('puts two players of the same game in one room', async () => {
    const a = connect();
    await once(a, 'open');
    a.send(serializeMessage(subscribeGame('p-1')));
    await nextMessage(a);
    const b = connect();
    await once(b, 'open');
    b.send(serializeMessage(subscribeGame('p-2')));
    await nextMessage(b);
    expect(hub.roomSize(G1)).to.eq(2);
    expect(hub.getRoomCount()).to.eq(1);
  });

  it('removes a subscriber from its room on disconnect', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage(subscribeGame('p-1')));
    await nextMessage(ws);
    expect(hub.roomSize(G1)).to.eq(1);
    ws.close();
    await once(ws, 'close');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hub.roomSize(G1)).to.eq(0);
  });

  it('delivers a hub invalidation to a subscribed client as GAME_STATE_INVALIDATED', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage(subscribeGame('p-1')));
    await nextMessage(ws); // SUBSCRIBED ack
    hub.invalidate({gameId: G1, gameAge: 8, undoCount: 3, phase: 'action'});
    const inv = parseServerMessage(await nextMessage(ws)) as GameStateInvalidatedMessage | undefined;
    expect(inv?.type).to.eq(ServerMessageType.INVALIDATED);
    expect(inv?.gameAge).to.eq(8);
    expect(inv?.undoCount).to.eq(3);
    expect(inv?.phase).to.eq('action');
  });

  it('resume with a STALE cursor acks SUBSCRIBED then an invalidation (catch-up)', async () => {
    const ws = connect();
    const rec = collectMessages(ws);
    await once(ws, 'open');
    ws.send(serializeMessage(resumeGame('p-1', 3, 0))); // current is (5, 2)
    await rec.waitFor(2);
    const ack = parseServerMessage(rec.messages[0]) as SubscribedMessage | undefined;
    expect(ack?.type).to.eq(ServerMessageType.SUBSCRIBED);
    expect(ack?.gameAge).to.eq(5);
    const inv = parseServerMessage(rec.messages[1]) as GameStateInvalidatedMessage | undefined;
    expect(inv?.type).to.eq(ServerMessageType.INVALIDATED);
    expect(inv?.gameAge).to.eq(5);
    expect(inv?.undoCount).to.eq(2);
    expect(hub.roomSize(G1)).to.eq(1);
  });

  it('resume with an UP-TO-DATE cursor acks SUBSCRIBED only (no refresh)', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage(resumeGame('p-1', 5, 2))); // matches current
    const ack = parseServerMessage(await nextMessage(ws)) as SubscribedMessage | undefined;
    expect(ack?.type).to.eq(ServerMessageType.SUBSCRIBED);
    const second = await Promise.race([
      nextMessage(ws),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 120)),
    ]);
    expect(second).to.be.undefined;
  });

  it('rejects a resume with an invalid token', async () => {
    const ws = connect();
    await once(ws, 'open');
    ws.send(serializeMessage(resumeGame('p-bad', 1, 0)));
    const err = parseServerMessage(await nextMessage(ws)) as ServerErrorMessage | undefined;
    expect(err?.type).to.eq(ServerMessageType.ERROR);
    expect(err?.code).to.eq('subscribe-rejected');
    expect(hub.getRoomCount()).to.eq(0);
  });
});

describe('realtime/realtimeEnabled (Phase 12 default-ON)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.REALTIME_ENABLED;
  });
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.REALTIME_ENABLED;
    } else {
      process.env.REALTIME_ENABLED = saved;
    }
  });

  it('defaults ON when the env var is unset', () => {
    delete process.env.REALTIME_ENABLED;
    expect(realtimeEnabled()).to.be.true;
  });

  it('stays ON for any truthy / unrecognized value', () => {
    for (const v of ['1', 'true', 'on', '', 'yes']) {
      process.env.REALTIME_ENABLED = v;
      expect(realtimeEnabled(), v).to.be.true;
    }
  });

  it('is the opt-out only for 0 / false / off', () => {
    for (const v of ['0', 'false', 'off', 'OFF', 'False']) {
      process.env.REALTIME_ENABLED = v;
      expect(realtimeEnabled(), v).to.be.false;
    }
  });
});
