import {expect} from 'chai';
import {
  visibleCampaignRows, sortActiveCampaigns, campaignActionRequired,
  campaignStateLabelKey, campaignProgress, campaignSlotMarks,
  isArchivedCampaign, activeCampaignCount, completedCampaignCount,
} from '../../src/client/console/campaign/campaignListModel';
import {CampaignSummaryModel, CampaignViewerState} from '../../src/common/campaign/CampaignSummary';
import {CampaignPhase} from '../../src/common/campaign/CampaignTypes';
import {CampaignId} from '../../src/common/Types';
import {BoardName} from '../../src/common/boards/BoardName';

let seq = 0;
function summary(overrides: Partial<CampaignSummaryModel> = {}): CampaignSummaryModel {
  seq++;
  return {
    id: `c${String(seq).padStart(12, '0')}` as CampaignId,
    rev: 1,
    name: `Campaign ${seq}`,
    createdTimeMs: 1000,
    lastActivityMs: 1000,
    phase: 'generated' as CampaignPhase,
    pointer: 0,
    missionCount: 4,
    completedMissions: 0,
    missionGamesCount: 0,
    currentBoard: BoardName.THARSIS,
    seats: [],
    you: {seat: 0},
    isCreator: true,
    state: 'launchReady' as CampaignViewerState,
    yourTitlePoints: 0,
    ...overrides,
  };
}

describe('campaignListModel', () => {
  it('splits by the CANONICAL campaign phase: finished AND abandoned are archived', () => {
    const rows = [
      summary({phase: 'generated', state: 'launchReady'}),
      summary({phase: 'missionActive', state: 'missionActive'}),
      summary({phase: 'interlude', state: 'chooseCarryover'}),
      summary({phase: 'finished', state: 'finished'}),
      summary({phase: 'abandoned', state: 'abandoned'}),
    ];
    expect(activeCampaignCount(rows)).eq(3);
    expect(completedCampaignCount(rows)).eq(2);
    expect(visibleCampaignRows(rows, 'active').every((c) => !isArchivedCampaign(c))).is.true;
    expect(visibleCampaignRows(rows, 'completed').every((c) => isArchivedCampaign(c))).is.true;
  });

  it('active sort: action-required first, then creator launch-ready, then last activity', () => {
    const waiting = summary({state: 'waitingLaunch', isCreator: false, lastActivityMs: 9000});
    const yourTurn = summary({phase: 'missionActive', state: 'yourTurn', lastActivityMs: 1000});
    const carry = summary({phase: 'interlude', state: 'chooseCarryover', lastActivityMs: 500});
    const ready = summary({state: 'launchReady', lastActivityMs: 100});
    const sorted = sortActiveCampaigns([waiting, ready, carry, yourTurn]);
    // Action-required lead (newest activity first inside the band), then
    // launch-ready, then the rest.
    expect(sorted.map((c) => c.state)).deep.eq(['yourTurn', 'chooseCarryover', 'launchReady', 'waitingLaunch']);
    expect(campaignActionRequired(yourTurn)).is.true;
    expect(campaignActionRequired(carry)).is.true;
    expect(campaignActionRequired(ready)).is.false;
  });

  it('the order is deterministic: equal ranks and timestamps fall back to the id', () => {
    const a = summary({lastActivityMs: 700});
    const b = summary({lastActivityMs: 700});
    const once = sortActiveCampaigns([b, a]).map((c) => c.id);
    const twice = sortActiveCampaigns([a, b]).map((c) => c.id);
    expect(once).deep.eq(twice);
  });

  it('archive sorts by ending time, newest first', () => {
    const older = summary({phase: 'finished', state: 'finished', lastActivityMs: 100});
    const newer = summary({phase: 'abandoned', state: 'abandoned', lastActivityMs: 900});
    expect(visibleCampaignRows([older, newer], 'completed').map((c) => c.id)).deep.eq([newer.id, older.id]);
  });

  it('every viewer state has a label key (exhaustive)', () => {
    const states: Array<CampaignViewerState> = [
      'yourTurn', 'chooseCarryover', 'launchReady', 'missionActive',
      'waitingOthers', 'waitingLaunch', 'blocked', 'finished', 'abandoned',
    ];
    for (const state of states) {
      expect(campaignStateLabelKey(summary({state})), state).is.a('string').and.not.empty;
    }
  });

  it('progress: «Миссия N из M» while running, «Кампания завершена» at the end', () => {
    expect(campaignProgress(summary({pointer: 1}))).deep.eq({key: 'Mission ${0} of ${1}', params: ['2', '4']});
    // The pointer never overflows the mission count in the label.
    expect(campaignProgress(summary({phase: 'abandoned', pointer: 4, completedMissions: 4})).params[0]).eq('4');
    expect(campaignProgress(summary({phase: 'finished'})).key).eq('Campaign complete');
  });

  it('slot marks: done/current/future; abandoned shows no current; finished is all done', () => {
    expect(campaignSlotMarks(summary({pointer: 1, phase: 'missionActive'}))).deep.eq(['done', 'current', 'future', 'future']);
    expect(campaignSlotMarks(summary({phase: 'finished'}))).deep.eq(['done', 'done', 'done', 'done']);
    expect(campaignSlotMarks(summary({phase: 'abandoned', completedMissions: 2, pointer: 2}))).deep.eq(['done', 'done', 'future', 'future']);
  });
});
