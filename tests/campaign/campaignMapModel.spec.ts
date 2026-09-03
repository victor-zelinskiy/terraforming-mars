import {expect} from 'chai';
import {buildCampaignMapVm} from '@/client/console/campaign/campaignMapModel';
import {CampaignModel} from '@/common/campaign/CampaignModel';
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

describe('campaignMapModel', () => {
  it('a fresh campaign: creator launch CTA, cursor mission is slot 0, finale marked', () => {
    const vm = buildCampaignMapVm(baseModel());
    expect(vm.cta.kind).eq('launch');
    expect(vm.currentSlot).eq(0);
    expect(vm.missions[0].isCurrent).is.true;
    expect(vm.missions[3].final).is.true;
    expect(vm.missions[0].stateLabel).eq('Ready to launch');
    expect(vm.isCreator).is.true;
  });

  it('a non-creator waits (never a launch CTA)', () => {
    const vm = buildCampaignMapVm(baseModel({you: {seat: 1}, canLaunch: false, launchBlockers: []}));
    expect(vm.cta.kind).eq('waiting');
    expect(vm.isCreator).is.false;
  });

  it('an active mission: the viewer joins through their own seat only', () => {
    const model = baseModel({phase: 'missionActive'});
    (model.missions[0] as any).state = 'active';
    (model.missions[0] as any).gameId = 'g1';
    (model.missions[0] as any).yourPlayerId = 'p-you';
    const vm = buildCampaignMapVm(model);
    expect(vm.cta).deep.include({kind: 'join', playerId: 'p-you'});
    // A stranger (no seat): the SERVER strips `yourPlayerId` from their view
    // — the model then answers the honest waiting line, no join link.
    const strangerModel = baseModel({phase: 'missionActive', you: undefined, canLaunch: false});
    (strangerModel.missions[0] as any).state = 'active';
    (strangerModel.missions[0] as any).gameId = 'g1';
    const stranger = buildCampaignMapVm(strangerModel);
    expect(stranger.cta.kind).eq('waiting');
  });

  it('interlude: a pending carryover outranks the launch CTA for its owner', () => {
    const model = baseModel({
      phase: 'interlude',
      pointer: 1,
      canLaunch: false,
      launchBlockers: ['Waiting for the project carryover selections'],
      carryover: {
        sourceSlot: 0,
        bySeat: [
          {seat: 0, status: 'pending', count: 0},
          {seat: 1, status: 'confirmed', count: 2},
        ],
        yourCards: [],
        yourEligible: [CardName.ANTS, CardName.ALGAE],
      },
    });
    (model.missions[0] as any).state = 'committed';
    (model.missions[1] as any).state = 'ready';
    const vm = buildCampaignMapVm(model);
    expect(vm.cta.kind).eq('carryover');
    expect(vm.carryoverOpen).is.true;
    expect(vm.carryoverConfirmed).is.false;
    expect(vm.yourEligibleCards).has.length(2);
    // The rail shows the OTHER seat's status as count only (privacy: no names).
    const bruno = vm.rail.find((r) => r.seat === 1)!;
    expect(bruno.carry).deep.eq({status: 'confirmed', count: 2});
  });

  it('titles/TP/bonuses project onto the rail; shared places surface in results', () => {
    const model = baseModel({
      phase: 'interlude',
      pointer: 1,
      progression: {
        lineages: {0: [CardName.CREDICOR]},
        titles: [
          {seat: 0, missionSlot: 0, title: 'governor', titlePoints: 15},
          {seat: 1, missionSlot: 0, title: 'administrator', titlePoints: 10},
        ],
        titlePoints: {0: 15, 1: 10, 2: 5},
        pendingBonuses: {1: 5},
      },
    });
    (model.missions[0] as any).state = 'committed';
    (model.missions[0] as any).result = {
      gameId: 'g1',
      generations: 9,
      standings: [
        {seat: 0, place: 1, score: 60, megaCredits: 20, corporations: [CardName.CREDICOR], tiedWith: [1]},
        {seat: 1, place: 1, score: 60, megaCredits: 20, corporations: [], tiedWith: [0]},
        {seat: 2, place: 3, score: 40, megaCredits: 0, corporations: [], tiedWith: []},
      ],
      titles: [
        {seat: 0, missionSlot: 0, title: 'governor', titlePoints: 15},
        {seat: 1, missionSlot: 0, title: 'governor', titlePoints: 15},
      ],
      bonuses: [{seat: 1, megaCredits: 5}],
    };
    const vm = buildCampaignMapVm(model);
    const alice = vm.rail.find((r) => r.seat === 0)!;
    expect(alice.titlePoints).eq(15);
    expect(alice.titles.map((t) => t.title)).deep.eq(['governor']);
    const bruno = vm.rail.find((r) => r.seat === 1)!;
    expect(bruno.pendingBonus).eq(5);
    // Shared place: both first rows read tied.
    const results = vm.missions[0].results!;
    expect(results[0].tied).is.true;
    expect(results[1].tied).is.true;
    expect(results[0].title).eq('governor');
  });

  it('a finished campaign is a chronicle: champion on the rail, chronicle CTA', () => {
    const model = baseModel({phase: 'finished', pointer: 3, championSeats: [1], canLaunch: false});
    for (const m of model.missions) {
      (m as any).state = 'committed';
    }
    const vm = buildCampaignMapVm(model);
    expect(vm.cta.kind).eq('chronicle');
    expect(vm.rail.find((r) => r.seat === 1)!.isChampion).is.true;
    expect(vm.missions.every((m) => !m.isCurrent)).is.true;
    expect(vm.progressLabel).eq('Campaign complete');
  });

  it('a blocked slot names its reason', () => {
    const model = baseModel();
    (model.missions[0] as any).blockedReason = 'The mission board is unavailable in this build';
    const vm = buildCampaignMapVm(model);
    expect(vm.missions[0].blockedReason).eq('The mission board is unavailable in this build');
  });
});
