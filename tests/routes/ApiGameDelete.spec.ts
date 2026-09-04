import {expect} from 'chai';
import {ApiGameDelete} from '../../src/server/routes/ApiGameDelete';
import {CampaignGameContract} from '../../src/server/game/GameOptions';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
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

  it('refuses to delete a campaign mission (the campaign cascade is the door)', async () => {
    const db = new InMemoryDatabase();
    setTestDatabase(db);
    try {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-camp', [player], player, 'spectatorid2');
      (game.gameOptions as {campaign?: CampaignGameContract}).campaign = {
        campaignId: 'c0123456789ab', campaignName: 'Test', missionSlot: 0, missionCount: 4, final: false, grants: [],
      };
      await db.saveGame(game);
      await scaffolding.ctx.gameLoader.add(game);

      scaffolding.url = '/api/game/delete?serverId=1&id=game-camp';
      scaffolding.req.method = 'POST';
      await ApiGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
      expect(res.statusCode).eq(400);
      expect(res.content).contains('part of a campaign');
      const ids = await scaffolding.ctx.gameLoader.getIds();
      expect(ids.map((entry) => entry.gameId)).to.include('game-camp');
    } finally {
      restoreTestDatabase();
    }
  });
});
