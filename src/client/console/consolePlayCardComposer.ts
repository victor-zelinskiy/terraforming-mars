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
import type {GlyphControl} from '@/client/gamepad/glyphSets';

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

// ── Contextual footer command bar (the ONE bottom action bar) ───────────────

export type FootHint = {control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean};

/** The focused review row's KIND — drives which local verb the footer offers. */
export type PlayFocusKind = 'variant' | 'amount' | 'spendHeat' | 'pick' | 'payment' | 'play' | 'none';

export type PlayFootContext = {
  /** The active sub-state (a list pick / the payment lanes), or none = review. */
  sub: 'none' | 'list' | 'payment';
  /** When `sub === 'list'`: the list is a CARD list (X = inspect the card). */
  subIsCardList: boolean;
  /** The focused review row's kind (only meaningful when `sub === 'none'`). */
  focusedKind: PlayFocusKind;
  /** The card accepts a NON-M€ payment mix (else pure AUTO M€ — no lanes to dial). */
  hasPaymentLanes: boolean;
  canConfirm: boolean;
  paymentReady: boolean;
};

/**
 * The footer is fully CONTEXTUAL: LB/RB (−1/+1) and RT (MAX) appear ONLY where a
 * value can actually be dialed — a focused amount stepper or inside the payment
 * lanes. A pure-AUTO payment (no non-M€ lanes) never shows a payment verb, and
 * no dead LB/RB/RT ever appears. This is the source of truth so the "no dead
 * hints" contract is unit-tested, not just eyeballed.
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
  const hints: Array<FootHint> = [{control: 'dpad', label: 'Navigate'}];
  switch (ctx.focusedKind) {
  case 'amount':
    hints.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'}, {control: 'triggerR', label: 'MAX'});
    break;
  case 'spendHeat':
    hints.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'});
    break;
  case 'variant':
  case 'pick':
    hints.push({control: 'confirm', label: 'Select'});
    break;
  case 'payment':
    if (ctx.hasPaymentLanes) {
      hints.push({control: 'confirm', label: 'Payment'});
    }
    break;
  case 'play':
    hints.push({control: 'confirm', label: 'Play now', enabled: ctx.canConfirm});
    break;
  case 'none':
    break;
  }
  hints.push({control: 'secondary', label: 'Inspect'});
  hints.push({control: 'back', label: 'Cancel'});
  return hints;
}
