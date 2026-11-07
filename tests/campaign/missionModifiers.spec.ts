import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {BoardName} from '../../src/common/boards/BoardName';
import {
  CAMPAIGN_RANDOM_MA_CHANCES,
  DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE,
  DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE,
  RANDOM_MA_MODIFIER,
  SHUFFLE_MAP_MODIFIER,
  hasMissionModifier,
  isCampaignRandomMAChance,
} from '../../src/common/campaign/missionModifiers';
import {boardAlwaysDrawsMA, missionRandomMA, missionShuffleMap, rollSlotModifiers, slotModifiersOf} from '../../src/server/campaign/missionModifiers';

const ma = (chance: number, roll: number) => ({chances: {randomMA: chance, shuffleMap: 0}, rolls: {randomMA: roll, shuffleMap: 0.99}});
import {campaignTestConfig} from './CampaignManager.spec';

describe('Campaign mission modifiers («Случайные цели и награды», «Случайные места для тайлов» per mission)', () => {
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
    expect(rollSlotModifiers(BoardName.HOLLANDIA, ma(0, 0.99).chances, ma(0, 0.99).rolls)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
    expect(rollSlotModifiers(BoardName.THARSIS, ma(0, 0).chances, ma(0, 0).rolls)).deep.eq([]);
  });

  it('a printed board rolls against the chance', () => {
    expect(rollSlotModifiers(BoardName.THARSIS, ma(20, 0.19).chances, ma(20, 0.19).rolls)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
    expect(rollSlotModifiers(BoardName.THARSIS, ma(20, 0.2).chances, ma(20, 0.2).rolls)).deep.eq([]);
    expect(rollSlotModifiers(BoardName.THARSIS, ma(50, 0.49).chances, ma(50, 0.49).rolls)).deep.eq([{id: RANDOM_MA_MODIFIER}]);
  });

  it('the shuffled layout rolls on its OWN roll and chance — never forced by a board, both modifiers may stand', () => {
    expect(DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE).eq(10);
    expect(rollSlotModifiers(BoardName.THARSIS, {randomMA: 0, shuffleMap: 10}, {randomMA: 0, shuffleMap: 0.09})).deep.eq([{id: SHUFFLE_MAP_MODIFIER}]);
    expect(rollSlotModifiers(BoardName.THARSIS, {randomMA: 0, shuffleMap: 10}, {randomMA: 0, shuffleMap: 0.1})).deep.eq([]);
    expect(rollSlotModifiers(BoardName.HOLLANDIA, {randomMA: 0, shuffleMap: 0}, {randomMA: 0.5, shuffleMap: 0})).deep.eq([{id: RANDOM_MA_MODIFIER}]);
    expect(rollSlotModifiers(BoardName.HOLLANDIA, {randomMA: 0, shuffleMap: 50}, {randomMA: 0.5, shuffleMap: 0.2}))
      .deep.eq([{id: RANDOM_MA_MODIFIER}, {id: SHUFFLE_MAP_MODIFIER}]);
  });

  it('rules OFF: no roll — only a row-less board is marked, and both chances are recorded as 0', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig(), {randomMAChance: 50, shuffleMapChance: 50});
    expect(campaign.generator.randomMAChance).eq(0);
    expect(campaign.generator.shuffleMapChance).eq(0);
    for (const slot of campaign.missions) {
      expect(hasMissionModifier(slot.modifiers, RANDOM_MA_MODIFIER)).eq(boardAlwaysDrawsMA(slot.board));
      expect(hasMissionModifier(slot.modifiers, SHUFFLE_MAP_MODIFIER)).is.false;
    }
  });

  it('«Случайные места для тайлов» ON: the chosen chance is recorded (default 10); over many routes ≈ half roll at 50 %', async () => {
    const absent = await manager.createCampaign(key(), campaignTestConfig({shuffleMapOption: true}));
    expect(absent.generator.shuffleMapChance).eq(DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE);
    const stray = await manager.createCampaign(key(), campaignTestConfig({shuffleMapOption: true}), {shuffleMapChance: 25});
    expect(stray.generator.shuffleMapChance).eq(DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE);
    let slots = 0;
    let rolled = 0;
    for (let i = 0; i < 60; i++) {
      const campaign = await manager.createCampaign(key(), campaignTestConfig({shuffleMapOption: true}), {shuffleMapChance: 50});
      expect(campaign.generator.shuffleMapChance).eq(50);
      for (const slot of campaign.missions) {
        slots++;
        rolled += hasMissionModifier(slot.modifiers, SHUFFLE_MAP_MODIFIER) ? 1 : 0;
      }
    }
    expect(rolled / slots).within(0.3, 0.7);
  });

  it('the launched mission shuffles its board exactly when its slot carries the modifier', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig({shuffleMapOption: true}), {shuffleMapChance: 10});
    const slot = campaign.missions[0];
    slot.modifiers = slot.modifiers.filter((m) => m.id !== SHUFFLE_MAP_MODIFIER);
    expect(missionShuffleMap(campaign, slot)).is.false;
    const first = await manager.launchMission(campaign.id, 'Alice');
    expect((await db.getGame(first.gameId)).gameOptions.shuffleMapOption).is.false;

    const other = await manager.createCampaign(key(), campaignTestConfig(), {});
    other.missions[0].modifiers = [{id: SHUFFLE_MAP_MODIFIER}];
    expect(missionShuffleMap(other, other.missions[0])).is.true;
    const launched = await manager.launchMission(other.id, 'Alice');
    expect((await db.getGame(launched.gameId)).gameOptions.shuffleMapOption).is.true;
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
    // A route rolled for the random set but generated before the shuffle roll: the frozen shuffle rule stands everywhere.
    const halfway = await manager.createCampaign(key(), campaignTestConfig({shuffleMapOption: true}), {shuffleMapChance: 10});
    delete halfway.generator.shuffleMapChance;
    for (const slot of halfway.missions) {
      slot.modifiers = [];
      expect(missionShuffleMap(halfway, slot)).is.true;
    }

    const off = await manager.createCampaign(key(), campaignTestConfig(), {});
    delete off.generator.randomMAChance;
    delete off.generator.shuffleMapChance;
    off.missions[0].board = BoardName.THARSIS;
    off.missions[0].modifiers = [];
    expect(slotModifiersOf(off, off.missions[0])).deep.eq([]);
  });
});
