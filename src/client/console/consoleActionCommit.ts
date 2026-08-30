/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ACTION COMMIT — the ONE universal activation beat of a card action
 * (docs/CONSOLE_BLUE_ACTION_PARITY.md, iteration 19; NORTH STAR:
 * docs/claude/console/workspace-band.md § ACTION COMMIT).
 *
 * Between «A Подтвердить» and the result there is a short, systemic moment:
 * the button presses, the SOURCE CARD mechanically fixes the activation, an
 * impulse runs through the SELECTED action graphic and lands on its result
 * icon, and only then the result animation takes over. The commit never
 * depicts the result — it fixes the boundary «настраивал → активировал».
 *
 * This module owns the unit-testable half: the commit lifecycle state (the
 * min-beat gate a fast server must not cut short, the abort a rejected submit
 * must release) and the PLAN — the normalized visual description of the
 * result the shell's handoff consumes (reward specs + per-icon origin points
 * CACHED AT SUBMIT TIME, so the reward wave never depends on the workspace
 * still being mounted when the answer lands). The DOM/GSAP half lives in
 * consoleActionCommitMotion.ts; game logic stays in the existing systems.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionEffect, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {
  ResourceTransferSpec, TransferPoint, extractPlayRewards, isStandardResource, mergeTransferSpecs,
} from '@/client/console/resourceTransfer/resourceTransferModel';

/**
 * The RESULT CATEGORY the commit hands off to. One systemic commit language;
 * only the handoff differs:
 *  - `deck-check` / `draw` — the impulse ends on the card-draw icon and the
 *    HUD deck answers; the existing physical draw beat follows.
 *  - `resources` — the reward wave (resource-transfer framework) materializes
 *    chips FROM the action graphic's own icons into the rail rows.
 *  - `tile` — the impulse ends on the tile icon; the board takes priority
 *    through the existing placement flow.
 *  - `global` — the impulse ends on the parameter icon; the existing HUD /
 *    scale animations carry the change.
 *  - `generic` — the mechanical commit alone (no addressable large result).
 */
export type ActionCommitKind = 'deck-check' | 'draw' | 'resources' | 'tile' | 'global' | 'generic';

/**
 * The normalized handoff plan, built and MEASURED at submit time. `origins`
 * aligns to `specs` by index (the resource-transfer contract): each reward
 * chip is born at ITS OWN icon inside the action graphic. `sourcePoint` is
 * the card-level fallback for a spec whose icon could not be resolved.
 */
export type ActionCommitPlan = {
  sourceCard: CardName;
  kind: ActionCommitKind;
  specs: ReadonlyArray<ResourceTransferSpec>;
  origins: ReadonlyArray<TransferPoint | undefined>;
  sourcePoint?: TransferPoint;
};

/**
 * The commit lifecycle. `active`/`settled` mirror the draw beat's
 * answerIn/beatDone shape (consoleWorkspaceOutcome): the beat owes its
 * minimum time from the CONFIRM, so a fast server answer cannot cut it —
 * the shell holds the dismiss while `actionCommitHolding()`.
 */
export const actionCommitState = reactive({
  /** Armed at submit; released by settle/abort/reset. */
  active: false,
  /** The visual beat has played out (or reduced-motion resolved it). */
  settled: true,
  /**
   * Bumped when a submitted action is REJECTED (server error) — the composer
   * watches this to drop its `submitting` lock and return to the editable
   * state (the premium rollback: nothing stays falsely activated).
   */
  abortNonce: 0,
  /** The pending handoff plan (consumed once by the shell's resolution). */
  plan: undefined as ActionCommitPlan | undefined,
});

/**
 * Backstop only: the settle must never gate the flow forever if the motion
 * episode dies without its callback (a torn-down stage, a stalled timeline in
 * a backgrounded tab). Deliberately short — the healthy beat settles ≈0.7 s,
 * so anything past ~1.4 s is already a failure, and failing fast turns a
 * broken beat into a slightly abrupt one instead of a hang.
 */
const SETTLE_SAFETY_MS = 1400;

let settleTimer: ReturnType<typeof setTimeout> | undefined;

function clearSettleTimer(): void {
  if (settleTimer !== undefined) {
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }
}

/** Arm the commit at submit (synchronous — before the response can land). */
export function armActionCommit(plan: ActionCommitPlan): void {
  actionCommitState.active = true;
  actionCommitState.settled = false;
  actionCommitState.plan = plan;
  clearSettleTimer();
  if (typeof setTimeout === 'function') {
    settleTimer = setTimeout(() => {
      settleTimer = undefined;
      markActionCommitSettled();
    }, SETTLE_SAFETY_MS);
  } else {
    actionCommitState.settled = true;
  }
}

/** The visual beat finished (the motion's own completion, or the backstop). */
export function markActionCommitSettled(): void {
  clearSettleTimer();
  actionCommitState.settled = true;
}

/** Is the minimum readable commit still owed? (The shell's dismiss gate.) */
export function actionCommitHolding(): boolean {
  return actionCommitState.active && !actionCommitState.settled;
}

/** Take the handoff plan (one consumer — the shell's awaiting resolution). */
export function consumeActionCommitPlan(): ActionCommitPlan | undefined {
  const plan = actionCommitState.plan;
  actionCommitState.plan = undefined;
  return plan;
}

/** The action resolved (result handed off / dismissed) — release the beat. */
export function releaseActionCommit(): void {
  clearSettleTimer();
  actionCommitState.active = false;
  actionCommitState.settled = true;
  actionCommitState.plan = undefined;
}

/**
 * The submitted action was REJECTED — the premium rollback. Releases every
 * commit hold and tells the composer (via `abortNonce`) to drop its
 * `submitting` lock so the workspace returns to a safe, editable state with
 * the player's captures intact. Never starts a result animation.
 */
export function abortConsoleActionCommit(): void {
  releaseActionCommit();
  actionCommitState.abortNonce++;
}

/** Full reset (game switch / spec cleanup). */
export function resetActionCommit(): void {
  releaseActionCommit();
  actionCommitState.abortNonce = 0;
}

// ── the pure plan builders ──────────────────────────────────────────────────

const GLOBAL_PARAM_ICONS: ReadonlySet<string> =
  new Set(['temperature', 'oxygen', 'venus', 'oceans', 'tr']);

/**
 * The premium chips of the options the player picked in this branch's OR steps
 * — the server's own `OptionMetadata.effects` for the outcome that was actually
 * chosen. The same fact `extractPlayRewards` reads to build the reward specs,
 * asked here for the CATEGORY.
 */
function chosenStepEffects(
  branch: ActionPreviewBranch,
  stepResponses: Readonly<Record<number, unknown>>,
): Array<ActionEffect> {
  const out: Array<ActionEffect> = [];
  (branch.steps ?? []).forEach((step, i) => {
    if (step.kind !== 'input' || step.input.type !== 'or') {
      return;
    }
    const r = stepResponses[i] as {type?: string, index?: number} | undefined;
    if (r === undefined || r.type !== 'or' || typeof r.index !== 'number') {
      return;
    }
    const opt = (step.input as OrOptionsModel).options[r.index] as
      {metadata?: {effects?: ReadonlyArray<ActionEffect>}} | undefined;
    out.push(...(opt?.metadata?.effects ?? []));
  });
  return out;
}

/**
 * The result CATEGORY of a branch — structural, from the same preview the
 * claim kinds derive from (never from the card's identity). Precedence
 * mirrors how large a result's own presentation is: a reveal/draw owns a
 * whole stage, a tile owns the board, a global owns the HUD scale, resources
 * own the rail wave; anything else keeps the mechanical commit alone.
 */
export function commitKindForBranch(
  branch: ActionPreviewBranch | undefined,
  /**
   * The captured step responses. A branch whose RESULT is chosen in a step
   * («получите любой стандартный ресурс» → titanium) states nothing in its own
   * chips — at preview time the resource does not exist yet — so without the
   * answers the category reads `generic` and the commit plays the mechanical
   * beat alone while the rail counters tick behind it, unexplained. The chosen
   * option's own chips join the pool; precedence is unchanged.
   */
  stepResponses: Readonly<Record<number, unknown>> = {},
): ActionCommitKind {
  if (branch === undefined) {
    return 'generic';
  }
  if (branch.reveal !== undefined) {
    return 'deck-check';
  }
  const effects = [...(branch.effects ?? []), ...chosenStepEffects(branch, stepResponses)];
  if (effects.some((e) => e.direction === 'gain' && e.icon === 'cards')) {
    return 'draw';
  }
  if ((branch.steps ?? []).some((s) => s.kind === 'boardPlacement')) {
    return 'tile';
  }
  if (effects.some((e) => e.direction === 'gain' && GLOBAL_PARAM_ICONS.has(e.icon))) {
    return 'global';
  }
  // A rail-bound gain (stock or production of a standard resource, or a
  // card-resource gain) → the reward wave / the transfer flows own the result.
  const railGain = effects.some((e) => e.direction === 'gain' && e.amount > 0 && e.unit === undefined &&
    (isStandardResource(e.icon) || e.note === 'on this card' || e.note === 'to a card'));
  return railGain ? 'resources' : 'generic';
}

/**
 * The reward specs the commit wave carries — the SAME extraction the
 * played-card beat uses (`extractPlayRewards`: server-computed preview
 * amounts, never client re-derivations). ALL THREE channels ride: the rail
 * wave (stock/production) AND the card-resource flight to the pre-selected
 * target — an action that puts animals on a card presents the same premium
 * transfer a card PLAY does (one language, every activation door: the
 * ДЕЙСТВИЯ КАРТ commit and the Hydronetwork repeat read this one builder).
 * The transfer framework resolves the landing honestly: the target's own
 * on-screen face when one is painted, else the additional-resources
 * satellite — never a silent counter jump with no flight.
 */
export function commitRewardSpecs(
  cardName: CardName,
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>>,
): Array<ResourceTransferSpec> {
  if (branch === undefined) {
    return [];
  }
  const all = extractPlayRewards({
    cardName,
    effects: branch.effects ?? [],
    steps: branch.steps ?? [],
    stepResponses,
  });
  return mergeTransferSpecs(all);
}
