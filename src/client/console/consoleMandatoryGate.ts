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
 * bonus (Pluto: draw then discard) flung the hand discard open. That reads as
 * "modal spam" and yanks the player away from whatever they were watching.
 *
 * THE MODEL — a per-DECISION "beat". At any moment there is at most ONE current
 * interruptive mandatory task BEAT. The gate HOLDS that beat closed (its surface
 * is suppressed, only the player's chip status shows) until the player
 * ACKNOWLEDGES it (opens it with B). While held AND the foreground is idle
 * (screens closed, animations done) a premium top ANNOUNCEMENT names the pending
 * decision; B opens it. Beats advance one at a time; no server change is needed
 * (the beats are derived from the client state the server already sends).
 *
 * ⚠️ A DRAWN-CARDS REVEAL IS NEVER A BEAT. The reveal overlay is the continuous
 * ENDPOINT of a draw CINEMATIC (the deck-draw scene literally *assembles into*
 * it — the cards peel off the deck and fly into the reveal's own slots; the
 * board-card-bonus scene does the same off a tile/colony). Gating the reveal
 * would SPLIT that one cinematic — the animation plays, then stops mid-flight
 * and demands a B to "review the cards" — which is exactly the abrupt break the
 * gate exists to remove. So the gate covers only genuine DECISION prompts; a
 * reveal always flows straight through from its animation. The Pluto discard is
 * still gated — but it is a distinct SURFACE (the hand) reached only after the
 * reveal cinematic has fully settled + the card physically landed, so it is a
 * real decision boundary, not a mid-animation split.
 *
 * SCOPE (Option A — "all interruptive / triggered"): the corporation first
 * action, a forced hand pick (discard / keep / place), and any triggered
 * sub-prompt (pick a player / amount / target) that arrives OUTSIDE the viewer's
 * own active turn. The viewer's OWN turn — the action menu, a tile placement
 * after their own play, the steps of a composer they opened — is NEVER gated.
 * And no task announcement can appear mid-animation (the shell's visibility gate
 * requires `!isAnimationHoldActive()`), so a decision never interrupts a scene.
 *
 * This module is PURE + a tiny reactive store (mirrors journalState / the
 * presentation policy): the beat DERIVATION is pure functions the shell feeds
 * with its own signals, so it is unit-testable under the server runner.
 */
import {reactive} from 'vue';
import {ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';

/** One interruptive mandatory DECISION beat — a stable identity + its task kind. */
export type MandatoryBeat = {
  /** Stable key for the beat (advances when the pending decision changes). */
  key: string;
  /** The task kind (drives the open path on acknowledge). */
  taskKind: TaskKind;
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
  /** The current top-level task (taskFor(view)). */
  task: ConsoleTask | undefined;
  /** A stable identity for the current prompt (the shell's `type|title` key). */
  taskKey: string;
  /** The viewer's status is an off-turn forced reaction (see above). */
  forcedReaction: boolean;
};

/**
 * The CURRENT interruptive mandatory DECISION beat, or undefined. A drawn-cards
 * reveal is deliberately NOT a beat (see the module header) — it flows straight
 * through from its draw cinematic. PURE.
 */
export function mandatoryBeatFor(input: MandatoryBeatInput): MandatoryBeat | undefined {
  if (isInterruptiveMandatoryTask(input.task, input.forcedReaction) && input.task !== undefined) {
    return {key: 'task:' + input.taskKey, taskKind: input.task.kind};
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

/**
 * Reset the gate (game switch / test cleanup) — clears ONLY the persistent
 * acknowledgment. `held` is a MIRROR owned exclusively by the shell watcher
 * (setMandatoryGateHeld): it is NOT reset here. The shell calls this in mounted()
 * AFTER the immediate `mandatoryGateHeld` watcher has already fired (created),
 * so writing `held = false` here would STOMP the live mirror — the computed does
 * not change afterwards, the watcher never re-fires, and the mirror is stuck
 * false. That desync made the corp-first-action announcement read as "not held"
 * → a stranded-guard false positive the moment the player left the board home
 * (where `.con-mandatory` masked it). The shell owns the mirror's whole
 * lifecycle: the watcher while mounted, an explicit clear on unmount.
 */
export function resetMandatoryGate(): void {
  mandatoryGateState.acknowledgedKey = '';
}
