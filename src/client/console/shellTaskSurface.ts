/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A LIVE QUESTION AND THE SURFACE THAT ANSWERS IT — two laws, one predicate (the owner's field bug of 2026-11-07:
 * «Проект Мирового правительства» deals «Эпатажный спонсор», whose play asks «разыграйте карту из руки» — and the hand
 * that played WG Project refused every press with «Сначала завершите текущее действие», or left for the board under
 * the stranded guard).
 *
 *   1. A DOOR TO THE QUESTION NEVER SETS IT ASIDE. Navigating away from a shell task's surface DEFERS it (the board
 *      home then offers «вернуться к решению», and every action verb answers «сначала завершите текущее действие»).
 *      A navigation whose destination IS that surface is the opposite of «away»: the hand opened FOR a play-from-hand
 *      prompt deferred the very prompt it opened for, and the open hand refused every A. Every defer names its
 *      DESTINATION, and the one predicate below decides whether it leaves the question.
 *
 *   2. A FINISHED FLOW HANDS ITS SURFACE TO THE QUESTION STANDING ON IT. A flow ends through its ONE guarded conclusion
 *      — and a flow's ending used to close the frame whatever was asked on it next: WG Project's owed conclusion closed
 *      the hand AFTER the prelude's «play a card from your hand» had already arrived and been seated there. The prompt
 *      was left with no surface (the stranded guard: «запрос недоступен в консольном режиме»). The question asked ON
 *      this frame (its own browse layer serves it) keeps the frame: the flow's stage is released, the frame folds to its
 *      browse layer and serves the question as the next step — one surface, never a close and a reopen.
 *
 * Pure: the shell passes the live task and the frame kind; `shellTaskOnSurface` (the router's one table of «which
 * surface answers which shell kind») is the only judge of «is this the question's surface».
 */
import {ConsoleTask, SHELL_SECTION_KINDS, shellTaskOnSurface} from '@/client/console/consoleTaskRouter';
import {WorkspaceFrameKind, workspaceKindSpec} from '@/client/console/consoleWorkspaceStack';

/** Where a navigation that may set the live question aside is going: a workspace, or the board home. */
export type ShellTaskDestination = WorkspaceFrameKind | 'board';

/** Does standing on `destination` put the player on `task`'s own answering surface? */
export function destinationServesShellTask(task: ConsoleTask | undefined, destination: ShellTaskDestination): boolean {
  if (task === undefined || destination === 'board') {
    return false;
  }
  const spec = workspaceKindSpec(destination);
  return shellTaskOnSurface(task, {
    section: spec.section ?? 'board',
    sheet: spec.sheet,
    corpFirstActionOpen: false,
    externalDrawOpen: destination === 'external-draw',
  });
}

/** LAW 1 — does a navigation to `destination` set the live shell question aside? Never when it goes TO its surface. */
export function navigationDefersShellTask(task: ConsoleTask | undefined, destination: ShellTaskDestination): boolean {
  return task !== undefined && !destinationServesShellTask(task, destination);
}

/**
 * LAW 2 — does the live question STAND ON this frame, so a finished flow of the frame hands the frame over to it
 * instead of closing it? Only a shell-section question (its surface IS a frame's browse layer), only one the player has
 * not set aside, only a frame that is no step of another flow (a hosted frame pops back to its host — the host's own
 * flow decides) and no phase root (the opening is not a flow — it ends through its own director).
 */
export function questionKeepsFrame(input: {
  task: ConsoleTask | undefined,
  kind: WorkspaceFrameKind,
  /** The question was set aside by the player (`consoleState.task.deferred`). */
  deferred: boolean,
  /** The frame stands as a step INSIDE another frame (`workspaceFrameHost(kind) !== undefined`). */
  hosted: boolean,
  /** The frame is a phase-anchored root. */
  phaseRoot: boolean,
}): boolean {
  const {task} = input;
  if (task === undefined || !SHELL_SECTION_KINDS.has(task.kind) || input.deferred || input.hosted || input.phaseRoot) {
    return false;
  }
  return destinationServesShellTask(task, input.kind);
}
