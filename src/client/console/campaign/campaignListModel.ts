// «Мои кампании» — the PURE list view-model (no Vue, no DOM; spec'd under the
// server runner like campaignMapModel). One campaign = one row; the split,
// the sort and every label key are decided here so the component and the
// menu's command bar read the same answers.

import {CampaignSummaryModel, CampaignViewerState} from '../../../common/campaign/CampaignSummary';

export type CampaignsTab = 'active' | 'completed';

export type CampaignSlotMark = 'done' | 'current' | 'future';

/** Finished AND abandoned live in the archive tab — visually distinct there. */
export function isArchivedCampaign(c: CampaignSummaryModel): boolean {
  return c.phase === 'finished' || c.phase === 'abandoned';
}

const ACTION_STATES: ReadonlySet<CampaignViewerState> = new Set(['yourTurn', 'chooseCarryover']);

/** «От меня требуется действие» — what the active sort leads with. */
export function campaignActionRequired(c: CampaignSummaryModel): boolean {
  return ACTION_STATES.has(c.state);
}

function activeRank(c: CampaignSummaryModel): number {
  if (campaignActionRequired(c)) {
    return 0;
  }
  if (c.state === 'launchReady') {
    return 1;
  }
  return 2;
}

/**
 * Active: action-required first, then launch-ready (creator), then the rest
 * by last activity. The id tiebreak keeps the order DETERMINISTIC — rows must
 * never swap places on a refresh that changed nothing.
 */
export function sortActiveCampaigns(rows: ReadonlyArray<CampaignSummaryModel>): Array<CampaignSummaryModel> {
  return [...rows].sort((a, b) =>
    (activeRank(a) - activeRank(b)) ||
    (b.lastActivityMs - a.lastActivityMs) ||
    a.id.localeCompare(b.id));
}

/** Archive: newest ending first, id as the deterministic tiebreak. */
export function sortCompletedCampaigns(rows: ReadonlyArray<CampaignSummaryModel>): Array<CampaignSummaryModel> {
  return [...rows].sort((a, b) =>
    (b.lastActivityMs - a.lastActivityMs) ||
    a.id.localeCompare(b.id));
}

/** The shown slice, sorted — the ONE list the cursor walks. */
export function visibleCampaignRows(rows: ReadonlyArray<CampaignSummaryModel>, tab: CampaignsTab): Array<CampaignSummaryModel> {
  const slice = rows.filter((c) => isArchivedCampaign(c) === (tab === 'completed'));
  return tab === 'completed' ? sortCompletedCampaigns(slice) : sortActiveCampaigns(slice);
}

export function activeCampaignCount(rows: ReadonlyArray<CampaignSummaryModel>): number {
  return rows.filter((c) => !isArchivedCampaign(c)).length;
}

export function completedCampaignCount(rows: ReadonlyArray<CampaignSummaryModel>): number {
  return rows.filter((c) => isArchivedCampaign(c)).length;
}

/** English i18n key for the row's leading viewer-state. */
export function campaignStateLabelKey(c: CampaignSummaryModel): string {
  switch (c.state) {
  case 'yourTurn': return 'Your turn';
  case 'chooseCarryover': return 'Choose projects to carry over';
  case 'waitingOthers': return 'Waiting for the project carryover selections';
  case 'waitingLaunch': return 'Waiting for the campaign creator to launch the mission';
  case 'launchReady': return 'Mission ready to launch';
  case 'missionActive': return 'Mission in progress';
  case 'blocked': return 'Recovery required';
  case 'finished': return 'Campaign complete';
  case 'abandoned': return 'Campaign abandoned';
  default: {
    const _exhaustive: never = c.state;
    return _exhaustive;
  }
  }
}

/** «Миссия N из M» / «Кампания завершена» — key + params for the progress chip. */
export function campaignProgress(c: CampaignSummaryModel): {key: string, params: Array<string>} {
  if (c.phase === 'finished') {
    return {key: 'Campaign complete', params: []};
  }
  const current = Math.min(c.pointer + 1, c.missionCount);
  return {key: 'Mission ${0} of ${1}', params: [String(current), String(c.missionCount)]};
}

/** The 4-segment progress rail: done / current / future per slot. */
export function campaignSlotMarks(c: CampaignSummaryModel): Array<CampaignSlotMark> {
  const marks: Array<CampaignSlotMark> = [];
  for (let i = 0; i < c.missionCount; i++) {
    if (c.phase === 'finished') {
      marks.push('done');
    } else if (c.phase === 'abandoned') {
      marks.push(i < c.completedMissions ? 'done' : 'future');
    } else if (i < c.pointer) {
      marks.push('done');
    } else if (i === c.pointer) {
      marks.push('current');
    } else {
      marks.push('future');
    }
  }
  return marks;
}
