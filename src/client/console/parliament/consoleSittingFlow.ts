/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING FLOW (Turmoil Redux — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §3.4, §6; docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md § Э3) — the PURE half of
 * «ПАРЛАМЕНТ › ЗАСЕДАНИЕ»: where the political phase stands on the SERVER, which
 * pages the viewer walks locally before each gate, what the crumb's tail says,
 * which phase B's verb comes from, and the mandatory FLOW beat that opens the
 * whole sitting once per generation.
 *
 * The sitting is ONE flow with TWO synchronous gates (`ParliamentPhase.ts`):
 *
 *   winner → agenda → support → enact → ▶ ASSEMBLY ◀ → effects → refresh → lobby → ▶ ADJOURN ◀ → done
 *
 * Every fact here is the server's: the phase's `step`, its `summary`, its
 * `awaiting` list, the viewer's own prompt and its STRUCTURAL markers
 * (`parliamentPhasePrompt`, a `choiceContext` / `externalDrawPrompt` /
 * `placementContext` whose source is a resolution) — never a title, never a
 * resolution name, never a client memory of «already seen» (the recap's
 * `localStorage` mark is what this module replaces).
 *
 * WHAT IS LOCAL, and why that is honest: inside the ASSEMBLY step the viewer
 * reads three pages (the verdict, the enactment, the reward) before answering
 * the gate; inside ADJOURN two (the renewal, the closing). The server holds
 * ONE prompt for the whole step, so which page the viewer is on is
 * presentation state — `parliamentFlow.sittingPage`. A reload therefore lands
 * on the step's FIRST page (a seat that has already answered lands on the
 * gate's wait pose — that much the server does know); Э4's `resume` mode
 * replays the passed pages compactly. Nothing is persisted on the device.
 */
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {PlayerInputType} from '@/common/input/PlayerInputType';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {ParliamentPhaseStage} from '@/common/parliament/ParliamentTypes';
import type {WorkspacePhase} from '@/client/console/consoleWorkspaceFlow';
import type {MandatoryFlowBeat} from '@/client/console/consoleMandatoryGate';
import {promptSourceResolution} from '@/client/console/promptSource';
import {externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';

/** The sitting's STAGES, in the order the server produces their facts. */
export type SittingStage = 'verdict' | 'enact' | 'reward' | 'renewal' | 'closing';

/**
 * What the REWARD stage is doing for THIS seat right now.
 *  · `reading`   — before the effects (the assembly's last page): the reading of what is coming;
 *  · `choice` / `intake` / `placement` — the viewer's own ask, hosted in the stage's zone (or the board);
 *  · `waiting`   — the effects ask ANOTHER seat (the honest wait line);
 *  · `received`  — the viewer's record is in: paid, or skipped with its reason (the plate names it);
 *  · `gate`      — the viewer answered the gate; the pose lists who is still awaited.
 */
export type SittingRewardStep = 'reading' | 'choice' | 'intake' | 'placement' | 'waiting' | 'received' | 'gate';

/**
 * WHERE THE SITTING STANDS, read off the server. `undefined` outside a live
 * political phase the viewer takes part in.
 */
export type SittingPosition = {
  generation: number;
  final: boolean;
  /** The server's step. */
  step: ParliamentPhaseModel['step'];
  /** The pages the viewer walks locally in this step, first to last (never empty). */
  pages: ReadonlyArray<SittingStage>;
  /** The gate this step ends in, when it is a gate step. */
  gate?: ParliamentPhaseStage;
  /** The viewer's own gate prompt stands — A on the last page answers it. */
  gateStanding: boolean;
  /** The viewer has answered the gate (or was never asked) and the phase still waits for these seats. */
  awaiting: ReadonlyArray<Color>;
  /** The REWARD stage's step for this seat (meaningful while `pages` includes `reward`, i.e. always past the enactment). */
  rewardStep: SittingRewardStep;
  /** The seat the effects are asking right now, when it is somebody else — and what kind of answer. */
  waitingFor?: {player: Color, input?: PlayerInputType};
};

/** The viewer's own resolution-sourced ask, by its structural markers — never a title. */
export function sittingAskOf(wf: PlayerInputModel | undefined): 'choice' | 'intake' | 'placement' | undefined {
  if (wf === undefined || promptSourceResolution(wf) === undefined) {
    return undefined;
  }
  if (externalDrawTakeOf(wf) !== undefined) {
    return 'intake';
  }
  if (wf.type === 'space') {
    return 'placement';
  }
  return 'choice';
}

/** The viewer's gate prompt, if it stands: the server's own marker. */
export function sittingGatePromptOf(wf: PlayerInputModel | undefined): ParliamentPhaseStage | undefined {
  return wf?.parliamentPhasePrompt?.stage;
}

/** The viewer's OWN records in the live phase (the effects so far). */
function viewerOutcomes(phase: ParliamentPhaseModel, viewer: Color | undefined): Array<ParliamentEnactOutcomeModel> {
  return viewer === undefined ? [] : (phase.outcomes ?? []).filter((o) => o.player === viewer);
}

/**
 * The pages of a step. The ASSEMBLY gate stands after the enactment, so its
 * step reads the verdict, the enactment and the reward that is coming; the
 * EFFECTS step IS the reward; the ADJOURN gate stands after the refresh, so
 * its step reads the renewal and closes — in the FINAL phase there is no
 * refresh (the server goes straight to the gate), so the sitting closes at
 * once. The transient server steps (`refresh` / `lobby`) are never on the
 * wire long enough to read; they map onto the renewal page.
 */
export function sittingPagesOf(step: ParliamentPhaseModel['step'], final: boolean): ReadonlyArray<SittingStage> {
  switch (step) {
  case 'winner':
  case 'agenda':
  case 'support':
  case 'enact':
  case 'assembly':
    return ['verdict', 'enact', 'reward'];
  case 'effects':
    return ['reward'];
  case 'refresh':
  case 'lobby':
    return ['renewal'];
  case 'adjourn':
    return final ? ['closing'] : ['renewal', 'closing'];
  case 'done':
    return ['closing'];
  }
}

/**
 * THE POSITION — the one derivation every sitting surface reads.
 * `undefined` when no political phase is live for this viewer (no phase, a
 * seat outside the parliament, a spectator).
 */
export function sittingPositionOf(
  model: ParliamentModel | undefined,
  wf: PlayerInputModel | undefined,
  viewer: Color | undefined,
): SittingPosition | undefined {
  const phase = model?.phase;
  if (model === undefined || phase === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  if (seat === undefined || !seat.participates) {
    return undefined;
  }
  const gate: ParliamentPhaseStage | undefined = phase.step === 'assembly' || phase.step === 'adjourn' ? phase.step : undefined;
  const gateStanding = gate !== undefined && sittingGatePromptOf(wf) === gate;
  const awaiting = phase.awaiting ?? [];
  const ask = sittingAskOf(wf);
  const pending = phase.pending;
  const waitingFor = phase.step === 'effects' && pending !== undefined && pending.player !== viewer ?
    {player: pending.player, input: pending.input} : undefined;
  let rewardStep: SittingRewardStep;
  if (ask !== undefined) {
    rewardStep = ask;
  } else if (gate !== undefined && !gateStanding) {
    rewardStep = 'gate';
  } else if (phase.step === 'assembly' || phase.step === 'enact' || phase.step === 'support' || phase.step === 'agenda' || phase.step === 'winner') {
    rewardStep = 'reading';
  } else if (waitingFor !== undefined) {
    rewardStep = 'waiting';
  } else if (viewerOutcomes(phase, viewer).length > 0 || phase.step !== 'effects') {
    rewardStep = 'received';
  } else {
    rewardStep = 'waiting';
  }
  return {
    generation: phase.generation,
    final: phase.final,
    step: phase.step,
    pages: sittingPagesOf(phase.step, phase.final),
    gate,
    gateStanding,
    awaiting,
    rewardStep,
    waitingFor,
  };
}

/**
 * WHERE A STEP'S WALK STARTS: on its first page — unless the seat has already
 * answered the step's gate (a reload, a restore while the others are still
 * reading): then there is nothing left to turn to, and the walk starts on the
 * gate's own wait pose. Server-derived, so a reload never re-asks a question
 * the seat has answered and never skips one it has not.
 */
export function sittingStartPage(position: SittingPosition): number {
  return position.gate !== undefined && !position.gateStanding ? position.pages.length - 1 : 0;
}

/** The stage on screen for a position and the viewer's local page cursor (clamped — a shorter step never reads past its end). */
export function sittingStageAt(position: SittingPosition, page: number): SittingStage {
  const pages = position.pages;
  const index = Math.max(0, Math.min(pages.length - 1, page));
  return pages[index];
}

/** Is the local cursor on the step's LAST page (the page whose A answers the gate, or has nothing left to turn)? */
export function sittingAtLastPage(position: SittingPosition, page: number): boolean {
  return page >= position.pages.length - 1;
}

/**
 * THE CRUMB'S TAIL — an i18n key per stage; the reward's tail names the STEP
 * the seat is actually in (a pick, a take, a placement), so the line reads
 * «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЫБОР» while the picker stands. One word each,
 * never echoing the root's noun (`consoleWorkspaceHeader` grammar).
 */
export function sittingStageKey(stage: SittingStage, rewardStep: SittingRewardStep): string {
  switch (stage) {
  case 'verdict': return 'Verdict';
  case 'enact': return 'Enactment';
  case 'reward':
    switch (rewardStep) {
    case 'choice': return 'Choice';
    case 'intake': return 'Intake';
    case 'placement': return 'Placement';
    default: return 'Reward';
    }
  case 'renewal': return 'Renewal';
  case 'closing': return 'Closing';
  }
}

/** The crumb's SUBJECT while the sitting stands — one fixed word. */
export const SITTING_SUBJECT_KEY = 'Sitting';

/**
 * WHERE THE STAGE STANDS RELATIVE TO ITS COMMIT — the workspace phase B's verb
 * is derived from (`consoleWorkspaceFlow.backVerbFor`):
 *  · every stage up to the closing is `committed` (the sitting cannot be
 *    unmade; B = «свернуть» — hide to read the board, the decision stays);
 *  · the CLOSING is a terminal `verdict` (nothing is chosen after it; B = none,
 *    A closes the sitting);
 *  · a gate answer in flight is `executing` (input absorbed by phase).
 */
export function sittingWorkspacePhase(stage: SittingStage, submitting: boolean): WorkspacePhase {
  if (submitting) {
    return 'executing';
  }
  return stage === 'closing' ? 'verdict' : 'committed';
}

/**
 * THE A VERB on a page — an i18n key, or undefined when A does nothing here
 * (a hosted step owns the bar; a wait pose has nothing to press).
 *  · a page before the last turns the page («Продолжить»);
 *  · the assembly's last page answers gate 1 — «К награде» when something is
 *    coming for this seat, else «Продолжить» (the verb follows the reward);
 *  · the adjourn's last page answers gate 2 — «Закрыть заседание».
 */
export function sittingPrimaryKey(position: SittingPosition, page: number, opts: {rewardComing: boolean}): string | undefined {
  const stage = sittingStageAt(position, page);
  if (!sittingAtLastPage(position, page)) {
    return 'Continue';
  }
  if (position.gate !== undefined && position.gateStanding) {
    if (position.gate === 'assembly') {
      return opts.rewardComing ? 'To the reward' : 'Continue';
    }
    return 'Close the sitting';
  }
  // The effects: a hosted step owns the bar; a wait / a receipt has no verb.
  void stage;
  return undefined;
}

/**
 * THE MANDATORY FLOW BEAT — one announcement per generation («Парламент
 * собрался · поколение N»), keyed on the phase's generation so it stays the
 * SAME beat through gate 1, every ask of the enacted resolution and gate 2:
 * acknowledged once at the open, gone with the phase. Derived from the
 * server's own phase record, exactly like the draft's `draft:gen<N>`.
 */
export function parliamentSittingFlowBeat(view: PlayerViewModel): MandatoryFlowBeat | undefined {
  if (view.game.phase !== Phase.PARLIAMENT) {
    return undefined;
  }
  const position = sittingPositionOf(view.game.parliament, view.waitingFor, view.thisPlayer?.color);
  if (position === undefined || position.step === 'done') {
    return undefined;
  }
  return {key: `parliament:gen${position.generation}`, taskKind: 'parliamentPhase', flow: 'parliament-phase'};
}

/** The sitting is LIVE for the viewer (the flow's frame anchor — the political phase itself). */
export function parliamentSittingLive(view: PlayerViewModel): boolean {
  return parliamentSittingFlowBeat(view) !== undefined;
}

/**
 * IS SOMETHING COMING FOR THIS SEAT — the assembly's A verb («К награде»)
 * reads it: a scaled effect of the enacted resolution the seat's influence
 * or count pays, or the winner's tile when the viewer won the vote. The
 * server's own facts (the declaration + the recorded winner), never a
 * recomputation of the payout.
 */
export function sittingRewardComing(
  model: ParliamentModel | undefined,
  viewer: Color | undefined,
  resolution: {scaled?: ReadonlyArray<unknown>, winnerReward?: unknown} | undefined,
): boolean {
  const phase = model?.phase;
  if (phase === undefined || viewer === undefined || resolution === undefined) {
    return false;
  }
  const scaled = resolution.scaled ?? [];
  if (scaled.length > 0) {
    return true;
  }
  return resolution.winnerReward !== undefined && phase.summary?.winner.player === viewer;
}
