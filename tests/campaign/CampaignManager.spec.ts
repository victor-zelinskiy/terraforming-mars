import {expect} from 'chai';
import {setTestDatabase, restoreTestDatabase} from '../testing/setup';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {CampaignManager} from '../../src/server/campaign/CampaignManager';
import {NewGameConfig} from '../../src/common/game/NewGameConfig';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {CardName} from '../../src/common/cards/CardName';
import {GameLoader} from '../../src/server/database/GameLoader';

export function campaignTestConfig(overrides: Partial<NewGameConfig> = {}): NewGameConfig {
  return {
    players: [
      {name: 'Alice', color: 'blue', beginner: false, handicap: 0, first: true},
      {name: 'Bruno', color: 'red', beginner: false, handicap: 2, first: false},
    ],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false, prelude: false,
      prelude2: false, turmoil: false, community: false, ares: false, moon: false,
      pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
    },
    board: RandomBoardOption.ALL,
    seed: 0,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    testMode: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: RandomMAOptionType.NONE,
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 0,
    startingPreludes: 0,
    ...overrides,
  };
}

describe('CampaignManager', () => {
  let db: InMemoryDatabase;
  let manager: CampaignManager;
  let keySeq = 0;
  const key = () => `test-key-${Date.now()}-${keySeq++}`;

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

  it('campaign id derives deterministically from the idempotency key', () => {
    const a = CampaignManager.campaignIdForKey('the-key');
    const b = CampaignManager.campaignIdForKey('the-key');
    const c = CampaignManager.campaignIdForKey('other-key');
    expect(a).eq(b);
    expect(a).not.eq(c);
    expect(a.startsWith('c')).is.true;
  });

  it('creation is durably idempotent: same key converges on the same campaign', async () => {
    const k = key();
    const first = await manager.createCampaign(k, campaignTestConfig());
    const second = await manager.createCampaign(k, campaignTestConfig());
    expect(second.id).eq(first.id);
    expect(second.missions.map((m) => m.board)).deep.eq(first.missions.map((m) => m.board));
    // Even across a fresh in-memory manager (server restart), the DB copy wins.
    CampaignManager.resetForTesting();
    const third = await CampaignManager.getInstance().createCampaign(k, campaignTestConfig());
    expect(third.id).eq(first.id);
    expect(third.missions.map((m) => m.board)).deep.eq(first.missions.map((m) => m.board));
  });

  it('generates 4 unique boards from the canonical pool and persists provenance', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    expect(campaign.missions).has.length(4);
    const boards = campaign.missions.map((m) => m.board);
    expect(new Set(boards).size).eq(4);
    for (const board of boards) {
      expect(campaign.generator.pool).includes(board);
    }
    expect(campaign.generator.version).eq(1);
    expect(campaign.phase).eq('generated');
    expect(campaign.pointer).eq(0);
    expect(campaign.rev).greaterThan(0);
  });

  it('with a MarsBot the board pool intersects the bot-supported set and a bot seat is added', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig({automa: {difficulty: 'hard'}}));
    for (const mission of campaign.missions) {
      expect(AUTOMA_SUPPORTED_BOARDS).includes(mission.board);
    }
    const bot = campaign.seats.find((s) => s.kind === 'bot');
    expect(bot).is.not.undefined;
    expect(bot!.botDifficulty).eq('hard');
    expect(campaign.seats).has.length(3);
    // The bot's color is the first free one and collides with nobody.
    expect(campaign.seats.filter((s) => s.color === bot!.color)).has.length(1);
  });

  it('refuses duplicate normalized names (seat identity is name-keyed)', async () => {
    const config = campaignTestConfig();
    config.players[1].name = ' alice ';
    let error: Error | undefined;
    await manager.createCampaign(key(), config).catch((e) => error = e);
    expect(error?.message).contains('distinct names');
  });

  it('refuses more than 5 participants', async () => {
    const config = campaignTestConfig();
    config.players = ['blue', 'red', 'green', 'yellow', 'black'].map((color, i) => (
      {name: `P${i}`, color: color as any, beginner: false, handicap: 0, first: i === 0}));
    config.automa = {difficulty: 'normal'};
    let error: Error | undefined;
    await manager.createCampaign(key(), config).catch((e) => error = e);
    expect(error?.message).contains('2-5 participants');
  });

  it('launch is creator-only', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    let error: Error | undefined;
    await manager.launchMission(campaign.id, 'Bruno').catch((e) => error = e);
    expect(error?.message).contains('creator');
  });

  it('launch: game persisted BEFORE the campaign pointer; idempotent double launch', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const first = await manager.launchMission(campaign.id, 'Alice');
    expect(first.gameId).is.not.undefined;
    expect(first.yourPlayerId).is.not.undefined;
    // The game is on disk (first save at creation).
    const stored = await db.getGame(first.gameId);
    expect(stored.id).eq(first.gameId);
    // Contract injected, Merger banned, mission slot recorded.
    expect(stored.gameOptions.campaign?.campaignId).eq(campaign.id);
    expect(stored.gameOptions.campaign?.missionSlot).eq(0);
    expect(stored.gameOptions.campaign?.final).is.false;
    expect(stored.gameOptions.bannedCards).includes(CardName.MERGER);
    expect(stored.gameOptions.boardName).eq(campaign.missions[0].board);
    // Every player carries their campaign seat.
    expect(stored.players.map((p) => p.campaignSeat).sort()).deep.eq([0, 1]);
    // Handicap flows from the frozen seat (Bruno trBoost 2).
    const bruno = stored.players.find((p) => p.name === 'Bruno')!;
    expect(bruno.campaignSeat).eq(1);

    // Idempotent: the second press converges on the same game.
    const second = await manager.launchMission(campaign.id, 'Alice');
    expect(second.gameId).eq(first.gameId);
    expect(second.yourPlayerId).eq(first.yourPlayerId);

    const reloaded = await manager.load(campaign.id);
    expect(reloaded!.phase).eq('missionActive');
    expect(reloaded!.missions[0].gameId).eq(first.gameId);
    expect(reloaded!.missions[0].playerIds).is.not.undefined;
  });

  it('missions launch strictly in order (no launch while one is active)', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const launch = await manager.launchMission(campaign.id, 'Alice');
    // While mission 1 is active the launch route degenerates to the idempotent
    // fast path — it can never mint mission 2.
    const again = await manager.launchMission(campaign.id, 'Alice');
    expect(again.gameId).eq(launch.gameId);
    const loaded = await manager.load(campaign.id);
    expect(loaded!.missions[1].gameId).is.undefined;
  });

  it('commitMissionResult: standings, titles/bonuses from the tables, interlude + carryover window', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = await GameLoader.getInstance().getGame(gameId);
    expect(game).is.not.undefined;
    // Make the outcome deterministic: Alice ahead on M€ at equal VP? No — give
    // Alice a clear M€ lead so the tie-break itself is exercised via score.
    const alice = game!.players.find((p) => p.name === 'Alice')!;
    alice.megaCredits += 30;
    await manager.commitMissionResult(game!);

    const committed = await manager.load(campaign.id);
    const result = committed!.missions[0].result!;
    expect(result.gameId).eq(gameId);
    expect(result.standings).has.length(2);
    expect(result.standings[0].place).eq(1);
    expect(result.standings[1].place).eq(2);
    // 2 participants: Governor + Administrator (approved D1).
    expect(result.titles.map((t) => t.title).sort()).deep.eq(['administrator', 'governor']);
    expect(result.titles.find((t) => t.title === 'governor')!.titlePoints).eq(15);
    // Bonus: 1st gets 0 (omitted), 2nd gets 5.
    expect(result.bonuses).has.length(1);
    expect(result.bonuses[0].megaCredits).eq(5);
    expect(committed!.phase).eq('interlude');
    expect(committed!.pointer).eq(1);
    // Carryover window opened for both human seats.
    expect(committed!.carryover).is.not.undefined;
    expect(Object.keys(committed!.carryover!.bySeat)).has.length(2);

    // Idempotent: a second commit is a no-op returning the stored snapshot.
    const before = JSON.stringify(result);
    await manager.commitMissionResult(game!);
    const after = await manager.load(campaign.id);
    expect(JSON.stringify(after!.missions[0].result)).eq(before);
  });

  it('carryover: validation, confirmation, launch gate and atomic consumption', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;
    const bruno = game.players.find((p) => p.name === 'Bruno')!;
    // Give both a TERMINAL hand (at launch the dealt cards are not yet bought;
    // the commit records `cardsInHand` — the state a finished mission has).
    alice.cardsInHand.push(...alice.dealtProjectCards.slice(0, 5));
    bruno.cardsInHand.push(...bruno.dealtProjectCards.slice(0, 5));
    const aliceHand = alice.cardsInHand.map((c) => c.name);
    const brunoHand = bruno.cardsInHand.map((c) => c.name);
    expect(aliceHand.length).greaterThan(1);
    await manager.commitMissionResult(game);
    let loaded = (await manager.load(campaign.id))!;
    const alicePid = loaded.missions[0].playerIds![0];
    const brunoPid = loaded.missions[0].playerIds![1];

    // The launch is gated on unresolved selections.
    expect(manager.launchBlockersOf(loaded)).deep.eq(['Waiting for the project carryover selections']);

    const failureOf = (p: Promise<unknown>) => p.then(() => undefined, (e) => e as Error);
    // >2 cards refused.
    expect((await failureOf(manager.submitCarryover(campaign.id, alicePid, aliceHand.slice(0, 3))))?.message).contains('At most 2');
    // Duplicates refused.
    expect((await failureOf(manager.submitCarryover(campaign.id, alicePid, [aliceHand[0], aliceHand[0]])))?.message).contains('Duplicate');
    // A card from someone ELSE's hand (not in yours) refused.
    const notInAlice = brunoHand.find((c) => !aliceHand.includes(c));
    if (notInAlice !== undefined) {
      let stealError: Error | undefined;
      await manager.submitCarryover(campaign.id, alicePid, [notInAlice]).catch((e) => stealError = e);
      expect(stealError?.message).contains('was not in your hand');
    }
    // A forged player id refused.
    let forgeError: Error | undefined;
    await manager.submitCarryover(campaign.id, 'p-forged', [aliceHand[0]]).catch((e) => forgeError = e);
    expect(forgeError?.message).contains('Not a participant');

    // Valid selections confirm; revisable before launch.
    await manager.submitCarryover(campaign.id, alicePid, aliceHand.slice(0, 2));
    await manager.submitCarryover(campaign.id, alicePid, [aliceHand[0]]);
    await manager.submitCarryover(campaign.id, brunoPid, []);
    loaded = (await manager.load(campaign.id))!;
    expect(loaded.carryover!.bySeat[0].status).eq('confirmed');
    expect(loaded.carryover!.bySeat[0].cards).deep.eq([aliceHand[0]]);
    expect(loaded.carryover!.bySeat[1].cards).deep.eq([]);
    expect(manager.launchBlockersOf(loaded)).deep.eq([]);

    // Launch mission 2: consumption is atomic with the pointer commit; the
    // carried card reaches Alice's mission-2 player and never the deck.
    const launch2 = await manager.launchMission(campaign.id, 'Alice');
    loaded = (await manager.load(campaign.id))!;
    expect(loaded.carryover!.bySeat[0].consumed).is.true;
    const stored2 = await db.getGame(launch2.gameId);
    const alice2 = stored2.players.find((p) => p.name === 'Alice')!;
    expect(alice2.campaignCarriedCards).deep.eq([aliceHand[0]]);
    expect(stored2.projectDeck.drawPile).not.includes(aliceHand[0]);
    // Selection can no longer change after consumption.
    expect(await failureOf(manager.submitCarryover(campaign.id, alicePid, []))).is.not.undefined;

    // Mission 2 bans the acquired lineage corporations for EVERYONE.
    for (const lineage of Object.values(loaded.progression.lineages)) {
      for (const corp of lineage) {
        expect(stored2.gameOptions.bannedCards).includes(corp);
      }
    }
    // The comeback bonus of the mission-1 loser rides the mission-2 contract.
    const loserSeat = loaded.missions[0].result!.standings[1].seat;
    const grant = stored2.gameOptions.campaign!.grants.find((g) => g.seat === loserSeat)!;
    expect(grant.bonusMegaCredits).eq(5);
  });

  it('devCommit fast-forwards the pointer with table-driven titles', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    await manager.devCommit(campaign.id, [1, 0]);
    const loaded = (await manager.load(campaign.id))!;
    expect(loaded.phase).eq('interlude');
    expect(loaded.pointer).eq(1);
    const result = loaded.missions[0].result!;
    expect(result.titles.find((t) => t.seat === 1)!.title).eq('governor');
    expect(result.titles.find((t) => t.seat === 0)!.title).eq('administrator');
    // Fast-forward to the final: 3 commits total, then the final one.
    await manager.devCommit(campaign.id, [0, 1]);
    await manager.devCommit(campaign.id, [0, 1]);
    await manager.devCommit(campaign.id, [1, 0]);
    const finished = (await manager.load(campaign.id))!;
    expect(finished.phase).eq('finished');
    expect(finished.championSeats).deep.eq([1]);
    // The final mission awarded NO new titles (approved D2): 3 missions × 2 titles.
    expect(finished.progression.titles).has.length(6);
    expect(finished.carryover).is.undefined;
  });

  it('final mission contract carries accumulated Title Points and the mission-3 bonus', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    await manager.devCommit(campaign.id, [0, 1]); // m1: Alice governor(15), Bruno administrator(10) + 5 M€
    await manager.devCommit(campaign.id, [1, 0]); // m2: Bruno 15, Alice 10 + 5 M€
    await manager.devCommit(campaign.id, [0, 1]); // m3: Alice 15, Bruno 10 + 5 M€
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const stored = await db.getGame(gameId);
    const contract = stored.gameOptions.campaign!;
    expect(contract.final).is.true;
    const aliceGrant = contract.grants.find((g) => g.seat === 0)!;
    const brunoGrant = contract.grants.find((g) => g.seat === 1)!;
    expect(aliceGrant.titlePoints.reduce((a, t) => a + t.titlePoints, 0)).eq(40);
    expect(brunoGrant.titlePoints.reduce((a, t) => a + t.titlePoints, 0)).eq(35);
    // Bonus from mission 3 IS applied into the final mission (D2 forbids only
    // the final GENERATING new rewards).
    expect(brunoGrant.bonusMegaCredits).eq(5);
    expect(aliceGrant.bonusMegaCredits).eq(0);
    // The final mission's players score the titles category from generation 1.
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alicePlayer = game.players.find((p) => p.name === 'Alice')!;
    const vpb = alicePlayer.getVictoryPoints();
    expect(vpb.titles).eq(40);
    expect(vpb.total).greaterThanOrEqual(40);
    // Provenance rows name the missions.
    expect(vpb.detailsTitles).has.length(3);
  });

  it('ordinary games never grow a titles category', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    // Mission 1 (non-final): absent.
    const vpb = game.players[0].getVictoryPoints();
    expect(vpb.titles).is.undefined;
    expect(vpb.detailsTitles).is.undefined;
  });

  it('revoke: allowed before the next mission exists, refused after', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    await manager.commitMissionResult(game);
    // Guard allows while mission 2 does not exist.
    let guard = await manager.rollbackGuard(game);
    expect(guard.allowed).is.true;
    // Revoke rewinds the campaign.
    const revoked = await manager.revokeMissionResult(gameId, campaign.id);
    expect(revoked).is.true;
    let loaded = (await manager.load(campaign.id))!;
    expect(loaded.missions[0].result).is.undefined;
    expect(loaded.phase).eq('missionActive');
    expect(loaded.pointer).eq(0);
    expect(loaded.progression.titles).is.empty;
    expect(loaded.carryover).is.undefined;

    // Recommit + launch mission 2 → now the guard refuses.
    await manager.commitMissionResult(game);
    loaded = (await manager.load(campaign.id))!;
    const pids = loaded.missions[0].playerIds!;
    await manager.submitCarryover(campaign.id, pids[0], []);
    await manager.submitCarryover(campaign.id, pids[1], []);
    await manager.launchMission(campaign.id, 'Alice');
    guard = await manager.rollbackGuard(game);
    expect(guard.allowed).is.false;
    const revoked2 = await manager.revokeMissionResult(gameId, campaign.id);
    expect(revoked2).is.false;
    loaded = (await manager.load(campaign.id))!;
    expect(loaded.missions[0].result).is.not.undefined;
  });

  it('protectedGameIds lists missions of unfinished campaigns only', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    expect(await manager.protectedGameIds()).includes(gameId);
    await manager.abandon(campaign.id, 'Alice');
    expect(await manager.protectedGameIds()).not.includes(gameId);
  });

  it('abandon is creator-only and terminal', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    let error: Error | undefined;
    await manager.abandon(campaign.id, 'Bruno').catch((e) => error = e);
    expect(error?.message).contains('creator');
    await manager.abandon(campaign.id, 'Alice');
    const loaded = (await manager.load(campaign.id))!;
    expect(loaded.phase).eq('abandoned');
  });

  it('the model hides other seats\' carried card identities (privacy)', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;
    alice.cardsInHand.push(...alice.dealtProjectCards.slice(0, 3));
    const pick = alice.cardsInHand[0].name;
    await manager.commitMissionResult(game);
    const loaded = (await manager.load(campaign.id))!;
    await manager.submitCarryover(campaign.id, loaded.missions[0].playerIds![0], [pick]);
    const reloaded = (await manager.load(campaign.id))!;

    const aliceView = manager.getModel(reloaded, 'Alice');
    expect(aliceView.carryover?.yourCards).deep.eq([pick]);
    expect(aliceView.carryover?.yourEligible).is.not.undefined;

    const brunoView = manager.getModel(reloaded, 'Bruno');
    expect(brunoView.carryover?.yourCards ?? []).not.includes(pick);
    // Bruno sees only Alice's status + count.
    const aliceRow = brunoView.carryover!.bySeat.find((s) => s.seat === 0)!;
    expect(aliceRow.status).eq('confirmed');
    expect(aliceRow.count).eq(1);
    expect(JSON.stringify(brunoView)).not.contains(pick);

    // A non-participant sees no private data and no launch capability.
    const strangerView = manager.getModel(reloaded, 'Stranger');
    expect(strangerView.you).is.undefined;
    expect(strangerView.canLaunch).is.false;
    expect(strangerView.carryover?.yourCards).is.undefined;
    expect(JSON.stringify(strangerView)).not.contains(pick);
  });

  it('mission 2 end-to-end: lineage plays in order, the bonus and the carried card arrive exactly once', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    // Fabricated mission 1: Bruno won (Alice gets the 5 M€ comeback bonus),
    // both acquired a corporation, Alice carries one project card.
    await manager.devCommit(campaign.id, [1, 0], {
      lineages: {0: [CardName.CREDICOR], 1: [CardName.HELION]},
      carryover: {0: [CardName.ACQUIRED_COMPANY]},
    });
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    const alice = game.players.find((p) => p.name === 'Alice')!;

    // The reservation: the carried card is in NEITHER pile and NOBODY's deal.
    expect(game.projectDeck.drawPile.map((c) => c.name)).not.includes(CardName.ACQUIRED_COMPANY);
    for (const p of game.players) {
      expect(p.dealtProjectCards.map((c) => c.name)).not.includes(CardName.ACQUIRED_COMPANY);
    }
    // Acquired corporations are banned from EVERY deal (own-lineage AND
    // cross-player uniqueness), Merger always.
    for (const p of game.players) {
      const dealt = p.dealtCorporationCards.map((c) => c.name);
      expect(dealt).not.includes(CardName.CREDICOR);
      expect(dealt).not.includes(CardName.HELION);
      expect(dealt).not.includes(CardName.MERGER);
    }

    // Drive the merge deployment: Alice picks a new corp and buys 2 cards.
    // The pick is PINNED (a random dealt corp can legitimately open a real
    // payment-choice prompt for the merge fee — Luna Trade Federation's
    // titanium — and this test drives the plain M€ path).
    const {runCampaignDeploymentChain} = await import('../../src/server/campaign/CampaignMissionSetup');
    const {newCorporationCard} = await import('../../src/server/createCard');
    const picked = newCorporationCard(CardName.THORGATE)!;
    alice.pickedCorporationCard = picked;
    alice.cardsInHand.push(...alice.dealtProjectCards.slice(0, 2));
    const before = alice.megaCredits;
    expect(before).eq(0);
    runCampaignDeploymentChain(alice, {deferCardPayment: false});
    // The chain is STAGED: answer the merge press (which also charges the
    // Merger-rule 42 M€ fee), then the legacy press.
    alice.process({type: 'card', cards: [picked.name]});
    alice.process({type: 'option'});

    // Order: the lineage base FIRST, the new pick second («в порядке получения»).
    const corps = alice.playedCards.filter((c) => c.type === 'corporation').map((c) => c.name);
    expect(corps[0]).eq(CardName.CREDICOR);
    expect(corps[1]).eq(picked.name);
    // Budget: CrediCor 57 + comeback 5 + the pick's starting M€ − 2×cost − the merge fee.
    expect(alice.megaCredits).eq(57 + 5 + (picked.startingMegaCredits) - 2 * alice.cardCost - 42);
    expect(alice.campaignMergeFeePaid).is.true;
    // The carried card arrived FREE (2 bought + 1 carried) with its reveal queued.
    expect(alice.cardsInHand.map((c) => c.name)).includes(CardName.ACQUIRED_COMPANY);
    expect(alice.cardsInHand).has.length(3);
    expect(alice.campaignCarriedGranted).is.true;
    expect(alice.cardDrawReveals.some((r) => r.source?.type === 'campaign')).is.true;
  });

  it('finalHands never leak into any wire model', async () => {
    const campaign = await manager.createCampaign(key(), campaignTestConfig());
    const {gameId} = await manager.launchMission(campaign.id, 'Alice');
    const game = (await GameLoader.getInstance().getGame(gameId))!;
    await manager.commitMissionResult(game);
    const loaded = (await manager.load(campaign.id))!;
    const model = manager.getModel(loaded, 'Bruno') as any;
    expect(JSON.stringify(model)).not.contains('finalHands');
  });
});
