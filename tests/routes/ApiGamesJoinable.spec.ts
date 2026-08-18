import {expect} from 'chai';
import {ApiGamesJoinable} from '../../src/server/routes/ApiGamesJoinable';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {JoinableGameSummary} from '../../src/common/models/JoinableGameModel';
import {Phase} from '../../src/common/Phase';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiGamesJoinable', () => {
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;

  beforeEach(() => {
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
});
