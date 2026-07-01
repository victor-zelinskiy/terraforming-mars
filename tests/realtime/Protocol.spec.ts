import {expect} from 'chai';
import {
  ClientMessageType,
  REALTIME_PROTOCOL_VERSION,
  ServerErrorMessage,
  ServerMessageType,
  SubscribeGameMessage,
  SubscribedMessage,
  clientHello,
  clientPing,
  parseClientMessage,
  parseServerMessage,
  serializeMessage,
  serverError,
  serverHello,
  serverPong,
  subscribeGame,
  subscribed,
  unsubscribeGame,
} from '../../src/common/realtime/Protocol';

describe('realtime/Protocol', () => {
  it('has a numeric protocol version', () => {
    expect(REALTIME_PROTOCOL_VERSION).to.be.a('number');
  });

  it('round-trips a client hello', () => {
    const raw = serializeMessage(clientHello('build-123', 'p-abc', 1000));
    const parsed = parseClientMessage(raw);
    expect(parsed?.type).to.eq(ClientMessageType.HELLO);
    expect(parsed).to.include({protocolVersion: REALTIME_PROTOCOL_VERSION, clientVersion: 'build-123', participantId: 'p-abc'});
  });

  it('round-trips a client ping', () => {
    const parsed = parseClientMessage(serializeMessage(clientPing(2000)));
    expect(parsed?.type).to.eq(ClientMessageType.PING);
  });

  it('accepts a hello with no participantId', () => {
    const parsed = parseClientMessage(serializeMessage(clientHello('build-123', undefined)));
    expect(parsed?.type).to.eq(ClientMessageType.HELLO);
  });

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('not json')).to.be.undefined;
  });

  it('rejects a message with no envelope', () => {
    expect(parseClientMessage(JSON.stringify({hello: true}))).to.be.undefined;
  });

  it('rejects an unknown client type', () => {
    expect(parseClientMessage(JSON.stringify({type: 'NONSENSE', protocolVersion: 1, ts: 1}))).to.be.undefined;
  });

  it('rejects a hello missing clientVersion', () => {
    expect(parseClientMessage(JSON.stringify({type: ClientMessageType.HELLO, protocolVersion: 1, ts: 1}))).to.be.undefined;
  });

  it('round-trips server hello / pong / error and preserves correlationId', () => {
    const hello = parseServerMessage(serializeMessage(serverHello('srv-9', 'corr-1')));
    expect(hello?.type).to.eq(ServerMessageType.HELLO);
    expect(hello?.correlationId).to.eq('corr-1');

    const pong = parseServerMessage(serializeMessage(serverPong('corr-2')));
    expect(pong?.type).to.eq(ServerMessageType.PONG);
    expect(pong?.correlationId).to.eq('corr-2');

    const err = parseServerMessage(serializeMessage(serverError('bad-message', 'nope'))) as ServerErrorMessage | undefined;
    expect(err?.type).to.eq(ServerMessageType.ERROR);
    expect(err?.code).to.eq('bad-message');
  });

  it('rejects a server error missing code/message', () => {
    expect(parseServerMessage(JSON.stringify({type: ServerMessageType.ERROR, protocolVersion: 1, ts: 1}))).to.be.undefined;
  });

  it('round-trips subscribe / unsubscribe / subscribed', () => {
    const sub = parseClientMessage(serializeMessage(subscribeGame('p-xyz')));
    expect(sub?.type).to.eq(ClientMessageType.SUBSCRIBE);
    expect((sub as SubscribeGameMessage).participantId).to.eq('p-xyz');

    const unsub = parseClientMessage(serializeMessage(unsubscribeGame()));
    expect(unsub?.type).to.eq(ClientMessageType.UNSUBSCRIBE);

    const ack = parseServerMessage(serializeMessage(subscribed(7, 2)));
    expect(ack?.type).to.eq(ServerMessageType.SUBSCRIBED);
    expect((ack as SubscribedMessage).gameAge).to.eq(7);
    expect((ack as SubscribedMessage).undoCount).to.eq(2);
  });

  it('rejects a subscribe with no participantId', () => {
    expect(parseClientMessage(JSON.stringify({type: ClientMessageType.SUBSCRIBE, protocolVersion: 1, ts: 1}))).to.be.undefined;
  });

  it('rejects a subscribed ack with non-numeric cursor', () => {
    expect(parseServerMessage(JSON.stringify({type: ServerMessageType.SUBSCRIBED, protocolVersion: 1, ts: 1, gameAge: 'x', undoCount: 0}))).to.be.undefined;
  });
});
