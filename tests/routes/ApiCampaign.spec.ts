import {expect} from 'chai';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {ApiCampaign} from '../../src/server/routes/ApiCampaign';
import {ApiCampaignCreate} from '../../src/server/routes/ApiCampaignCreate';
import {ApiCampaignLaunch} from '../../src/server/routes/ApiCampaignLaunch';
import {ApiCampaignDev} from '../../src/server/routes/ApiCampaignDev';
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
