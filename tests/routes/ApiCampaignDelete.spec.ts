import {expect} from 'chai';
import {ApiCampaignDelete} from '../../src/server/routes/ApiCampaignDelete';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {campaignTestConfig} from '../campaign/CampaignManager.spec';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiCampaignDelete', () => {
  let db: InMemoryDatabase;
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    db = new InMemoryDatabase();
    setTestDatabase(db);
    CampaignManager.resetForTesting();
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  afterEach(() => {
    restoreTestDatabase();
    CampaignManager.resetForTesting();
  });

  it('rejects an invalid campaign id', async () => {
    scaffolding.url = '/api/campaign/delete?id=nope&name=Alice';
    scaffolding.req.method = 'POST';
    await ApiCampaignDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(400);
  });

  it('refuses a non-creator with the reason', async () => {
    const campaign = await CampaignManager.getInstance().createCampaign('del-route-key-1', campaignTestConfig());
    scaffolding.url = `/api/campaign/delete?id=${campaign.id}&name=Bruno`;
    scaffolding.req.method = 'POST';
    await ApiCampaignDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(400);
    expect(res.content).contains('creator');
    expect(db.campaigns.has(campaign.id)).is.true;
  });

  it('the creator deletes; the response names the cascade', async () => {
    const manager = CampaignManager.getInstance();
    const campaign = await manager.createCampaign('del-route-key-2', campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    scaffolding.url = `/api/campaign/delete?id=${campaign.id}&name=Alice`;
    scaffolding.req.method = 'POST';
    await ApiCampaignDelete.INSTANCE.processRequest(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);
    const body = JSON.parse(res.content) as {campaignId: string, deletedGames: Array<string>};
    expect(body.campaignId).eq(campaign.id);
    expect(body.deletedGames).deep.eq([gameId]);
    expect(db.campaigns.has(campaign.id)).is.false;
    expect(db.games.has(gameId)).is.false;
  });
});
