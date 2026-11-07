import {expect} from 'chai';
import {CampaignModel} from '../../src/common/campaign/CampaignModel';
import {
  campaignRewardModeOf, seatTenderAtMission, seatTenderHoldings, tenderNoteKey, tenderStatusKey,
} from '../../src/client/console/campaign/tenderHoldings';

/*
 * «Тендеры» — ONE reader of a seat's holdings for every campaign surface that spoke titles before: the holdings in
 * acquisition order, the lot a seat took at a mission's bidding, the status vocabulary, the rail's note.
 */
function model(overrides: Partial<CampaignModel> = {}): CampaignModel {
  return {
    id: 'ct', rev: 1, name: 'T', createdTimeMs: 0, phase: 'interlude', pointer: 1, missionCount: 3,
    seats: [{seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0}, {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0}],
    you: {seat: 0}, canLaunch: false, launchBlockers: [],
    missions: [
      {slot: 0, board: 'tharsis', final: false, state: 'committed', modifiers: [],
        bidding: {sourceSlot: 0, offer: [{instance: 't0-0', id: 'openCall', takenBy: 1}, {instance: 't0-1', id: 'gamble', withdrawn: true}], order: [1, 0], lots: [], pointer: 1, done: true}},
      {slot: 1, board: 'hellas', final: false, state: 'ready', modifiers: []},
      {slot: 2, board: 'elysium', final: true, state: 'locked', modifiers: []},
    ],
    progression: {lineages: {}, titles: [], titlePoints: {0: 0, 1: 0}, pendingBonuses: {},
      tenders: {1: [{instance: 't0-0', id: 'openCall', wonAtSlot: 0, place: 1, status: 'held'}]}},
    rewardMode: 'tenders',
    ...overrides,
  } as unknown as CampaignModel;
}

describe('tenderHoldings — the surfaces\' one reader', () => {
  it('a seat\'s holdings in acquisition order; a seat with none, and a titles campaign, read empty', () => {
    const m = model();
    expect(campaignRewardModeOf(m)).eq('tenders');
    expect(seatTenderHoldings(m, 1)).deep.eq([{instance: 't0-0', id: 'openCall', wonAtSlot: 0, place: 1, status: 'held'}]);
    expect(seatTenderHoldings(m, 0)).deep.eq([]);
    const titles = model({rewardMode: undefined, progression: {lineages: {}, titles: [], titlePoints: {}, pendingBonuses: {}}} as never);
    expect(campaignRewardModeOf(titles)).eq('titles');
    expect(seatTenderHoldings(titles, 1)).deep.eq([]);
  });

  it('the lot a seat TOOK at a mission\'s bidding — the withdrawn one belongs to nobody; a live bidding counts too', () => {
    const m = model();
    expect(seatTenderAtMission(m, 0, 1)).deep.eq({id: 'openCall', instance: 't0-0'});
    expect(seatTenderAtMission(m, 0, 0)).is.undefined;
    expect(seatTenderAtMission(m, 1, 1)).is.undefined;
    const live = model({bidding: {sourceSlot: 1, offer: [{instance: 't1-0', id: 'restructuring', takenBy: 0}], order: [0, 1], lots: [], pointer: 1, done: false}} as never);
    expect(seatTenderAtMission(live, 1, 0)).deep.eq({id: 'restructuring', instance: 't1-0'});
  });

  it('the status words and the rail\'s note are keys of the one vocabulary', () => {
    expect(tenderStatusKey('held')).eq('Held');
    expect(tenderStatusKey('executed')).eq('Executed');
    expect(tenderStatusKey('cashed')).eq('Bought back');
    expect(tenderNoteKey(model())).include('execute at the finale');
    expect(tenderNoteKey(model({phase: 'finished'} as never))).include('were executed');
  });
});
