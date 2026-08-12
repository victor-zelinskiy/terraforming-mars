/*
 * CONSOLE MA FOCUS — the Milestones/Awards workspace FLOW state
 * (browse ⇄ detail ⇄ commit ⇄ ceremony ⇄ close), the strategic sibling of
 * `consoleColoniesModel.colonyFocusState`.
 *
 * The MA dashboard is a WORKSPACE (the family model: consoleWorkspaceFlow).
 * Its browse layer is the two-column emblem grid; pressing A on an item
 * DESCENDS into the MA FOCUS STAGE — the one source of truth for «what does
 * claiming/funding this do» (condition, race, economy, slots, blockers) AND
 * the safe confirmation context: the second A on the stage is the commit.
 * The old `ConsoleMaConfirm` modal is gone from the console-native flow.
 *
 * After a successful commit the flow does NOT return to the overview: the
 * hero emblem (already carried from the pressed card) becomes the entry
 * point of the EXISTING ma-ceremony (maCeremonyState), which now plays
 * INSIDE the workspace; the workspace closes only after the ceremony's own
 * completion signal (never a parallel timeout).
 *
 * Module-level reactive (not component data): the shell's command bar, the
 * breadcrumb, the input router and the commit watchers all read it, and it
 * must survive the screen's own re-renders.
 */

import {reactive} from 'vue';
import {MaKind} from '@/client/components/ma/maArt';
import {WorkspacePhase, WorkspaceBackVerb, backVerbFor} from '@/client/console/consoleWorkspaceFlow';

/**
 * The stage's own lifecycle, one typed axis (never a spread of booleans):
 *  'detail'     — the reversible confirmation context (B folds to browse);
 *  'committing' — the submit is on the wire; input absorbed, nothing closes;
 *  'ceremony'   — the server confirmed; the existing ceremony plays ON the
 *                 stage (the hero emblem is its entry object);
 *  'closing'    — the ceremony settled; the workspace is letting go.
 */
export type MaFocusPhase = 'detail' | 'committing' | 'ceremony' | 'closing';

export const maFocusState = reactive({
  /** The focus stage is open (the browse grid is parked behind it). */
  open: false,
  /** The item descended into. */
  kind: 'milestone' as MaKind,
  name: '',
  phase: 'detail' as MaFocusPhase,
  /** Inline commit-refusal reason (i18n key; '' = none). Shown IN the stage's
   *  status line — the stage stays up, the player may retry or back out. */
  error: '',
  /** The view identity at submit time — the refusal detector's baseline. */
  committedAt: undefined as {gameAge: number, undoCount: number} | undefined,
  /**
   * The SUSPENDED-INSTANCE record (the workspace-stack rule: what the frames
   * cannot carry across a park lives in a module-level draft). Written when
   * the screen unmounts with a live PRE-COMMIT detail (a lateral move / a
   * defer); consumed ONLY by the task-restore door — a wheel open is always
   * a fresh browse beside it (RESUME ≠ FRESH-OPEN).
   */
  draft: undefined as {kind: MaKind, name: string} | undefined,
});

/** Enter the detail stage for one item (the descend). */
export function openMaFocus(kind: MaKind, name: string): void {
  maFocusState.open = true;
  maFocusState.kind = kind;
  maFocusState.name = name;
  maFocusState.phase = 'detail';
  maFocusState.error = '';
  maFocusState.committedAt = undefined;
  maFocusState.draft = undefined;
}

/** Leave the stage — back at the browse layer (B; PRE-commit only). */
export function closeMaFocus(): void {
  if (maFocusState.phase !== 'detail') {
    return;
  }
  maFocusState.open = false;
  maFocusState.name = '';
  maFocusState.error = '';
  maFocusState.committedAt = undefined;
}

/** An inline pre-submit refusal (blocked / stale) — the stage names it. */
export function setMaFocusError(reason: string): void {
  if (maFocusState.open && maFocusState.phase === 'detail') {
    maFocusState.error = reason;
  }
}

/** The commit left for the wire — input is absorbed from this moment. */
export function beginMaFocusCommit(at: {gameAge: number, undoCount: number}): void {
  if (!maFocusState.open || maFocusState.phase !== 'detail') {
    return;
  }
  maFocusState.phase = 'committing';
  maFocusState.error = '';
  maFocusState.committedAt = at;
}

/** The server refused / the race was lost — restore the reversible detail. */
export function failMaFocusCommit(reason: string): void {
  if (maFocusState.phase !== 'committing') {
    return;
  }
  maFocusState.phase = 'detail';
  maFocusState.error = reason;
  maFocusState.committedAt = undefined;
}

/** The own beat arrived — the ceremony owns the stage now. */
export function beginMaFocusCeremony(): void {
  if (maFocusState.phase === 'committing') {
    maFocusState.phase = 'ceremony';
  }
}

/** The ceremony settled — the workspace is closing (still absorbing input). */
export function beginMaFocusClosing(): void {
  if (maFocusState.phase === 'ceremony') {
    maFocusState.phase = 'closing';
  }
}

/**
 * The screen is unmounting under a live PRE-COMMIT detail (a lateral move /
 * the task defer) — keep the context as the suspended-instance draft. Any
 * other phase resets outright: a commit in flight past an unmount is the
 * degrade path (the global ceremony shell presents the beat).
 */
export function suspendMaFocus(): void {
  if (maFocusState.open && maFocusState.phase === 'detail') {
    maFocusState.draft = {kind: maFocusState.kind, name: maFocusState.name};
  }
  maFocusState.open = false;
  maFocusState.name = '';
  maFocusState.phase = 'detail';
  maFocusState.error = '';
  maFocusState.committedAt = undefined;
}

/** Drop the suspended draft (a real close / the prompt moved on). */
export function discardMaFocusDraft(): void {
  maFocusState.draft = undefined;
}

/** Full reset (close after ceremony / game switch / test cleanup). */
export function resetMaFocus(): void {
  maFocusState.open = false;
  maFocusState.name = '';
  maFocusState.phase = 'detail';
  maFocusState.error = '';
  maFocusState.committedAt = undefined;
  maFocusState.draft = undefined;
}

/** Input is live only at the reversible depths (flow rule: a double submit
 *  is impossible by construction, never by a flag someone checks). */
export function maFocusAcceptsInput(): boolean {
  return !maFocusState.open || maFocusState.phase === 'detail';
}

/**
 * The workspace phase of the MA screen, in the family vocabulary
 * (consoleWorkspaceFlow) — what B means DERIVES from this, never from
 * hand-rolled flags at call sites. The ceremony is a transient beat, not a
 * navigation destination: B during it is absorbed, never «collapse».
 */
export function maWorkspacePhase(): WorkspacePhase {
  if (!maFocusState.open) {
    return 'browse';
  }
  switch (maFocusState.phase) {
  case 'detail': return 'configure';
  case 'committing': return 'executing';
  case 'ceremony': return 'executing';
  case 'closing': return 'completing';
  default: return 'configure';
  }
}

/** B's verb at the MA workspace's current depth. */
export function maWorkspaceBackVerb(): WorkspaceBackVerb {
  return backVerbFor(maWorkspacePhase());
}

// ── The commit-outcome decision (pure — the shell's watchers execute it) ────

/**
 * What the fresh state means for a commit in flight. Evaluated on every
 * playerView commit AND on every ceremony-queue change (either may arrive
 * first — the queue is fed by NotificationLayer's own update hook).
 */
export type MaCommitOutcome =
  /** No verdict yet — the submit is still on the wire. */
  | {kind: 'wait'}
  /** The viewer's own beat is current — the ceremony owns the stage. */
  | {kind: 'ceremony'}
  /** The claim needs the player's own PAYMENT step (Helion / Stormcraft —
   *  `SelectPaymentDeferred` did not auto-resolve). The workspace yields to
   *  the standard payment task; the ceremony then plays globally. */
  | {kind: 'payment'}
  /** The commit did not resolve — the stage restores as reversible detail. */
  | {kind: 'refused', cause: 'raced' | 'stale'};

export function maFocusCommitOutcome(input: {
  committing: boolean,
  kind: MaKind,
  name: string,
  /** maCeremonyState.current (the queue head). */
  beat: {kind: MaKind, name: string, own: boolean} | undefined,
  /** The public slot flipped to the VIEWER (the beat is guaranteed to come). */
  takenByViewer: boolean,
  /** The public slot flipped to ANOTHER player (the race was lost). */
  takenByOther: boolean,
  /** The live waitingFor is a bare payment prompt (`type: 'payment'`). */
  paymentPromptUp: boolean,
  /** The view moved past the submit baseline (gameAge / undoCount changed). */
  viewAdvanced: boolean,
}): MaCommitOutcome {
  if (!input.committing) {
    return {kind: 'wait'};
  }
  const beat = input.beat;
  if (beat !== undefined && beat.own && beat.kind === input.kind && beat.name === input.name) {
    return {kind: 'ceremony'};
  }
  // The slot is ours on the fresh model but the beat has not surfaced yet
  // (watcher ordering / a rival's beat ahead in the FIFO queue) — hold on.
  if (input.takenByViewer) {
    return {kind: 'wait'};
  }
  if (input.viewAdvanced && input.paymentPromptUp) {
    return {kind: 'payment'};
  }
  if (input.takenByOther) {
    return {kind: 'refused', cause: 'raced'};
  }
  if (input.viewAdvanced) {
    return {kind: 'refused', cause: 'stale'};
  }
  return {kind: 'wait'};
}
