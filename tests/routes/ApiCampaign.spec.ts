import {expect} from 'chai';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {ApiCampaign} from '../../src/server/routes/ApiCampaign';
import {ApiCampaignCreate} from '../../src/server/routes/ApiCampaignCreate';
import {ApiCampaignLaunch} from '../../src/server/routes/ApiCampaignLaunch';
import {ApiCampaignDev} from '../../src/server/routes/ApiCampaignDev';
import {ApiCampaignBid} from '../../src/server/routes/ApiCampaignBid';
import {ApiCampaignTender} from '../../src/server/routes/ApiCampaignTender';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {CampaignModel} from '../../src/common/campaign/CampaignModel';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {campaignTestConfig} from '../campaign/CampaignManager.spec';

describe('ApiCampaign routes', () => {
  let scaffolding: RouteTestScaffolding;
  let req: MockRequest;
  let res: MockResponse;
  let db: InMemoryDatabase;
  let keySeq = 0;
  const key = () => `route-key-${Date.now()}-${keySeq++}`;

  beforeEach(() => {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    db = new InMemoryDatabase();
    setTestDatabase(db);
    CampaignManager.resetForTesting();
  });

  afterEach(() => {
    restoreTestDatabase();
    CampaignManager.resetForTesting();
  });

  async function postJson(handler: any, body: unknown): Promise<void> {
    const post = scaffolding.post(handler, res);
    const emit = Promise.resolve().then(() => {
      req.emitter.emit('data', JSON.stringify(body));
      req.emitter.emit('end');
    });
    await Promise.all([emit, post]);
  }

  it('create: persists and answers the creator view; a retry with the same key converges', async () => {
    const k = key();
    scaffolding.url = '/api/campaign/create';
    await postJson(ApiCampaignCreate.INSTANCE, {key: k, name: 'Alice', config: campaignTestConfig()});
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as CampaignModel;
    expect(model.id.startsWith('c')).is.true;
    expect(model.missions).has.length(4);
    expect(model.you?.seat).eq(0);
    expect(model.canLaunch).is.true;

    // Retry (lost response): the SAME campaign comes back.
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/campaign/create';
    await postJson(ApiCampaignCreate.INSTANCE, {key: k, name: 'Alice', config: campaignTestConfig()});
    const retry = JSON.parse(res.content) as CampaignModel;
    expect(retry.id).eq(model.id);
  });

  it('create: refuses a creator who does not occupy the first seat', async () => {
    scaffolding.url = '/api/campaign/create';
    await postJson(ApiCampaignCreate.INSTANCE, {key: key(), name: 'Bruno', config: campaignTestConfig()});
    expect(res.statusCode).eq(statusCode.badRequest);
  });

  it('get: answers the per-viewer model; an unknown id is 404', async () => {
    const created = await CampaignManager.getInstance().createCampaign(key(), campaignTestConfig());
    scaffolding.url = `/api/campaign?id=${created.id}&name=Bruno`;
    await scaffolding.get(ApiCampaign.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as CampaignModel;
    expect(model.you?.seat).eq(1);
    expect(model.canLaunch).is.false;

    res = new MockResponse();
    scaffolding.url = '/api/campaign?id=cdeadbeef&name=Bruno';
    await scaffolding.get(ApiCampaign.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('launch: creator-only via the route; a non-creator gets the named reason', async () => {
    const created = await CampaignManager.getInstance().createCampaign(key(), campaignTestConfig());
    scaffolding.url = `/api/campaign/launch?id=${created.id}&name=Bruno`;
    await postJson(ApiCampaignLaunch.INSTANCE, {});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('creator');

    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = `/api/campaign/launch?id=${created.id}&name=Alice`;
    await postJson(ApiCampaignLaunch.INSTANCE, {});
    expect(res.statusCode).eq(statusCode.ok);
    const answer = JSON.parse(res.content) as {gameId: string, yourPlayerId?: string};
    expect(answer.gameId.startsWith('g')).is.true;
    expect(answer.yourPlayerId?.startsWith('p')).is.true;
  });

  it('tender: a legacy tender\'s ACTIVATION on the carryover step is bearer-authenticated by the source-mission PlayerId', async () => {
    const manager = CampaignManager.getInstance();
    const created = await manager.createCampaign(key(), campaignTestConfig(), {rewardMode: 'tenders', missionCount: 3});
    await manager.devCommit(created.id, [0, 1], {tenders: {0: ['extendedLegacy']}});
    await manager.devCommit(created.id, [0, 1], {tenders: {}, carryoverPending: true, carryover: {0: []}});
    const loaded = (await manager.load(created.id))!;
    loaded.missions[1].playerIds = {0: 'p-route-alice', 1: 'p-route-bruno'};

    scaffolding.url = `/api/campaign/tender?id=${created.id}`;
    await postJson(ApiCampaignTender.INSTANCE, {playerId: 'p-forged', instance: 'dev0-0-0'});
    expect(res.statusCode).eq(statusCode.badRequest);

    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = `/api/campaign/tender?id=${created.id}`;
    await postJson(ApiCampaignTender.INSTANCE, {playerId: 'p-route-alice', instance: 'dev0-0-0'});
    expect(res.statusCode).eq(statusCode.ok);
    const answer = JSON.parse(res.content) as {carryover?: {yourLimit?: number, yourTenders?: Array<{status: string}>}};
    expect(answer.carryover?.yourLimit, 'the activated seat opened').eq(3);
    expect(answer.carryover?.yourTenders?.[0]?.status).eq('executed');
  });

  it('bid: the «Тендеры» mode\'s pick is bearer-authenticated by the source-mission PlayerId', async () => {
    const manager = CampaignManager.getInstance();
    const created = await manager.createCampaign(key(), campaignTestConfig(), {rewardMode: 'tenders'});
    await manager.launchMission(created.id, 'Alice');
    const pending = (await manager.load(created.id))!;
    // The real mission ends: the bidding opens, the first of the standings picks.
    const game = (await (await import('../../src/server/database/GameLoader')).GameLoader.getInstance().getGame(pending.missions[0].gameId!))!;
    await manager.commitMissionResult(game);
    const open = (await manager.load(created.id))!;
    expect(open.bidding?.done).is.false;
    const first = open.bidding!.order[0];
    const firstPid = open.missions[0].playerIds![first];
    const instance = open.bidding!.offer[0].instance;

    scaffolding.url = `/api/campaign/bid?id=${created.id}`;
    await postJson(ApiCampaignBid.INSTANCE, {playerId: 'p-forged', instance});
    expect(res.statusCode).eq(statusCode.badRequest);

    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = `/api/campaign/bid?id=${created.id}`;
    await postJson(ApiCampaignBid.INSTANCE, {playerId: firstPid, instance});
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as CampaignModel;
    expect(model.rewardMode).eq('tenders');
    expect(model.bidding, 'two seats: one pick closes the bidding').is.undefined;
    expect(model.missions[0].bidding?.done).is.true;
    expect(model.progression.tenders?.[first]).has.length(1);
    expect(model.you?.seat, 'the answer is the picker\'s own view').eq(first);
  });

  it('dev fast-forward is gated on the admin name', async () => {
    const created = await CampaignManager.getInstance().createCampaign(key(), campaignTestConfig());
    scaffolding.url = '/api/campaign/dev?name=alice';
    await postJson(ApiCampaignDev.INSTANCE, {campaignId: created.id, placements: [0, 1]});
    expect(res.statusCode).eq(statusCode.forbidden);

    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/campaign/dev?name=admin';
    await postJson(ApiCampaignDev.INSTANCE, {campaignId: created.id, placements: [0, 1]});
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as CampaignModel;
    expect(model.phase).eq('interlude');
    expect(model.pointer).eq(1);
  });
});
