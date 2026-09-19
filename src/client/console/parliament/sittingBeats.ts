/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING'S BEATS (Turmoil Redux — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §6): the PURE list of what the sitting director plays, derived from the
 * phase's summary and nothing else. The order is the SERVER's order (winner →
 * agenda → support → enact → the viewer's rewards → refresh → lobby →
 * closing); a beat exists only for a fact the summary carries (no agenda move
 * — no agenda beat; nothing gained — no support beat); the viewer's own
 * outcomes are one beat each, a skip with its reason; the FINAL phase has no
 * renewal. No beat is ever keyed on a resolution's name: a beat names an
 * OBJECT and an ADDRESS, the way the reward address table does.
 *
 * MODES:
 *  · `live`   — the phase in progress: every beat at full length, the dwell
 *               between beats where the storyboard has one;
 *  · `resume` — a reload / a restore INSIDE the phase: the beats of stages
 *               already passed play COMPACT (half length, no dwell), the
 *               current stage's own beat plays in full;
 *  · `review` — a finished sitting re-read (the protocol, later): every beat
 *               compact, no waits.
 */
import {Color} from '@/common/Color';
import {ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {rewardAddressOf} from '@/common/parliament/rewardAddress';
import {SittingStage} from './consoleSittingFlow';

export type SittingBeatKind =
  /** Light + numbers on the winning card; the tie phrase when a tie was broken. */
  | 'verdict'
  /** The winner's Agenda marker glides (+ the step's bonus). */
  | 'agenda'
  /** Popular support: neutral cubes from the supply onto the parties' places. */
  | 'support'
  /** The old law leaves, the winner moves into the government, its delegates go home, the ruling plaque reveals. */
  | 'enact'
  /** ONE of the viewer's own outcomes: paid (its address), or skipped (its reason). */
  | 'reward'
  /** The losers leave, three fresh resolutions are dealt (with the turn), support votes seat on them. */
  | 'renewal'
  /** Every free delegate returns to the lobby. */
  | 'lobby'
  /** The compact results card. */
  | 'closing';

export type SittingBeat = {
  kind: SittingBeatKind;
  /** The stage this beat belongs to (the page it plays on). */
  stage: SittingStage;
  /** A stable id (unique within one sitting). */
  id: string;
  /** Play compact (half length, no dwell) — a passed stage on resume, everything in review. */
  compact: boolean;
  /** `reward`: the viewer's record this beat presents. */
  outcome?: ParliamentEnactOutcomeModel;
  /** `reward`: the record paid nothing — the skip's reason (an i18n key), named on the plate. */
  skipped?: string;
  /** `enact`: the Agenda move that rides with it (the agenda beat's payload, kept here too for the director's convenience). */
  agenda?: ParliamentPhaseSummaryModel['agenda'];
};

export type SittingBeatMode = 'live' | 'resume' | 'review';

/** The stage each beat kind plays on — the storyboard's own mapping. */
export function sittingBeatStage(kind: SittingBeatKind): SittingStage {
  switch (kind) {
  case 'verdict': return 'verdict';
  case 'agenda':
  case 'support':
  case 'enact': return 'enact';
  case 'reward': return 'reward';
  case 'renewal':
  case 'lobby': return 'renewal';
  case 'closing': return 'closing';
  }
}

const STAGE_ORDER: ReadonlyArray<SittingStage> = ['verdict', 'enact', 'reward', 'renewal', 'closing'];

/** Is `stage` BEFORE `current` in the sitting's order? */
export function sittingStageBefore(stage: SittingStage, current: SittingStage): boolean {
  return STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(current);
}

/**
 * THE BEATS of one sitting, in the server's order. `current` is the stage the
 * viewer stands on (resume marks every stage before it compact); `viewer` is
 * the seat whose rewards are presented (a spectator gets none).
 */
export function sittingBeats(
  summary: ParliamentPhaseSummaryModel,
  viewer: Color | undefined,
  mode: SittingBeatMode,
  current: SittingStage = 'verdict',
): Array<SittingBeat> {
  const out: Array<SittingBeat> = [];
  const compactFor = (stage: SittingStage): boolean =>
    mode === 'review' || (mode === 'resume' && sittingStageBefore(stage, current));
  const push = (kind: SittingBeatKind, extra: Partial<SittingBeat> = {}): void => {
    const stage = sittingBeatStage(kind);
    out.push({kind, stage, id: `${kind}:${out.length}`, compact: compactFor(stage), ...extra});
  };
  push('verdict');
  if (summary.agenda !== undefined) {
    push('agenda', {agenda: summary.agenda});
  }
  if (summary.support.some((s) => s.gained > 0)) {
    push('support');
  }
  push('enact', {agenda: summary.agenda});
  for (const outcome of summary.outcomes ?? []) {
    if (viewer === undefined || outcome.player !== viewer || outcome.kind === 'reaction') {
      continue;
    }
    const delivery = rewardAddressOf(outcome, viewer);
    push('reward', {outcome, ...(delivery.skipped === undefined ? {} : {skipped: delivery.skipped})});
  }
  if (!summary.final) {
    if (summary.refreshed.length > 0 || (summary.discarded?.length ?? 0) > 0) {
      push('renewal');
    }
    if (summary.lobbyRefilled.length > 0) {
      push('lobby');
    }
  }
  push('closing');
  return out;
}

/** The beats of ONE stage (what the director plays when the page opens). */
export function sittingBeatsOfStage(beats: ReadonlyArray<SittingBeat>, stage: SittingStage): Array<SittingBeat> {
  return beats.filter((b) => b.stage === stage);
}
