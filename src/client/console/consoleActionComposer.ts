/*
 * CONSOLE ACTION COMPOSER — the PURE model behind ConsoleActionComposer.vue
 * (iteration 2 of the console Blue Card Action Center).
 *
 * Desktop parity contract (mirrors CardActionConfirmContent.vue +
 * PlayerHome.submitCardActionBatch — audited, not guessed):
 *
 *  - The confirm modal pre-collects EVERY interactive choice BEFORE the one
 *    final submit: `preview.preSteps` (Stormcraft spend-heat), the BRANCH pick
 *    (only when the render node resolves ambiguously — a combined-node card),
 *    the branch's direct `optionInput` (SelectAmount / SelectCard as the
 *    or-option itself), and every `branch.steps` entry of `kind:'input'`
 *    (card / player / amount / payment / or). Notes / board placements /
 *    reveals are DISPLAY-ONLY and ride the post-submit native flow — exactly
 *    like desktop.
 *
 *  - The final batch is BYTE-IDENTICAL to `submitCardActionBatch`:
 *      [wrapped activate pick, ...preStepResponses, <branch slot>, ...stepResponses]
 *    where the branch slot is
 *      branchIndex >= 0 → {type:'or', index: branchIndex, response: optionResponse ?? {type:'option'}}
 *      branchIndex < 0 && optionResponse !== undefined → the BARE optionResponse
 *      (the lone-available-branch auto-resolve — the live prompt is the direct
 *       input itself, no OrOptions wrapper), else nothing.
 *    A REPEAT-ACTION handoff (Viron) replaces the activate pick with the
 *    pre-built prefix `[wrapped activate of the OUTER card, {type:'card',
 *    cards:[chosen action card]}]` — mirroring `submitRepeatActionBatch`.
 *
 * No Vue / DOM / i18n. Unit-tested under the mochapack runner
 * (tests/client/components/console/consoleActionComposer.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {
  ActionPreview,
  ActionPreviewBranch,
  ActionPreviewStep,
} from '@/common/models/ActionPreviewModel';
import {
  AndOptionsModel,
  OrOptionsModel,
  PlayerInputModel,
  SelectAmountModel,
  SelectCardModel,
  SelectPaymentModel,
  SelectPlayerModel,
} from '@/common/models/PlayerInputModel';

// ── The choice model ─────────────────────────────────────────────────────────

/** Where a choice's captured response lands in the batch. */
export type ComposerScope = 'pre' | 'option' | 'step';

export type ComposerChoice = {
  /** Stable focus id (`pre#i` / `option` / `step#i`). */
  id: string;
  scope: ComposerScope;
  /** Index within its source list (preSteps / steps); -1 for the optionInput. */
  index: number;
  kind: 'spendHeat' | 'amount' | 'card' | 'player' | 'or' | 'payment' | 'other';
  input: PlayerInputModel;
  /** Signed per-target delta for a card-target step ("2 → 4 on the card"). */
  amount?: number;
  /** Icon key of the card resource an add/remove step moves. */
  cardResource?: string;
  /** The step's candidates are USED ACTIONS to perform again (Viron). */
  repeatAction?: boolean;
};

function choiceKind(input: PlayerInputModel): ComposerChoice['kind'] {
  switch (input.type) {
  case 'amount': return 'amount';
  case 'card': return 'card';
  case 'player': return 'player';
  case 'or': return 'or';
  case 'payment': return 'payment';
  default: return 'other';
  }
}

/** The pre-branch choices (branch-independent — captured once per preview). */
export function preChoices(preview: ActionPreview | undefined): Array<ComposerChoice> {
  const out: Array<ComposerChoice> = [];
  (preview?.preSteps ?? []).forEach((step, i) => {
    if (step.kind === 'spendHeat') {
      out.push({id: `pre#${i}`, scope: 'pre', index: i, kind: 'spendHeat', input: step.input});
    } else if (step.kind === 'input') {
      out.push({id: `pre#${i}`, scope: 'pre', index: i, kind: choiceKind(step.input), input: step.input});
    }
  });
  return out;
}

/** The selected branch's choices: the direct optionInput + every input step. */
export function branchChoices(branch: ActionPreviewBranch | undefined): Array<ComposerChoice> {
  if (branch === undefined) {
    return [];
  }
  const out: Array<ComposerChoice> = [];
  if (branch.optionInput !== undefined) {
    out.push({id: 'option', scope: 'option', index: -1, kind: choiceKind(branch.optionInput), input: branch.optionInput});
  }
  branch.steps.forEach((step, i) => {
    if (step.kind === 'input') {
      out.push({
        id: `step#${i}`,
        scope: 'step',
        index: i,
        kind: choiceKind(step.input),
        input: step.input,
        amount: step.amount,
        cardResource: step.cardResource,
        repeatAction: step.repeatAction,
      });
    } else if (step.kind === 'spendHeat') {
      out.push({id: `step#${i}`, scope: 'step', index: i, kind: 'spendHeat', input: step.input});
    }
  });
  return out;
}

/** Display-only "after confirming" steps (notes / board placements). */
export function afterConfirmSteps(branch: ActionPreviewBranch | undefined): Array<ActionPreviewStep> {
  return (branch?.steps ?? []).filter((s) => s.kind === 'note' || s.kind === 'boardPlacement');
}

// ── Confirm gating (mirror of CardActionConfirmContent.canConfirm) ──────────

export type ComposerCaptures = {
  /** By preSteps index. */
  pre: Readonly<Record<number, unknown>>;
  /** The branch optionInput's RAW response (un-wrapped). */
  option: unknown | undefined;
  /** By branch.steps index. */
  steps: Readonly<Record<number, unknown>>;
};

export function canConfirm(
  preview: ActionPreview | undefined,
  branch: ActionPreviewBranch | undefined,
  captures: ComposerCaptures,
): boolean {
  if (preview === undefined || branch === undefined || !branch.available) {
    return false;
  }
  const pres = preChoices(preview);
  if (!pres.every((c) => captures.pre[c.index] !== undefined)) {
    return false;
  }
  if (branch.optionInput !== undefined && captures.option === undefined) {
    return false;
  }
  return branch.steps.every((step, i) => step.kind !== 'input' || captures.steps[i] !== undefined);
}

/** The first missing decision (the honest disabled-confirm reason). */
export function firstMissingChoice(
  preview: ActionPreview | undefined,
  branch: ActionPreviewBranch | undefined,
  captures: ComposerCaptures,
): ComposerChoice | undefined {
  const pres = preChoices(preview);
  const missingPre = pres.find((c) => captures.pre[c.index] === undefined);
  if (missingPre !== undefined) {
    return missingPre;
  }
  if (branch === undefined) {
    return undefined;
  }
  const all = branchChoices(branch);
  return all.find((c) =>
    (c.scope === 'option' && captures.option === undefined) ||
    (c.scope === 'step' && captures.steps[c.index] === undefined));
}

// ── The final batch (byte-parity with submitCardActionBatch) ────────────────

export type ActionBatchArgs = {
  /** The `findPerformActionCard(waitingFor).path` OR-indices (root → SelectCard). */
  performPath: ReadonlyArray<number>;
  cardName: CardName;
  /**
   * REPEAT-ACTION prefix (Viron): replaces the activate pick entirely —
   * `[wrapped activate of the outer card, {type:'card', cards:[this card]}]`
   * (mirrors submitRepeatActionBatch: the inner card's activate is NOT re-wrapped).
   */
  prefix?: ReadonlyArray<unknown>;
  /** The selected branch's server runtime index (-1 = no branch pick). */
  branchIndex: number;
  /** preSteps responses, in preSteps order. */
  preResponses: ReadonlyArray<unknown>;
  /** The branch optionInput's RAW response (nested into the branch or-wrap). */
  optionResponse: unknown | undefined;
  /** Input-step responses, compacted, in branch.steps order. */
  stepResponses: ReadonlyArray<unknown>;
};

export function buildActionBatch(args: ActionBatchArgs): Array<unknown> {
  const responses: Array<unknown> = [];
  if (args.prefix !== undefined) {
    responses.push(...args.prefix);
  } else {
    let pick: unknown = {type: 'card' as const, cards: [args.cardName]};
    for (let i = args.performPath.length - 1; i >= 0; i--) {
      pick = {type: 'or' as const, index: args.performPath[i], response: pick};
    }
    responses.push(pick);
  }
  // PRE-branch responses replay BEFORE the branch — the live action fires them
  // before the effect resolves (Stormcraft heat).
  for (const r of args.preResponses) {
    responses.push(r);
  }
  if (args.branchIndex >= 0) {
    const branchResponse = args.optionResponse ?? {type: 'option' as const};
    responses.push({type: 'or' as const, index: args.branchIndex, response: branchResponse});
  } else if (args.optionResponse !== undefined) {
    // The lone available branch auto-resolved WITHOUT an OrOptions wrapper —
    // the live prompt is the direct input itself (bare, top-level).
    responses.push(args.optionResponse);
  }
  for (const r of args.stepResponses) {
    responses.push(r);
  }
  return responses;
}

/** Collect captured step responses in steps order (input steps only). */
export function orderedStepResponses(
  branch: ActionPreviewBranch,
  steps: Readonly<Record<number, unknown>>,
): Array<unknown> {
  const out: Array<unknown> = [];
  branch.steps.forEach((step, i) => {
    if (step.kind === 'input' && steps[i] !== undefined) {
      out.push(steps[i]);
    }
  });
  return out;
}

/** Collect captured preStep responses in preSteps order. */
export function orderedPreResponses(
  preview: ActionPreview,
  pre: Readonly<Record<number, unknown>>,
): Array<unknown> {
  const out: Array<unknown> = [];
  (preview.preSteps ?? []).forEach((_s, i) => {
    if (pre[i] !== undefined) {
      out.push(pre[i]);
    }
  });
  return out;
}

// ── spend-heat (Stormcraft) — the AndOptions of two SelectAmounts ────────────

export type SpendHeatPlan = {
  /** Total heat-value the action needs (the spendHeatPrompt marker). */
  target: number;
  /** Max heat payable from stock (options[0].max). */
  heatMax: number;
  /** Max floaters spendable (options[1].max). */
  floaterMax: number;
  /** The fewest floaters that still cover the target (the desktop default). */
  minFloaters: number;
};

export function spendHeatPlan(input: PlayerInputModel): SpendHeatPlan | undefined {
  if (input.type !== 'and') {
    return undefined;
  }
  const and = input as AndOptionsModel;
  const target = and.spendHeatPrompt?.amount;
  const heat = and.options[0];
  const floaters = and.options[1];
  if (target === undefined || heat?.type !== 'amount' || floaters?.type !== 'amount') {
    return undefined;
  }
  const heatMax = (heat as SelectAmountModel).max;
  const floaterMax = (floaters as SelectAmountModel).max;
  const minFloaters = Math.max(0, Math.ceil((target - heatMax) / 2));
  return {target, heatMax, floaterMax, minFloaters};
}

/** Heat from stock for a chosen floater count (floaters pay 2 heat each). */
export function spendHeatStock(plan: SpendHeatPlan, floaters: number): number {
  return Math.max(0, plan.target - floaters * 2);
}

export function spendHeatValid(plan: SpendHeatPlan, floaters: number): boolean {
  if (floaters < 0 || floaters > plan.floaterMax) {
    return false;
  }
  const stock = spendHeatStock(plan, floaters);
  return stock <= plan.heatMax && stock + floaters * 2 >= plan.target;
}

/** The byte-identical SpendHeatContent response (order load-bearing: heat, floaters). */
export function spendHeatResponse(plan: SpendHeatPlan, floaters: number): unknown {
  return {
    type: 'and' as const,
    responses: [
      {type: 'amount' as const, amount: spendHeatStock(plan, floaters)},
      {type: 'amount' as const, amount: floaters},
    ],
  };
}

// ── typed input views (narrowing helpers for the component) ─────────────────

export function asAmount(input: PlayerInputModel): SelectAmountModel | undefined {
  return input.type === 'amount' ? (input as SelectAmountModel) : undefined;
}

export function asCards(input: PlayerInputModel): SelectCardModel | undefined {
  return input.type === 'card' ? (input as SelectCardModel) : undefined;
}

export function asPlayers(input: PlayerInputModel): SelectPlayerModel | undefined {
  return input.type === 'player' ? (input as SelectPlayerModel) : undefined;
}

export function asOr(input: PlayerInputModel): OrOptionsModel | undefined {
  return input.type === 'or' ? (input as OrOptionsModel) : undefined;
}

export function asPayment(input: PlayerInputModel): SelectPaymentModel | undefined {
  return input.type === 'payment' ? (input as SelectPaymentModel) : undefined;
}

export function inputTitle(input: PlayerInputModel): string | Message {
  return input.title;
}
