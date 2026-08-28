import {expect} from 'chai';
import {JoinableGameSummary} from '../../../../src/common/models/JoinableGameModel';
import {GameId, PlayerId} from '../../../../src/common/Types';
import {
  lobbyState, lobbyRows, lobbySource,
  startLobbyWatch, openLobbyList, closeLobbyList, refreshLobby, resetLobbyStateForTesting,
} from '../../../../src/client/components/mainMenu/lobbyState';
import {lanState, addManualHost, removeManualHost, parseManualEntry, resetLanStateForTesting} from '../../../../src/client/components/mainMenu/lanState';
import {resetLobbyChannelsForTesting} from '../../../../src/client/components/mainMenu/lobbyChannel';

/**
 * THE REPORTED BUG, as a spec: playing in local (LAN) mode, the host's games
 * did not show up in «Мои партии» until the app was restarted. Everything here
 * is about the LAN source's lifecycle — it appears, it is asked, it says when
 * it cannot answer, and it never quietly turns into «no games».
 */

function game(id: string): JoinableGameSummary {
  return {
    id: id as GameId,
    name: id,
    createdTimeMs: 1,
    phase: 'research' as JoinableGameSummary['phase'],
    generation: 1,
    boardName: 'tharsis' as JoinableGameSummary['boardName'],
    expansions: [],
    players: [{name: 'Victor', color: 'red', isYou: true}],
    maxPlayers: 1,
    activePlayer: 'red',
    finished: false,
    you: {id: `p-${id}` as PlayerId, color: 'red'},
    ambiguous: false,
  } as JoinableGameSummary;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (!lobbyState.refreshing) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('the lobby never settled');
}

/** Let the LAN host watcher (a Vue watch) run before settling. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await settle();
}

describe('client/mainMenu/lobbyState — LAN sources', () => {
  let originalFetch: typeof fetch;
  let hostGames: Array<JoinableGameSummary>;
  let hostReachable: boolean;
  let hostCalls: Array<string>;

  beforeEach(() => {
    resetLobbyStateForTesting();
    resetLobbyChannelsForTesting();
    resetLanStateForTesting();
    hostGames = [];
    hostReachable = true;
    hostCalls = [];
    originalFetch = global.fetch;
    global.fetch = ((url: string) => {
      const target = String(url);
      // A LAN probe is an absolute URL at the host's address; the local
      // listing is relative (runtimeConfig's default base).
      if (target.startsWith('http://')) {
        hostCalls.push(target);
        return hostReachable ?
          Promise.resolve({ok: true, json: () => Promise.resolve(hostGames)} as unknown as Response) :
          Promise.reject(new Error('unreachable'));
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve([])} as unknown as Response);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetLobbyStateForTesting();
    resetLobbyChannelsForTesting();
    resetLanStateForTesting();
  });

  function publishHost(addresses: Array<string> = ['192.168.1.5']): void {
    lanState.hosts = [{id: 'host-1', name: 'Deck', addresses, port: 17325, version: ''}];
  }

  it('lists a discovered host\'s games as soon as the screen opens', async () => {
    publishHost();
    hostGames = [game('lan-1')];
    startLobbyWatch('Victor');
    await settle();
    // Closed: the LAN is not probed at all — the badge/CONTINUE are local.
    expect(hostCalls).to.be.empty;

    await openLobbyList();
    await settle();
    expect(hostCalls).to.have.length(1);
    expect(hostCalls[0]).to.contain('192.168.1.5:17325');
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['lan-1']);
    expect(lobbySource('lan:host-1')?.status).to.eq('ok');
  });

  it('a host that appears WHILE the screen is open is asked immediately', async () => {
    startLobbyWatch('Victor');
    await settle();
    await openLobbyList();
    await settle();
    expect(lobbyRows()).to.be.empty;

    // mDNS pushes the host a moment later — the previous implementation only
    // noticed on the next poll tick, and only if one was running at all.
    hostGames = [game('lan-late')];
    publishHost();
    await flush();
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['lan-late']);
  });

  it('a host that stops answering SAYS SO and keeps its rows for a grace period', async () => {
    publishHost();
    hostGames = [game('lan-1')];
    startLobbyWatch('Victor');
    await settle();
    await openLobbyList();
    await settle();
    expect(lobbyRows()).to.have.length(1);

    hostReachable = false;
    void refreshLobby();
    await settle();
    // The game did not stop existing just because the probe failed.
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['lan-1']);
    expect(lobbyRows()[0].stale).to.be.true;
    expect(lobbySource('lan:host-1')?.status).to.eq('unreachable');

    // ...but a host that stays silent eventually drops off, so the list does
    // not haunt the player with a couch that has been off for ten minutes.
    void refreshLobby();
    await settle();
    void refreshLobby();
    await settle();
    expect(lobbyRows()).to.be.empty;
  });

  it('a host that LEAVES the network takes its rows with it at once', async () => {
    publishHost();
    hostGames = [game('lan-1')];
    startLobbyWatch('Victor');
    await settle();
    await openLobbyList();
    await settle();
    expect(lobbyRows()).to.have.length(1);

    lanState.hosts = [];
    await flush();
    expect(lobbyRows()).to.be.empty;
    expect(lobbySource('lan:host-1')).to.eq(undefined);
  });

  it('closing the screen retires the LAN sources (no background probing)', async () => {
    publishHost();
    hostGames = [game('lan-1')];
    startLobbyWatch('Victor');
    await settle();
    await openLobbyList();
    await settle();
    const probed = hostCalls.length;

    closeLobbyList();
    expect(lobbyState.lanRows).to.be.empty;
    void refreshLobby();
    await settle();
    expect(hostCalls.length).to.eq(probed);
  });

  /**
   * mDNS is multicast, and multicast is the first thing a router's client
   * isolation, a guest SSID or a firewall drops. A hand-typed address is the
   * fallback that works whenever the two machines can reach each other at all —
   * so it must behave as an ordinary source, not as a second code path.
   */
  describe('a hand-typed host', () => {
    it('becomes a source and is asked like any other', async () => {
      hostGames = [game('manual-1')];
      startLobbyWatch('Victor');
      await settle();
      await openLobbyList();
      await settle();
      expect(lobbyRows()).to.be.empty;

      expect(addManualHost('192.168.1.9')).to.be.true;
      await flush();
      expect(hostCalls.some((u) => u.includes('192.168.1.9:17325'))).to.be.true;
      expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['manual-1']);
    });

    it('takes the default embedded port, and honours an explicit one', () => {
      expect(parseManualEntry('192.168.1.9')).to.deep.eq({address: '192.168.1.9', port: 17325});
      expect(parseManualEntry('http://deck.local:9000/')).to.deep.eq({address: 'deck.local', port: 9000});
      expect(parseManualEntry('[fe80::1]:9000')).to.deep.eq({address: 'fe80::1', port: 9000});
      expect(parseManualEntry('   ')).to.eq(undefined);
      expect(parseManualEntry('192.168.1.9:99999')).to.eq(undefined);
    });

    it('is dropped — with its rows — when the player removes it', async () => {
      hostGames = [game('manual-1')];
      startLobbyWatch('Victor');
      await settle();
      await openLobbyList();
      await settle();
      addManualHost('192.168.1.9');
      await flush();
      expect(lobbyRows()).to.have.length(1);

      removeManualHost('192.168.1.9');
      await flush();
      expect(lobbyRows()).to.be.empty;
    });

    it('never doubles a host that mDNS also found', async () => {
      hostGames = [game('manual-1')];
      publishHost(['192.168.1.5']);
      startLobbyWatch('Victor');
      await settle();
      await openLobbyList();
      await settle();
      // The same endpoint, typed by hand: one row, not two.
      addManualHost('192.168.1.5');
      await flush();
      expect(lobbyRows()).to.have.length(1);
    });
  });

  it('races a host\'s addresses so one dead NIC cannot hide its games', async () => {
    // A machine with Hyper-V / WSL / a VPN advertises several addresses and the
    // dead ones do not fail fast — they hang. Only a raced probe answers in time.
    publishHost(['10.0.0.1', '192.168.1.5']);
    hostGames = [game('lan-1')];
    global.fetch = ((url: string) => {
      const target = String(url);
      if (target.startsWith('http://10.0.0.1')) {
        hostCalls.push(target);
        return new Promise<Response>(() => {}); // hangs, like a dead NIC
      }
      if (target.startsWith('http://')) {
        hostCalls.push(target);
        return Promise.resolve({ok: true, json: () => Promise.resolve(hostGames)} as unknown as Response);
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve([])} as unknown as Response);
    }) as typeof fetch;

    startLobbyWatch('Victor');
    await settle();
    await openLobbyList();
    await settle();
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['lan-1']);
    expect(hostCalls).to.have.length(2);
  });
});
