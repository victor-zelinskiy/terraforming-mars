/*
 * startStageDirector — THE ONE MOTION DIRECTOR of the Game Start Workspace's
 * stage changes.
 *
 * ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────
 *
 * The stage used to change SYNCHRONOUSLY, in the same tick the player pressed
 * RT, before a single card had moved:
 *
 *     collectToDock(sources, pile, () => { state.stepIdx = railPos + 1; }, …)
 *                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *     // `onCovered` fires right after the proxies spawn — i.e. at t = 0.
 *
 * So the Prelude table was already standing (and fading in) while the chosen
 * Corporation was still on its way to the shelf: two full card surfaces on
 * screen at once, with a card of the OLD one flying over the cards of the NEW
 * one. No z-index fixes that — the layers were never the problem; the ORDER
 * OF LIFE PHASES was. A card must finish its physical business in the context
 * it belongs to before that context is allowed to leave.
 *
 * Hence the split this module owns:
 *   · ACTIVE stage  — what is physically on screen (`consoleStartState.stepIdx`)
 *   · PENDING stage — what the player has asked for (`startTransition.to`)
 * The commit that turns one into the other is a PHASE, and it sits after the
 * docking in every forward path — never at the press.
 *
 * ── FORWARD AND BACKWARD ARE NOT MIRROR IMAGES ───────────────────────────
 *
 * They are different physical events and get different orders:
 *
 *   FORWARD  — the player TAKES cards off the table they are standing at, so
 *              the old table must still be there to take them from. The cards
 *              leave first; the surface they left retires behind them; the
 *              next surface opens only once the shelf has them.
 *   BACKWARD — the player asks for cards BACK, so the table that will receive
 *              them must exist first. The current surface retires, the
 *              previous one returns (cached — no re-deal), its reserved slot
 *              stands empty, and only then does the card leave the shelf.
 *
 * A single symmetric crossfade cannot express either of them.
 *
 * The phases below are the vocabulary; `ConsoleStartScene` performs them.
 * Everything here is PURE (plus one small reactive record) so the ordering
 * contract is unit-testable without a DOM:
 * `tests/client/components/console/startStageDirector.spec.ts`.
 */

import {reactive} from 'vue';

/** Which physical event a stage change is. */
export type StartTransitionKind = 'step-forward' | 'step-back' | 'to-summary' | 'from-summary';

/**
 * The phases, as one flat union (a phase name is unique across kinds so a
 * log line / a test failure names the event without extra context).
 */
export type StartTransitionPhase =
  | 'idle'
  // ── shared opening beat ──
  | 'accepting-navigation'
  // ── forward (step → step, step → summary) ──
  | 'compressing-selection'
  | 'lifting-selection'
  | 'transferring-selection'
  | 'parking-current-surface'
  | 'docking-selection'
  | 'committing-stage'
  | 'revealing-next-surface'
  // ── backward (step → step, summary → step) ──
  | 'committing-previous-stage'
  | 'revealing-previous-surface'
  | 'preparing-reserved-slots'
  | 'releasing-selection-from-dock'
  | 'transferring-selection-home'
  | 'docking-selection-home'
  // ── summary-specific ──
  | 'preparing-summary-layout'
  | 'distributing-summary-cards'
  | 'docking-all-summary-cards'
  | 'revealing-summary-status'
  // ── shared closing beat ──
  | 'stabilizing-focus';

/**
 * FORWARD, step → step. The cards are gone from the old table before the new
 * one is allowed to exist; the old table retires as ONE layer while they are
 * in the air (never card by card — see `parkSurface`).
 */
export const FORWARD_PHASES: ReadonlyArray<StartTransitionPhase> = [
  'accepting-navigation',
  'compressing-selection',
  'lifting-selection',
  'transferring-selection',
  'parking-current-surface',
  'docking-selection',
  'committing-stage',
  'revealing-next-surface',
  'stabilizing-focus',
];

/**
 * FORWARD, last step → summary. Identical up to the docking, except the
 * destination layout has to be PREWARMED (mounted + measured + frozen) before
 * anything moves — a summary that assembles itself while cards arrive cannot
 * offer them a stable rect to land on. The summary's own chrome and its
 * controls come last, after the final card is down.
 */
export const TO_SUMMARY_PHASES: ReadonlyArray<StartTransitionPhase> = [
  'accepting-navigation',
  'compressing-selection',
  'lifting-selection',
  'preparing-summary-layout',
  'parking-current-surface',
  'committing-stage',
  'distributing-summary-cards',
  'docking-all-summary-cards',
  'revealing-summary-status',
  'stabilizing-focus',
];

/**
 * BACKWARD, step → step. The receiving table is restored BEFORE the card is
 * released from the shelf — «the previous surface must be ready to accept the
 * card first».
 */
export const BACKWARD_PHASES: ReadonlyArray<StartTransitionPhase> = [
  'accepting-navigation',
  'parking-current-surface',
  'committing-previous-stage',
  'revealing-previous-surface',
  'preparing-reserved-slots',
  'releasing-selection-from-dock',
  'transferring-selection-home',
  'docking-selection-home',
  'stabilizing-focus',
];

/** BACKWARD, summary → last step. The same order; the cards leave TILES
 *  rather than a pile, and the other groups gather onto their shelves as the
 *  second leg of the same convoy. */
export const FROM_SUMMARY_PHASES: ReadonlyArray<StartTransitionPhase> = [
  'accepting-navigation',
  'compressing-selection',
  'lifting-selection',
  'parking-current-surface',
  'committing-previous-stage',
  'revealing-previous-surface',
  'preparing-reserved-slots',
  'transferring-selection-home',
  'docking-selection-home',
  'stabilizing-focus',
];

export function phasesFor(kind: StartTransitionKind): ReadonlyArray<StartTransitionPhase> {
  switch (kind) {
  case 'step-forward':
    return FORWARD_PHASES;
  case 'to-summary':
    return TO_SUMMARY_PHASES;
  case 'step-back':
    return BACKWARD_PHASES;
  case 'from-summary':
    return FROM_SUMMARY_PHASES;
  }
}

/** Classify a requested move. `undefined` = not a stage change. */
export function transitionKind(from: number, to: number, stepCount: number): StartTransitionKind | undefined {
  if (from === to) {
    return undefined;
  }
  if (to > from) {
    return to >= stepCount ? 'to-summary' : 'step-forward';
  }
  return from >= stepCount ? 'from-summary' : 'step-back';
}

/** The direction a transition travels (drives the rail's pulse + parking). */
export function transitionDirection(kind: StartTransitionKind): 1 | -1 {
  return kind === 'step-forward' || kind === 'to-summary' ? 1 : -1;
}

/** The phase in which `stepIdx` flips from the active to the pending stage. */
export function commitPhaseOf(kind: StartTransitionKind): StartTransitionPhase {
  return transitionDirection(kind) === 1 ? 'committing-stage' : 'committing-previous-stage';
}

/**
 * THE LOAD-BEARING INVARIANT, stated once so a test can assert it: on every
 * FORWARD path the chosen cards have physically left the old surface (and,
 * for a step advance, have reached the shelf) before the stage is committed —
 * i.e. before any card of the next surface may be painted.
 */
export function commitFollowsSeparation(kind: StartTransitionKind): boolean {
  const phases = phasesFor(kind);
  const commit = phases.indexOf(commitPhaseOf(kind));
  if (commit < 0) {
    return false;
  }
  if (transitionDirection(kind) === -1) {
    // Backward commits EARLY on purpose: the receiving table must stand
    // before the card is released from the shelf.
    return phases.indexOf('releasing-selection-from-dock') > commit ||
      phases.indexOf('transferring-selection-home') > commit;
  }
  // The cards are physically OFF the table once they have been lifted out of
  // it; the table may retire only behind them, and the commit only behind the
  // table. (For a step advance the shelf must also have them — that is the
  // extra `transferring-selection` → `docking-selection` pair.)
  const lifted = phases.indexOf('lifting-selection');
  const parked = phases.indexOf('parking-current-surface');
  return lifted >= 0 && parked >= 0 && parked > lifted && commit > parked;
}

/**
 * Does the NEXT surface's card layer exist during this phase? The answer must
 * be `false` for every phase in which the OLD surface still shows cards —
 * that is the «no two card grids at once» rule, expressed so a test can walk
 * the whole order and check it.
 */
export function nextSurfaceVisible(kind: StartTransitionKind, phase: StartTransitionPhase): boolean {
  const phases = phasesFor(kind);
  const i = phases.indexOf(phase);
  const commit = phases.indexOf(commitPhaseOf(kind));
  return i >= 0 && commit >= 0 && i >= commit;
}

/** Does the OLD surface still show its cards during this phase? */
export function currentSurfaceVisible(kind: StartTransitionKind, phase: StartTransitionPhase): boolean {
  const phases = phasesFor(kind);
  const i = phases.indexOf(phase);
  const parked = phases.indexOf('parking-current-surface');
  return i >= 0 && parked >= 0 && i <= parked;
}

/**
 * Input is LOCKED for the whole transition and released only on the final
 * phase — but the lock is never felt, because the response (`compressing` /
 * `lifting`) starts in the same interaction frame as the press.
 */
export function inputLocked(phase: StartTransitionPhase): boolean {
  return phase !== 'idle' && phase !== 'stabilizing-focus';
}

// ── ADAPTIVE MULTI-CARD CHOREOGRAPHY ───────────────────────────────────────

export type ChoreographyTier = 'single' | 'few' | 'several' | 'many';

/**
 * How a convoy of N cards is choreographed. The rule the tiers encode: a
 * bigger set is allowed to TAKE LONGER, and is never allowed to drop cards.
 * («Animate the first N and place the rest» is the failure this replaces —
 * the last cards popping into the summary one by one.)
 *
 *  · 1        — one clearly readable trajectory;
 *  · 2–4      — individual trajectories, generous spacing;
 *  · 5–10     — trajectories overlap, the spacing compresses, still one card
 *               per beat;
 *  · 11+      — the set opens as a package: the spacing compresses further and
 *               the total spread saturates, so a 20-card buy is ~3× the
 *               spread of a 4-card one rather than ~5×.
 */
export function summaryChoreography(count: number): {
  tier: ChoreographyTier,
  /** Per-card spacing (ms @ motion scale 1). */
  stagger: number,
  /** Total spread of the convoy's launches (ms @ motion scale 1). */
  spread: number,
} {
  const n = Math.max(0, count);
  const tier: ChoreographyTier = n <= 1 ? 'single' : n <= 4 ? 'few' : n <= 10 ? 'several' : 'many';
  if (n <= 1) {
    return {tier, stagger: 0, spread: 0};
  }
  const gaps = n - 1;
  const spread = Math.min(900, 300 + gaps * 32);
  const stagger = Math.max(38, Math.min(95, Math.round(spread / gaps)));
  return {tier, stagger, spread: stagger * gaps};
}

// ── THE LIVE TRANSITION (module reactive — one director, never booleans) ───

export type StartTransitionState = {
  kind: StartTransitionKind | undefined,
  phase: StartTransitionPhase,
  /** The ACTIVE stage the transition started from. */
  from: number,
  /** The PENDING stage — requested, not yet physically on screen. */
  to: number,
  dir: 1 | -1 | 0,
};

export const startTransition: StartTransitionState = reactive({
  kind: undefined,
  phase: 'idle',
  from: -1,
  to: -1,
  dir: 0,
} as StartTransitionState);

/** A stage change is running (input gates on this; the rail pulses on it). */
export function startTransitionActive(): boolean {
  return startTransition.kind !== undefined;
}

/**
 * The stage the player ASKED for while it is not yet the active one. The
 * journey rail shows this as a directional anticipation ONLY — never as the
 * current stage, and never with a text change (see the rail's pulse).
 */
export function pendingStage(): number | undefined {
  return startTransition.kind === undefined ? undefined : startTransition.to;
}

export function beginStartTransition(kind: StartTransitionKind, from: number, to: number): void {
  startTransition.kind = kind;
  startTransition.phase = 'accepting-navigation';
  startTransition.from = from;
  startTransition.to = to;
  startTransition.dir = transitionDirection(kind);
}

/**
 * Advance the director. Phases may be SKIPPED (a step with nothing to do —
 * an empty projects buy has no cards to lift) but never REORDERED: going
 * backwards through the order is a bug in the caller, and in dev it says so
 * rather than silently producing the old out-of-order behaviour.
 */
export function setStartTransitionPhase(phase: StartTransitionPhase): void {
  const kind = startTransition.kind;
  if (kind !== undefined && process.env.NODE_ENV !== 'production') {
    const order = phasesFor(kind);
    const now = order.indexOf(startTransition.phase);
    const next = order.indexOf(phase);
    if (next >= 0 && now >= 0 && next < now) {
      console.warn(`[start-director] «${kind}» went backwards: ${startTransition.phase} → ${phase}. ` +
        'Phases may be skipped, never reordered.');
    }
  }
  startTransition.phase = phase;
}

export function endStartTransition(): void {
  startTransition.kind = undefined;
  startTransition.phase = 'idle';
  startTransition.from = -1;
  startTransition.to = -1;
  startTransition.dir = 0;
}

/** Full reset (a new deal identity / an unmount mid-flight). */
export function resetStartTransition(): void {
  endStartTransition();
}
