/*
 * BUDGET LANES — the ONE stepper engine behind every console prompt that reads
 * "spread a fixed budget across N lanes".
 *
 * Two prompts in scope look different and are the same machine:
 *   • the Venus alt-track bonus — spend EXACTLY N across the six standard
 *     resources (every lane is worth 1);
 *   • Stormcraft's spend-heat — COVER N heat with heat (1 each) and floaters
 *     (2 each), and never overpay.
 * Both are `AndOptions` of `SelectAmount` on the wire, which is why the console
 * used to drop both onto the desktop modal: the task host's `distribute` lanes
 * only speak `SelectResources`.
 *
 * PURITY: no Vue, no DOM, no i18n — English i18n KEYS out, numbers in. That is
 * what lets the whole rule set be unit-tested under the fast server runner
 * instead of through a mounted component.
 */

export interface BudgetLane {
  /** Stable identity — the response order key, and the focus key. */
  key: string;
  /** Premium icon class (`resource_icon resource_icon--heat`, …). */
  iconClass: string;
  /** English i18n key for the lane's name. */
  label: string;
  /** How much of the BUDGET one step of this lane covers. Heat 1, floaters 2. */
  weight: number;
  /** Hard cap on this lane (what the player actually owns / the rules allow). */
  max: number;
  /**
   * OPTIONAL "what you have" figure for the lane readout. Distinct from `max`:
   * a Venus bonus lane is capped by the BUDGET, not by your stock, and showing
   * the stock there would read as a limit that isn't one.
   */
  available?: number;
  /** OPTIONAL note under the lane (why the cap is what it is). */
  noteKey?: string;
}

/**
 * EXACT — the sum must land on the target (the Venus bonus: you are handed N
 * resources and must place all N).
 * COVER — the sum must REACH the target without a wasted step (Stormcraft: any
 * lane you could drop and still cover means you overpaid). The rules reject an
 * overpayment server-side, so the surface must never let one be submitted.
 */
export type BudgetRule =
  | {kind: 'exact', target: number}
  | {kind: 'cover', target: number};

export type BudgetState = Readonly<Record<string, number>>;

export function laneValue(state: BudgetState, key: string): number {
  return state[key] ?? 0;
}

/** What the current allocation covers, in BUDGET units (weights applied). */
export function budgetTotal(lanes: ReadonlyArray<BudgetLane>, state: BudgetState): number {
  return lanes.reduce((acc, lane) => acc + laneValue(state, lane.key) * lane.weight, 0);
}

/** How much of the budget is still unplaced (never negative). */
export function budgetRemaining(lanes: ReadonlyArray<BudgetLane>, state: BudgetState, rule: BudgetRule): number {
  return Math.max(0, rule.target - budgetTotal(lanes, state));
}

/**
 * The steps this lane may still take UP, honouring both its own cap and the
 * rule. `exact` never allows overshooting the target at all; `cover` allows the
 * step that CROSSES the target (a floater covering the last 1 heat is legal and
 * often the only way), but not one taken on top of an already-covered budget.
 */
export function stepsUp(lanes: ReadonlyArray<BudgetLane>, state: BudgetState, rule: BudgetRule, key: string): number {
  const lane = lanes.find((l) => l.key === key);
  if (lane === undefined) {
    return 0;
  }
  const headroom = lane.max - laneValue(state, key);
  if (headroom <= 0) {
    return 0;
  }
  const remaining = rule.target - budgetTotal(lanes, state);
  if (remaining <= 0) {
    return 0;
  }
  if (rule.kind === 'exact') {
    return Math.min(headroom, Math.floor(remaining / lane.weight));
  }
  // COVER: the last step may overshoot, so round UP.
  return Math.min(headroom, Math.ceil(remaining / lane.weight));
}

/** Apply a signed step to one lane, clamped by `stepsUp` / 0. */
export function stepLane(
  lanes: ReadonlyArray<BudgetLane>,
  state: BudgetState,
  rule: BudgetRule,
  key: string,
  delta: number,
): BudgetState {
  const current = laneValue(state, key);
  if (delta > 0) {
    const allowed = Math.min(delta, stepsUp(lanes, state, rule, key));
    return allowed <= 0 ? state : {...state, [key]: current + allowed};
  }
  const next = Math.max(0, current + delta);
  if (next === current) {
    return state;
  }
  const out = {...state};
  if (next === 0) {
    delete out[key];
  } else {
    out[key] = next;
  }
  return out;
}

/** RT — pour as much of the remaining budget as this lane can take. */
export function maxOntoLane(
  lanes: ReadonlyArray<BudgetLane>,
  state: BudgetState,
  rule: BudgetRule,
  key: string,
): BudgetState {
  const steps = stepsUp(lanes, state, rule, key);
  return steps <= 0 ? state : stepLane(lanes, state, rule, key, steps);
}

/**
 * Is the allocation submittable?
 *
 * `exact`: the sum IS the target.
 * `cover`: the sum reaches the target AND no single step could be removed while
 *   still covering it — the server's own "you cannot overspend heat / floaters"
 *   rule, stated once here instead of per-lane. Expressed over lanes rather
 *   than over the two hardcoded Stormcraft cases, so a third payment lane would
 *   need no new rule.
 */
export function budgetValid(lanes: ReadonlyArray<BudgetLane>, state: BudgetState, rule: BudgetRule): boolean {
  const total = budgetTotal(lanes, state);
  if (rule.kind === 'exact') {
    return total === rule.target;
  }
  if (total < rule.target) {
    return false;
  }
  return !lanes.some((lane) => laneValue(state, lane.key) > 0 && total - lane.weight >= rule.target);
}

/**
 * IS THE WHOLE BUDGET ONE STEP? — the shape most of these prompts actually take.
 *
 * A Venus track bonus is usually a SINGLE resource, and a stepper is the wrong
 * instrument for a decision that is really «which one»: the player counts up a
 * dial to 1 and then hunts for the confirm, on a chassis built for spreading 3
 * across six lanes. So the surfaces ask this and switch to a RADIO — A places
 * the unit / takes it back, and LB/RB/MAX are not offered at all.
 *
 * Stated as a PROPERTY of the budget, never as `target === 1`: every usable lane
 * must be a complete answer by itself, and once taken, nothing more may be added
 * ANYWHERE. That is what makes the stepper meaningless, and it is honest for
 * `cover` too — a 1-heat bill is one heat OR one floater, and a floater is a
 * legal (if wasteful) whole answer.
 *
 * Below two usable lanes there is no choice to simplify: zero is unanswerable
 * and one is `forcedAllocation`'s pre-filled confirmation.
 */
export function budgetSingleStep(lanes: ReadonlyArray<BudgetLane>, rule: BudgetRule): boolean {
  if (rule.target <= 0) {
    return false;
  }
  const usable = lanes.filter((lane) => lane.max > 0);
  if (usable.length < 2) {
    return false;
  }
  return usable.every((lane) => {
    const filled = stepLane(lanes, {}, rule, lane.key, 1);
    return laneValue(filled, lane.key) === 1 &&
      budgetValid(lanes, filled, rule) &&
      lanes.every((other) => stepsUp(lanes, filled, rule, other.key) === 0);
  });
}

/**
 * A in SINGLE-STEP mode: put the one unit on this lane, or take it back.
 *
 * Placing MOVES it (the allocation is rebuilt from empty) rather than trying to
 * add beside what is already there — under a full budget every `stepLane` up is
 * refused, so «A on another lane» would otherwise be a dead press on the one
 * gesture the mode exists for. Only meaningful while `budgetSingleStep` holds;
 * outside it, clearing the other lanes would throw away real work.
 */
export function toggleSoleStep(
  lanes: ReadonlyArray<BudgetLane>,
  state: BudgetState,
  rule: BudgetRule,
  key: string,
): BudgetState {
  if (laneValue(state, key) > 0) {
    return {};
  }
  return stepLane(lanes, {}, rule, key, 1);
}

/**
 * The honest reason the CONFIRM verb is disabled — never a dead button with no
 * explanation. Returns an English i18n key, or `undefined` when it is ready.
 */
export function budgetBlockedKey(
  lanes: ReadonlyArray<BudgetLane>,
  state: BudgetState,
  rule: BudgetRule,
): string | undefined {
  if (budgetValid(lanes, state, rule)) {
    return undefined;
  }
  const total = budgetTotal(lanes, state);
  if (total < rule.target) {
    // In SINGLE-STEP mode «under the target» can only mean «nothing chosen
    // yet» — and «распределите весь бонус» is the wrong sentence for a radio
    // with one thing to pick.
    if (budgetSingleStep(lanes, rule)) {
      return rule.kind === 'exact' ? 'Choose where it goes' : 'Choose how to pay';
    }
    return rule.kind === 'exact' ? 'Distribute the whole bonus' : 'Not enough to cover the cost';
  }
  // Over the line: only `cover` can reach here (an `exact` overshoot is
  // unreachable — `stepsUp` refuses it).
  return 'Remove a step — this overpays';
}

/**
 * Auto-fill for a distribution with NO real choice: exactly one lane can take
 * anything at all. A forced allocation reads as a confirmation, not a puzzle —
 * the same rule the production-loss surface applies to a lone reducible row.
 * Returns `undefined` when the player genuinely has a decision.
 */
export function forcedAllocation(lanes: ReadonlyArray<BudgetLane>, rule: BudgetRule): BudgetState | undefined {
  const usable = lanes.filter((lane) => lane.max > 0);
  if (usable.length !== 1) {
    return undefined;
  }
  const filled = maxOntoLane(lanes, {}, rule, usable[0].key);
  return budgetValid(lanes, filled, rule) ? filled : undefined;
}

/** Move the cursor within the lanes (no wrap — a rail, not a carousel). */
export function stepFocus(lanes: ReadonlyArray<BudgetLane>, index: number, delta: number): number {
  if (lanes.length === 0) {
    return 0;
  }
  return Math.min(lanes.length - 1, Math.max(0, index + delta));
}
