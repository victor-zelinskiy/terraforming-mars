/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE STANDARD-PROJECTS FLOW — the module-level state of the one flow the
 * «СТАНДАРТНЫЕ ПРОЕКТЫ» workspace owns, from the A-press on a row to the
 * commit's last beat.
 *
 * WHY A MODULE. The workspace frame carries navigation (phase / subject /
 * serves); what it cannot carry is the flow's own pending decision — which
 * project was submitted, what the flow is waiting for, and the draft that
 * lets a board excursion come back to the very row the player left. That is
 * the SUSPENDED-INSTANCE record of `docs/CONSOLE_WORKSPACE_STACK.md` — the
 * same shape as `consoleCardActionsUi.draft` / `maFocusState.draft`.
 *
 * THE COMMIT MODEL (mirrors the server's own two shapes):
 *  · TERMINAL projects (Asteroid / Power Plant / Air Scrapping / …) — the
 *    A-press IS the commit: submit → `executing` (input absorbed by phase)
 *    → the response applies the change → a short COMMIT beat on the row →
 *    the workspace closes. No second confirm, no resource flights.
 *  · TARGET projects (City / Ocean / Greenery / Colony) — the server is
 *    pay-on-commit (`cancellablePlacement`): the A-press submits the project
 *    but NOTHING is spent until the target is committed inside the nested
 *    step, so the whole flow stays reversible until that atomic commit.
 *  · PATENT SALE — a pure client pre-select (nothing submitted until the
 *    sale is confirmed inside the hand step).
 *
 * PURE + reactive state only: no DOM, no Vue components, no submission.
 * The shell owns the wiring; specs drive this model directly.
 */
import {reactive} from 'vue';
import {WorkspacePhase} from '@/client/console/consoleWorkspaceFlow';
import {StdProjectItem} from '@/client/console/consoleQuickModel';

/**
 * Where the flow stands. Deliberately NOT the frame's `WorkspacePhase` —
 * the frame answers «what does B do here», this answers «what is the flow
 * waiting for». `stdProjectsFramePhase` maps one onto the other.
 *
 *  idle       — browse; nothing pending.
 *  submitting — a projectCard response is on the wire (round trip).
 *  target     — the server answered with the project's own follow-up
 *               (SelectColony hosted as a step / SelectSpace on the board);
 *               nothing is paid yet — the flow is still reversible.
 *  commit     — a TERMINAL project's answer arrived: the world has changed,
 *               the row plays its short committed beat, then the flow closes.
 */
export type StdProjectsFlowState = 'idle' | 'submitting' | 'target' | 'commit';

type BoardExcursionDraft = {
  /** The submitted project (a CardName — the row the player left from). */
  card: string,
  /** The focused row index at submit time (`consoleState.sheetIndex` is
   *  reset by `closeConsoleLayers`, so the draft carries it). */
  sheetIndex: number,
};

export const stdProjectsFlow = reactive({
  state: 'idle' as StdProjectsFlowState,
  /** The project the flow is about (a CardName; '' while idle / sale). */
  card: '' as string,
  /**
   * The view fingerprint (`gameAge|undoCount`) at submit time — DIAGNOSTIC
   * ONLY (the `__conColonyDiag` probe and post-mortems).
   *
   * It was briefly the response DETECTOR and must never be one again: those
   * counters do not have to move for a standard project, so the gate swallowed
   * the colony answer, the flow stayed `submitting`, and the player's later
   * CANCEL was then celebrated as a terminal commit. The honest detector is
   * the `playerView` watcher's own existence — it fires only on a new view.
   */
  submittedAt: '' as string,
  /**
   * FROZEN row snapshot for the span of a submit. The live rows derive from
   * `waitingFor`, which moves on with the response — without the freeze the
   * browse grid re-renders EMPTY between the submit and the flow's next
   * surface (the deck-pick precedent: the surface outlives its own prompt).
   */
  frozenItems: undefined as ReadonlyArray<StdProjectItem> | undefined,
  /**
   * The BOARD EXCURSION draft. A City/Ocean/Greenery follow-up is served by
   * the always-mounted board, so the workspace honestly FOLDS for the
   * placement; this draft is what lets a CANCELLED placement reopen the very
   * row the player left (same project, same focus — a resume, not a fresh
   * open). Cleared when the flow moves past the placement.
   */
  boardExcursion: undefined as BoardExcursionDraft | undefined,
  /**
   * A cancel is in flight (B on the nested step / the placement). The
   * response that answers it is the flow's cue to fold the step back to the
   * browse layer (or reopen the folded workspace) instead of closing.
   */
  cancelRequested: false,
});

/** The frame phase the flow state maps onto (B's verb + input gating derive
 *  from it — never hand-rolled at a call site). */
export function stdProjectsFramePhase(state: StdProjectsFlowState): WorkspacePhase {
  switch (state) {
  case 'idle': return 'browse';
  // The round trip is a machine beat: input absorbed, not a destination.
  case 'submitting': return 'executing';
  // The nested step is the flow's configure stage — still reversible
  // (pay-on-commit: nothing is spent until the step's own atomic commit).
  case 'target': return 'configure';
  // Past the commit boundary; the result is leaving (the closing beat).
  case 'commit': return 'completing';
  }
}

/** A submit left the browse layer (the wire, a step, or the commit beat). */
export function stdProjectsFlowLive(): boolean {
  return stdProjectsFlow.state !== 'idle';
}

export function beginStdProjectSubmit(
  card: string,
  items: ReadonlyArray<StdProjectItem>,
  sheetIndex: number,
  fingerprint: string,
): void {
  stdProjectsFlow.state = 'submitting';
  stdProjectsFlow.card = card;
  stdProjectsFlow.submittedAt = fingerprint;
  stdProjectsFlow.frozenItems = items.map((it) => ({...it}));
  stdProjectsFlow.boardExcursion = {card, sheetIndex};
  stdProjectsFlow.cancelRequested = false;
}

/** The server answered with the project's own follow-up prompt. */
export function markStdProjectTarget(): void {
  stdProjectsFlow.state = 'target';
}

/** A terminal project's answer arrived — the short committed beat begins. */
export function markStdProjectCommit(): void {
  stdProjectsFlow.state = 'commit';
  stdProjectsFlow.boardExcursion = undefined;
}

/** B pressed inside the nested step / placement — awaiting the server's
 *  restore of the action menu. */
export function requestStdProjectCancel(): void {
  stdProjectsFlow.cancelRequested = true;
}

/**
 * The flow is over (committed and closed, cancelled back to browse, or the
 * server moved on to something that is not ours). Always safe to call.
 */
export function resetStdProjectsFlow(): void {
  stdProjectsFlow.state = 'idle';
  stdProjectsFlow.card = '';
  stdProjectsFlow.submittedAt = '';
  stdProjectsFlow.frozenItems = undefined;
  stdProjectsFlow.boardExcursion = undefined;
  stdProjectsFlow.cancelRequested = false;
}
