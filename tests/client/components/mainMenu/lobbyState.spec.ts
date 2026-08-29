import {expect} from 'chai';
import {JoinableGameSummary} from '../../../../src/common/models/JoinableGameModel';
import {
  lobbyState, lobbyRows, localLobbySource, lobbyFirstLoad, lobbyUnreachable, lobbyKnownEmpty,
  startLobbyWatch, stopLobbyWatch, openLobbyList, closeLobbyList, setLobbyIdentity, refreshLobby,
  loadLobbyArchive, resetLobbyStateForTesting,
} from '../../../../src/client/components/mainMenu/lobbyState';
import {resetLanStateForTesting} from '../../../../src/client/components/mainMenu/lanState';
import {resetLobbyChannelsForTesting} from '../../../../src/client/components/mainMenu/lobbyChannel';

/** A summary shaped like the route's, with only the fields this model reads. */
function game(id: string, extra: Partial<JoinableGameSummary> = {}): JoinableGameSummary {
  return {
    id: id as JoinableGameSummary['id'],
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
    you: {id: `p-${id}` as JoinableGameSummary['id'], color: 'red'},
    ambiguous: false,
    ...extra,
  } as JoinableGameSummary;
}

type Answer = {games?: Array<JoinableGameSummary>, fail?: boolean};

/** What the `status=finished` slice answers (the active slice has its own). */
let archiveAnswer: Array<JoinableGameSummary> = [];

/**
 * Wait until no refresh is in flight.
 *
 * The model deliberately COLLAPSES a refresh asked for mid-flight into a single
 * replay after the running one (so a push that lands during a fetch is answered
 * exactly once). That means `await refreshLobby()` can resolve while the replay
 * is still going — the spec has to wait for the model to be quiet, not for one
 * promise. `refreshing` is never observably false with a replay pending: the
 * replay starts synchronously in the same continuation that clears it.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (!lobbyState.refreshing) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('the lobby never settled');
}

describe('client/mainMenu/lobbyState', () => {
  let originalFetch: typeof fetch;
  let calls: Array<string>;
  let answer: Answer;

  beforeEach(() => {
    resetLobbyStateForTesting();
    resetLobbyChannelsForTesting();
    resetLanStateForTesting();
    calls = [];
    answer = {games: []};
    archiveAnswer = [];
    originalFetch = global.fetch;
    global.fetch = ((url: string) => {
      calls.push(String(url));
      if (answer.fail === true) {
        return Promise.reject(new Error('offline'));
      }
      const finished = String(url).includes('status=finished');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(finished ? archiveAnswer : (answer.games ?? [])),
      } as unknown as Response);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetLobbyStateForTesting();
    resetLobbyChannelsForTesting();
    resetLanStateForTesting();
  });

  it('loads on watch and exposes the rows', async () => {
    answer = {games: [game('g1'), game('g2')]};
    startLobbyWatch('Victor');
    await settle();
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['g1', 'g2']);
    expect(localLobbySource()?.status).to.eq('ok');
    expect(lobbyKnownEmpty()).to.be.false;
  });

  it('a LATE identity still loads — the case that used to need an app restart', async () => {
    // Watch starts with no name at all (Steam prefill / profile roster pending).
    startLobbyWatch('');
    await settle();
    expect(calls).to.be.empty;
    expect(localLobbySource()?.status).to.eq('idle');
    // Nothing was asked, so the screen must NOT claim the player has no games.
    expect(lobbyKnownEmpty()).to.be.false;
    expect(lobbyFirstLoad()).to.be.false;

    answer = {games: [game('late')]};
    setLobbyIdentity('Victor');
    await settle();
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['late']);
  });

  it('separates «asked and empty» from «could not ask»', async () => {
    startLobbyWatch('Victor');
    await settle();
    expect(lobbyKnownEmpty()).to.be.true;
    expect(lobbyUnreachable()).to.be.false;

    answer = {fail: true};
    void refreshLobby();
    await settle();
    expect(localLobbySource()?.status).to.eq('unreachable');
    expect(lobbyUnreachable()).to.be.true;
    // The one thing it may never say: «you have no games».
    expect(lobbyKnownEmpty()).to.be.false;
  });

  it('a failed refresh KEEPS the rows it had (nothing disappears silently)', async () => {
    answer = {games: [game('kept')]};
    startLobbyWatch('Victor');
    await settle();
    expect(lobbyRows()).to.have.length(1);

    answer = {fail: true};
    void refreshLobby();
    await settle();
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['kept']);
    expect(localLobbySource()?.status).to.eq('unreachable');
  });

  it('opening the screen ALWAYS re-asks, even with a list already on it', async () => {
    answer = {games: [game('g1')]};
    startLobbyWatch('Victor');
    await settle();
    const before = calls.length;

    answer = {games: [game('g1'), game('g2')]};
    void openLobbyList();
    await settle();
    expect(calls.length).to.be.greaterThan(before);
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['g1', 'g2']);
  });

  it('marks rows that ARRIVED while watching, never the first list', async () => {
    answer = {games: [game('old')]};
    startLobbyWatch('Victor');
    await settle();
    expect(lobbyState.newIds).to.be.empty;

    answer = {games: [game('old'), game('fresh')]};
    void refreshLobby();
    await settle();
    expect([...lobbyState.newIds]).to.deep.eq(['fresh']);
  });

  it('a switched profile drops the previous name\'s rows before reloading', async () => {
    answer = {games: [game('victors')]};
    startLobbyWatch('Victor');
    await settle();
    expect(lobbyRows()).to.have.length(1);

    answer = {games: [game('nadias')]};
    setLobbyIdentity('Nadia');
    // Synchronously — the old player's games must not be readable for a frame
    // under the new player's name.
    expect(lobbyRows()).to.be.empty;
    await settle();
    expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['nadias']);
  });

  it('the archive is its own slice with its own status', async () => {
    startLobbyWatch('Victor');
    await settle();
    expect(lobbyState.archiveStatus).to.eq('idle');
    await loadLobbyArchive();
    expect(lobbyState.archiveStatus).to.eq('ok');
    expect(calls.some((u) => u.includes('status=finished'))).to.be.true;
  });

  /**
   * The list states its own rule on every row («12 с назад»), so the order has
   * to be the rule — not whatever order a server happened to answer in. LAN
   * rows in particular come from several servers, each sorting only its own.
   */
  describe('newest first, strictly by creation time', () => {
    it('sorts the rows even when the answer arrives shuffled', async () => {
      answer = {games: [
        game('old', {createdTimeMs: 1_000}),
        game('newest', {createdTimeMs: 9_000}),
        game('middle', {createdTimeMs: 5_000}),
      ]};
      startLobbyWatch('Victor');
      await settle();
      expect(lobbyRows().map((r) => r.game.id)).to.deep.eq(['newest', 'middle', 'old']);
    });

    it('puts a game created a moment ago on top', async () => {
      answer = {games: [game('yesterday', {createdTimeMs: 1_000})]};
      startLobbyWatch('Victor');
      await settle();

      answer = {games: [game('yesterday', {createdTimeMs: 1_000}), game('fresh', {createdTimeMs: 99_000})]};
      void refreshLobby();
      await settle();
      expect(lobbyRows()[0].game.id).to.eq('fresh');
    });

    it('sorts the archive the same way', async () => {
      startLobbyWatch('Victor');
      await settle();
      archiveAnswer = [
        game('a', {createdTimeMs: 2_000, finished: true}),
        game('b', {createdTimeMs: 8_000, finished: true}),
      ];
      await loadLobbyArchive();
      expect(lobbyState.archive.map((g) => g.id)).to.deep.eq(['b', 'a']);
    });
  });

  describe('the age clock', () => {
    it('advances while the screen is open, and stops when it closes', async () => {
      answer = {games: [game('g1', {createdTimeMs: Date.now()})]};
      startLobbyWatch('Victor');
      await settle();
      await openLobbyList();
      await settle();

      const first = lobbyState.nowMs;
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const ticked = lobbyState.nowMs;
      expect(ticked, 'the shared clock must advance while rows are on screen').to.be.greaterThan(first);

      closeLobbyList();
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(lobbyState.nowMs, 'a closed screen must not keep a timer alive').to.eq(ticked);
      // Two real one-second ticks have to elapse for this to mean anything —
      // the whole claim is about wall-clock behaviour.
    }).timeout(10_000);
  });

  it('stopping the watch leaves no timers or state behind', async () => {
    answer = {games: [game('g1')]};
    startLobbyWatch('Victor');
    await settle();
    stopLobbyWatch();
    expect(lobbyState.open).to.be.false;
    const after = calls.length;
    // Nothing may fire once the menu is gone.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.length).to.eq(after);
  });
});
