import {expect} from 'chai';
import {buildCampaignOverview, buildMissionDetails, buildSeatLegacy, corpOrigins, tpStatusLabel} from '@/client/console/campaign/campaignOverviewModel';
import {CampaignModel, MissionResultModel} from '@/common/campaign/CampaignModel';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';

function baseModel(overrides: Partial<CampaignModel> = {}): CampaignModel {
  return {
    id: 'ctest',
    rev: 3,
    name: 'Test Campaign',
    createdTimeMs: 0,
    phase: 'generated',
    pointer: 0,
    missionCount: 4,
    seats: [
      {seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0},
      {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
      {seat: 2, kind: 'bot', name: 'MarsBot', color: 'green', trBoost: 0, botDifficulty: 'hard'},
    ],
    you: {seat: 0},
    canLaunch: true,
    launchBlockers: [],
    missions: [
      {slot: 0, board: BoardName.THARSIS, final: false, state: 'ready', modifiers: []},
      {slot: 1, board: BoardName.HELLAS, final: false, state: 'locked', modifiers: []},
      {slot: 2, board: BoardName.ELYSIUM, final: false, state: 'locked', modifiers: []},
      {slot: 3, board: BoardName.UTOPIA_PLANITIA, final: true, state: 'locked', modifiers: []},
    ],
    progression: {lineages: {}, titles: [], titlePoints: {0: 0, 1: 0, 2: 0}, pendingBonuses: {}},
    ...overrides,
  };
}

function result(standings: Array<{seat: number, place: number, score: number, corporations: Array<CardName>}>, extra: Partial<MissionResultModel> = {}): MissionResultModel {
  return {
    gameId: 'g1' as MissionResultModel['gameId'],
    generations: 10,
    standings: standings.map((s) => ({...s, megaCredits: 10, tiedWith: []})),
    titles: [],
    bonuses: [],
    ...extra,
  };
}

/** A campaign standing on an ACTIVE mission 2 with mission 1 committed. */
function midCampaign(): CampaignModel {
  const model = baseModel({
    phase: 'missionActive',
    pointer: 1,
    progression: {
      lineages: {0: [CardName.THORGATE], 1: [CardName.HELION]},
      titles: [
        {seat: 0, missionSlot: 0, title: 'governor', titlePoints: 15},
        {seat: 1, missionSlot: 0, title: 'administrator', titlePoints: 10},
        {seat: 2, missionSlot: 0, title: 'prefect', titlePoints: 5},
      ],
      titlePoints: {0: 15, 1: 10, 2: 5},
      pendingBonuses: {},
    },
  });
  (model.missions[0] as any).state = 'committed';
  (model.missions[0] as any).result = result([
    {seat: 0, place: 1, score: 60, corporations: [CardName.THORGATE]},
    {seat: 1, place: 2, score: 50, corporations: [CardName.HELION]},
    {seat: 2, place: 3, score: 40, corporations: []},
  ], {
    titles: [
      {seat: 0, missionSlot: 0, title: 'governor', titlePoints: 15},
      {seat: 1, missionSlot: 0, title: 'administrator', titlePoints: 10},
      {seat: 2, missionSlot: 0, title: 'prefect', titlePoints: 5},
    ],
    bonuses: [{seat: 1, megaCredits: 5}],
  });
  (model.missions[1] as any).state = 'active';
  (model.missions[1] as any).gameId = 'g2';
  (model.missions[1] as any).carriedCounts = {0: 2, 1: 0};
  (model.missions[1] as any).yourCarried = [CardName.ANTS, CardName.ALGAE];
  return model;
}

describe('campaignOverviewModel', () => {
  it('TP semantics: accrues on missions 1–3, included on the live final, included-final in the chronicle', () => {
    expect(buildCampaignOverview(midCampaign()).seats[0].tpStatus).eq('accrues-final');

    const final = midCampaign();
    final.pointer = 3;
    (final.missions[1] as any).state = 'committed';
    (final.missions[1] as any).result = result([
      {seat: 0, place: 1, score: 1, corporations: [CardName.THORGATE, CardName.ECOLINE]},
      {seat: 1, place: 2, score: 1, corporations: [CardName.HELION, CardName.PHOBOLOG]},
      {seat: 2, place: 3, score: 1, corporations: []},
    ]);
    (final.missions[2] as any).state = 'committed';
    (final.missions[2] as any).result = result([
      {seat: 0, place: 1, score: 1, corporations: [CardName.THORGATE, CardName.ECOLINE, CardName.INVENTRIX]},
      {seat: 1, place: 2, score: 1, corporations: [CardName.HELION, CardName.PHOBOLOG, CardName.TERACTOR]},
      {seat: 2, place: 3, score: 1, corporations: []},
    ]);
    (final.missions[3] as any).state = 'active';
    (final.missions[3] as any).gameId = 'g4';
    expect(buildCampaignOverview(final, {missionSlot: 3}).seats[0].tpStatus).eq('included-now');

    const finished = midCampaign();
    finished.phase = 'finished';
    expect(buildCampaignOverview(finished).seats[0].tpStatus).eq('included-final');

    // The three statuses carry distinct player-facing notes.
    expect(new Set([tpStatusLabel('accrues-final'), tpStatusLabel('included-now'), tpStatusLabel('included-final')]).size).eq(3);
  });

  it('corporation provenance derives from the committed snapshots + the live tableau', () => {
    const model = midCampaign();
    // Mission 2 is live; Alice picked Ecoline there (tableau knows, results do not yet).
    const origins = corpOrigins(model, 0, {missionSlot: 1, corpsBySeat: {0: [CardName.THORGATE, CardName.ECOLINE]}});
    expect(origins.get(CardName.THORGATE)).eq(0);
    expect(origins.get(CardName.ECOLINE)).eq(1);

    const vm = buildCampaignOverview(model, {missionSlot: 1, corpsBySeat: {0: [CardName.THORGATE, CardName.ECOLINE]}});
    expect(vm.seats[0].corps).deep.eq([
      {name: CardName.THORGATE, missionSlot: 0},
      {name: CardName.ECOLINE, missionSlot: 1},
    ]);
    // The bot renders its one corporation identity, never a lineage.
    expect(vm.seats[2].corps).has.length(0); // botCorporation unset in fixture
  });

  it('mission details: place-ordered rows with the HISTORIC composition, outgoing legacy from the recorded history', () => {
    const model = midCampaign();
    const details = buildMissionDetails(model, 0)!;
    expect(details.rows.map((r) => r.place)).deep.eq([1, 2, 3]);
    expect(details.rows[0].corporations).deep.eq([CardName.THORGATE]);
    expect(details.rows[0].title?.title).eq('governor');
    expect(details.rows[2].isBot).is.true;

    const outgoing = details.outgoing!;
    expect(outgoing.nextSlot).eq(1);
    expect(outgoing.bonuses).deep.eq([{seat: 1, color: 'red', name: 'Bruno', megaCredits: 5}]);
    expect(outgoing.carried.known).is.true;
    expect(outgoing.carried.pending).is.false;
    expect(outgoing.carried.bySeat.find((s) => s.seat === 0)?.count).eq(2);
    expect(outgoing.carried.yourCards).deep.eq([CardName.ANTS, CardName.ALGAE]);
  });

  it('mission details: an uncommitted mission has none, an old save answers unknown (never zero)', () => {
    const model = midCampaign();
    expect(buildMissionDetails(model, 1)).is.undefined;

    delete (model.missions[1] as any).carriedCounts;
    delete (model.missions[1] as any).yourCarried;
    const details = buildMissionDetails(model, 0)!;
    expect(details.outgoing?.carried.known).is.false;
  });

  it('mission details: a still-deciding interlude reads as PENDING, never as a done transfer', () => {
    const model = midCampaign();
    model.phase = 'interlude';
    (model.missions[1] as any).state = 'ready';
    delete (model.missions[1] as any).gameId;
    delete (model.missions[1] as any).carriedCounts;
    delete (model.missions[1] as any).yourCarried;
    model.carryover = {
      sourceSlot: 0,
      bySeat: [{seat: 0, status: 'pending', count: 0}, {seat: 1, status: 'confirmed', count: 1}],
      yourCards: [],
      yourEligible: [CardName.ANTS],
    };
    const outgoing = buildMissionDetails(model, 0)!.outgoing!;
    expect(outgoing.carried.known).is.true;
    expect(outgoing.carried.pending).is.true;
  });

  it('seat legacy: mission 1 is a known zero, the live mission reads the recorded history', () => {
    const model = midCampaign();
    const m1 = buildSeatLegacy(model, 0, {contextSlot: 0})!;
    expect(m1.carried).deep.eq({known: true, count: 0});
    expect(m1.bonus).is.undefined;

    const m2 = buildSeatLegacy(model, 0, {contextSlot: 1, selfBonusGranted: true})!;
    expect(m2.carried.known).is.true;
    expect(m2.carried.count).eq(2);
    expect(m2.carried.names).deep.eq([CardName.ANTS, CardName.ALGAE]);
    expect(m2.bonus, 'Alice won mission 1 — no comeback bonus').is.undefined;

    const bruno = buildSeatLegacy(model, 1, {contextSlot: 1})!;
    expect(bruno.bonus).deep.eq({amount: 5, status: 'unknown'});
    expect(bruno.carried.names, 'another seat\'s names stay private').is.undefined;
  });

  it('seat legacy: bonus status — pending/granted for you, settled on a committed mission, none for the bot', () => {
    const model = midCampaign();
    model.you = {seat: 1};
    expect(buildSeatLegacy(model, 1, {contextSlot: 1, selfBonusGranted: false})!.bonus).deep.eq({amount: 5, status: 'pending'});
    expect(buildSeatLegacy(model, 1, {contextSlot: 1, selfBonusGranted: true})!.bonus).deep.eq({amount: 5, status: 'granted'});

    (model.missions[1] as any).state = 'committed';
    (model.missions[1] as any).result = result([
      {seat: 0, place: 1, score: 1, corporations: []},
      {seat: 1, place: 2, score: 1, corporations: []},
      {seat: 2, place: 3, score: 1, corporations: []},
    ]);
    expect(buildSeatLegacy(model, 1, {contextSlot: 1})!.bonus).deep.eq({amount: 5, status: 'settled'});

    expect(buildSeatLegacy(model, 2, {contextSlot: 1})!.bonus).is.undefined;
    expect(buildSeatLegacy(model, 2, {contextSlot: 1})!.carried).deep.eq({known: true, count: 0});
  });

  it('seat legacy: an old save without history answers unknown; the live interlude window backfills an active mission', () => {
    const model = midCampaign();
    delete (model.missions[1] as any).carriedCounts;
    delete (model.missions[1] as any).yourCarried;
    expect(buildSeatLegacy(model, 0, {contextSlot: 1})!.carried.known).is.false;

    // The interlude window that launched mission 2 is still the latest one.
    model.carryover = {
      sourceSlot: 0,
      bySeat: [{seat: 0, status: 'confirmed', count: 2}, {seat: 1, status: 'confirmed', count: 0}],
      yourCards: [CardName.ANTS, CardName.ALGAE],
      yourEligible: [CardName.ANTS, CardName.ALGAE, CardName.BIRDS],
    };
    const legacy = buildSeatLegacy(model, 0, {contextSlot: 1})!;
    expect(legacy.carried.known).is.true;
    expect(legacy.carried.count).eq(2);
    expect(legacy.carried.names).deep.eq([CardName.ANTS, CardName.ALGAE]);
  });

  it('seat legacy: a READY (not yet launched) mission reads the live window — the revisable selection travelling in', () => {
    // The map between missions: mission 2 is `ready`, the interlude window
    // is confirmed — the legacy overlay must show the chosen cards, and the
    // bonus must read as PENDING (nothing was granted to anyone yet).
    const model = midCampaign();
    model.phase = 'interlude';
    (model.missions[1] as any).state = 'ready';
    delete (model.missions[1] as any).gameId;
    delete (model.missions[1] as any).carriedCounts;
    delete (model.missions[1] as any).yourCarried;
    model.carryover = {
      sourceSlot: 0,
      bySeat: [{seat: 0, status: 'confirmed', count: 2}, {seat: 1, status: 'confirmed', count: 0}],
      yourCards: [CardName.ANTS, CardName.ALGAE],
      yourEligible: [CardName.ANTS, CardName.ALGAE, CardName.BIRDS],
    };
    const alice = buildSeatLegacy(model, 0, {contextSlot: 1})!;
    expect(alice.carried).deep.eq({known: true, count: 2, names: [CardName.ANTS, CardName.ALGAE]});
    const bruno = buildSeatLegacy(model, 1, {contextSlot: 1})!;
    expect(bruno.bonus).deep.eq({amount: 5, status: 'pending'});
  });

  it('the overview podium orders a committed card by place and marks the current mission', () => {
    const vm = buildCampaignOverview(midCampaign());
    expect(vm.missions[0].podium?.map((p) => p.seat)).deep.eq([0, 1, 2]);
    expect(vm.missions[0].generations).eq(10);
    expect(vm.missions[1].isCurrent).is.true;
    expect(vm.missions[0].isCurrent).is.false;
    expect(vm.progressParams).deep.eq(['2', '4']);
  });
});
