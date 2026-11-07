import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager, campaignRewardMode} from '../../src/server/campaign/CampaignManager';
import {GameLoader} from '../../src/server/database/GameLoader';
import {CardName} from '../../src/common/cards/CardName';
import {NewGameConfig} from '../../src/common/game/NewGameConfig';
import {TENDER_COMPENSATION_MC, biddingOpenCards, biddingTurnSeat} from '../../src/common/campaign/tenders';
import {marsBotOf} from '../../src/server/automa/AutomaUtil';
import {MarsBotCorpId} from '../../src/common/automa/MarsBotCorpData';
import {campaignTestConfig} from './CampaignManager.spec';

function tenderConfig(overrides: Partial<NewGameConfig> = {}): NewGameConfig {
  return campaignTestConfig({
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false, prelude: true,
      prelude2: false, turmoil: false, community: false, ares: false, moon: false,
      pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false, turmoilRedux: false,
    },
    ...overrides,
  });
}

describe('the «Тендеры» reward mode', () => {
  let db: InMemoryDatabase;
  let manager: CampaignManager;
  let keySeq = 0;
  const key = () => `tender-key-${Date.now()}-${keySeq++}`;
  const failureOf = (p: Promise<unknown>) => p.then(() => undefined, (e) => e as Error);

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

  it('a titles campaign is byte-identical to before the mode existed; a tenders campaign prints its Register', async () => {
    const titles = await manager.createCampaign(key(), tenderConfig());
    expect(titles.rewardMode).is.undefined;
    expect(titles.register).is.undefined;
    expect(titles.progression.tenders).is.undefined;
    expect(campaignRewardMode(titles)).eq('titles');
    expect(manager.getModel(titles, 'Alice').rewardMode).eq('titles');

    const tenders = await manager.createCampaign(key(), tenderConfig(), {rewardMode: 'tenders'});
    expect(tenders.rewardMode).eq('tenders');
    expect(tenders.register?.order.length).greaterThan(10);
    expect(tenders.register?.drawn).eq(0);
    expect(tenders.progression.tenders).deep.eq({});
    expect(manager.getModel(tenders, 'Alice').rewardMode).eq('tenders');
    // An unknown mode is a titles campaign.
    const odd = await manager.createCampaign(key(), tenderConfig(), {rewardMode: 'coins' as any});
    expect(odd.rewardMode).is.undefined;
  });

  it('the commit opens the BIDDING: two cards for two seats, the winner picks, the loser gets nothing, no titles', async () => {
    const campaign = await manager.createCampaign(key(), tenderConfig(), {rewardMode: 'tenders'});
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;
    alice.megaCredits += 30;
    await manager.commitMissionResult(game);

    let loaded = (await manager.load(campaign.id))!;
    const result = loaded.missions[0].result!;
    expect(result.titles, 'a tenders campaign awards no titles').is.empty;
    expect(result.bonuses.map((b) => b.megaCredits), 'the comeback bonus stays').deep.eq([5]);
    expect(loaded.missions[0].finalPreludes, 'the played preludes are recorded for «Продление программы»').is.not.undefined;
    const bidding = loaded.bidding!;
    expect(bidding.done).is.false;
    expect(bidding.offer).has.length(2);
    expect(new Set(bidding.offer.map((c) => c.id)).size, 'distinct kinds on the table').eq(2);
    const first = result.standings[0].seat;
    const second = result.standings[1].seat;
    expect(bidding.order, 'the standings are the pick order').deep.eq([first, second]);
    expect(loaded.register!.drawn).eq(2);
    expect(manager.launchBlockersOf(loaded)).includes('Waiting for the tender bidding');

    const firstPid = loaded.missions[0].playerIds![first];
    const secondPid = loaded.missions[0].playerIds![second];
    const firstName = loaded.seats[first].name;
    const secondName = loaded.seats[second].name;
    // The carryover waits for the bidding; a pick out of turn is refused by name.
    expect((await failureOf(manager.submitCarryover(campaign.id, firstPid, [])))?.message).contains('bidding must finish');
    expect((await failureOf(manager.submitBid(campaign.id, secondPid, bidding.offer[0].instance)))?.message).contains('not this seat');
    expect((await failureOf(manager.submitBid(campaign.id, 'p-forged', bidding.offer[0].instance)))?.message).contains('Not a participant');

    // The model names whose turn it is.
    expect(manager.getModel(loaded, firstName).bidding?.yourTurn).is.true;
    expect(manager.getModel(loaded, secondName).bidding?.yourTurn).is.false;
    expect((await manager.listSummaries(firstName))[0].state).eq('chooseTender');
    expect((await manager.listSummaries(secondName))[0].state).eq('waitingOthers');

    const taken = bidding.offer[1];
    const {campaign: after, viewerName} = await manager.submitBid(campaign.id, firstPid, taken.instance);
    expect(viewerName).eq(firstName);
    expect(after.bidding, 'the last picker picked — the bidding is over').is.undefined;
    loaded = (await manager.load(campaign.id))!;
    const record = loaded.missions[0].bidding!;
    expect(record.done).is.true;
    expect(record.offer.find((c) => c.instance === taken.instance)?.takenBy).eq(first);
    expect(record.offer.find((c) => c.instance !== taken.instance)?.withdrawn, 'the two-seat table withdraws the other card').is.true;
    expect(loaded.progression.tenders![first]).has.length(1);
    expect(loaded.progression.tenders![first][0]).deep.include({id: taken.id, wonAtSlot: 0, place: 1, status: 'held'});
    expect(loaded.progression.tenders![second] ?? []).is.empty;
    expect(manager.launchBlockersOf(loaded)).not.includes('Waiting for the tender bidding');
    expect(manager.getModel(loaded, firstName).missions[0].bidding?.done).is.true;
    expect((await manager.listSummaries(firstName))[0].yourTenders).eq(1);
    // The carryover proceeds as before.
    await manager.submitCarryover(campaign.id, firstPid, []);
    await manager.submitCarryover(campaign.id, secondPid, []);
    expect(manager.launchBlockersOf(loaded)).deep.eq([]);
  });

  it('with the bot: it picks AT ONCE when its turn comes before a human, by the denial order', async () => {
    const campaign = await manager.createCampaign(key(), tenderConfig({automa: {difficulty: 'hard'}}), {rewardMode: 'tenders'});
    // Fabricated mission 1: the bot (seat 2) wins, Alice second, Bruno last.
    await manager.devCommit(campaign.id, [2, 0, 1], {biddingPending: true});
    const loaded = (await manager.load(campaign.id))!;
    const bidding = loaded.bidding!;
    expect(bidding.offer).has.length(2);
    expect(bidding.order).deep.eq([2, 0, 1]);
    const botCard = bidding.offer.find((c) => c.takenBy === 2);
    expect(botCard, 'the bot took its card at the commit').is.not.undefined;
    const open = biddingOpenCards(bidding);
    expect(open).has.length(1);
    expect(biddingTurnSeat(bidding), 'Alice\'s turn stands').eq(0);
    expect(loaded.progression.tenders![2] ?? [], 'holdings are recorded only when the bidding closes').is.empty;
  });

  it('the dev fast-forward resolves the humans\' picks (fixture or the bot\'s order) so nothing waits', async () => {
    const campaign = await manager.createCampaign(key(), tenderConfig(), {rewardMode: 'tenders'});
    await manager.devCommit(campaign.id, [1, 0]);
    const loaded = (await manager.load(campaign.id))!;
    expect(loaded.bidding).is.undefined;
    expect(loaded.missions[0].bidding?.done).is.true;
    expect(loaded.progression.tenders![1]).has.length(1);
    expect(loaded.progression.tenders![0] ?? []).is.empty;
  });

  it('BEFORE THE FINALE the legacy tenders are realized BY USE: a third card, a carried prelude; the launch marks them', async () => {
    const campaign = await manager.createCampaign(key(), tenderConfig({players: [
      {name: 'Alice', color: 'blue', beginner: false, handicap: 0, first: true},
      {name: 'Bruno', color: 'red', beginner: false, handicap: 0, first: false},
    ]}), {rewardMode: 'tenders', missionCount: 3});
    // Missions 1 and 2 fabricated: mission 1 grants Alice two legacy tenders; mission 2 deals no bidding (`tenders: {}`)
    // and records her played preludes. The fabricated slot gets its seat ids by hand (a dev commit launches no game).
    await manager.devCommit(campaign.id, [0, 1], {tenders: {0: ['extendedLegacy', 'programExtension']}});
    await manager.devCommit(campaign.id, [0, 1], {
      tenders: {},
      carryoverPending: true,
      carryover: {0: [CardName.ACQUIRED_COMPANY, CardName.ADAPTATION_TECHNOLOGY, CardName.AI_CENTRAL, CardName.ALGAE]},
      finalPreludes: {0: [CardName.ALLIED_BANK, CardName.BIOFUELS]},
      lineages: {0: [CardName.CREDICOR, CardName.THORGATE], 1: [CardName.HELION, CardName.TERACTOR]},
    });
    let loaded = (await manager.load(campaign.id))!;
    expect(loaded.pointer).eq(2);
    expect(loaded.missions[2].slot).eq(loaded.missions.length - 1);
    expect(loaded.bidding, 'an empty tenders fixture deals no bidding').is.undefined;
    loaded.missions[1].playerIds = {0: 'p-tender-alice', 1: 'p-tender-bruno'};
    const alicePid = loaded.missions[1].playerIds[0];
    const brunoPid = loaded.missions[1].playerIds[1];
    const model = manager.getModel(loaded, 'Alice');
    expect(model.carryover?.yourLimit, 'the base 2 + one tender seat').eq(3);
    expect(model.carryover?.yourTenderSeats).eq(1);
    expect(model.carryover?.yourPreludeLimit).eq(1);
    expect(model.carryover?.yourEligiblePreludes).deep.eq([CardName.ALLIED_BANK, CardName.BIOFUELS]);
    expect(model.carryover?.bySeat.find((s) => s.seat === 0)?.limit).eq(3);
    expect(manager.getModel(loaded, 'Bruno').carryover?.yourLimit, 'Bruno holds nothing').eq(2);

    // Four cards: refused (3 is the ceiling); two preludes: refused (one copy); a prelude not played: refused.
    expect((await failureOf(manager.submitCarryover(campaign.id, alicePid,
      [CardName.ACQUIRED_COMPANY, CardName.ADAPTATION_TECHNOLOGY, CardName.AI_CENTRAL, CardName.ALGAE])))?.message).contains('at most 3');
    expect((await failureOf(manager.submitCarryover(campaign.id, alicePid, [], [CardName.ALLIED_BANK, CardName.BIOFUELS])))?.message).contains('at most 1 prelude');
    expect((await failureOf(manager.submitCarryover(campaign.id, alicePid, [], [CardName.ACQUIRED_COMPANY])))?.message).contains('not played');
    expect((await failureOf(manager.submitCarryover(campaign.id, brunoPid, [], [CardName.ALLIED_BANK])))?.message).contains('carries no prelude');

    await manager.submitCarryover(campaign.id, alicePid,
      [CardName.ACQUIRED_COMPANY, CardName.ADAPTATION_TECHNOLOGY, CardName.AI_CENTRAL], [CardName.BIOFUELS]);
    await manager.submitCarryover(campaign.id, brunoPid, []);
    loaded = (await manager.load(campaign.id))!;
    expect(loaded.carryover!.bySeat[0].preludes).deep.eq([CardName.BIOFUELS]);
    expect(manager.getModel(loaded, 'Alice').carryover?.yourPreludes).deep.eq([CardName.BIOFUELS]);
    expect(manager.getModel(loaded, 'Bruno').carryover?.bySeat.find((s) => s.seat === 0)?.preludeCount).eq(1);

    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    loaded = (await manager.load(campaign.id))!;
    // Both legacy tenders were USED — the launch marks them executed; nothing rides into the finale as held.
    expect(loaded.progression.tenders![0].map((t) => t.status)).deep.eq(['executed', 'executed']);
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;
    expect(alice.campaignCarriedCards).deep.eq([CardName.ACQUIRED_COMPANY, CardName.ADAPTATION_TECHNOLOGY, CardName.AI_CENTRAL]);
    expect(alice.campaignCarriedPreludes).deep.eq([CardName.BIOFUELS]);
    expect(alice.campaignTenders).is.undefined;
    expect(game.preludeDeck.drawPile.map((c) => c.name), 'the carried prelude is reserved out of the deck').not.includes(CardName.BIOFUELS);
    for (const p of game.players) {
      expect(p.dealtPreludeCards.map((c) => c.name)).not.includes(CardName.BIOFUELS);
    }
    expect(game.gameOptions.campaign?.rewardMode).eq('tenders');
    expect(game.gameOptions.campaign?.grants.find((g) => g.seat === 0)?.tenders).is.undefined;
    expect(game.gameOptions.campaign?.grants.find((g) => g.seat === 0)?.titlePoints, 'a tenders finale scores no titles').deep.eq([]);
  });

  it('the finale LAUNCH hands a human its held tenders and CASHES the bot\'s out at once', async () => {
    const campaign = await manager.createCampaign(key(), tenderConfig({automa: {difficulty: 'hard'}}), {rewardMode: 'tenders', missionCount: 3});
    await manager.devCommit(campaign.id, [0, 1, 2], {tenders: {0: ['projectReview'], 2: ['gamble', 'openCall']}});
    await manager.devCommit(campaign.id, [0, 1, 2], {
      tenders: {},
      lineages: {0: [CardName.CREDICOR, CardName.THORGATE], 1: [CardName.HELION, CardName.TERACTOR]},
    });
    let loaded = (await manager.load(campaign.id))!;
    loaded.progression.botCorporation = loaded.progression.botCorporation ?? MarsBotCorpId.C01_CREDICOR;
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    loaded = (await manager.load(campaign.id))!;
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;
    expect(alice.campaignTenders?.map((t) => [t.id, t.status])).deep.eq([['projectReview', 'held']]);
    expect(game.gameOptions.campaign?.grants.find((g) => g.seat === 0)?.tenders?.map((t) => t.id)).deep.eq(['projectReview']);
    const bot = marsBotOf(game);
    expect(bot.megaCredits, 'the bot received 3 M€ per tender').eq(2 * TENDER_COMPENSATION_MC);
    expect(loaded.progression.tenders![2].map((t) => t.status)).deep.eq(['cashed', 'cashed']);
    expect(manager.getModel(loaded, 'Alice').progression.tenders![2].every((t) => t.status === 'cashed')).is.true;
  });

  it('a revoke withdraws the revoked mission\'s bidding and what it gave', async () => {
    const campaign = await manager.createCampaign(key(), tenderConfig(), {rewardMode: 'tenders'});
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    await manager.commitMissionResult(game);
    let loaded = (await manager.load(campaign.id))!;
    const first = loaded.bidding!.order[0];
    await manager.submitBid(campaign.id, loaded.missions[0].playerIds![first], loaded.bidding!.offer[0].instance);
    loaded = (await manager.load(campaign.id))!;
    expect(loaded.progression.tenders![first]).has.length(1);
    expect(loaded.missions[0].bidding?.done).is.true;
    expect(await manager.revokeMissionResult(gameId, campaign.id)).is.true;
    loaded = (await manager.load(campaign.id))!;
    expect(loaded.missions[0].bidding).is.undefined;
    expect(loaded.bidding).is.undefined;
    expect(loaded.progression.tenders![first]).is.empty;
    expect(loaded.phase).eq('missionActive');
  });
});
