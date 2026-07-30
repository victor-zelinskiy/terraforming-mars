/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKSPACE FLOW MODEL — what phase a self-opened workspace is in, and
 * what B means there.
 *
 * WHY A MODEL AND NOT A FLAG. A workspace flow is not a stack of pages. Some
 * of its states are a player's reversible decision, one is a machine beat with
 * no decision in it at all, and the rest are the consequences of a move that
 * has already been made and cannot be unmade. Treating all of them as
 * "screens" produces exactly the two bugs this module exists to kill:
 *
 *   · B on the purchase stage walked BACK into the empty «берём карты из
 *     колоды…» beat — a machine state the player can neither act on nor
 *     return to, and which by then described something that had already
 *     happened. An execution beat is not a destination.
 *   · Nothing distinguished «отменить настройку» from «свернуть, чтобы
 *     посмотреть поле». Both were B, so B had to mean whichever the last
 *     `if` happened to check.
 *
 * So the phases are typed by their RELATIONSHIP TO THE COMMIT, and the back
 * verb is DERIVED from that — never hand-rolled at a call site.
 *
 * PURE: no DOM, no reactive reads, no Vue. The surface owns the state; this
 * owns the policy.
 */

/**
 * Where the flow stands relative to its commit.
 *
 * The ORDER is meaningful: everything before `executing` is the player still
 * composing a move; `executing` is the machine performing it; everything after
 * is the world having changed.
 */
export type WorkspacePhase =
  /** REVERSIBLE — the browse layer: the workspace itself is what B closes. */
  | 'browse'
  /** REVERSIBLE — configuring one object; B folds back to browse. */
  | 'configure'
  /**
   * TRANSIENT — committed, the server is answering, cards are physically
   * moving. Not a destination: it is never entered by navigation, never
   * returned to, and never a thing B can reach. It exists to be LOOKED at
   * for as long as the machine needs, and no longer.
   */
  | 'executing'
  /**
   * COMMITTED + INTERACTIVE — the reveal, the purchase, the follow-up choice.
   * The move is done; what remains is a decision ABOUT ITS RESULT. B cannot
   * cross back over the commit, so here it means COLLAPSE (go look at the
   * board), not Back.
   */
  | 'committed'
  /** COMPLETION — the result is leaving (to the hand, to the discard). */
  | 'completing';

/** Is this phase before the commit boundary (i.e. still undoable)? */
export function isReversible(phase: WorkspacePhase): boolean {
  return phase === 'browse' || phase === 'configure';
}

/**
 * May this phase be RETURNED to by a back navigation?
 *
 * `executing` and `completing` answer false — they are beats, not places. A
 * back stack that records them lets the player walk into a state whose only
 * content is "wait", describing work that has since finished.
 */
export function isNavigationDestination(phase: WorkspacePhase): boolean {
  return isReversible(phase);
}

/** Has the flow crossed the commit boundary? */
export function isCommitted(phase: WorkspacePhase): boolean {
  return !isReversible(phase);
}

/**
 * WHAT B DOES. Four DIFFERENT verbs that share one button — conflating them is
 * how B came to mean "whatever the last branch checked".
 */
export type WorkspaceBackVerb =
  /** Leave the workspace entirely (browse: there is nothing under us). */
  | 'close'
  /** Fold one reversible level back (configure → browse). */
  | 'back'
  /** Hide the workspace to inspect the board; the decision stays live. */
  | 'collapse'
  /** Nothing: a machine beat owns the screen, and there is nothing to undo. */
  | 'none';

/**
 * The back verb for a phase. THE one source — the handler, the command-bar
 * label and the specs all read this, so the button can never do one thing and
 * say another.
 */
export function backVerbFor(phase: WorkspacePhase): WorkspaceBackVerb {
  switch (phase) {
  case 'browse': return 'close';
  case 'configure': return 'back';
  // Post-commit: the move cannot be unmade, so B stops meaning "undo" and
  // starts meaning "let me look at the board" — the decision waits for us.
  case 'committed': return 'collapse';
  // A beat in flight: swallow. Cancelling is not on offer (the server already
  // has the move) and neither is collapsing (there is nothing to come back to
  // yet — the very next state is the one worth showing).
  case 'executing': return 'none';
  case 'completing': return 'none';
  }
}

/** The i18n key B should be LABELLED with, for the command bar. */
export function backLabelFor(phase: WorkspacePhase): string | undefined {
  switch (backVerbFor(phase)) {
  case 'close': return 'Close';
  case 'back': return 'Cancel';
  case 'collapse': return 'Minimize';
  case 'none': return undefined;
  }
}

/**
 * Is the pad live for the player at all in this phase? A transient beat
 * absorbs input: the move is committed, so a stray press must not reach the
 * rows underneath, and a double-submit must be impossible by construction
 * rather than by a `submitting` flag someone remembers to check.
 */
export function acceptsInput(phase: WorkspacePhase): boolean {
  return phase !== 'executing' && phase !== 'completing';
}

/**
 * The phase a workspace is in, derived from the signals a surface actually
 * has. Keeping the derivation here (rather than as a `data` field someone
 * assigns) means the phase can never drift from the flow's real state.
 *
 *  - `open`       — a specific object is being configured (vs the browse grid);
 *  - `committed`  — the batch has been sent (the claim is live);
 *  - `resultUp`   — the outcome is on screen and interactive;
 *  - `finishing`  — the result is leaving.
 */
export function workspacePhaseOf(signals: {
  open: boolean,
  committed: boolean,
  resultUp: boolean,
  finishing: boolean,
}): WorkspacePhase {
  if (signals.finishing) {
    return 'completing';
  }
  if (!signals.committed) {
    return signals.open ? 'configure' : 'browse';
  }
  return signals.resultUp ? 'committed' : 'executing';
}
