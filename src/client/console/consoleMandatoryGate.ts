/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * MANDATORY ANNOUNCEMENT GATE — the ONE mechanism that turns an INTERRUPTIVE
 * mandatory prompt from a surface that POPS OPEN abruptly into one that is
 * gently ANNOUNCED first and only OPENED on the player's explicit press (B).
 *
 * WHY: in console-native mode every mandatory prompt used to auto-mount its
 * surface the instant `taskFor` classified it — the corporation's first action
 * modal appeared over the still-running prelude/intake animations, and a colony
 * bonus (Pluto: draw then discard) flung the drawn-cards reveal AND the hand
 * discard open on top of each other. That reads as "modal spam" and yanks the
 * player away from whatever they were watching.
 *
 * THE MODEL — a per-prompt "beat". At any moment there is at most ONE current
 * interruptive mandatory BEAT (a drawn-cards reveal, or an interruptive task).
 * The gate HOLDS that beat closed (its surface is suppressed, only the player's
 * chip status shows) until the player ACKNOWLEDGES it (opens it with B). While
 * held AND the foreground is idle (screens closed, animations done) a premium
 * top ANNOUNCEMENT names the pending decision; B opens it. Beats advance one at
 * a time — this is exactly what gives Pluto the desired sequence: reveal beat →
 * B → take (the hand counter ticks on the physical landing) → THEN the discard
 * beat → B → the hand opens in select mode. No server change is needed: the
 * beats are derived from the client state the server already sends.
 *
 * SCOPE (Option A — "all interruptive / triggered"): the corporation first
 * action, a drawn-cards reveal, a forced hand pick (discard / keep / place),
 * and any triggered sub-prompt (pick a player / amount / target) that arrives
 * OUTSIDE the viewer's own active turn. The viewer's OWN turn — the action
 * menu, a tile placement after their own play, the steps of a composer they
 * opened — is NEVER gated; those flow immediately.
 *
 * This module is PURE + a tiny reactive store (mirrors journalState / the
 * presentation policy): the beat DERIVATION is pure functions the shell feeds
 * with its own signals, so it is unit-testable under the server runner.
 */
import {reactive} from 'vue';
import {ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';

/** The kind of interruptive beat currently pending. */
export type MandatoryBeatKind = 'reveal' | 'task';

/** One interruptive mandatory beat — a stable identity + what it is. */
export type MandatoryBeat = {
  kind: MandatoryBeatKind;
  /** Stable key for the beat (advances when the pending decision changes). */
  key: string;
  /** For a task beat: the task kind (drives the open path on acknowledge). */
  taskKind?: TaskKind;
};

/**
 * The gate's ONLY mutable state: the key of the beat the player has already
 * OPENED (acknowledged). A beat is "held" while its key differs from this.
 * Module-level so it survives the App-level `playerkey` remount (mirrors
 * journalState / the other console module singletons).
 */
export const mandatoryGateState = reactive({
  acknowledgedKey: '' as string,
  /**
   * A live mirror of the shell's `mandatoryGateHeld` computed. The leak detector
   * runs on a 1 s timer and cannot recompute the shell signals (reveal state /
   * forced-reaction / taskFor), so the shell keeps this in sync and the detector
   * reads it to treat a held prompt as legitimately served (the announcement /
   * chip is its surface — it opens on B). See setMandatoryGateHeld.
   */
  held: false,
});

/** The shell mirrors its live `mandatoryGateHeld` computed here for the detector. */
export function setMandatoryGateHeld(held: boolean): void {
  mandatoryGateState.held = held;
}

/** Is an interruptive mandatory beat currently HELD (announced, not opened)? */
export function isMandatoryGateHeld(): boolean {
  return mandatoryGateState.held;
}

/**
 * Task kinds that are ALWAYS interruptive — announced regardless of whose turn
 * it is. `corpFirstAction` is a start-of-game trigger; `handSelect` is a forced
 * hand pick (a VOLUNTARY hand pick — sell patents, an on-play discard — is
 * client-initiated or pre-collected in the play composer, so it never reaches
 * here as a top-level `handSelect` prompt).
 */
const ALWAYS_INTERRUPTIVE: ReadonlySet<TaskKind> = new Set<TaskKind>([
  'corpFirstAction', 'handSelect',
]);

/**
 * Task kinds gated ONLY when they arrive as an OFF-TURN FORCED REACTION (the
 * viewer's status is `forcedaction`, not their own `turn`) — e.g. an opponent's
 * card forces you to pick a player / lose production / discard a target. During
 * the viewer's OWN active turn these are continuations of an action they drove,
 * so they open immediately (never gated).
 */
const FORCED_REACTION_INTERRUPTIVE: ReadonlySet<TaskKind> = new Set<TaskKind>([
  'choice', 'player', 'amount', 'resource', 'distribute', 'payment', 'projectCard', 'colony', 'composite',
]);

// Deliberately NEVER gated (open immediately): 'actionMenu' (the turn UI is not
// a modal), 'space' (a placement — a continuation of the player's own play, and
// it has its own banner flow), 'cardSelect' (draft / buy / target inside the
// player's own action), 'draftWait' / 'initialDraft' / 'startSequence' (their
// own full-screen flows), 'awardFunding' (the player's own award screen),
// 'aresGlobal', and 'unknown' (the honest guard owns it).

/**
 * Is this task an INTERRUPTIVE mandatory prompt (→ announce, don't auto-open)?
 * `forcedReaction` = the viewer's status is an off-turn forced reaction
 * (`actionLabelForPlayer(...) === 'forcedaction'`), computed by the shell.
 */
export function isInterruptiveMandatoryTask(task: ConsoleTask | undefined, forcedReaction: boolean): boolean {
  if (task === undefined) {
    return false;
  }
  if (ALWAYS_INTERRUPTIVE.has(task.kind)) {
    return true;
  }
  if (FORCED_REACTION_INTERRUPTIVE.has(task.kind)) {
    return forcedReaction;
  }
  return false;
}

/** The signals the shell feeds the pure beat derivation. */
export type MandatoryBeatInput = {
  /** The drawn-cards reveal batch id when a DRAWN reveal is pending (else
   *  undefined). Derived from the RAW reveal state, NOT `consoleRevealMode`
   *  (which the gate itself suppresses), to keep the derivation acyclic. */
  revealDrawnBatchId: number | undefined;
  /** The current top-level task (taskFor(view)). */
  task: ConsoleTask | undefined;
  /** A stable identity for the current prompt (the shell's `type|title` key). */
  taskKey: string;
  /** The viewer's status is an off-turn forced reaction (see above). */
  forcedReaction: boolean;
};

/**
 * The CURRENT interruptive mandatory beat, or undefined. A drawn-cards reveal
 * takes PRIORITY over a pending task beat — the reveal is always shown/announced
 * first, and the task (e.g. the Pluto discard) becomes the current beat only
 * once the reveal has cleared. PURE.
 */
export function mandatoryBeatFor(input: MandatoryBeatInput): MandatoryBeat | undefined {
  if (input.revealDrawnBatchId !== undefined) {
    return {kind: 'reveal', key: 'reveal:' + input.revealDrawnBatchId};
  }
  if (isInterruptiveMandatoryTask(input.task, input.forcedReaction) && input.task !== undefined) {
    return {kind: 'task', key: 'task:' + input.taskKey, taskKind: input.task.kind};
  }
  return undefined;
}

/** Is this beat still HELD (announced but not yet opened by the player)? PURE. */
export function isMandatoryBeatHeld(beat: MandatoryBeat | undefined): boolean {
  return beat !== undefined && beat.key !== mandatoryGateState.acknowledgedKey;
}

/** Record that the player OPENED (acknowledged) the beat with this key. */
export function acknowledgeMandatoryBeat(key: string): void {
  mandatoryGateState.acknowledgedKey = key;
}

/** Reset the gate (game switch / test cleanup). */
export function resetMandatoryGate(): void {
  mandatoryGateState.acknowledgedKey = '';
  mandatoryGateState.held = false;
}
