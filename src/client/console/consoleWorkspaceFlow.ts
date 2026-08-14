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
  /**
   * COMMITTED + TERMINAL — the flow's LAST stage: a verdict to read and
   * acknowledge (the deck-check «Результат вскрытия»). Nothing is owed, nothing
   * is chosen, nothing continues after it: the single «ОК» ends the operation.
   *
   * WHY IT IS NOT `committed`. «Свернуть» exists so a live decision can wait
   * while the player reads the board — it is a ROUND TRIP, and the way back is
   * the board-home restore card. A verdict has no decision to keep alive, so
   * that trip buys nothing and costs plenty: the workspace parks, its stage
   * unmounts, and the artifact that outlives it (`lastReveal` is server state
   * until the next input) is then free to be picked up by the standalone
   * presenter — which is exactly how B on «Поиск жизни» put a legacy full-bleed
   * modal on screen carrying the very verdict the player had just minimized.
   * So B is not on offer here at all: the stage advertises «A ОК» and means it.
   */
  | 'verdict'
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
  // A TERMINAL verdict: nothing to undo, and nothing to come back TO — see the
  // phase's own doc. The one press that means anything here is «ОК».
  case 'verdict': return 'none';
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
 *
 * `verdict` accepts input — it is a stage the player ACTS on («ОК», «Осмотреть»,
 * «Источник»); what it refuses is only the back VERB, which is `backVerbFor`'s
 * answer, not this one.
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
 *  - `terminal`   — …and it is the flow's LAST stage: a verdict to acknowledge,
 *                   with nothing chosen, owed or continuing after it;
 *  - `finishing`  — the result is leaving.
 */
export function workspacePhaseOf(signals: {
  open: boolean,
  committed: boolean,
  resultUp: boolean,
  terminal?: boolean,
  finishing: boolean,
}): WorkspacePhase {
  if (signals.finishing) {
    return 'completing';
  }
  if (!signals.committed) {
    return signals.open ? 'configure' : 'browse';
  }
  if (!signals.resultUp) {
    return 'executing';
  }
  return signals.terminal === true ? 'verdict' : 'committed';
}

// ── THE CONCLUSION — where a FINISHED flow leaves the player ─────────────────

/*
 * WHY THIS IS A POLICY AND NOT A `close()` AT EACH ENDING.
 *
 * A committed flow can finish in as many places as it has result flavours: a
 * plain reward ends on the server's answer, a drawn batch ends when the last
 * card is taken, a deck-check ends on the player's «ОК», a purchase ends when
 * its prompt stops being asked. Every one of those used to conclude itself, at
 * its own call site — and they DISAGREED. Two left the workspace; two folded
 * back to the browse grid the player had come from:
 *
 *   «Поиск жизни» → confirm → the card is pulled, turned over, the verdict
 *   reads «Условие выполнено» → A → …and the player is standing in the ДЕЙСТВИЯ
 *   КАРТ list again, looking at the action they just performed, now greyed
 *   «Активирована». Nobody asked for that screen. It is one more B away from the
 *   board, and the only reason it appeared is that this action's result happened
 *   to be embeddable.
 *
 * THE RULE. A REVERSIBLE cancel folds back — there is something to fold back TO,
 * and the player asked to go there. A COMPLETED operation does not: past the
 * commit boundary the workspace is not a place to return to, it is the thing
 * that is OVER. It leaves, and the player lands on the board — where the next
 * move is made.
 *
 * …but only once it genuinely owes nothing. A workspace is ONE FLOW, and a flow
 * routinely outlives the stage that produced its first result: a purchase raises
 * its payment, a colony step stands INSIDE the activation that opened it, a
 * drawn batch is still in the air. So «the flow ended» stops being a per-flavour
 * close and becomes ONE question — is anything inside this workspace still
 * owed? — asked in one place, with the four ways it can answer «yes» NAMED
 * rather than re-spelled at every site.
 *
 * PURE: the caller reads the four facts off the stack / the claim / the prompt;
 * this owns what they mean together.
 */

/** WHY a finished flow may not leave yet. Ordered by how much they outrank
 *  each other, so the reported reason is the strongest one. */
export type WorkspaceHoldReason =
  /** A step — another workspace — is standing INSIDE this one. An inner frame
   *  cannot outlive its host, so the host cannot leave first. */
  | 'nested-step'
  /** This workspace still owns an outcome artifact: on its way, or on screen. */
  | 'live-outcome'
  /** The server is still asking something this workspace serves or hosts (the
   *  second half of a pick-then-pay is the reference case). */
  | 'owned-prompt'
  /** The player set the flow aside. Coming back to it is THEIR decision, and a
   *  conclusion here would silently turn «свернуть» into «закрыть». */
  | 'parked';

export type WorkspaceConclusion =
  /** The operation is over — the workspace goes, and takes its stack with it. */
  | {verdict: 'dismiss'}
  /** Something is still owed here — stay, and let it present itself. */
  | {verdict: 'hold', reason: WorkspaceHoldReason};

/**
 * MAY A FINISHED FLOW DISMISS ITS WORKSPACE? The ONE answer — the ending, the
 * specs and any future host all read this, so no two endings of the same
 * workspace can land the player in different places again.
 */
export function workspaceConclusionFor(signals: {
  /** `workspaceFrameHasNested(kind)` — a step is standing inside. */
  nested: boolean,
  /** This host still holds its outcome claim. */
  outcomeLive: boolean,
  /** A live prompt belongs to this workspace (embedded, or on its way there). */
  ownsPrompt: boolean,
  /** This workspace is in the PARK rather than on screen. */
  parked: boolean,
}): WorkspaceConclusion {
  if (signals.nested) {
    return {verdict: 'hold', reason: 'nested-step'};
  }
  if (signals.outcomeLive) {
    return {verdict: 'hold', reason: 'live-outcome'};
  }
  if (signals.ownsPrompt) {
    return {verdict: 'hold', reason: 'owned-prompt'};
  }
  if (signals.parked) {
    return {verdict: 'hold', reason: 'parked'};
  }
  return {verdict: 'dismiss'};
}
