import {expect} from 'chai';
import {
  bindPrivateScoreGame,
  privateScoreState,
  setPrivateScore,
  shouldMaskOwnPassiveVp,
  togglePrivateScore,
} from '@/client/components/overview/privateScoreState';

describe('privateScoreState (per-game)', () => {
  // A deterministic in-memory localStorage so the per-game persistence is
  // exercised under BOTH runners (the server runner has no real localStorage).
  let savedLocalStorage: PropertyDescriptor | undefined;
  before(() => {
    const store = new Map<string, string>();
    savedLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });
  after(() => {
    if (savedLocalStorage !== undefined) {
      Object.defineProperty(globalThis, 'localStorage', savedLocalStorage);
    } else {
      delete (globalThis as {localStorage?: unknown}).localStorage;
    }
  });

  afterEach(() => {
    // Leave no bound game / masking between specs (module state is shared).
    bindPrivateScoreGame(undefined);
  });

  it('toggles the reactive flag while a game is bound', () => {
    bindPrivateScoreGame('game-A');
    setPrivateScore(true);
    expect(privateScoreState.enabled).is.true;
    setPrivateScore(false);
    expect(privateScoreState.enabled).is.false;
    togglePrivateScore();
    expect(privateScoreState.enabled).is.true;
  });

  it('masks ONLY the viewer\'s own VP, and only when enabled', () => {
    bindPrivateScoreGame('game-A');
    setPrivateScore(false);
    expect(shouldMaskOwnPassiveVp(true)).is.false; // off → never masks
    setPrivateScore(true);
    expect(shouldMaskOwnPassiveVp(true)).is.true; // own VP + on → masked
    expect(shouldMaskOwnPassiveVp(false)).is.false; // an opponent's VP is never masked
  });

  it('is PER-GAME: the choice is scoped to the bound game and does not leak', () => {
    bindPrivateScoreGame('game-A');
    setPrivateScore(true);
    // Switch to a different game — it starts OFF (its own, unset value).
    bindPrivateScoreGame('game-B');
    expect(privateScoreState.enabled).is.false;
    // Back to game A — its ON choice is remembered.
    bindPrivateScoreGame('game-A');
    expect(privateScoreState.enabled).is.true;
  });

  it('resets to OFF when no game is bound (the main menu)', () => {
    bindPrivateScoreGame('game-A');
    setPrivateScore(true);
    bindPrivateScoreGame(undefined);
    expect(privateScoreState.enabled).is.false;
  });

  it('binding is idempotent — re-binding the same game keeps the live value', () => {
    bindPrivateScoreGame('game-A');
    setPrivateScore(true);
    bindPrivateScoreGame('game-A'); // e.g. a repeat playerView commit
    expect(privateScoreState.enabled).is.true;
  });
});
