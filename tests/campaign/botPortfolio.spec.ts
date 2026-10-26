import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {GameLoader} from '../../src/server/database/GameLoader';
import {drawBotHoldings, holdingsForSlot} from '../../src/server/campaign/botPortfolio';
import {CardName} from '../../src/common/cards/CardName';
import {MarsBotCorpId, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {CampaignId} from '../../src/common/Types';
import {campaignTestConfig} from './CampaignManager.spec';
import {computeMissionStandings} from '../../src/server/campaign/missionStandings';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';

const BASE = {
  primary: MarsBotCorpId.C01_CREDICOR,
  holdings: [],
  expansions: {corpera: true},
  humanCorporations: new Set<CardName>(),
  seed: 0.37,
};

describe('the bot\'s campaign portfolio', () => {
  describe('the draw (pure)', () => {
    it('the humans\' rhythm: none on mission 1, one on mission 2, two from mission 3 on (D1)', () => {
      expect([0, 1, 2, 3].map(holdingsForSlot)).deep.eq([0, 1, 2, 2]);
    });

    it('a new holding is never the primary, a human\'s corporation or one this campaign cannot use', () => {
      const humanCorporations = new Set<CardName>([CardName.ECOLINE, CardName.THARSIS_REPUBLIC]);
      for (let i = 0; i < 40; i++) {
        const drawn = drawBotHoldings({...BASE, slot: 3, humanCorporations, seed: (i + 1) / 41});
        expect(drawn).has.length(2);
        expect(new Set(drawn).size, 'two different holdings').eq(2);
        for (const id of drawn) {
          expect(id).not.eq(BASE.primary);
          expect(humanCorporations.has(marsBotCorpInfo(id).original), `${id} is a human's`).is.false;
          // No Venus / Colonies / Prelude / Turmoil in this campaign.
          const info = marsBotCorpInfo(id);
          expect(info.requiresModules ?? [], `${id} needs a module`).is.empty;
          expect(info.requiresAnyModule, `${id} needs a module`).is.undefined;
        }
      }
    });

    it('the acquired holdings are kept as they are, and a relaunch draws nothing new', () => {
      const first = drawBotHoldings({...BASE, slot: 1});
      expect(first).has.length(1);
      const second = drawBotHoldings({...BASE, slot: 2, holdings: first});
      expect(second.slice(0, 1)).deep.eq(first);
      expect(second).has.length(2);
      expect(drawBotHoldings({...BASE, slot: 2, holdings: second})).deep.eq(second);
      expect(drawBotHoldings({...BASE, slot: 3, holdings: second})).deep.eq(second, 'the final mission keeps the two');
    });

    it('reproducible per campaign and mission — and spread across campaigns', () => {
      expect(drawBotHoldings({...BASE, slot: 1})).deep.eq(drawBotHoldings({...BASE, slot: 1}));
      const seen = new Set<MarsBotCorpId>();
      for (let i = 0; i < 30; i++) {
        seen.add(drawBotHoldings({...BASE, slot: 1, seed: (i + 1) / 31})[0]);
      }
      expect(seen.size, 'a seeded draw, not «take the first»').gt(10);
    });
  });

  describe('the mission\'s record', () => {
    it('the bot\'s standing keeps its holdings and what their dividends paid (inside its score)', () => {
      const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR, portfolio: [MarsBotCorpId.C10_THARSIS_REPUBLIC]}, '-standing');
      game.playerIsFinishedWithResearchPhase(human);
      human.campaignSeat = 0;
      bot.campaignSeat = 1;
      const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      land.tile = {tileType: TileType.CITY};
      land.player = bot;
      const standings = computeMissionStandings(game);
      const botRow = standings.find((s) => s.seat === 1)!;
      expect(botRow.dividends).deep.eq({holdings: [MarsBotCorpId.C10_THARSIS_REPUBLIC], vp: 3});
      expect(standings.find((s) => s.seat === 0)!.dividends, 'a human holds no portfolio').is.undefined;
    });
  });

  describe('the campaign launch', () => {
    let db: InMemoryDatabase;
    let manager: CampaignManager;
    let seq = 0;
    const key = () => `portfolio-${Date.now()}-${seq++}`;

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

    async function botCampaignAtMission2(): Promise<CampaignId> {
      const campaign = await manager.createCampaign(key(), campaignTestConfig({automa: {difficulty: 'hard'}}));
      expect(campaign.progression.botHoldings, 'a new bot campaign starts its portfolio EMPTY').deep.eq([]);
      await manager.devCommit(campaign.id, [0, 1, 2]);
      const loaded = (await manager.load(campaign.id))!;
      loaded.progression.botCorporation = MarsBotCorpId.C01_CREDICOR;
      return campaign.id;
    }

    it('mission 2 draws ONE holding, bans its card from the humans\' deal and hands it to the game', async () => {
      const id = await botCampaignAtMission2();
      const {gameId} = await manager.launchMission(id, 'Alice');
      const campaign = (await manager.load(id))!;
      expect(campaign.progression.botHoldings).has.length(1);
      const holding = campaign.progression.botHoldings![0];
      const game = (await GameLoader.getInstance().getGame(gameId))!;
      expect(game.gameOptions.automa?.corporation).eq(MarsBotCorpId.C01_CREDICOR);
      expect(game.gameOptions.automa?.portfolio).deep.eq([holding]);
      expect(game.gameOptions.bannedCards).contains(marsBotCorpInfo(holding).original);
      // A relaunch converges on the same game and draws nothing.
      await manager.launchMission(id, 'Alice');
      expect((await manager.load(id))!.progression.botHoldings).deep.eq([holding]);
    });

    it('mission 3 adds the SECOND holding and keeps the first', async () => {
      const id = await botCampaignAtMission2();
      await manager.launchMission(id, 'Alice');
      const first = [...(await manager.load(id))!.progression.botHoldings!];
      await manager.devCommit(id, [0, 1, 2]);
      const {gameId} = await manager.launchMission(id, 'Alice');
      const holdings = (await manager.load(id))!.progression.botHoldings!;
      expect(holdings).has.length(2);
      expect(holdings[0]).eq(first[0]);
      const game = (await GameLoader.getInstance().getGame(gameId))!;
      expect(game.gameOptions.automa?.portfolio).deep.eq(holdings);
    });

    it('a campaign created before the portfolio finishes without holdings (D7)', async () => {
      const id = await botCampaignAtMission2();
      delete (await manager.load(id))!.progression.botHoldings;
      const {gameId} = await manager.launchMission(id, 'Alice');
      const game = (await GameLoader.getInstance().getGame(gameId))!;
      expect(game.gameOptions.automa?.portfolio).is.undefined;
      expect((await manager.load(id))!.progression.botHoldings).is.undefined;
    });

    it('a campaign without a bot has no portfolio at all', async () => {
      const campaign = await manager.createCampaign(key(), campaignTestConfig());
      expect(campaign.progression.botHoldings).is.undefined;
    });
  });
});
