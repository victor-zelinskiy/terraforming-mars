import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {campaignTestConfig} from './CampaignManager.spec';
import {GameLoader} from '../../src/server/database/GameLoader';
import {RealtimeHub, GameInvalidation} from '../../src/server/server/realtime/RealtimeHub';

describe('CampaignManager.deleteCampaign (cascade)', () => {
  let db: InMemoryDatabase;
  let manager: CampaignManager;
  let keySeq = 0;
  const key = () => `del-key-${Date.now()}-${keySeq++}`;
  let invalidations: Array<GameInvalidation>;
  const realGetInstance = RealtimeHub.getInstance;

  beforeEach(() => {
    db = new InMemoryDatabase();
    setTestDatabase(db);
    CampaignManager.resetForTesting();
    manager = CampaignManager.getInstance();
    invalidations = [];
    RealtimeHub.getInstance = () => ({
      invalidate: (update: GameInvalidation) => {
        invalidations.push(update);
        return 0;
      },
      invalidateLobby: () => 0,
    } as unknown as RealtimeHub);
  });

  afterEach(() => {
    RealtimeHub.getInstance = realGetInstance;
    restoreTestDatabase();
    CampaignManager.resetForTesting();
  });

  const failureOf = (p: Promise<unknown>) => p.then(() => undefined, (e) => e as Error);

  it('an ordinary participant cannot delete the shared campaign', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const error = await failureOf(manager.deleteCampaign(campaign.id, 'Bruno'));
    expect(error?.message).contains('creator');
    const stranger = await failureOf(manager.deleteCampaign(campaign.id, 'Carol'));
    expect(stranger?.message).contains('creator');
    expect(await manager.load(campaign.id)).is.not.undefined;
    expect(db.campaigns.has(campaign.id)).is.true;
  });

  it('the creator deletes a campaign with no launched mission (and a repeat is a no-op success)', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const result = await manager.deleteCampaign(campaign.id, 'Alice');
    expect(result.deletedGames).deep.eq([]);
    expect(db.campaigns.has(campaign.id)).is.false;
    expect(await manager.load(campaign.id)).is.undefined;
    // Idempotent repeat.
    const again = await manager.deleteCampaign(campaign.id, 'Alice');
    expect(again.deletedGames).deep.eq([]);
  });

  it('the ADMIN_NAME identity may also delete (the administrative mechanism)', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    await manager.deleteCampaign(campaign.id, 'admin');
    expect(db.campaigns.has(campaign.id)).is.false;
  });

  it('cascades into the launched mission game: saves gone, loader gone, subscribers woken', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    expect(db.games.has(gameId)).is.true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    invalidations = []; // drop creation-time saves' broadcasts

    const result = await manager.deleteCampaign(campaign.id, 'Alice');
    expect(result.deletedGames).deep.eq([gameId]);
    expect(db.games.has(gameId)).is.false;
    expect(db.campaigns.has(campaign.id)).is.false;
    // The canonical delete path also evicted the loader's instance.
    expect(await GameLoader.getInstance().getGame(gameId)).is.undefined;
    // Active participants are woken: one-past-the-known-age invalidation.
    const wake = invalidations.find((i) => i.gameId === gameId);
    expect(wake).is.not.undefined;
    expect(wake!.gameAge).greaterThan(0);
  });

  it('a MISSING mission game never blocks the rest of the cascade', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    // The mission game vanished (purge / manual cleanup) — delete anyway.
    db.games.delete(gameId);
    await GameLoader.getInstance().deleteGame(gameId);
    const result = await manager.deleteCampaign(campaign.id, 'Alice');
    expect(result.deletedGames).deep.eq([]);
    expect(db.campaigns.has(campaign.id)).is.false;
  });

  it('a FOREIGN game named by a corrupted document is NEVER deleted', async () => {
    // Campaign A owns a real mission game.
    const a = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId: foreignGame} = await manager.launchMission(a.id, 'Alice');
    // Campaign B's document is corrupted to point at A's game.
    const b = await manager.createCampaign(key(), campaignTestConfig());
    const raw = (await db.getCampaign(b.id))!;
    raw.missions[0].gameId = foreignGame;
    await db.saveCampaign(raw);
    CampaignManager.resetForTesting();
    const fresh = CampaignManager.getInstance();

    const result = await fresh.deleteCampaign(b.id, 'Alice');
    expect(result.deletedGames).deep.eq([]);
    // B is gone; A's game survives untouched, A still opens.
    expect(db.campaigns.has(b.id)).is.false;
    expect(db.games.has(foreignGame)).is.true;
    expect(await fresh.load(a.id)).is.not.undefined;
  });

  it('crash recovery: a tombstoned campaign resumes its cascade on the next read', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    // Simulate the crash window: tombstone persisted, cascade not yet run.
    const raw = (await db.getCampaign(campaign.id))!;
    raw.deletingAtMs = Date.now();
    await db.saveCampaign(raw);
    CampaignManager.resetForTesting();
    const fresh = CampaignManager.getInstance();

    // The next read resumes the deletion and reports the campaign as gone.
    expect(await fresh.load(campaign.id)).is.undefined;
    expect(db.campaigns.has(campaign.id)).is.false;
    expect(db.games.has(gameId)).is.false;
  });

  it('a deleting campaign refuses every mutation and leaves the list', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const raw = (await db.getCampaign(campaign.id))!;
    raw.deletingAtMs = Date.now();
    await db.saveCampaign(raw);
    CampaignManager.resetForTesting();
    const fresh = CampaignManager.getInstance();

    const launch = await failureOf(fresh.launchMission(campaign.id, 'Alice'));
    expect(launch?.message).contains('not found');
    expect(await fresh.listSummaries('Alice')).has.length(0);
  });

  it('deletes an ACTIVE campaign as safely as a finished one (both cascade fully)', async () => {
    // Active: one live mission.
    const active = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId: liveGame} = await manager.launchMission(active.id, 'Alice');
    // Finished: dev fast-forward through all four missions (no real games).
    const finished = await manager.createCampaign(key(), campaignTestConfig());
    for (let i = 0; i < 4; i++) {
      await manager.devCommit(finished.id, [0, 1], {carryover: {0: [], 1: []}});
    }
    await manager.deleteCampaign(active.id, 'Alice');
    await manager.deleteCampaign(finished.id, 'Alice');
    expect(db.games.has(liveGame)).is.false;
    expect(db.campaigns.size).eq(0);
  });
});
