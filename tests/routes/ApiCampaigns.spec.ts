import {expect} from 'chai';
import {ApiCampaigns} from '../../src/server/routes/ApiCampaigns';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {LobbyIndex} from '../../src/server/models/lobbyIndex';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {campaignTestConfig} from '../campaign/CampaignManager.spec';
import {CampaignSummaryModel} from '../../src/common/campaign/CampaignSummary';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiCampaigns', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    setTestDatabase(new InMemoryDatabase());
    CampaignManager.resetForTesting();
    LobbyIndex.resetForTesting();
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  afterEach(() => {
    restoreTestDatabase();
    CampaignManager.resetForTesting();
    LobbyIndex.resetForTesting();
  });

  it('an empty name answers an empty list (200, like the joinable route)', async () => {
    scaffolding.url = '/api/campaigns';
    await ApiCampaigns.INSTANCE.get(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);
    expect(JSON.parse(res.content)).deep.eq([]);
  });

  it('lists exactly the campaigns the named viewer holds a seat in', async () => {
    const manager = CampaignManager.getInstance();
    const campaign = await manager.createCampaign('list-route-key-1', campaignTestConfig());

    scaffolding.url = '/api/campaigns?name=Alice';
    await ApiCampaigns.INSTANCE.get(scaffolding.req, res, scaffolding.ctx);
    const rows = JSON.parse(res.content) as Array<CampaignSummaryModel>;
    expect(rows).has.length(1);
    expect(rows[0].id).eq(campaign.id);
    expect(rows[0].isCreator).is.true;
    expect(rows[0].state).eq('launchReady');

    const res2 = new MockResponse();
    const s2 = new RouteTestScaffolding();
    s2.url = '/api/campaigns?name=Carol';
    await ApiCampaigns.INSTANCE.get(s2.req, res2, s2.ctx);
    expect(JSON.parse(res2.content)).deep.eq([]);
  });
});
