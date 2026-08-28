import {expect} from 'chai';
import {testGame} from '../TestGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {LobbyIndex} from '../../src/server/models/lobbyIndex';
import {RealtimeHub, RealtimeSubscriber} from '../../src/server/server/realtime/RealtimeHub';
import {ServerMessage, ServerMessageType} from '../../src/common/realtime/Protocol';
import {Phase} from '../../src/common/Phase';

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

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('realtime/lobby room', () => {
  it('broadcasts to every lobby subscriber and to nobody else', () => {
    const hub = RealtimeHub.newInstanceForTesting(() => Promise.resolve(undefined));
    const a = subscriber(1);
    const b = subscriber(2);
    const outsider = subscriber(3);

    hub.subscribeLobby(a);
    hub.subscribeLobby(b);
    expect(hub.lobbySize()).to.eq(2);

    expect(hub.invalidateLobby(7)).to.eq(2);
    for (const sub of [a, b]) {
      expect(sub.sent).to.have.length(1);
      expect(sub.sent[0].type).to.eq(ServerMessageType.LOBBY_INVALIDATED);
      expect((sub.sent[0] as {revision: number}).revision).to.eq(7);
    }
    expect(outsider.sent).to.be.empty;
  });

  it('an empty room costs nothing, and a disconnect leaves it', () => {
    const hub = RealtimeHub.newInstanceForTesting(() => Promise.resolve(undefined));
    expect(hub.invalidateLobby(1)).to.eq(0);

    const a = subscriber(1);
    hub.subscribeLobby(a);
    // Idempotent: a re-subscribe must not double-deliver.
    hub.subscribeLobby(a);
    expect(hub.lobbySize()).to.eq(1);

    hub.handleDisconnect(a);
    expect(hub.lobbySize()).to.eq(0);
    expect(hub.invalidateLobby(2)).to.eq(0);
  });

  it('a game that ENDS moves the lobby revision (the archive appears without a restart)', async () => {
    const [game] = testGame(2);
    await settled();
    LobbyIndex.resetForTesting();
    const index = LobbyIndex.getInstance();
    const bumps: Array<number> = [];
    index.onRevisionChanged((revision) => bumps.push(revision));
    try {
      // The listing shows the phase, so ending a game is a lobby change even
      // though nothing about the SET of games moved.
      GameLoader.getInstance().notifyGameStateChanged(game);
      const afterFirst = bumps.length;
      expect(afterFirst).to.be.greaterThan(0);

      // An unchanged repeat is silent — a save per turn must not wake menus.
      GameLoader.getInstance().notifyGameStateChanged(game);
      expect(bumps).to.have.length(afterFirst);

      game.phase = Phase.END;
      GameLoader.getInstance().notifyGameStateChanged(game);
      expect(bumps.length).to.be.greaterThan(afterFirst);
    } finally {
      index.onRevisionChanged(undefined);
    }
  });
});
