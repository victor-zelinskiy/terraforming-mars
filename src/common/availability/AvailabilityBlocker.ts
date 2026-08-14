import {UnplayableReason, UnplayableReasonType} from '../cards/UnplayableReason';

/**
 * THE ONE MEANING OF «НЕЛЬЗЯ» — the structured semantics of a blocker, shared by
 * every availability surface in the console (hand cards, card actions, the
 * Hydronetwork advance, a colony trade, the action wheel's counts).
 *
 * The distinction it formalizes is the whole point:
 *
 *   POTENTIALLY AVAILABLE — the move would be entirely legal in the CURRENT game
 *     state if it were this player's action window. This is what the wheel's
 *     green number counts, and it must NOT move because the turn moved.
 *
 *   EXECUTABLE NOW — potentially available AND actually submittable right now
 *     (the player's turn, no owed decision, no other execution gate).
 *
 * «Сейчас не ваш ход» is NOT a domain reason a card / action / trade / advance is
 * unavailable — it is a GLOBAL, TEMPORARY EXECUTION GATE. It blocks the commit,
 * it paints the calm `warning` tone («НЕ СЕЙЧАС»), and it leaves the element in
 * the potential count. A card that ALSO lacks a tag is a different story: the
 * domain reason outranks, the element leaves the count, and it stays red.
 *
 * ⚠️ The classification is STRUCTURAL, never a comparison against displayed text
 * (cross-cutting invariant 1 — i18n mutates messages in place). It keys off
 * `UnplayableReasonType`, which the server already produces from the real rule
 * sources, and each code declares its OWN answer to both questions: a future
 * temporary gate with different semantics (a paused game, a spectator seat) adds
 * a code and states them, it does not inherit them from «is it temporary» or
 * from a colour.
 */

export type BlockerCode =
  /** Another player's action window — nothing about this element is wrong. */
  | 'NOT_YOUR_TURN'
  /** The viewer's own turn, but a decision is already owed (mid sub-action, a
   *  minimized mandatory prompt). Also purely an execution gate. */
  | 'FINISH_CURRENT_ACTION'
  /**
   * Some OTHER gate on executing — not a statement about this element's
   * legality (an opponent's tableau is being inspected, a spectator seat, …).
   * It exists so a surface never has to squeeze such a case into one of the two
   * turn codes: a new temporary gate declares its own semantics here.
   */
  | 'EXECUTION_GATE'
  /** A real game-rule blocker: cost, requirement, target, per-generation usage,
   *  no free fleet, no payment path, … */
  | 'DOMAIN';

export type AvailabilityBlocker = {
  code: BlockerCode;
  /** The move cannot be submitted right now (Commit stays disabled). */
  blocksExecutionNow: boolean;
  /**
   * The element is NOT potentially available — it drops out of the wheel's green
   * number and paints the danger state. Deliberately its OWN field: it is not
   * «the opposite of temporary» and it is not derived from `tone`.
   */
  affectsPotentialCount: boolean;
  /** The visual register the surface paints. */
  tone: 'warning' | 'danger';
};

/** The canonical semantics per code — the single table every surface reads. */
export const AVAILABILITY_BLOCKERS: Readonly<Record<BlockerCode, AvailabilityBlocker>> = {
  NOT_YOUR_TURN: {code: 'NOT_YOUR_TURN', blocksExecutionNow: true, affectsPotentialCount: false, tone: 'warning'},
  FINISH_CURRENT_ACTION: {code: 'FINISH_CURRENT_ACTION', blocksExecutionNow: true, affectsPotentialCount: false, tone: 'warning'},
  EXECUTION_GATE: {code: 'EXECUTION_GATE', blocksExecutionNow: true, affectsPotentialCount: false, tone: 'warning'},
  DOMAIN: {code: 'DOMAIN', blocksExecutionNow: true, affectsPotentialCount: true, tone: 'danger'},
};

/** The turn-flavoured gate for a viewer who is not being asked to act. */
export function turnGateBlocker(awaitingInput: boolean): AvailabilityBlocker {
  return awaitingInput ?
    AVAILABILITY_BLOCKERS.FINISH_CURRENT_ACTION :
    AVAILABILITY_BLOCKERS.NOT_YOUR_TURN;
}

/**
 * The reason TYPES the client itself adds to describe the action WINDOW rather
 * than the element (see {@link UnplayableReason} — the server never produces
 * these, because it does not know whose turn the viewer thinks it is).
 */
const EXECUTION_GATE_TYPES: Readonly<Record<string, BlockerCode>> = {
  turn: 'NOT_YOUR_TURN',
  phase: 'FINISH_CURRENT_ACTION',
};

/** Structural: which blocker code an {@link UnplayableReasonType} carries. */
export function blockerCodeForReasonType(type: UnplayableReasonType): BlockerCode {
  return EXECUTION_GATE_TYPES[type] ?? 'DOMAIN';
}

/** The semantics of one structured reason. */
export function blockerForReason(reason: UnplayableReason): AvailabilityBlocker {
  return AVAILABILITY_BLOCKERS[blockerCodeForReasonType(reason.type)];
}

/** Every blocker of a reason list, in order. */
export function blockersForReasons(reasons: ReadonlyArray<UnplayableReason>): Array<AvailabilityBlocker> {
  return reasons.map(blockerForReason);
}

/**
 * Would this be legal if it were the player's window? TRUE when nothing but
 * execution gates stands in the way (an empty list is trivially available).
 */
export function potentiallyAvailable(blockers: ReadonlyArray<AvailabilityBlocker>): boolean {
  return blockers.every((b) => !b.affectsPotentialCount);
}

/** Can it be submitted RIGHT NOW? */
export function executableNow(blockers: ReadonlyArray<AvailabilityBlocker>): boolean {
  return blockers.every((b) => !b.blocksExecutionNow);
}

/**
 * The blocker a surface should SHOW when several apply.
 *
 * A real domain reason is strictly more useful than «не сейчас», so it wins —
 * «Сейчас не ваш ход» must never mask «не хватает метки». Among equals the FIRST
 * wins (the producing validator already ordered them by how absolute they are).
 * `undefined` = nothing blocks.
 */
export function primaryBlocker(blockers: ReadonlyArray<AvailabilityBlocker>): AvailabilityBlocker | undefined {
  return blockers.find((b) => b.affectsPotentialCount) ?? blockers[0];
}

/**
 * The same priority over the structured reasons themselves, so a surface can
 * render the winning reason's TEXT (and its icon / current value) — never a
 * second, equally-loud line beside it.
 */
export function primaryReason(reasons: ReadonlyArray<UnplayableReason>): UnplayableReason | undefined {
  return reasons.find((r) => blockerForReason(r).affectsPotentialCount) ?? reasons[0];
}
