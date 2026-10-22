/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COMMIT GATE — one authoritative answer to «may this be confirmed yet, and
 * if not, what is the player supposed to do instead».
 *
 * THE DEFECT IT REMOVES. A composer used to answer that question with a
 * scattering of local booleans (`canConfirm`, `ctaReady`, `ctaHint`, a focus
 * seed, a nav clamp, a footer label), each computed separately and each free to
 * disagree with the others. They did: on «Обстрел кометами» the commit row was
 * a cursor stop with the full active treatment — bright ring, live Ⓐ — while a
 * required card pick was still empty and pressing A did nothing at all. The
 * screen promised an action it had already decided to refuse. Every one of
 * those booleans was individually correct; what was missing was a single place
 * that says what the screen IS right now.
 *
 * SO THE GATE IS ONE VALUE, and everything that must agree derives from it:
 *
 *   · whether the commit row accepts the CURSOR      (`commitAcceptsCursor`)
 *   · where the cursor belongs instead               (`commitCursorTarget`)
 *   · whether the commit may actually RUN            (`commitAllowed`)
 *   · which verb the ONE command bar publishes on A  (`commitFocusVerb`)
 *   · how the commit row PAINTS itself               (the host reads `kind`)
 *
 * A screen cannot show a live Ⓐ on a row the same value refuses to run, because
 * both readings come from the same word.
 *
 * WHAT IT IS NOT. It does not know what a requirement MEANS — «is this pick
 * answered», «does 1 of 2 satisfy this ask», «is this branch affordable» are
 * domain questions their own owners answer, and they hand the verdict in. A
 * count is not a rule: `1/2 выбрано` is ready for an up-to-2 ask and not ready
 * for an exactly-2 one, and this module must never guess which.
 *
 * PURE: no DOM, no Vue, no i18n (labels are keys).
 */

/** One thing that must be settled before the commit can run. */
export type CommitRequirement = {
  /** The host's own cursor index for the row that owns this requirement. */
  index: number;
  /**
   * The A-verb while this requirement holds the cursor (i18n key). It is the
   * requirement's OWN verb — «Выбрать карту», not a generic «Выбрать» — because
   * the command bar's job is to name the next real step, not to describe the
   * screen's eventual purpose.
   */
  verb: string;
  /** Answered, and the answer still holds. */
  satisfied: boolean;
  /**
   * Answered, but the answer stopped being legal — a target that left the
   * table, a value a branch switch invalidated. Distinct from «never answered»
   * on purpose: the player did the work and something moved under them, and a
   * screen that silently re-opens the same empty row hides that.
   */
  stale?: boolean;
};

/**
 * WHAT THE SCREEN IS.
 *
 * `incomplete` / `stale` carry the requirement the cursor must go to — the gate
 * never just says «no», it always says «this next».
 */
export type CommitGate =
  | {kind: 'incomplete', blocking: CommitRequirement, outstanding: number}
  | {kind: 'stale', blocking: CommitRequirement, outstanding: number}
  /** Nothing on this screen can fix it (the action itself is unavailable). */
  | {kind: 'blocked', reason: string}
  | {kind: 'ready'}
  /** The commit is in flight — input is absorbed and a second press is a no-op. */
  | {kind: 'submitting'};

export type CommitGateInput = {
  /** In the host's own cursor order — the FIRST unsatisfied one is the one. */
  requirements: ReadonlyArray<CommitRequirement>;
  submitting: boolean;
  /** An i18n key when the action cannot be performed at all. */
  unavailable?: string;
};

/**
 * Resolve the gate.
 *
 * Order matters and is deliberate: a commit already in flight outranks
 * everything (the player's press has been taken), an unavailable action
 * outranks its own unfilled fields (filling them would change nothing), and
 * only then does the first outstanding requirement speak.
 */
export function computeCommitGate(o: CommitGateInput): CommitGate {
  if (o.submitting) {
    return {kind: 'submitting'};
  }
  if (o.unavailable !== undefined && o.unavailable !== '') {
    return {kind: 'blocked', reason: o.unavailable};
  }
  const outstanding = o.requirements.filter((r) => !r.satisfied);
  const blocking = outstanding[0];
  if (blocking === undefined) {
    return {kind: 'ready'};
  }
  return {
    kind: blocking.stale === true ? 'stale' : 'incomplete',
    blocking,
    outstanding: outstanding.length,
  };
}

/** May the commit actually run? The ONE execution guard. */
export function commitAllowed(gate: CommitGate): boolean {
  return gate.kind === 'ready';
}

/**
 * May the commit row take the CURSOR?
 *
 * It yields whenever there is somewhere better for the cursor to be, which is
 * the whole point: a row that cannot act must not be a place the player can
 * arrive at and press A on. `submitting` keeps it — the cursor is frozen there
 * anyway and moving it mid-flight would be a jump the player did not ask for.
 * `blocked` also keeps it: nothing else on the screen explains why, and there
 * is no requirement to redirect to.
 */
export function commitAcceptsCursor(gate: CommitGate): boolean {
  return gate.kind !== 'incomplete' && gate.kind !== 'stale';
}

/**
 * Where the cursor BELONGS — `undefined` means «leave it alone».
 *
 * Called on open and on every change that can re-block a screen (a branch
 * switch, a target that went stale). This is what keeps focus off a row the
 * gate has just refused: the answer moves with the state instead of being
 * seeded once and drifting.
 */
export function commitCursorTarget(gate: CommitGate, commitIndex: number): number | undefined {
  switch (gate.kind) {
  case 'incomplete':
  case 'stale':
    return gate.blocking.index;
  case 'ready':
    return commitIndex;
  default:
    return undefined;
  }
}

/**
 * The A-verb the ONE command bar publishes, given where the cursor is.
 *
 * `undefined` = A does nothing right now and must not be advertised at all —
 * the bar shows no confirm entry rather than a greyed «ПОДТВЕРДИТЬ» next to a
 * press that would open a card selector.
 */
export function commitFocusVerb(gate: CommitGate, onCommitRow: boolean): string | undefined {
  if (gate.kind === 'submitting') {
    return undefined;
  }
  if (gate.kind === 'incomplete' || gate.kind === 'stale') {
    // The cursor cannot legitimately be on the commit row here, but a stale
    // frame can still ask: answer with the step that IS live.
    return gate.blocking.verb;
  }
  return onCommitRow ? 'Confirm action' : undefined;
}

/*
 * THE ONE CURSOR RULE AFTER AN ANSWER (T14 «ОДИН КУРСОР ПОСЛЕ ОТВЕТА», ledger CC — `docs/claude/console/
 * composer-preselect.md`).
 *
 * THE DEFECT IT REMOVES. Three composers had three landing rules: the play composer walked to the first open row and
 * then the commit — except after a VARIANT, where the cursor stayed on the tile; the action composer re-seated the
 * cursor only on open and in four hand-written `focusIdx = ctaIndex` branches, so closing any of its seven sub-pickers
 * left the cursor on the row just answered; the Parliament's party composer counted its own `cursorRow`. «Smart focus
 * works in some cases» was exactly that: the same question («where does the cursor go now?») answered three ways.
 *
 * So the answer is ONE function, asked from ONE point in every composer — after EVERY answer (a pick from a list, the
 * album, the table or a player; a variant; «Далее» on a dial; the payment's «Готово»; a decline; a B back from a
 * sub-picker that carries an answer), on open, after a refetch of the same shape and when a target goes stale:
 *
 *   1. the row that HOLDS the commit (`incomplete` / `stale` → its blocking requirement) — a QUESTION;
 *   2. else the next question that was OFFERED and may wait (the play composer's table question deferrable behind a
 *      draw — it holds nothing up, but it IS the next question, so the cursor visits it once before the commit);
 *   3. else the COMMIT row — `ready`: the next press plays the move, so the arrival is the ARMED one; `blocked`: the
 *      row that says why (nothing else on the screen does — the payment shortfall's fix is opened from there).
 *
 * `submitting` → `undefined`: the cursor is frozen while the press is in flight. The host never writes
 * `focusIdx = ctaIndex` by hand again — the guard of that is the absence of the assignment (`composerCursorRule.spec`).
 */

/** Why the cursor stands where the rule put it — the arrival paints from this. */
export type CursorLanding =
  /** A requirement holds the commit: the cursor goes to it (its own verb on the bar). */
  | {kind: 'question', index: number}
  /** Nothing holds the commit, but a question that may wait was offered and not yet visited. */
  | {kind: 'offered', index: number}
  /** Nothing is left to ask and the commit RUNS: the next press plays the move — the commit row ARRIVES armed. */
  | {kind: 'commit', index: number}
  /** Nothing is left to ask, but the commit cannot run (`blocked`): the commit row, which names why — never armed. */
  | {kind: 'held', index: number};

/**
 * Where the cursor goes after an answer (and on open). `offered` is the host's index of a deferrable question it has
 * not visited yet (-1 / undefined = none) — consulted only when nothing holds the commit.
 */
export function nextCursorAfterAnswer(gate: CommitGate, commitIndex: number, offered?: number): CursorLanding | undefined {
  switch (gate.kind) {
  case 'incomplete':
  case 'stale':
    return {kind: 'question', index: gate.blocking.index};
  case 'submitting':
    return undefined;
  case 'ready':
  case 'blocked':
    if (offered !== undefined && offered >= 0) {
      return {kind: 'offered', index: offered};
    }
    return {kind: gate.kind === 'ready' ? 'commit' : 'held', index: commitIndex};
  }
}

/**
 * THE COMMIT ARRIVES — and a press in its arrival window is the arrival, never the move (decision 4 of the T14 prompt).
 *
 * The cursor that lands on the commit row BECAUSE the last question was answered (or because the screen opened with
 * nothing to ask) makes the next press a move — so the player must SEE the landing before the press counts: an A that
 * comes before the commit's pose is PAINTED (the arrival window — the ring's one clock plus a frame), or, on an open
 * whose every answer was seeded, inside the decision family's first settle (`SETTLE_FIRST_MS` — the A that opened the
 * composer must never be the A that plays the card), is ABSORBED. Pure: the host owns the clock and the paint signal.
 */
export type CommitArrival = {
  /** When the cursor landed on the commit row by the rule (ms, the host's clock). */
  at: number;
  /** When the commit's pose became paintable (`undefined` while a surface's arrival gate still holds it). */
  paintedAt: number | undefined;
  /** An absolute floor for the window (an open with everything seeded: the decision's first settle). */
  settleUntil: number;
};

/** The arrival window past the paint: the ring's own clock (`CURSOR_MS`, 180) and a frame. */
export const COMMIT_ARRIVAL_ABSORB_MS = 200;

/** Is a deciding press on the commit row, at `now`, still the ARRIVAL (absorbed) rather than the move? */
export function commitPressAbsorbed(arrival: CommitArrival | undefined, now: number): boolean {
  if (arrival === undefined) {
    return false;
  }
  if (now < arrival.settleUntil) {
    return true;
  }
  return arrival.paintedAt === undefined || now < arrival.paintedAt + COMMIT_ARRIVAL_ABSORB_MS;
}

/**
 * Does a submit attempt have to be REDIRECTED rather than run?
 *
 * The cursor rule is the real protection; this is the backstop for everything
 * that does not go through the cursor — a mouse click, a stale press that
 * crossed a state change, a repeat during a transition. Returns the index to
 * send the player to, so the refusal always lands them ON the thing that needs
 * them instead of failing silently.
 */
export function commitRedirectTarget(gate: CommitGate): number | undefined {
  return gate.kind === 'incomplete' || gate.kind === 'stale' ? gate.blocking.index : undefined;
}
