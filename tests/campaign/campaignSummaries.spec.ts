import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {campaignTestConfig} from './CampaignManager.spec';
import {GameLoader} from '../../src/server/database/GameLoader';
import {Color} from '../../src/common/Color';
import {GameId} from '../../src/common/Types';
import {CampaignSummaryModel} from '../../src/common/campaign/CampaignSummary';

// The exact public surface of a summary — a field added to the type must be
// added here CONSCIOUSLY (the summary is the privacy boundary of the list).
const SUMMARY_KEYS = [
  'id', 'rev', 'name', 'createdTimeMs', 'lastActivityMs', 'phase', 'pointer',
  'missionCount', 'completedMissions', 'missionGamesCount', 'currentBoard',
  'seats', 'you', 'isCreator', 'state', 'blockedReason', 'missionGameId',
  'championSeats', 'yourTitlePoints',
];

describe('CampaignManager.listSummaries', () => {
  let db: InMemoryDatabase;
  let manager: CampaignManager;
  let keySeq = 0;
  const key = () => `sum-key-${Date.now()}-${keySeq++}`;

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

  it('an empty viewer name answers an empty list', async () => {
    await manager.createCampaign(key(), campaignTestConfig());
    expect(await manager.listSummaries('')).deep.eq([]);
    expect(await manager.listSummaries('   ')).deep.eq([]);
  });

  it('is participant-scoped by normalized name', async () => {
    await manager.createCampaign(key(), campaignTestConfig());
    expect(await manager.listSummaries('Alice')).has.length(1);
    expect(await manager.listSummaries(' ALICE ')).has.length(1);
    expect(await manager.listSummaries('Bruno')).has.length(1);
    expect(await manager.listSummaries('Carol')).has.length(0);
  });

  it('a freshly generated campaign (no mission launched) is listed: creator launchReady, other seat waitingLaunch', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const [forAlice] = await manager.listSummaries('Alice');
    expect(forAlice.id).eq(campaign.id);
    expect(forAlice.phase).eq('generated');
    expect(forAlice.state).eq('launchReady');
    expect(forAlice.isCreator).is.true;
    expect(forAlice.missionGamesCount).eq(0);
    expect(forAlice.completedMissions).eq(0);
    expect(forAlice.currentBoard).eq(campaign.missions[0].board);
    const [forBruno] = await manager.listSummaries('Bruno');
    expect(forBruno.state).eq('waitingLaunch');
    expect(forBruno.isCreator).is.false;
  });

  it('an active mission: one row (never per-mission), «ваш ход» only with the matching live color', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const aliceTurn = new Map<GameId, Color>([[gameId, 'blue' as Color]]);
    const [forAlice] = await manager.listSummaries('Alice', aliceTurn);
    expect(forAlice.state).eq('yourTurn');
    expect(forAlice.missionGameId).eq(gameId);
    expect(forAlice.missionGamesCount).eq(1);
    const [forBruno] = await manager.listSummaries('Bruno', aliceTurn);
    expect(forBruno.state).eq('missionActive');
    // Without turn context the state degrades honestly.
    const [plain] = await manager.listSummaries('Alice');
    expect(plain.state).eq('missionActive');
    // Still exactly one row per campaign.
    expect(await manager.listSummaries('Alice')).has.length(1);
  });

  it('the interlude walks carryover states: choose → waitingOthers → launchReady/waitingLaunch', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    await manager.commitMissionResult(game);

    let [forAlice] = await manager.listSummaries('Alice');
    expect(forAlice.phase).eq('interlude');
    expect(forAlice.state).eq('chooseCarryover');
    expect(forAlice.completedMissions).eq(1);
    expect(forAlice.pointer).eq(1);
    const loaded = (await manager.load(campaign.id))!;
    expect(forAlice.currentBoard).eq(loaded.missions[1].board);
    expect(forAlice.lastActivityMs).eq(loaded.missions[0].result!.committedAtMs);

    const alicePid = loaded.missions[0].playerIds![0];
    await manager.submitCarryover(campaign.id, alicePid, []);
    [forAlice] = await manager.listSummaries('Alice');
    expect(forAlice.state).eq('waitingOthers');
    let [forBruno] = await manager.listSummaries('Bruno');
    expect(forBruno.state).eq('chooseCarryover');

    const brunoPid = loaded.missions[0].playerIds![1];
    await manager.submitCarryover(campaign.id, brunoPid, []);
    [forAlice] = await manager.listSummaries('Alice');
    expect(forAlice.state).eq('launchReady');
    [forBruno] = await manager.listSummaries('Bruno');
    expect(forBruno.state).eq('waitingLaunch');
  });

  it('finished and abandoned classify by the CANONICAL campaign phase', async () => {
    const finished = await manager.createCampaign(key(), campaignTestConfig());
    for (let i = 0; i < 4; i++) {
      await manager.devCommit(finished.id, [0, 1], {carryover: {0: [], 1: []}});
    }
    const dropped = await manager.createCampaign(key(), campaignTestConfig());
    await manager.abandon(dropped.id, 'Alice');

    const rows = await manager.listSummaries('Alice');
    expect(rows).has.length(2);
    const fin = rows.find((r) => r.id === finished.id)!;
    expect(fin.phase).eq('finished');
    expect(fin.state).eq('finished');
    expect(fin.completedMissions).eq(4);
    expect(fin.championSeats).deep.eq([0]);
    expect(fin.yourTitlePoints).greaterThan(0);
    const aband = rows.find((r) => r.id === dropped.id)!;
    expect(aband.phase).eq('abandoned');
    expect(aband.state).eq('abandoned');
  });

  it('the summary carries EXACTLY the declared public fields — no hands, no carryover cards, no PlayerIds', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;
    alice.cardsInHand.push(...alice.dealtProjectCards.slice(0, 3));
    await manager.commitMissionResult(game);

    const [summary] = await manager.listSummaries('Alice');
    expect(Object.keys(summary).sort()).deep.eq([...SUMMARY_KEYS].sort());
    const json = JSON.stringify(summary);
    expect(json).to.not.include('finalHands');
    expect(json).to.not.include('carryover');
    // No participant token anywhere (PlayerIds are p-prefixed 13+ char ids).
    for (const pid of Object.values((await manager.load(campaign.id))!.missions[0].playerIds ?? {})) {
      expect(json).to.not.include(pid);
    }
  });

  it('the base order is deterministic: newest activity first, id as the tiebreak', async () => {
    const a = await manager.createCampaign(key(), campaignTestConfig());
    const b = await manager.createCampaign(key(), campaignTestConfig());
    // Same createdTimeMs tick is possible — the id tiebreak keeps it stable.
    const once = await manager.listSummaries('Alice');
    const twice = await manager.listSummaries('Alice');
    expect(once.map((r: CampaignSummaryModel) => r.id)).deep.eq(twice.map((r: CampaignSummaryModel) => r.id));
    expect(once.map((r) => r.id).sort()).to.have.members([a.id, b.id]);
  });
});
