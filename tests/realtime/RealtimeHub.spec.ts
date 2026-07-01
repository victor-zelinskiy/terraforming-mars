import {expect} from 'chai';
import {RealtimeHub, RealtimeSubscriber, SubscriptionResolver} from '../../src/server/server/realtime/RealtimeHub';
import {GameId} from '../../src/common/Types';
import {GameStateInvalidatedMessage, ServerMessage, ServerMessageType} from '../../src/common/realtime/Protocol';

const G1 = 'g-1' as GameId;
const G2 = 'g-2' as GameId;

interface TestSubscriber extends RealtimeSubscriber {
  readonly sent: Array<ServerMessage>;
}

function subscriber(id: number): TestSubscriber {
  const sent: Array<ServerMessage> = [];
  return {
    id,
    gameId: undefined,
    participantId: undefined,
    sent,
    send(message) {
      sent.push(message);
    },
  };
}

const resolver: SubscriptionResolver = async (participantId) => {
  if (participantId === 'p-1' || participantId === 'p-2') {
    return {gameId: G1, gameAge: 3, undoCount: 1};
  }
  if (participantId === 'p-3') {
    return {gameId: G2, gameAge: 9, undoCount: 0};
  }
  return undefined;
};

describe('realtime/RealtimeHub', () => {
  it('subscribes valid tokens and tracks room size', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const a = subscriber(1);
    const b = subscriber(2);

    const ra = await hub.subscribe(a, 'p-1');
    expect(ra.ok).to.be.true;
    expect(ra.roomSize).to.eq(1);
    expect(ra.gameAge).to.eq(3);
    expect(a.gameId).to.eq(G1);

    const rb = await hub.subscribe(b, 'p-2');
    expect(rb.roomSize).to.eq(2);
    expect(hub.roomSize(G1)).to.eq(2);
    expect(hub.getRoomCount()).to.eq(1);
  });

  it('rejects an unknown token and joins no room', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const r = await hub.subscribe(subscriber(1), 'nope');
    expect(r.ok).to.be.false;
    expect(hub.getRoomCount()).to.eq(0);
  });

  it('unsubscribe removes from the room and clears the empty room', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const a = subscriber(1);
    await hub.subscribe(a, 'p-1');
    hub.unsubscribe(a);
    expect(a.gameId).to.be.undefined;
    expect(hub.roomSize(G1)).to.eq(0);
    expect(hub.getRoomCount()).to.eq(0);
  });

  it('disconnect removes only the leaving subscriber', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const a = subscriber(1);
    const b = subscriber(2);
    await hub.subscribe(a, 'p-1');
    await hub.subscribe(b, 'p-2');
    hub.handleDisconnect(a);
    expect(hub.roomSize(G1)).to.eq(1);
  });

  it('moves a subscriber that re-subscribes to a different game', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const a = subscriber(1);
    await hub.subscribe(a, 'p-1'); // g-1
    await hub.subscribe(a, 'p-3'); // g-2
    expect(hub.roomSize(G1)).to.eq(0);
    expect(hub.roomSize(G2)).to.eq(1);
    expect(a.gameId).to.eq(G2);
  });

  it('the default (unconfigured) hub rejects every subscription', async () => {
    const hub = RealtimeHub.newInstanceForTesting(async () => undefined);
    const r = await hub.subscribe(subscriber(1), 'p-1');
    expect(r.ok).to.be.false;
  });

  it('invalidate broadcasts to every subscriber of the game and returns the count', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const a = subscriber(1);
    const b = subscriber(2);
    await hub.subscribe(a, 'p-1');
    await hub.subscribe(b, 'p-2');

    const notified = hub.invalidate({gameId: G1, gameAge: 7, undoCount: 1, phase: 'action'});
    expect(notified).to.eq(2);
    expect(a.sent).to.have.length(1);
    expect(a.sent[0].type).to.eq(ServerMessageType.INVALIDATED);
    const message = a.sent[0] as GameStateInvalidatedMessage;
    expect(message.gameId).to.eq(G1);
    expect(message.gameAge).to.eq(7);
    expect(message.undoCount).to.eq(1);
    expect(message.phase).to.eq('action');
  });

  it('invalidate is a no-op for an empty room', () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    expect(hub.invalidate({gameId: G1, gameAge: 1, undoCount: 0})).to.eq(0);
  });

  it('invalidate only reaches the matching game room', async () => {
    const hub = RealtimeHub.newInstanceForTesting(resolver);
    const a = subscriber(1);
    const c = subscriber(3);
    await hub.subscribe(a, 'p-1'); // g-1
    await hub.subscribe(c, 'p-3'); // g-2
    hub.invalidate({gameId: G1, gameAge: 2, undoCount: 0});
    expect(a.sent).to.have.length(1);
    expect(c.sent).to.have.length(0);
  });
});
