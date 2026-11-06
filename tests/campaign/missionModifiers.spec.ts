import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {BoardName} from '../../src/common/boards/BoardName';
import {
  CAMPAIGN_RANDOM_MA_CHANCES,
  DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE,
  RANDOM_MA_MODIFIER,
  hasMissionModifier,
  isCampaignRandomMAChance,
} from '../../src/common/campaign/missionModifiers';
import {boardAlwaysDrawsMA, missionRandomMA, rollSlotModifiers, slotModifiersOf} from '../../src/server/campaign/missionModifiers';
import {campaignTestConfig} from './CampaignManager.spec';

describe('Campaign mission modifiers («Случайные цели и награды» per mission)', () => {
  let db: InMemoryDatabase;
  let manager: CampaignManager;
  let keySeq = 0;
  const key = () => `mod-key-${Date.now()}-${keySeq++}`;

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

  it('the chance ladder is the owner\'s six values, 20 % by default', () => {
    expect([...CAMPAIGN_RANDOM_MA_CHANCES]).deep.eq([10, 15, 20, 30, 40, 50]);
    expect(DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE).eq(20);
    expect(isCampaignRandomMAChance(30)).is.true;
    expect(isCampaignRandomMAChance(25)).is.false;
    expect(isCampaignRandomMAChance('30')).is.false;
  });

  it('a board with no printed row (Hollandia) always carries the modifier — whatever the roll, rule on or off', () => {
    expect(boardAlwaysDrawsMA(BoardName.HOLLANDIA)).is.true;
    expect(boardAlwaysDrawsMA(BoardName.THARSIS)).is.false;
    expect(rollSlotModifiers(BoardName.HOLLANDIA, 0, 0.99)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
    expect(rollSlotModifiers(BoardName.THARSIS, 0, 0)).deep.eq([]);
  });

  it('a printed board rolls against the chance', () => {
    expect(rollSlotModifiers(BoardName.THARSIS, 20, 0.19)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
    expect(rollSlotModifiers(BoardName.THARSIS, 20, 0.2)).deep.eq([]);
    expect(rollSlotModifiers(BoardName.THARSIS, 50, 0.49)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
  });

  it('rule OFF: no roll — only a row-less board is marked, and the chance is recorded as 0', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig(), {randomMAChance: 50});
    expect(campaign.generator.randomMAChance).eq(0);
    for (const slot of campaign.missions) {
      expect(hasMissionModifier(slot.modifiers, RANDOM_MA_MODIFIER)).eq(boardAlwaysDrawsMA(slot.board));
    }
  });

  it('rule ON: the chosen chance is recorded; a value off the ladder falls back to the default', async () => {
    const chosen = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}), {randomMAChance: 40});
    expect(chosen.generator.randomMAChance).eq(40);
    const stray = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}), {randomMAChance: 33});
    expect(stray.generator.randomMAChance).eq(DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE);
    const absent = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}));
    expect(absent.generator.randomMAChance).eq(DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE);
  });

  it('rule ON at 50 %: over many routes, roughly half of the printed boards roll the modifier', async () => {
    let printed = 0;
    let rolled = 0;
    for (let i = 0; i < 60; i++) {
      const campaign = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}), {randomMAChance: 50});
      for (const slot of campaign.missions) {
        if (boardAlwaysDrawsMA(slot.board)) {
          expect(hasMissionModifier(slot.modifiers, RANDOM_MA_MODIFIER)).is.true;
          continue;
        }
        printed++;
        if (hasMissionModifier(slot.modifiers, RANDOM_MA_MODIFIER)) {
          rolled++;
        }
      }
    }
    const share = rolled / printed;
    expect(share).within(0.3, 0.7);
  });

  it('the launched mission plays randomMA exactly when its slot carries the modifier', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}), {randomMAChance: 10});
    const slot = campaign.missions[0];
    slot.board = BoardName.THARSIS;
    slot.modifiers = [];
    expect(missionRandomMA(campaign, slot)).eq(RandomMAOptionType.NONE);
    const first = await manager.launchMission(campaign.id, 'Alice');
    const stored = await db.getGame(first.gameId);
    expect(stored.gameOptions.randomMA).eq(RandomMAOptionType.NONE);

    slot.modifiers = [{id: RANDOM_MA_MODIFIER}];
    expect(missionRandomMA(campaign, slot)).eq(RandomMAOptionType.ALL);
  });

  it('the wire model shows the slot\'s modifiers (the map\'s badge reads the same reader the launch does)', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}), {randomMAChance: 30});
    campaign.missions[2].modifiers = [{id: RANDOM_MA_MODIFIER}];
    const model = manager.getModel(campaign, 'Alice');
    expect(model.missions[2].modifiers).deep.eq([{id: RANDOM_MA_MODIFIER}]);
  });

  it('a campaign generated BEFORE the roll keeps playing (and now shows) the frozen rule on every mission', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig({randomMA: RandomMAOptionType.ALL}), {randomMAChance: 10});
    delete campaign.generator.randomMAChance;
    for (const slot of campaign.missions) {
      slot.modifiers = [];
      expect(slotModifiersOf(campaign, slot)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
      expect(missionRandomMA(campaign, slot)).eq(RandomMAOptionType.ALL);
    }
    const off = await manager.createCampaign(key(), campaignTestConfig(), {});
    delete off.generator.randomMAChance;
    off.missions[0].board = BoardName.THARSIS;
    off.missions[0].modifiers = [];
    expect(slotModifiersOf(off, off.missions[0])).deep.eq([]);
  });
});
