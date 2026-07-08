/*
 * CONSOLE PLAY-CARD COMPOSER — the PURE batch builder behind
 * ConsolePlayCardConfirm.vue (the console-native replacement for the bare
 * play confirm).
 *
 * Desktop-parity contract (mirrors HandCardPaymentContent's PlayCardPayload +
 * PlayerHome.submitPlayCardBatch — audited, not guessed): the play modal
 * pre-collects EVERY interactive choice BEFORE the one final submit — the
 * card's PAYMENT, `preview.preSteps` (heat-source spend), the BRANCH pick
 * (an on-play `behavior.or` variant like Artificial Photosynthesis), the
 * branch's direct `optionInput`, and every `branch.steps` entry of
 * `kind:'input'` (card / player / amount / or). Board placements / notes /
 * reveals stay a post-submit native follow-up — exactly like desktop.
 *
 * The final batch is BYTE-IDENTICAL to `submitPlayCardBatch`:
 *   [wrapped {type:'projectCard', card, payment}, ...preResponses,
 *    <branch slot>, ...stepResponses]
 * where the branch slot is
 *   branchIndex >= 0 → {type:'or', index: branchIndex, response: optionResponse ?? {type:'option'}}
 *   branchIndex < 0 && optionResponse !== undefined → the BARE optionResponse
 *   else nothing.
 * The ONLY structural difference from `buildActionBatch` is the FIRST element
 * (the projectCard-play response, which also carries the payment) — everything
 * after is the same shared shape, so the choice/step model is reused verbatim
 * from `consoleActionComposer.ts`.
 *
 * No Vue / DOM / i18n. Unit-tested under the mochapack runner
 * (tests/client/components/console/consolePlayCardComposer.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import type {SpendableResource} from '@/common/inputs/Spendable';
import type {GlyphControl} from '@/client/gamepad/glyphSets';
import type {PaymentLane} from '@/client/console/paymentPlan';

export type PlayCardBatchArgs = {
  /**
   * The action-menu OR path to the `Play project card` option (root → the
   * projectCard SelectCard). EMPTY for the mandatory play-from-hand prompt
   * (EccentricSponsor / EcologyExperts), where the projectCard prompt is
   * top-level and the response is bare.
   */
  playPath: ReadonlyArray<number>;
  cardName: CardName;
  /** The full Payment mix (byte-parity: every spendable key present). */
  payment: Payment;
  /** The selected branch's server runtime index (-1 = no branch pick). */
  branchIndex: number;
  /** preSteps responses, in preSteps order (heat-source spend). */
  preResponses: ReadonlyArray<unknown>;
  /** The branch optionInput's RAW response (nested into the branch or-wrap). */
  optionResponse: unknown | undefined;
  /** Input-step responses, compacted, in branch.steps order. */
  stepResponses: ReadonlyArray<unknown>;
};

export function buildPlayCardBatch(args: PlayCardBatchArgs): Array<unknown> {
  const responses: Array<unknown> = [];
  // The play pick itself, wrapped in the action-menu OR path (empty path → bare).
  let play: unknown = {type: 'projectCard' as const, card: args.cardName, payment: args.payment};
  for (let i = args.playPath.length - 1; i >= 0; i--) {
    play = {type: 'or' as const, index: args.playPath[i], response: play};
  }
  responses.push(play);
  // PRE-branch responses replay BEFORE the branch — the live play fires them
  // before the on-play effect's own choice (parity with the action composer).
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

// ── Smart PRIMARY ACTION state machine (the A button, focus-independent) ─────

/**
 * The A button is the ONE smart primary action of the whole play-card screen —
 * its behaviour is derived from this explicit state, NOT from which DOM row
 * happens to be focused:
 *  - `ready`               → A PLAYS the card (all pre-select resolved, payment valid);
 *  - `need-preselect`      → A leads the player to the first UNRESOLVED choice
 *                            (`rowIndex` is the nav-row to focus + open);
 *  - `blocked-payment`     → A opens the payment lanes so the mix can be fixed;
 *  - `blocked-requirement` → A does nothing (the card can't be played) + a reason.
 * The CTA label, the footer A-verb and the disabled state all flow from here.
 */
export type PrimaryActionState =
  | {kind: 'ready'}
  | {kind: 'need-preselect', rowIndex: number}
  | {kind: 'blocked-payment'}
  | {kind: 'blocked-requirement', reason: string};

export function computePrimaryAction(ctx: {
  /** A branch is selected AND available (or the implicit single-branch). */
  branchSelectable: boolean,
  paymentReady: boolean,
  /** The nav-row index of the first uncaptured pre-select step (undefined = all done). */
  firstUnresolvedStepRowIndex: number | undefined,
  /** i18n key for the `blocked-requirement` reason (default: a generic one). */
  requirementReason?: string,
}): PrimaryActionState {
  if (!ctx.branchSelectable) {
    return {kind: 'blocked-requirement', reason: ctx.requirementReason ?? 'Unavailable right now'};
  }
  if (!ctx.paymentReady) {
    return {kind: 'blocked-payment'};
  }
  if (ctx.firstUnresolvedStepRowIndex !== undefined) {
    return {kind: 'need-preselect', rowIndex: ctx.firstUnresolvedStepRowIndex};
  }
  return {kind: 'ready'};
}

// ── Payment resource chips (unified with the result chips: было → стало) ─────

const STANDARD_PAY_UNITS: ReadonlySet<string> =
  new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);

/**
 * The payment mix as `ActionEffect` COST chips (icon + spent amount + a
 * `current → resulting` stock readout for standard resources) — the SAME chip
 * the result uses, so payment reads "[M€] −8  19 → 11" / "[Steel] −2  2 → 0"
 * instead of a bare "8 M€ + 2 Сталь" text. A special payment resource (paid off
 * a card — microbes / floaters / …) has no single stock field, so it shows just
 * the signed amount. Only resources actually spent (> 0) get a chip.
 */
export function paymentChips(args: {
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  /** The auto-computed M€ portion of the payment. */
  mcSpent: number,
  /** Current stock per unit (megacredits/steel/titanium/plants/energy/heat). */
  stock: Partial<Record<string, number>>,
}): Array<ActionEffect> {
  const out: Array<ActionEffect> = [];
  const push = (unit: string, spent: number): void => {
    if (spent <= 0) {
      return;
    }
    const cur = args.stock[unit];
    if (STANDARD_PAY_UNITS.has(unit) && cur !== undefined) {
      out.push({direction: 'cost', icon: unit, amount: spent, current: cur, resulting: Math.max(0, cur - spent)});
    } else {
      out.push({direction: 'cost', icon: unit, amount: spent});
    }
  };
  push('megacredits', args.mcSpent);
  for (const lane of args.lanes) {
    push(lane.unit, args.counts[lane.unit] ?? 0);
  }
  return out;
}

// ── Contextual footer command bar (the ONE bottom action bar) ───────────────

export type FootHint = {control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean};

/** The focused review row's KIND — drives which local verb the footer offers. */
export type PlayFocusKind = 'variant' | 'amount' | 'spendHeat' | 'pick' | 'none';

export type PlayFootContext = {
  /** The active sub-state (a list pick / the payment lanes), or none = review. */
  sub: 'none' | 'list' | 'payment';
  /** When `sub === 'list'`: the list is a CARD list (X = inspect the card). */
  subIsCardList: boolean;
  /** There are navigable pre-select rows (show the Navigate hint). */
  hasRows: boolean;
  /** The focused review row's kind (only meaningful when `sub === 'none'`). */
  focusedKind: PlayFocusKind;
  /** The card accepts a NON-M€ payment mix — LT opens the payment lanes. */
  configurablePayment: boolean;
  paymentReady: boolean;
  /** The A-button verb + enabled, decided by the component from the primary state. */
  primaryLabel: string;
  primaryEnabled: boolean;
};

/**
 * The footer is fully CONTEXTUAL: LB/RB (−1/+1) and RT (MAX) appear ONLY where a
 * value can actually be dialed — a focused amount stepper or inside the payment
 * lanes. LT «Configure payment» appears ONLY when the payment is configurable
 * (never for pure-AUTO M€). A is the ONE smart primary action (verb from the
 * primary state). No dead LB/RB/RT/LT ever appears — unit-tested, not eyeballed.
 */
export function playComposerFootHints(ctx: PlayFootContext): Array<FootHint> {
  if (ctx.sub === 'payment') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'bumperL', control2: 'bumperR', label: '−1 / +1'},
      {control: 'triggerR', label: 'MAX'},
      {control: 'confirm', label: 'Done', enabled: ctx.paymentReady},
      {control: 'back', label: 'Back'},
    ];
  }
  if (ctx.sub === 'list') {
    const hints: Array<FootHint> = [{control: 'dpad', label: 'Navigate'}, {control: 'confirm', label: 'Select'}];
    if (ctx.subIsCardList) {
      hints.push({control: 'secondary', label: 'Inspect'});
    }
    hints.push({control: 'back', label: 'Back'});
    return hints;
  }
  const hints: Array<FootHint> = [];
  if (ctx.hasRows) {
    hints.push({control: 'dpad', label: 'Navigate'});
  }
  if (ctx.focusedKind === 'amount') {
    hints.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'}, {control: 'triggerR', label: 'MAX'});
  } else if (ctx.focusedKind === 'spendHeat') {
    hints.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'});
  }
  hints.push({control: 'confirm', label: ctx.primaryLabel, enabled: ctx.primaryEnabled});
  if (ctx.configurablePayment) {
    hints.push({control: 'triggerL', label: 'Configure payment'});
  }
  hints.push({control: 'secondary', label: 'Inspect'});
  hints.push({control: 'back', label: 'Cancel'});
  return hints;
}
