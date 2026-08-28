import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {Phase} from '../../src/common/Phase';
import {GameId} from '../../src/common/Types';
import {IGame} from '../../src/server/IGame';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {GameIdLedger} from '../../src/server/database/IDatabase';
import {LobbyIndex, lobbyRecordFromGame, lobbyRecordFromSerialized} from '../../src/server/models/lobbyIndex';

/**
 * A loader that holds games but is never RESIDENT (peek always misses), so the
 * index has to take its cold path. Everything else delegates to the map.
 */
function coldLoader(games: ReadonlyArray<IGame>): IGameLoader {
  const byId = new Map<GameId, IGame>(games.map((g) => [g.id, g]));
  const loads: Array<GameId> = [];
  return {
    add: () => Promise.resolve(),
    peek: () => undefined,
    getIds: (): Promise<Array<GameIdLedger>> =>
      Promise.resolve([...byId.keys()].map((gameId) => ({gameId, participantIds: []}))),
    getGame: (id: GameId) => {
      loads.push(id);
      return Promise.resolve(byId.get(id));
    },
    restoreGameAt: () => {
      throw new Error('not used');
    },
    mark: () => {},
    deleteGame: (id: GameId) => {
      byId.delete(id);
      return Promise.resolve();
    },
    saveGame: () => Promise.resolve(),
    completeGame: () => Promise.resolve(),
    maintenance: () => Promise.resolve(),
    notifyGameStateChanged: () => {},
    loads,
  } as unknown as IGameLoader & {loads: Array<GameId>};
}

/** The same shape, but the games ARE resident — the hot path. */
function residentLoader(games: ReadonlyArray<IGame>): IGameLoader {
  const loader = coldLoader(games) as IGameLoader & {loads: Array<GameId>};
  const byId = new Map<GameId, IGame>(games.map((g) => [g.id, g]));
  loader.peek = (id: GameId) => byId.get(id);
  return loader;
}

/**
 * One game with a chosen id, seated by `Victor`. Distinct ids matter here:
 * `testGame` always builds `game-id`, and this suite is about a MAP keyed by it.
 */
function namedGame(id: string): IGame {
  const player = TestPlayer.BLACK.newPlayer();
  player.name = 'Victor';
  return Game.newInstance(id as GameId, [player], player, `s-${id}` as 'spectator-id');
}

/**
 * A clean index. Creating a game SAVES it, and a save records it (that is the
 * production path), so fixtures are built first and the index reset after —
 * otherwise every «cold» assertion would start warm.
 */
function freshIndex(): LobbyIndex {
  LobbyIndex.resetForTesting();
  return LobbyIndex.getInstance();
}

/** Let the saves queued by game construction land BEFORE the index is reset. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('models/lobbyIndex', () => {
  beforeEach(() => {
    LobbyIndex.resetForTesting();
  });

  it('derives the SAME record from a live game and from its serialized form', () => {
    const [game] = testGame(3);
    const live = lobbyRecordFromGame(game);
    const cold = lobbyRecordFromSerialized(game.serialize());
    // The cold path exists to avoid a full Game.deserialize; it must not be a
    // second, subtly different derivation. The generation ORDER in particular
    // is a rotation the serialized form has to reproduce.
    expect(cold).to.deep.eq(live);
    expect(live.seats.map((s) => s.name)).to.deep.eq(game.playersInGenerationOrder.map((p) => p.name));
  });

  it('normalizes seat names so a listing matches case-insensitively', () => {
    const [game, player] = testGame(2);
    player.name = '  Victor  ';
    const record = lobbyRecordFromGame(game);
    expect(record.seats.some((s) => s.normalizedName === 'victor')).to.be.true;
  });

  it('bumps the revision only when something a LISTING shows has moved', () => {
    const [game] = testGame(2);
    const index = freshIndex();
    const start = index.revision();

    expect(index.recordGame(game)).to.be.true;
    const afterFirst = index.revision();
    expect(afterFirst).to.be.greaterThan(start);

    // Re-recording an unchanged game is silent: otherwise every save in every
    // game would wake every menu on the network.
    expect(index.recordGame(game)).to.be.false;
    expect(index.revision()).to.eq(afterFirst);

    game.phase = Phase.END;
    expect(index.recordGame(game)).to.be.true;
    expect(index.revision()).to.be.greaterThan(afterFirst);
  });

  it('bumps on drop, and only for a game it knew', () => {
    const [game] = testGame(2);
    const index = freshIndex();
    index.recordGame(game);
    const before = index.revision();
    expect(index.drop(game.id)).to.be.true;
    expect(index.revision()).to.be.greaterThan(before);
    // A second drop is not a change.
    const after = index.revision();
    expect(index.drop(game.id)).to.be.false;
    expect(index.revision()).to.eq(after);
  });

  it('snapshot reads a cold game ONCE and serves it from the index afterwards', async () => {
    const game = namedGame('lobby-cold');
    const loader = coldLoader([game]) as IGameLoader & {loads: Array<GameId>};
    await settled();
    const index = freshIndex();

    const first = await index.snapshot(loader);
    expect(first.map((r) => r.id)).to.deep.eq([game.id]);
    expect(loader.loads).to.have.length(1);

    // The whole point: a second listing costs no game load at all. This is what
    // kept a LAN guest's probe inside its timeout on a real library.
    const second = await index.snapshot(loader);
    expect(second.map((r) => r.id)).to.deep.eq([game.id]);
    expect(loader.loads).to.have.length(1);
  });

  it('snapshot re-derives a RESIDENT game, so a listing is never stale', async () => {
    const game = namedGame('lobby-resident');
    const loader = residentLoader([game]);
    await settled();
    const index = freshIndex();

    expect((await index.snapshot(loader))[0].finished).to.be.false;
    // A phase change that never went through a save must still be visible: the
    // index trusts the live object over anything it remembered.
    game.phase = Phase.END;
    expect((await index.snapshot(loader))[0].finished).to.be.true;
  });

  it('snapshot forgets a game the loader no longer lists', async () => {
    const a = namedGame('lobby-a');
    const b = namedGame('lobby-b');
    const loader = residentLoader([a, b]);
    await settled();
    const index = freshIndex();
    expect(await index.snapshot(loader)).to.have.length(2);

    await loader.deleteGame(a.id);
    const remaining = await index.snapshot(loader);
    expect(remaining.map((r) => r.id)).to.deep.eq([b.id]);
  });

  it('notifies the injected revision listener on every real change', () => {
    const [game] = testGame(2);
    const index = freshIndex();
    const seen: Array<number> = [];
    index.onRevisionChanged((revision) => seen.push(revision));

    index.recordGame(game);
    index.recordGame(game); // unchanged — no notification
    index.drop(game.id);

    expect(seen).to.have.length(2);
    expect(seen[1]).to.be.greaterThan(seen[0]);
    index.onRevisionChanged(undefined);
  });
});
