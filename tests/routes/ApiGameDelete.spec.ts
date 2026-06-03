import {expect} from 'chai';
import {ApiGameDelete} from '../../src/server/routes/ApiGameDelete';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiGameDelete', () => {
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('validates server id', async () => {
    scaffolding.url = '/api/game/delete?id=game-id';
    scaffolding.req.method = 'POST';
    await ApiGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.content).eq('Not authorized');
  });

  it('requires an id', async () => {
    scaffolding.url = '/api/game/delete?serverId=1';
    scaffolding.req.method = 'POST';
    await ApiGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(400);
  });

  it('deletes a game', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    await scaffolding.ctx.gameLoader.add(Game.newInstance('game-id', [player], player, 'spectatorid'));

    let ids = await scaffolding.ctx.gameLoader.getIds();
    expect(ids.map((entry) => entry.gameId)).to.include('game-id');

    scaffolding.url = '/api/game/delete?serverId=1&id=game-id';
    scaffolding.req.method = 'POST';
    await ApiGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);

    ids = await scaffolding.ctx.gameLoader.getIds();
    expect(ids.map((entry) => entry.gameId)).to.not.include('game-id');
  });
});
