import {expect} from 'chai';
import {ApiLocalGameDelete, isLoopbackIp} from '../../src/server/routes/ApiLocalGameDelete';
import {RealtimeHub, GameInvalidation} from '../../src/server/server/realtime/RealtimeHub';
import {CampaignGameContract} from '../../src/server/game/GameOptions';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiLocalGameDelete', () => {
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;
  let invalidations: Array<GameInvalidation>;
  const realGetInstance = RealtimeHub.getInstance;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
    invalidations = [];
    // The route broadcasts a room invalidation per deletion — capture them.
    RealtimeHub.getInstance = () => ({
      invalidate: (update: GameInvalidation) => {
        invalidations.push(update);
        return 0;
      },
    } as unknown as RealtimeHub);
  });

  afterEach(() => {
    RealtimeHub.getInstance = realGetInstance;
  });

  const addGame = (id: string) => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance(id as 'game-id', [player], player, `s-${id}` as 'spectator-id');
    scaffolding.ctx.gameLoader.add(game);
    return game;
  };

  it('rejects a non-loopback caller (a LAN guest must not erase the host library)', async () => {
    scaffolding.ctx.ip = '!192.168.1.20!';
    addGame('game-lan');
    scaffolding.url = '/api/local-game-delete?id=game-lan';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.content).eq('Not authorized');
    const ids = await scaffolding.ctx.gameLoader.getIds();
    expect(ids.map((e) => e.gameId)).to.include('game-lan');
  });

  it('requires an id (or all=1)', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    scaffolding.url = '/api/local-game-delete';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(400);
  });

  it('404s an unknown game', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    scaffolding.url = '/api/local-game-delete?id=game-nope';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(404);
  });

  it('deletes one game over loopback and broadcasts the invalidation', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    const game = addGame('game-one');
    addGame('game-two');
    // Game.newInstance itself saves (async) through the REAL GameLoader
    // singleton (tests/testing/setup.ts) → one creation-time invalidation per
    // game, landing a microtask later. Drain them, then count only the route's.
    await new Promise((resolve) => setTimeout(resolve, 0));
    invalidations = [];

    scaffolding.url = '/api/local-game-delete?id=game-one';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);
    expect(JSON.parse(res.content).deleted).deep.eq(['game-one']);

    const ids = (await scaffolding.ctx.gameLoader.getIds()).map((e) => e.gameId);
    expect(ids).to.not.include('game-one');
    expect(ids).to.include('game-two');

    expect(invalidations).has.length(1);
    expect(invalidations[0].gameId).eq('game-one');
    // One PAST the last known age — every subscriber's cursor reads "newer".
    expect(invalidations[0].gameAge).eq(game.gameAge + 1);
  });

  it('all=1 deletes every game, notifying each room', async () => {
    scaffolding.ctx.ip = '!::1!';
    addGame('game-a');
    addGame('game-b');
    addGame('game-c');
    await new Promise((resolve) => setTimeout(resolve, 0));
    invalidations = []; // drop the async creation-time saves (see above)

    scaffolding.url = '/api/local-game-delete?all=1';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);
    expect(JSON.parse(res.content).deleted).to.have.members(['game-a', 'game-b', 'game-c']);
    expect(await scaffolding.ctx.gameLoader.getIds()).has.length(0);
    expect(invalidations.map((i) => i.gameId)).to.have.members(['game-a', 'game-b', 'game-c']);
  });

  it('refuses to delete a campaign mission alone (the campaign owns its games)', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    const game = addGame('game-mission');
    (game.gameOptions as {campaign?: CampaignGameContract}).campaign = {
      campaignId: 'c0123456789ab', campaignName: 'Test', missionSlot: 0, missionCount: 4, final: false, grants: [],
    };
    scaffolding.url = '/api/local-game-delete?id=game-mission';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(422);
    expect(res.content).contains('part of a campaign');
    const ids = await scaffolding.ctx.gameLoader.getIds();
    expect(ids.map((e) => e.gameId)).to.include('game-mission');
  });

  it('all=1 SKIPS campaign missions — a bulk delete never cascades into campaigns', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    addGame('game-plain');
    const mission = addGame('game-mission-2');
    (mission.gameOptions as {campaign?: CampaignGameContract}).campaign = {
      campaignId: 'c0123456789ab', campaignName: 'Test', missionSlot: 1, missionCount: 4, final: false, grants: [],
    };
    scaffolding.url = '/api/local-game-delete?all=1';
    scaffolding.req.method = 'POST';
    await ApiLocalGameDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);
    const body = JSON.parse(res.content) as {deleted: Array<string>, skippedCampaignGames: Array<string>};
    expect(body.deleted).to.include('game-plain');
    expect(body.deleted).to.not.include('game-mission-2');
    expect(body.skippedCampaignGames).to.include('game-mission-2');
    const ids = (await scaffolding.ctx.gameLoader.getIds()).map((e) => e.gameId);
    expect(ids).to.include('game-mission-2');
    expect(ids).to.not.include('game-plain');
  });

  it('isLoopbackIp recognizes every loopback form and nothing else', () => {
    for (const ip of ['!127.0.0.1!', '!::1!', '!::ffff:127.0.0.1!', '127.0.0.1', '::1']) {
      expect(isLoopbackIp(ip), ip).eq(true);
    }
    for (const ip of ['!192.168.1.5!', '!10.0.0.2!', '!::ffff:192.168.1.5!', '203.0.113.7', '']) {
      expect(isLoopbackIp(ip), ip).eq(false);
    }
  });
});
