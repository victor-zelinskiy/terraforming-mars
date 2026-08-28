import {expect} from 'chai';
import {ApiGamesJoinable} from '../../src/server/routes/ApiGamesJoinable';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {JoinableGameSummary} from '../../src/common/models/JoinableGameModel';
import {Phase} from '../../src/common/Phase';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {LobbyIndex} from '../../src/server/models/lobbyIndex';

describe('ApiGamesJoinable', () => {
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;

  beforeEach(() => {
    // The listing reads a process-wide index; each case gets a clean one.
    LobbyIndex.resetForTesting();
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  /** One game named after its id, seated by a player called `Victor`. */
  const addGame = (id: string, phase?: Phase) => {
    const player = TestPlayer.BLACK.newPlayer();
    player.name = 'Victor';
    const game = Game.newInstance(id as 'game-id', [player], player, `s-${id}` as 'spectator-id');
    if (phase !== undefined) {
      game.phase = phase;
    }
    void scaffolding.ctx.gameLoader.add(game);
    return game;
  };

  const ids = (): Array<string> =>
    (JSON.parse(res.content) as Array<JoinableGameSummary>).map((g) => g.id);

  it('returns nothing without a name', async () => {
    addGame('game-live');
    scaffolding.url = '/api/games/joinable';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(res.content).eq('[]');
  });

  it('lists the live games by default and never a finished one', async () => {
    addGame('game-live');
    addGame('game-done', Phase.END);
    scaffolding.url = '/api/games/joinable?name=victor';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(ids()).deep.eq(['game-live']);
  });

  it('status=finished lists the archive instead', async () => {
    addGame('game-live');
    addGame('game-done', Phase.END);
    scaffolding.url = '/api/games/joinable?name=victor&status=finished';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    const summaries = JSON.parse(res.content) as Array<JoinableGameSummary>;
    expect(summaries.map((g) => g.id)).deep.eq(['game-done']);
    expect(summaries[0].finished).eq(true);
    // The seat link is what lets the console re-enter and review the result.
    expect(summaries[0].you).not.eq(undefined);
  });

  it('an unknown status can never widen the slice — it falls back to active', async () => {
    addGame('game-live');
    addGame('game-done', Phase.END);
    scaffolding.url = '/api/games/joinable?name=victor&status=everything';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(ids()).deep.eq(['game-live']);
  });

  // ── Freshness ─────────────────────────────────────────────────────────────
  // The listing is cached per game (that is what keeps it cheap enough for a
  // LAN guest to probe). These are the cases that cache MUST NOT break — each
  // of them shipped as «the game exists but the menu says it does not».

  it('a game created AFTER a previous listing appears in the next one', async () => {
    addGame('game-first');
    scaffolding.url = '/api/games/joinable?name=victor';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(ids()).deep.eq(['game-first']);

    addGame('game-second');
    const res2 = new MockResponse();
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res2);
    const listed = (JSON.parse(res2.content) as Array<JoinableGameSummary>).map((g) => g.id);
    expect(listed).to.have.members(['game-first', 'game-second']);
  });

  it('a game that has since ENDED leaves the active slice and enters the archive', async () => {
    const game = addGame('game-turning');
    scaffolding.url = '/api/games/joinable?name=victor';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(ids()).deep.eq(['game-turning']);

    game.phase = Phase.END;
    const active = new MockResponse();
    await scaffolding.get(ApiGamesJoinable.INSTANCE, active);
    expect(active.content).eq('[]');

    scaffolding.url = '/api/games/joinable?name=victor&status=finished';
    const archive = new MockResponse();
    await scaffolding.get(ApiGamesJoinable.INSTANCE, archive);
    expect((JSON.parse(archive.content) as Array<JoinableGameSummary>).map((g) => g.id)).deep.eq(['game-turning']);
  });

  it('a DELETED game stops being listed', async () => {
    addGame('game-doomed');
    addGame('game-kept');
    scaffolding.url = '/api/games/joinable?name=victor';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(ids()).to.have.members(['game-doomed', 'game-kept']);

    await scaffolding.ctx.gameLoader.deleteGame('game-doomed' as 'game-id');
    const after = new MockResponse();
    await scaffolding.get(ApiGamesJoinable.INSTANCE, after);
    expect((JSON.parse(after.content) as Array<JoinableGameSummary>).map((g) => g.id)).deep.eq(['game-kept']);
  });

  it('a RENAMED seat is matched under the new name on the very next listing', async () => {
    const game = addGame('game-rename');
    scaffolding.url = '/api/games/joinable?name=victor';
    await scaffolding.get(ApiGamesJoinable.INSTANCE, res);
    expect(ids()).deep.eq(['game-rename']);

    game.players[0].name = 'Nadia';
    const asVictor = new MockResponse();
    await scaffolding.get(ApiGamesJoinable.INSTANCE, asVictor);
    expect(asVictor.content).eq('[]');

    scaffolding.url = '/api/games/joinable?name=NADIA';
    const asNadia = new MockResponse();
    await scaffolding.get(ApiGamesJoinable.INSTANCE, asNadia);
    expect((JSON.parse(asNadia.content) as Array<JoinableGameSummary>).map((g) => g.id)).deep.eq(['game-rename']);
  });
});
