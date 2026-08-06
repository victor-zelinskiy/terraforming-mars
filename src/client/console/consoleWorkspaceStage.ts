/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKSPACE STAGE — «где я внутри workspace», one model for every screen
 * that can be DESCENDED INTO.
 *
 * `consoleWorkspaceOutcome` already answers the POST-commit half of the north
 * star: «I entered this workspace myself, so what my move PRODUCED presents
 * inside it». This is the PRE-commit half, and it is a different question with
 * the same answer shape: «I entered this workspace myself, so the thing I am
 * now CONFIGURING presents inside it». Both end in a `<Teleport>` of one
 * shell-mounted instance into a zone the workspace publishes; neither may ever
 * be a second copy of the surface.
 *
 * WHY A MODEL AND NOT `isHandOpen` / `isPlayModalOpen` / `isPaymentOpen`.
 * Independent booleans cannot answer the three questions the flow actually
 * asks — what does B do here, what does the breadcrumb say, and what is
 * restored when I come back — so every consumer re-derives them from a
 * different subset of the flags and they drift. Here there is ONE record:
 *
 *   host     — which workspace owns the descent (the breadcrumb's root);
 *   subject  — the object carried into it (the card name — the crumb's anchor);
 *   stage    — the step's own name, published UP by the embedded surface;
 *   slot     — the teleport target, published only while it is really mounted;
 *   phase    — the commit relationship (`consoleWorkspaceFlow`), which is what
 *              B's verb and the input gate are derived from.
 *
 * The RESTORE half (which card was selected, which filter was on, where the
 * grid was scrolled) deliberately does NOT live here: it already lives in
 * `consoleRouter.consoleState` (`handIndex`, `handTagFilter`), which survives
 * the descent by construction because the browse layer is never unmounted —
 * it is parked. Copying it here would create a second truth that can disagree
 * with the first.
 *
 * PURE-ish: one reactive record + pure accessors. No DOM, no Vue components.
 */
import {reactive} from 'vue';
import {WorkspacePhase, backVerbFor, WorkspaceBackVerb, acceptsInput, isCommitted} from '@/client/console/consoleWorkspaceFlow';

/**
 * Which workspace the player has descended INTO. A closed union on purpose:
 * every host has to publish a real zone and a real breadcrumb root, so a new
 * one is a deliberate addition — never a string that silently starts matching.
 */
export type WorkspaceStageHost =
  /**
   * «КАРТЫ В РУКЕ» → the play-a-card flow (ConsoleHandSection +
   * ConsolePlayCardConfirm).
   *
   * NB the hand can itself be a STEP of a bigger workspace (the Game Start
   * Workspace's play-from-hand prelude — Eccentric Sponsor). That does NOT
   * add a host here: the composer still descends into the hand's own zone,
   * because that is structurally where it lands. What changes is only which
   * shell the hand wears, and therefore who draws the breadcrumb ROOT — see
   * `ConsoleHandSection.embedded` / `consoleWorkspaceEmbed.ts`.
   */
  | 'hand';

/** The breadcrumb ROOT of each host — one table, so the crumb cannot drift
 *  from the screen it names. i18n keys (English text IS the key). */
const HOST_ROOT: Record<WorkspaceStageHost, string> = {
  hand: 'Cards in hand',
};

export const workspaceStageState = reactive({
  /** The descended-into workspace, or undefined at the browse layer. */
  host: undefined as WorkspaceStageHost | undefined,
  /** The carried object — a CardName. '' while browsing. */
  subject: '' as string,
  /**
   * The stage's own name (i18n key), published UP by the embedded surface.
   *
   * The embedded surface must not title itself: a second heading inside
   * someone else's frame is exactly how a stage starts reading as a modal that
   * arrived. It hands the name up and the WORKSPACE says it, in the one line
   * that has been on screen since the player opened the screen.
   */
  stage: '' as string,
  /**
   * The CSS selector of the workspace's stage zone — the teleport target.
   *
   * REACTIVE on purpose (same reasoning as `workspaceOutcomeState.embedSlot`):
   * the host's mount is what makes the target real, and a `querySelector` in a
   * consumer's computed would never re-run when the node appears. A teleport
   * whose target does not exist yet drops its content on the floor.
   */
  slot: '' as string,
  /** Where the descent stands relative to its commit (drives B and the gate). */
  phase: 'browse' as WorkspacePhase,
});

/** Enter a stage: the player descended into `subject` inside `host`. */
export function openWorkspaceStage(host: WorkspaceStageHost, subject: string, stage: string): void {
  workspaceStageState.host = host;
  workspaceStageState.subject = subject;
  workspaceStageState.stage = stage;
  workspaceStageState.phase = 'configure';
}

/** The embedded surface names the step it is showing (breadcrumb tail). */
export function setWorkspaceStageName(stage: string): void {
  if (workspaceStageState.host !== undefined) {
    workspaceStageState.stage = stage;
  }
}

/** The descent crossed the commit boundary (submitted — B stops meaning back). */
export function markWorkspaceStageCommitted(): void {
  if (workspaceStageState.host !== undefined) {
    workspaceStageState.phase = 'executing';
  }
}

/**
 * A POST-COMMIT follow-up decision presents inside the stage (the played
 * card asked for a colony / a target): the move is made and cannot be
 * unmade, but the pad must be live for the decision ABOUT ITS RESULT —
 * `committed` in the flow vocabulary (B = collapse, input accepted). The
 * embedded surface's name goes up as the new crumb tail.
 */
export function markWorkspaceStageFollowUp(stage: string): void {
  if (workspaceStageState.host !== undefined) {
    workspaceStageState.phase = 'committed';
    workspaceStageState.stage = stage;
  }
}

/**
 * The server REFUSED the move — the descent goes back to being configurable.
 *
 * A commit that the server rejected never happened, so leaving the phase past
 * the boundary would strand the player in a state where B does nothing and the
 * crumb claims a move that was not made. The rollback is a peer of the commit,
 * not an afterthought: every enumerated reject path that re-arms the CTA calls
 * it in the same breath.
 */
export function rollbackWorkspaceStageCommit(): void {
  if (workspaceStageState.host !== undefined && isCommitted(workspaceStageState.phase)) {
    workspaceStageState.phase = 'configure';
  }
}

/** The workspace's stage zone mounted (or went away) — publish the target. */
export function setWorkspaceStageSlot(selector: string): void {
  workspaceStageState.slot = selector;
}

/** Leave the stage — back at the browse layer of the same workspace. */
export function closeWorkspaceStage(): void {
  workspaceStageState.host = undefined;
  workspaceStageState.subject = '';
  workspaceStageState.stage = '';
  workspaceStageState.phase = 'browse';
  // NB: `slot` is deliberately NOT cleared here. It belongs to the host's
  // MOUNT, not to the flow, and the host retracts it in its own unmount hook.
  // Clearing it from the flow side would retract a target that is still in the
  // DOM during the leave transition — the teleport would drop its content in
  // the middle of the fold, which is the one frame the fold exists to show.
}

/** Is a descent live in this workspace right now? */
export function workspaceStageOpen(host: WorkspaceStageHost): boolean {
  return workspaceStageState.host === host;
}

/**
 * The teleport target for `host`'s embedded stage, or undefined.
 *
 * OWNERSHIP AND READINESS ARE SEPARATE QUESTIONS (the lesson `taskEmbedTarget`
 * paid for): the flow may own the stage a tick before its zone exists. A
 * consumer that treats "no slot yet" as "not mine" hands the surface to the
 * standalone band for one frame — which is precisely the modal-on-top-of-modal
 * impression this whole migration removes.
 */
export function workspaceStageTarget(host: WorkspaceStageHost): string | undefined {
  if (workspaceStageState.host !== host || workspaceStageState.slot === '') {
    return undefined;
  }
  return workspaceStageState.slot;
}

/** The breadcrumb for the live descent — feeds `buildWorkspaceHeader`. */
export function workspaceStageCrumb(host: WorkspaceStageHost): {
  root: string,
  subject?: {text: string, translate?: boolean},
  stage?: string,
  committed: boolean,
} {
  const live = workspaceStageState.host === host;
  return {
    root: HOST_ROOT[host],
    subject: live && workspaceStageState.subject !== '' ? {text: workspaceStageState.subject} : undefined,
    stage: live && workspaceStageState.stage !== '' ? workspaceStageState.stage : undefined,
    committed: live && workspaceStageState.phase !== 'configure' && workspaceStageState.phase !== 'browse',
  };
}

/** What B means at the current depth of `host` (never hand-rolled at a site). */
export function workspaceStageBackVerb(host: WorkspaceStageHost): WorkspaceBackVerb {
  return backVerbFor(workspaceStageState.host === host ? workspaceStageState.phase : 'browse');
}

/** Is the pad live at the current depth? A committed beat absorbs input, so a
 *  double submit is impossible by construction rather than by a flag. */
export function workspaceStageAcceptsInput(): boolean {
  return acceptsInput(workspaceStageState.phase);
}

/** Full reset (game switch / test cleanup / shell unmount). */
export function resetWorkspaceStage(): void {
  closeWorkspaceStage();
  workspaceStageState.slot = '';
}
