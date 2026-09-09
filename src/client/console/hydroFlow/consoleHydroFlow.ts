/*
 * THE HYDRO WORKSPACE FLOW — the state machine of the console-native
 * «Гидросеть Марса» workspace (the North-Star rework of the old
 * section + confirm-modal pair).
 *
 * ONE lifecycle, never five special cases:
 *
 *   preview ──(configure: reward pick / target pick / repeat bridge)── summary
 *      │                                                                  │
 *      └──────────────── A «Укрепить гидросеть» ───────────────────────────┘
 *                                   │ COMMIT BOUNDARY
 *                                   ▼
 *   moving (marker glide, input absorbed) → resolving (the LANDED stage pays:
 *   reward wave / embedded deck pick / repeated-action follow-ups / VP
 *   ceremony) → result (read hold) → close.
 *
 * PRE-COMMIT is a pure client DRAFT: nothing is submitted, nothing is spent,
 * the marker does not move. The draft lives in module state (hydroNetworkState
 * + consoleHydroUi.repeatResult) and this module only records WHICH step is
 * open and how the draft maps onto the workspace phase dictionary.
 *
 * POST-COMMIT is forward-only: `advanceHydroCommitPhase` refuses to walk
 * backwards, so a stray signal can never resurrect a spent beat. The one
 * sanctioned reversal is `rollbackHydroCommit()` — the SERVER refused the
 * batch, the move did not happen, and the draft comes back intact.
 *
 * PURE POLICY + REACTIVE RECORD: the functions that answer «what phase is
 * this» and «what does B do» take their inputs as arguments (unit-tested,
 * no DOM); the reactive record is what the section/shell watch.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import type {Color} from '@/common/Color';
import type {Tag} from '@/common/cards/Tag';
import type {DeltaStageOutcomeProjection} from '@/common/models/DeltaEspionageModel';
import type {WorkspacePhase, WorkspaceBackVerb} from '@/client/console/consoleWorkspaceFlow';
import {backVerbFor} from '@/client/console/consoleWorkspaceFlow';
import {workspaceFrameEpoch, workspaceStackCollapsed} from '@/client/console/consoleWorkspaceStack';
import {consoleState} from '@/client/console/consoleRouter';
import {isHydroMarkerActive, hydroTraversalPending} from '@/client/console/hydroMarker/consoleHydroMarker';
import {registerTruthWitness} from '@/client/console/presentationLedger';
import type {HydroDeltaLine} from '@/client/components/hydronetwork/hydroReward';
import type {DeltaMovementBonusProjection} from '@/common/models/DeltaTrackPreviewModel';
import type {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';

/** An embedded pre-select step standing INSIDE the workspace scene.
 *  `payment` is the Delta Works COMPOSITION step — entered from the plan's
 *  own confirm, and ONLY when the server model admits at least two valid
 *  energy/steel mixes (`minSteelForSpend < maxSteelForSpend`). */
export type HydroPreStep = 'reward' | 'target' | 'payment';

/**
 * Where a committed advance stands. `moving` covers submit→glide→lock (the
 * marker gate holds the view commit until the token locks in, so the two are
 * one beat from the player's seat); `resolving` is the landed stage paying
 * out (wave / pick / follow-ups / ceremony); `result` is the read hold.
 */
export type HydroCommitPhase = 'moving' | 'resolving' | 'result';

/** How the LANDED stage resolves — decides which resolving scene stands. */
export type HydroResolutionKind =
  /** Immediate credit (production / stock / tag) — the reward wave alone. */
  | 'plain'
  /** Pos 5 «Гидромоделирование»: draw 4 keep 2 → the embedded deck pick. */
  | 'deck-draw'
  /** Pos 7 with a composed repeat: the chosen action executes; its own
   *  follow-ups (draws, targets, payments) continue inside the flow. */
  | 'repeat'
  /** Pos 9: the animals fly onto the pre-selected card (presented on stage). */
  | 'card-resource'
  /** Pos 10/11: the VP ceremony (2 ПО / 5 ПО) plays over the track. */
  | 'ceremony';

/**
 * ONE stage of a committed MULTI-REWARD traversal (Delta Surge) — everything
 * its presentation owes, frozen at submit: the wave to fly on arrival, the
 * frozen result lines, and how the stage resolves (`kind` reuses the landing
 * vocabulary; `excluded` marks the crossed 2 VP cell — settle, no wave, the
 * omission named). Path order.
 */
export type HydroTraversalSegmentRecord = {
  position: number;
  kind: HydroResolutionKind | 'excluded';
  stageNameKey: string;
  transfers: ReadonlyArray<ResourceTransferSpec>;
  rewardLines: ReadonlyArray<HydroDeltaLine>;
  rewardChoice?: number;
  selectedCard?: CardName;
  composedRepeat?: boolean;
  /** The target-bearing reward was consciously declined (named, never silent). */
  waived?: boolean;
  /** Pos 9: the target's pre-commit count (the presented face's freeze). */
  targetBefore?: number;
};

/** The committed advance — frozen at submit, updated forward-only. */
export type HydroCommitRecord = {
  phase: HydroCommitPhase;
  kind: HydroResolutionKind;
  fromPosition: number;
  toPosition: number;
  spend: number;
  /** Steel spent 1:1 in place of energy (Delta Works) — 0 = energy-only. */
  spendSteel: number;
  rewardChoice: number | undefined;
  selectedCard: CardName | undefined;
  /** The stage-7 composed repeat rode the batch (vs a bare card pick). */
  composedRepeat: boolean;
  /** The landed stage's target reward was CONSCIOUSLY declined (the warned
   *  second press) — the result stage names the forfeit, never a silent
   *  nothing. Absent = the reward resolved (or fizzled) as always. */
  waivedTarget?: boolean;
  /** Pos 9: the target card's resource count BEFORE the commit — the presented
   *  face is frozen at this value and ticks per physical touchdown. */
  targetBefore: number | undefined;
  /** The CARD whose effect authorised this move (DOB's bonus step, Storm
   *  Surge Barrier's entry) — the context column keeps showing it through the
   *  commit and the result, so the origin never blinks away mid-flow. Absent
   *  for the player's own advance. */
  sourceCard?: CardName;
  /** Intermediate stages passed WITHOUT their reward (the standing track
   *  rule) — the result names the omission honestly. 0/absent = none. */
  skippedCount?: number;
  /** Frozen «сейчас → станет» lines for the result stage — the live model
   *  moves on with the commit and would describe the NEXT advance. */
  rewardLines: ReadonlyArray<HydroDeltaLine>;
  /** VP granted by the landed stage (10 → 2, 11 → 5), if any. */
  vp: number | undefined;
  /**
   * THE MOVE'S PASSIVE HALF, frozen at the submit — what a tableau card of the
   * player's own pays them for MOVING (Social Heating's heat), exactly as the
   * plan panel promised it. Server-authored
   * (`DeltaTrackDestination.movementBonuses` / `DeltaAdvanceOffer`), carried
   * unchanged: the result states the same numbers the CTA did. Absent for
   * every move that owes none, which is every historical one.
   */
  movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>;
  /** The landed stage name key — the result stage names its source. */
  stageNameKey: string;
  /**
   * THE ORDERED TRAVERSAL (Delta Surge): one record per crossed/landed stage,
   * in path order — the presentation sequence's whole plan. Absent = the
   * historical single-landing move (every field above describes it alone).
   */
  traversal?: ReadonlyArray<HydroTraversalSegmentRecord>;
  /** The tableau card whose effect granted the crossed rewards — presented as
   *  the move's secondary MODIFIER (inspectable), never as its source. */
  modifierCard?: CardName;
  /**
   * THE ESPIONAGE PREFIX (Corporate Espionage, DP10): the attacked player's
   * committed retreat, resolved and presented STRICTLY BEFORE the owner's own
   * advance the rest of this record describes. Frozen off the server's
   * projection at submit — the commit scene's target line, the waiting
   * caption and the result's attack half all read THIS, never live state.
   */
  espionage?: {
    /** The attacked player (absent ⇔ the attack half was a NAMED skip). */
    target?: {
      color: Color;
      from: number;
      to: number;
      /** The reward THEY receive at the resulting stage (server-projected). */
      reward?: DeltaStageOutcomeProjection;
      /** The compensation clause is void for this player (MarsBot's Solo
       *  Delta Project rule) — named, never silent. */
      rewardSkipped?: 'automa-rules';
      /** The reward belongs to the target's own decision — the flow parks
       *  after their retreat and the actor sees a calm waiting state. */
      interactive?: boolean;
    };
    /** The owner's consumed tag waiver — the result names it. */
    waivedTag?: Tag;
  };
};

export const hydroFlowState = reactive<{
  /** The open embedded pre-select step (reward picker / target picker). */
  step: HydroPreStep | undefined;
  /** The full-scene stage-7 repeat browser stands over the workspace. */
  repeatBridge: boolean;
  commit: HydroCommitRecord | undefined;
  /**
   * WHICH FRAME MADE THE COMMIT (`workspaceFrameEpoch('hydro')` at the press).
   *
   * This record is MODULE state and outlives its frame on purpose — the board
   * takes the screen for a placement, the player parks the chain — and all of
   * those come back to the SAME frame. A LATER, unrelated frame must not adopt
   * it: it would render a committed workspace whose content is somewhere else,
   * with «Ⓐ Выполняется» as its only verb and B dead by phase. Comparing the
   * stamp answers «is this flow mine?» exactly, instead of inferring it from
   * whether a park happened to survive.
   */
  frameEpoch: number;
  /** The view version (gameAge|undoCount) the pre-commit draft was composed
   *  against — a re-open only re-seats a draft the world has not moved under. */
  draftVersion: string;
  /** One-shot: the ceremony choreography is running (pos 10/11). */
  ceremonyActive: boolean;
  /**
   * THE TERMINAL CEREMONY HAS FINISHED PRESENTING (or was honestly skipped by
   * the recovery net). A ceremony-kind commit OWES this beat: the flow may not
   * reach its result stage — and therefore may not close — before the
   * culmination has actually played. Server completion (the VP is granted the
   * moment the response applies) and presentation completion are two different
   * events, and the result stage waits for both.
   */
  ceremonyPlayed: boolean;
}>({
  step: undefined,
  repeatBridge: false,
  commit: undefined,
  frameEpoch: 0,
  draftVersion: '',
  ceremonyActive: false,
  ceremonyPlayed: false,
});

const COMMIT_ORDER: ReadonlyArray<HydroCommitPhase> = ['moving', 'resolving', 'result'];

/** How the landed position resolves. `composedRepeat` distinguishes the real
 *  stage-7 execution from the bare-pick degrade (whose follow-ups arrive as
 *  native tasks — still awaited by the same resolving phase). */
export function resolutionKindFor(toPosition: number, opts: {composedRepeat: boolean, selectedCard: CardName | undefined}): HydroResolutionKind {
  if (toPosition === 10 || toPosition === 11) {
    return 'ceremony';
  }
  if (toPosition === 5) {
    return 'deck-draw';
  }
  if (toPosition === 7) {
    // No candidate card at all → the reward fizzles server-side: plain.
    return opts.selectedCard !== undefined || opts.composedRepeat ? 'repeat' : 'plain';
  }
  if (toPosition === 9) {
    return opts.selectedCard !== undefined ? 'card-resource' : 'plain';
  }
  return 'plain';
}

/**
 * The workspace phase — the ONE input of the B verb and the input gate.
 * `followUpInteractive` is the shell's live fact «a decision about the result
 * is standing» (the embedded deck pick, a follow-up prompt of the repeated
 * action): it turns the transient `resolving` beat into the collapsible
 * `committed` phase.
 */
export function hydroPhaseOf(
  s: {step: HydroPreStep | undefined, repeatBridge: boolean, commit: HydroCommitRecord | undefined},
  followUpInteractive: boolean,
): WorkspacePhase {
  const c = s.commit;
  if (c !== undefined) {
    switch (c.phase) {
    case 'moving': return 'executing';
    case 'resolving': return followUpInteractive ? 'committed' : 'executing';
    case 'result': return 'completing';
    }
  }
  return s.step !== undefined || s.repeatBridge ? 'configure' : 'browse';
}

/**
 * IS THE COMMITTED ADVANCE STILL PHYSICALLY HAPPENING?
 *
 * THE CLOSE GATE OF THE WHOLE FLOW, and the reason it is a function rather
 * than a shell computed: the workspace may only reach its result stage — and
 * therefore may only close — on this predicate's FALLING EDGE. Never a
 * timeout, never «the server answered», never «the press is over».
 *
 * Each signal is a different way the move is still on screen, and every one of
 * them has to be here or the workspace closes over its own animation:
 *  - `markerGliding` — the token is travelling between the two stops;
 *  - `rewardHeld` — the panel is showing `committed - held`, i.e. the gain has
 *    been granted by the server and is deliberately NOT on the counter yet;
 *  - `transfersFlying` — the reward chips are in the air;
 *  - `ceremony` — the VP culmination of a finish position;
 *  - `followUpInteractive` — the landed stage is asking the player something.
 *
 * `committed` gates them all: none of these signals means anything about THIS
 * flow before the commit boundary.
 */
export function hydroResolutionBusyOf(signals: {
  committed: boolean,
  markerGliding: boolean,
  rewardHeld: boolean,
  transfersFlying: boolean,
  ceremony: boolean,
  followUpInteractive: boolean,
  /**
   * A MULTI-LEG TRAVERSAL PLAN still holds unfinished legs (Delta Surge) —
   * true through its pauses too, where the marker itself is not gliding and
   * an interactive stop may momentarily hold no other signal. The plan's own
   * completion drops it; a timeout never does.
   */
  traversalPending?: boolean,
  /**
   * A TAKEN CARD IS STILL FLYING to the hand dock. The reveal's own mode
   * ends a tick after the take press — the delivery flights are the only
   * signal that survives to the physical landing, and the flow may not
   * reach its result (nor a traversal resume) over a card in the air.
   */
  intakeFlying?: boolean,
  /**
   * A TERMINAL LANDING STILL OWES ITS CULMINATION ({@link hydroCeremonyOwed}).
   * Distinct from `ceremony` (the choreography is RUNNING): this one is true
   * from the commit until the ceremony has finished PRESENTING, so the gap
   * between the marker settling and the ceremony's own $nextTick start can
   * never read as «resolution over» — the exact frame the summary used to be
   * skipped in. Released by `markHydroCeremonyPlayed`, never by a timeout.
   */
  ceremonyOwed?: boolean,
}): boolean {
  if (!signals.committed) {
    return false;
  }
  return signals.markerGliding || signals.rewardHeld || signals.transfersFlying ||
    signals.ceremony || signals.followUpInteractive || signals.traversalPending === true ||
    signals.intakeFlying === true || signals.ceremonyOwed === true;
}

/** The live-module convenience readers (the section/shell side). */
export function hydroWorkspacePhase(followUpInteractive: boolean): WorkspacePhase {
  return hydroPhaseOf(hydroFlowState, followUpInteractive);
}
export function hydroWorkspaceBackVerb(followUpInteractive: boolean): WorkspaceBackVerb {
  return backVerbFor(hydroWorkspacePhase(followUpInteractive));
}

export function hydroCommitStanding(): boolean {
  return hydroFlowState.commit !== undefined;
}

export function openHydroStep(step: HydroPreStep): void {
  if (hydroFlowState.commit !== undefined) {
    return; // past the boundary nothing re-opens a pre-select
  }
  hydroFlowState.step = step;
}

export function closeHydroStep(): void {
  hydroFlowState.step = undefined;
}

export function setHydroRepeatBridge(on: boolean): void {
  hydroFlowState.repeatBridge = on;
}

/** The commit boundary: freeze the draft into the record, phase = moving. */
export function beginHydroCommit(rec: Omit<HydroCommitRecord, 'phase'>): void {
  hydroFlowState.step = undefined;
  hydroFlowState.repeatBridge = false;
  ceremonyHealAttempts = 0; // a fresh commit gets the witness's full patience
  hydroFlowState.commit = {...rec, phase: 'moving'};
  // WHOSE FLOW THIS IS. Taken at the press, when the frame that is making the
  // move is by definition the live one.
  hydroFlowState.frameEpoch = workspaceFrameEpoch('hydro');
  hydroFlowState.ceremonyPlayed = false;
}

/**
 * IS THE STANDING FLOW RECORD THIS SCREEN'S OWN?
 *
 * False for an ORPHAN: a record whose frame is gone and whose content lives
 * somewhere this instance cannot show — the case the player reaches by setting
 * the step aside and then asking the wheel for the track again after the park
 * was discarded. Presented anyway it is a sealed screen; the honest answer is
 * that this frame has no flow, so it shows its ordinary track and refuses
 * actions with the one reason it already has.
 */
export function hydroFlowIsOwnedByCurrentFrame(): boolean {
  return hydroFlowState.commit === undefined ||
    hydroFlowState.frameEpoch === workspaceFrameEpoch('hydro');
}

/** Forward-only — a stray signal can never resurrect a spent beat. */
export function advanceHydroCommitPhase(phase: HydroCommitPhase): void {
  const c = hydroFlowState.commit;
  if (c === undefined) {
    return;
  }
  if (COMMIT_ORDER.indexOf(phase) <= COMMIT_ORDER.indexOf(c.phase)) {
    return;
  }
  c.phase = phase;
}

/** The SERVER refused the batch — the move did not happen. The record drops,
 *  the pre-commit draft (module state) is untouched, B lives again. */
export function rollbackHydroCommit(): void {
  hydroFlowState.commit = undefined;
  hydroFlowState.ceremonyActive = false;
  hydroFlowState.ceremonyPlayed = false;
}

/** The flow is over (result read / workspace closing) — full reset. */
export function resetHydroFlow(): void {
  hydroFlowState.step = undefined;
  hydroFlowState.repeatBridge = false;
  hydroFlowState.commit = undefined;
  hydroFlowState.frameEpoch = 0;
  hydroFlowState.draftVersion = '';
  hydroFlowState.ceremonyActive = false;
  hydroFlowState.ceremonyPlayed = false;
}

export function setHydroCeremonyActive(on: boolean): void {
  hydroFlowState.ceremonyActive = on;
  // The choreography's own age — the one witness term that can tell «the
  // culmination is playing» from «its finish call died with a killed
  // timeline» (see hydroCeremonyWitnessLying).
  ceremonyRunSince = on ? Date.now() : 0;
}
export function isHydroCeremonyActive(): boolean {
  return hydroFlowState.ceremonyActive;
}

/**
 * THE CEREMONY FINISHED PRESENTING (culmination played to its end, or the
 * recovery net honestly skipped a culmination whose glide degraded). The one
 * completion signal that releases {@link hydroCeremonyOwed} — the flow then
 * advances to its RESULT stage through the ordinary busy falling edge. The
 * ceremony itself never ends the flow: the summary is the mandatory terminal
 * stage of every successful movement, and the ceremony is the beat before it.
 */
export function markHydroCeremonyPlayed(): void {
  if (hydroFlowState.commit !== undefined) {
    hydroFlowState.ceremonyPlayed = true;
  }
}

/**
 * A TERMINAL (VP) landing still OWES its culmination: the commit resolves at
 * a finish stage and the ceremony has neither played nor been skipped by the
 * recovery net. A term of `hydroResolutionBusyOf` — the flow may not reach
 * the result stage (nor close) over an unplayed culmination, and equally may
 * not stall once it HAS played: completion is this flag, never a timeout.
 */
export function hydroCeremonyOwed(): boolean {
  const c = hydroFlowState.commit;
  return c !== undefined && c.kind === 'ceremony' && c.phase !== 'result' &&
    !hydroFlowState.ceremonyPlayed;
}

// The ceremony is a cinematic INSIDE a mandatory-free workspace: ordinary
// notifications queue behind it (they would narrate over the culmination),
// but nothing blocking — the flow's own phase already absorbs input.
registerAnimationHoldSupplier('hydro-ceremony', isHydroCeremonyActive, {scope: 'notification-only'});

/** The player touched the pre-commit draft — remember what world it fits. */
export function noteHydroDraftTouched(version: string): void {
  hydroFlowState.draftVersion = version;
}

/** May a re-open re-seat the standing draft? Only when the world has not
 *  moved under it (same gameAge|undoCount) — else the plan starts clean. */
export function hydroDraftFresh(version: string): boolean {
  return hydroFlowState.draftVersion !== '' && hydroFlowState.draftVersion === version;
}

/**
 * The mount-time restore decision — pure and HOST-SCOPED (the
 * actionWorkspaceRestorePlan idiom). The hydro workspace re-mounts after a
 * park (collapse → board → restore door): decide ONCE what the frame can
 * honestly rebuild.
 *
 *  - `seat-commit` — a committed flow with a live continuation (the claim is
 *    ours, or a follow-up prompt is standing): re-open the commit scene at
 *    its exact phase; the host republishes its zones from mounted().
 *  - `fold` — a commit record with NOTHING live under it (the resolution
 *    finished while parked, or a reload wiped the claim): the flow cannot be
 *    replayed — reset honestly to the browse state.
 *  - `none` — no commit: plain browse (the pre-commit draft re-seats itself
 *    through the ordinary model path).
 */
export type HydroRestorePlan = 'none' | 'seat-commit' | 'fold';

export function hydroWorkspaceRestorePlan(input: {
  commit: HydroCommitRecord | undefined,
  claimHost: string | undefined,
  followUpInteractive: boolean,
  /**
   * Is the standing record THIS frame's own (`hydroFlowIsOwnedByCurrentFrame`)?
   * A record whose frame is gone is an ORPHAN, and no evidence of liveness
   * makes it presentable HERE: its content is somewhere this instance cannot
   * show. Seated anyway it is a sealed screen — a committed workspace with no
   * body, «Ⓐ Выполняется» as its only verb and B dead by phase, reachable by
   * setting the step aside and then asking the wheel for the track again.
   */
  ownedByThisFrame: boolean,
  /**
   * The record is an ESPIONAGE EXECUTION (Corporate Espionage): its frame is
   * pushed AT the commit, so this very mount is the presentation's first
   * frame — a commit with no claim and no follow-up yet, which the ordinary
   * heuristic below would mistake for a finished resolution and fold. An
   * OWNED espionage record therefore always seats.
   */
  espionageExecution?: boolean,
}): HydroRestorePlan {
  if (input.commit === undefined) {
    return 'none';
  }
  // OWNERSHIP OUTRANKS LIVENESS. A stale claim or a prompt owed by somebody
  // else's chain both read as «live» and both belong to a flow this frame did
  // not make — that pair is exactly what produced the sealed screen.
  if (!input.ownedByThisFrame) {
    return 'fold';
  }
  if (input.claimHost === 'hydro' || input.followUpInteractive || input.espionageExecution === true) {
    return 'seat-commit';
  }
  return 'fold';
}

/*
 * ── THE FLOW-CLOSE TRUTH WITNESSES (the presentation-ledger net) ────────────
 *
 * The committed flow's whole close chain is EDGE-DRIVEN: the marker's falling
 * edge advances the phase, the busy predicate's falling edge reaches the
 * result stage, the section's three change-watchers start the culmination,
 * and a window.setTimeout ends the read hold. Every one of those edges can be
 * missed — a true→true transition fires nothing, an 800 ms one-shot fact
 * expires under a slow frame, a component's watchers die with it, a cleared
 * timer is never re-armed — and a missed edge used to cost the player a
 * WEDGED SCREEN: the workspace standing in a transient beat with B absorbed
 * by phase, until some unrelated 20–30 s safety happened to shake the state
 * («финальная анимация зависла, потом сама прошла»).
 *
 * The ledger's truth witnesses state the invariants positively — «a committed
 * flow that is quiet and visible must be making progress» — and re-drive the
 * flow's OWN doors when one holds too long. They never cut a genuine wait:
 * a glide, a standing plan, an interactive follow-up, a park and the read
 * hold all read as healthy. Installed by the shell (install/uninstall pair),
 * never at import — a module-scope registration would leave a permanent
 * heartbeat in every unit-spec bundle.
 */

/** The flow is deliberately set aside — a park is not a wedge, and nothing
 *  may start or settle on a hidden stage. */
export function hydroFlowSetAside(): boolean {
  return workspaceStackCollapsed() || consoleState.task.deferred;
}

/** The culmination choreography has been RUNNING implausibly long — its
 *  finish call died (a killed timeline). Bounded far above any real run
 *  (~2.7 s at motion scale 1). */
const CEREMONY_RUN_MAX_MS = 12_000;
let ceremonyRunSince = 0;

export function hydroCeremonyRunningTooLong(now: number = Date.now()): boolean {
  return hydroFlowState.ceremonyActive && ceremonyRunSince !== 0 &&
    now - ceremonyRunSince > CEREMONY_RUN_MAX_MS;
}

/**
 * THE CULMINATION'S DOOR — the section registers its own `maybeStartCeremony`
 * ask here (mounted → registered, beforeUnmount → cleared), and the witness
 * replays it through the SAME guards the ordinary edges use. One door, so a
 * heal can never invent a second start path.
 */
let ceremonyStarter: (() => void) | undefined;
export function registerHydroCeremonyStarter(starter: (() => void) | undefined): void {
  ceremonyStarter = starter;
}

/**
 * «The finale is owed, startable, and nothing is starting it.» False through
 * every legitimate wait: the glide (marker active), a standing plan (its own
 * pauses included), a park, a running choreography — except one that has
 * outlived any possible run (the killed-timeline case).
 */
export function hydroCeremonyWitnessLying(now: number = Date.now()): boolean {
  const c = hydroFlowState.commit;
  if (c === undefined || c.kind !== 'ceremony' || c.phase !== 'resolving' ||
      hydroFlowState.ceremonyPlayed || hydroFlowSetAside()) {
    return false;
  }
  if (hydroFlowState.ceremonyActive) {
    return hydroCeremonyRunningTooLong(now);
  }
  return !isHydroMarkerActive() && !hydroTraversalPending();
}

/** A starter that repeatedly changes NOTHING (a latched one-shot over a
 *  choreography that threw at birth) stops being retried — the skip is the
 *  honest end. Counted per commit; any real progress resets it. */
let ceremonyHealAttempts = 0;
const CEREMONY_HEAL_MAX_ATTEMPTS = 3;

/** The witness's heal — CONVERGING by construction: every branch either
 *  starts the culmination (lying falls on `ceremonyActive`) or marks it
 *  honestly skipped (lying falls on `ceremonyPlayed`). */
export function healHydroCeremony(): void {
  if (hydroFlowState.ceremonyActive) {
    // The choreography wedged mid-run — end it honestly. A late finish from
    // the real timeline is idempotent (`doneFired` / played-latch).
    setHydroCeremonyActive(false);
    markHydroCeremonyPlayed();
    return;
  }
  const starter = ceremonyStarter;
  if (starter !== undefined && ceremonyHealAttempts < CEREMONY_HEAL_MAX_ATTEMPTS) {
    // The section's own durable-arrival ask: it either starts the finale or
    // skips it honestly — both end the lie. An ask that moves nothing
    // (pathological: the one-shot latched over a start that threw) is
    // retried a bounded number of times, then skipped below.
    ceremonyHealAttempts++;
    starter();
    if (hydroFlowState.ceremonyActive || hydroFlowState.ceremonyPlayed) {
      ceremonyHealAttempts = 0;
    }
  } else {
    // No stage anywhere (the section is unmounted, the flow orphaned) or a
    // starter that cannot converge — the honest skip; the summary still
    // follows through the ordinary edge.
    markHydroCeremonyPlayed();
  }
}

/**
 * THE SHELL-SIDE FACTS the stuck-flow witness needs — the busy conjunction
 * and the result hold live in ConsoleShell (they read prompt/arrival state
 * only the shell has), so the shell registers a probe, the same idiom as the
 * release funnel's serving probe.
 */
export type HydroFlowProbe = {
  /** `hydroResolutionBusy` — the close gate's own conjunction. */
  busy: () => boolean;
  /** The result stage's read-hold timer is armed. */
  resultHoldArmed: () => boolean;
  /** The server's own position confirms the committed destination. */
  serverAtDestination: () => boolean;
  /** Re-drive the flow's own doors (settle / re-arm the hold). Idempotent. */
  drive: () => void;
};
let flowProbe: HydroFlowProbe | undefined;
export function registerHydroFlowProbe(probe: HydroFlowProbe | undefined): void {
  flowProbe = probe;
}

/**
 * «A committed flow stands quiet and visible, and no edge is left to move
 * it.» Three wedges, one witness:
 *  - `moving` with the marker idle and no plan — the advance edge was missed
 *    (or the glide died past its own nets);
 *  - `resolving` with the busy conjunction false — the falling edge was
 *    missed (the settle door was never re-asked);
 *  - `result` with the read hold's timer dead — the auto-finish edge died.
 */
export function hydroFlowStuckLying(): boolean {
  const c = hydroFlowState.commit;
  if (c === undefined || hydroFlowSetAside()) {
    return false;
  }
  if (c.phase === 'moving') {
    return !isHydroMarkerActive() && !hydroTraversalPending();
  }
  if (flowProbe === undefined) {
    return false;
  }
  if (c.phase === 'resolving') {
    return !flowProbe.busy();
  }
  return !flowProbe.resultHoldArmed();
}

/** The stuck-flow heal — each branch routes through the flow's OWN recovery
 *  door, never a new mechanism. */
export function healHydroFlowStuck(): void {
  const c = hydroFlowState.commit;
  if (c === undefined) {
    return;
  }
  if (c.phase === 'moving') {
    if (flowProbe !== undefined && flowProbe.serverAtDestination()) {
      // The move IS committed server-side — the same recovery the shell's
      // own position watcher performs on its (missed) edge.
      advanceHydroCommitPhase('resolving');
    } else {
      // The move never committed (a lost submit past every marker net) —
      // the refusal battery's own answer: the draft returns, B lives again.
      rollbackHydroCommit();
    }
    return;
  }
  flowProbe?.drive();
}

/** How long a lie must hold before the heal fires — well past any same-flush
 *  transition, well short of the old accidental 20–30 s recoveries. */
const HYDRO_WITNESS_GRACE_MS = 3000;

/**
 * Install both witnesses (the shell's mounted; returns the uninstall for its
 * beforeUnmount). The ledger warns with the witness id whenever a heal fires,
 * so a wedge names itself instead of dissolving into an unexplained wait.
 */
export function installHydroFlowWitnesses(): () => void {
  const offCeremony = registerTruthWitness({
    id: 'hydro-ceremony-owed',
    lying: () => hydroCeremonyWitnessLying(),
    graceMs: HYDRO_WITNESS_GRACE_MS,
    heal: healHydroCeremony,
  });
  const offStuck = registerTruthWitness({
    id: 'hydro-flow-stuck',
    lying: hydroFlowStuckLying,
    graceMs: HYDRO_WITNESS_GRACE_MS,
    heal: healHydroFlowStuck,
  });
  return () => {
    offCeremony();
    offStuck();
  };
}
