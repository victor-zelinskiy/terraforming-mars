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
 * mandatory action BEAT, drawn from TWO derivations in a fixed, deterministic
 * order: an interruptive TASK beat (one server prompt), else the first pending
 * FLOW beat (a whole workspace flow the player must OPEN — the between-
 * generations draft). The gate HOLDS the beat closed (its surface is
 * suppressed, only the player's chip status shows) until the player
 * ACKNOWLEDGES it (opens it with A). Beats advance one at a time; no server
 * change is needed (the beats are derived from the client state the server
 * already sends). Because a beat is DERIVED, registration is idempotent by
 * construction: equivalent server updates re-derive the same key, a reconnect
 * re-derives the pending action, and a beat whose source state has moved on
 * simply stops existing (invalidation without a stale plate).
 *
 * A BEAT'S LIFECYCLE (the asymmetric presentation boundary):
 *   pending  — derived, but its FIRST presentation has not happened yet: the
 *              shell waits for the ordinary-notification feed to finish
 *              completely (nothing visible, empty queue, exit animations done)
 *              before showing the announcement / lighting the chip. Ordinary
 *              notifications and mandatory actions NEVER share a queue — the
 *              feed keeps flowing while the beat waits beside it.
 *   presented— the announcement (board home) or the chip beacon (anywhere
 *              else) has appeared ONCE (`presentedKey`). From here the rule
 *              flips: NEW notifications keep presenting over/beside it, but
 *              can no longer hide the plate, reset it to pending, or replay
 *              its entrance. The plate hides only for the player's own
 *              location changes (another screen → the chip carries it).
 *   acknowledged — the player pressed A: the surface opens (task kinds mount
 *              their host/section; a FLOW beat runs its open route — the
 *              draft workspace's enterWorkspace). Exactly once: the press
 *              flips `mandatoryGateHeld` off synchronously, so a second A
 *              finds no plate and no branch.
 *   gone     — the derivation stops returning the key (answered / flow over /
 *              no longer relevant): `noteMandatoryBeatIdentity` then clears
 *              both latches, so a LATER beat with the same key (an admin
 *              rollback replaying the same draft) starts a fresh cycle.
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

/**
 * The FLOW-scoped mandatory action kinds — workspace flows the player must
 * OPEN explicitly (never auto-mounted). Each kind is an open route the shell's
 * `openMandatoryAnnounce` knows how to run. Today: the between-generations
 * draft. A new flow = a value here + a derivation the shell feeds into
 * `MandatoryBeatInput.flows` + an open-route branch.
 */
export type MandatoryFlowKind = 'draft';

/** One interruptive mandatory DECISION beat — a stable identity + its task kind. */
export type MandatoryBeat = {
  /** Stable key for the beat (advances when the pending decision changes). */
  key: string;
  /** The task kind (drives the open path on acknowledge). */
  taskKind: TaskKind;
  /** Set on a FLOW beat: the open route the acknowledge takes (absent = task). */
  flow?: MandatoryFlowKind;
};

/**
 * A pending FLOW-scoped mandatory action, as derived by its own module (the
 * draft flow derives its from `betweenGenDraftLive`). The KEY is the whole
 * flow's stable semantic identity (`draft:gen<N>`) — deliberately NOT a prompt
 * identity, because one flow spans many prompts (pick rounds → the research
 * buy) and must be announced/acknowledged ONCE, not once per round.
 */
export type MandatoryFlowBeat = {
  key: string;
  taskKind: TaskKind;
  flow: MandatoryFlowKind;
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
   * The key of the beat whose FIRST PRESENTATION has happened (the plate rose
   * on the board home, or the chip beacon lit elsewhere). One string, not a
   * set: there is at most one current beat, and a SUPERSEDED beat returning
   * later deserves a fresh presentation cycle anyway (see
   * noteMandatoryBeatIdentity). This is the asymmetric boundary's latch — the
   * pre-presentation quiet (wait out the notification feed) applies exactly
   * while the current beat's key differs from this.
   */
  presentedKey: '' as string,
  /**
   * A live mirror of the shell's `mandatoryGateHeld` computed. The leak detector
   * runs on a 1 s timer and cannot recompute the shell signals (reveal state /
   * forced-reaction / taskFor), so the shell keeps this in sync and the detector
   * reads it to treat a held prompt as legitimately served (the announcement /
   * chip is its surface — it opens on A). See setMandatoryGateHeld.
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
 * it is. `corpFirstAction` here covers ONLY its MID-GAME shape (a merger chain
 * acquiring a corp that still owes its opening move — the confirm modal):
 * inside the START FLOW the shell filters the task out of the beat input
 * before it reaches this module (`ConsoleShell.mandatoryBeat`), because the
 * Game Start Workspace's own «ПЕРВОЕ ДЕЙСТВИЕ» stage is the presentation —
 * exactly like the never-gated `startSequence` prompts. `handSelect` is a
 * forced hand pick (a VOLUNTARY hand pick — sell patents, an on-play discard —
 * is client-initiated or pre-collected in the play composer, so it never
 * reaches here as a top-level `handSelect` prompt).
 */
const ALWAYS_INTERRUPTIVE: ReadonlySet<TaskKind> = new Set<TaskKind>([
  'corpFirstAction', 'handSelect',
  // A COLONY-BONUS DELIVERY only ever arises from SOMEBODY ELSE's trade (the
  // trader's own cube resolves inline, with no prompt at all), so it is an
  // interruption by construction — and the whole point of the prompt is that
  // the card waits until its owner goes and takes it.
  'colonyBonus',
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

// The three DEDICATED composite surfaces are deliberately NOT here. Each is a
// continuation of an action the viewer is already taking — spending heat pays a
// bill they chose to raise, the Venus alt-track bonus rewards the step THEY
// crossed, and the planetary thresholds shift on their own World Government
// beat. None can arrive as an off-turn forced reaction, so gating them would
// only add a press to a decision the player is already mid-way through.

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
  /**
   * Pending FLOW-scoped mandatory actions, in the shell's deterministic order.
   * At most one is ever CURRENT: a task beat (the server's immediate demand,
   * which nothing else can proceed past) outranks every flow beat, and among
   * flows the array order decides. When the current one completes, the next
   * derives on its own and runs a fresh pending → presented cycle.
   */
  flows?: ReadonlyArray<MandatoryFlowBeat>;
};

/**
 * The CURRENT mandatory action beat, or undefined. A drawn-cards reveal is
 * deliberately NOT a beat (see the module header) — it flows straight through
 * from its draw cinematic. PURE.
 */
export function mandatoryBeatFor(input: MandatoryBeatInput): MandatoryBeat | undefined {
  if (isInterruptiveMandatoryTask(input.task, input.forcedReaction) && input.task !== undefined) {
    return {key: 'task:' + input.taskKey, taskKind: input.task.kind};
  }
  const flow = input.flows?.[0];
  if (flow !== undefined) {
    return {key: flow.key, taskKind: flow.taskKind, flow: flow.flow};
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

/** Has this beat had its FIRST PRESENTATION (plate / chip)? PURE. */
export function isMandatoryBeatPresented(beat: MandatoryBeat | undefined): boolean {
  return beat !== undefined && beat.key === mandatoryGateState.presentedKey;
}

/**
 * Record the beat's FIRST presentation. Idempotent (a latch): the shell's
 * readiness watcher fires it once the ordinary-notification feed has fully
 * finished; equivalent later updates re-derive the same key and change nothing.
 */
export function markMandatoryBeatPresented(key: string): void {
  mandatoryGateState.presentedKey = key;
}

/**
 * The current beat IDENTITY changed (a different key, or no beat at all) —
 * called by the shell's beat-key watcher. Latches referring to a beat that no
 * longer exists are cleared, so:
 *  - an ANSWERED / INVALIDATED action leaves nothing stale behind (its plate
 *    simply unrenders — no empty transition, no ghost acknowledgment);
 *  - the SAME key arising again later (an admin rollback replaying the same
 *    generation's draft) is a NEW pending action: announced again, opened
 *    again — never silently pre-acknowledged into a surface nobody opens.
 * A key that is still the current one is never touched (the latches are
 * exactly as durable as the beat they describe).
 */
export function noteMandatoryBeatIdentity(currentKey: string | undefined): void {
  if (mandatoryGateState.acknowledgedKey !== '' && mandatoryGateState.acknowledgedKey !== currentKey) {
    mandatoryGateState.acknowledgedKey = '';
  }
  if (mandatoryGateState.presentedKey !== '' && mandatoryGateState.presentedKey !== currentKey) {
    mandatoryGateState.presentedKey = '';
  }
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
  mandatoryGateState.presentedKey = '';
}
