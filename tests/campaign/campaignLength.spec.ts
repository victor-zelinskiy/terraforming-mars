import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {holdingsForSlot} from '../../src/server/campaign/botPortfolio';
import {CAMPAIGN_MISSION_COUNT, CAMPAIGN_MISSION_COUNTS, isCampaignMissionCount} from '../../src/common/campaign/CampaignTypes';
import {campaignTestConfig} from './CampaignManager.spec';

/**
 * THE CAMPAIGN'S LENGTH (2026-11-07): the creator chooses 3…6 missions (default 4); the LAST is always the finale.
 * Everything downstream reads the route's own `missions.length` — these pin the places the length is a rule.
 */
describe('Campaign length (3…6 missions, the last the finale)', () => {
  let db: InMemoryDatabase;
  let manager: CampaignManager;
  let keySeq = 0;
  const key = () => `len-key-${Date.now()}-${keySeq++}`;

  beforeEach(() => {
    db = new InMemoryDatabase();
    setTestDatabase(db);
    CampaignManager.resetForTesting();
    manager = CampaignManager.getInstance();
  });

  afterEach(() => {
    restoreTestDatabase();
    CampaignManager.resetForTesting();
  });

  it('the ladder is 3 · 4 · 5 · 6, four by default', () => {
    expect([...CAMPAIGN_MISSION_COUNTS]).deep.eq([3, 4, 5, 6]);
    expect(CAMPAIGN_MISSION_COUNT).eq(4);
    expect(isCampaignMissionCount(2)).is.false;
    expect(isCampaignMissionCount(7)).is.false;
    expect(isCampaignMissionCount('5')).is.false;
  });

  for (const count of CAMPAIGN_MISSION_COUNTS) {
    it(`a ${count}-mission route: ${count} unique boards, the model names the length and marks ONLY the last as the finale`, async () => {
      const campaign = await manager.createCampaign(key(), campaignTestConfig(), {missionCount: count});
      expect(campaign.missions).has.length(count);
      expect(new Set(campaign.missions.map((m) => m.board)).size).eq(count);
      const model = manager.getModel(campaign, 'Alice');
      expect(model.missionCount).eq(count);
      expect(model.missions.map((m) => m.final)).deep.eq([...Array(count).keys()].map((i) => i === count - 1));
    });
  }

  it('a length off the ladder (or none) is the default four', async () => {
    for (const missionCount of [undefined, 2, 7, 4.5]) {
      const campaign = await manager.createCampaign(key(), campaignTestConfig(), {missionCount});
      expect(campaign.missions, `missionCount ${missionCount}`).has.length(4);
    }
  });

  it('a three-mission campaign: two committed missions, then the launched game IS the finale', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig(), {missionCount: 3});
    await manager.devCommit(campaign.id, [1, 0], {carryover: {0: [], 1: []}});
    await manager.devCommit(campaign.id, [0, 1], {carryover: {0: [], 1: []}});
    const loaded = (await manager.load(campaign.id))!;
    expect(loaded.pointer).eq(2);
    expect(loaded.phase).eq('interlude');
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const stored = await db.getGame(gameId);
    expect(stored.gameOptions.campaign?.final).is.true;
    expect(stored.gameOptions.campaign?.missionCount).eq(3);
    expect(stored.gameOptions.campaign?.missionSlot).eq(2);
  });

  it('a six-mission campaign is finished by its sixth commit, never by its fourth', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig(), {missionCount: 6});
    for (let i = 0; i < 4; i++) {
      await manager.devCommit(campaign.id, [i % 2, (i + 1) % 2], {carryover: {0: [], 1: []}});
    }
    expect((await manager.load(campaign.id))!.phase).eq('interlude');
    await manager.devCommit(campaign.id, [0, 1], {carryover: {0: [], 1: []}});
    await manager.devCommit(campaign.id, [1, 0]);
    const finished = (await manager.load(campaign.id))!;
    expect(finished.phase).eq('finished');
    expect(finished.championSeats).deep.eq([1]);
    // Titles on every mission but the finale: 5 × 2.
    expect(finished.progression.titles).has.length(10);
  });

  it('the bot keeps the humans\' rhythm on any length: one holding more per mission, none added by the finale', () => {
    const at = (count: number) => [...Array(count).keys()].map((slot) => holdingsForSlot(slot, count));
    expect(at(3)).deep.eq([0, 1, 1]);
    expect(at(4)).deep.eq([0, 1, 2, 2]);
    expect(at(5)).deep.eq([0, 1, 2, 3, 3]);
    expect(at(6)).deep.eq([0, 1, 2, 3, 4, 4]);
  });

  it('the corporation pool must last the WHOLE route — a longer campaign asks for more', async () => {
    // The test config's pool is 12 corporations. Three humans dealt two each need 6 + 3 × (missionCount − 2):
    // 12 on the default route (fits exactly), 15 on a five-mission one (refused, named).
    const players = ['Alice', 'Bruno', 'Cyra'].map((name, i) => ({
      name, color: (['blue', 'red', 'green'] as const)[i], beginner: false, handicap: 0, first: i === 0,
    }));
    const config = campaignTestConfig({players});
    const refusal = await manager.createCampaign(key(), config, {missionCount: 5}).then(() => undefined, (e: Error) => e);
    expect(refusal?.message).eq('Not enough unique corporations for a campaign: 12 available, 15 required');
    const shorter = await manager.createCampaign(key(), config, {missionCount: 4});
    expect(shorter.missions).has.length(4);
    // A THREE-mission route deals corporations on the finale too (its lineage is two short of the company of
    // three), so it asks for the same 12: 6 dealt + 3 humans × 2 banned before the finale's deal.
    const three = await manager.createCampaign(key(), config, {missionCount: 3});
    expect(three.missions).has.length(3);
  });
});
