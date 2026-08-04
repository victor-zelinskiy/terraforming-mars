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
import {ActionEffect, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import type {SelectCardModel} from '@/common/models/PlayerInputModel';
import type {Units} from '@/common/Units';
import type {ComposerChoice, RepeatComposed} from '@/client/console/consoleActionComposer';
import {repeatActionResponses} from '@/client/console/consoleActionComposer';
import type {GlyphControl} from '@/client/gamepad/glyphSets';

// The premium payment PRESENTATION model lives in the SHARED `paymentPlan`
// module so EVERY payment surface (card play, blue action, standalone
// SelectPayment task, colony trade) speaks one payment language — neither
// composer owns it, so they cannot drift. Re-exported here for the play
// composer + its spec, which import it from this module by history.
export {buildPaymentView, editableRows, quickAdjustRow, paymentUnitLabel} from '@/client/console/paymentPlan';
export type {PaymentSourceRow, PaymentStatus, PaymentStatusKind, PaymentView} from '@/client/console/paymentPlan';

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
  /**
   * A REPEAT-ACTION source (ProjectInspection): after the play, the chosen
   * already-used action's card pick + its composed responses. Appended as the
   * batch TAIL so the whole submit reads `[play, {card:chosen}, ...composed]`.
   */
  repeat?: {chosenCard: CardName, composed: RepeatComposed};
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
  // Repeat-action tail (ProjectInspection): the chosen action's card pick +
  // its own composed responses, resolved by the repeat pick surface.
  if (args.repeat !== undefined) {
    responses.push(...repeatActionResponses(args.repeat.chosenCard, args.repeat.composed));
  }
  return responses;
}

// ── Choice classification (which surface hosts a pre-select choice) ──────────

/**
 * HOW the play composer serves one pre-select choice:
 *  - `inline`       — hosted in the composer itself (a sub-list / stepper);
 *  - `handPick`     — handed to the HAND SECTION's pick mode (every candidate
 *                     is a hand card — single AND multi-select, Public Plans);
 *  - `playedTarget` — the EMBEDDED played-card target step (every candidate is
 *                     already on SOME player's table): the single «point at one
 *                     card» ask, the server's merged up-to-N ask (Astra
 *                     Mechanica `mergeCardSteps`) and the deduped sequential
 *                     picks (Cyberia `dedupeFromSteps`) alike;
 *  - `repeat`       — a "repeat an already-used action" pick (ProjectInspection):
 *                     hosted by the ДЕЙСТВИЯ КАРТ list surface in repeat mode
 *                     (`consoleRepeatPick`), pre-collected as the chosen action +
 *                     its composed responses;
 *  - `followup`     — an honest post-submit follow-up (a candidate-less pick the
 *                     live play auto-resolves, a multi-select whose candidates
 *                     the console doesn't own).
 *
 * (`tableauPick` is GONE. It handed the pick to the «Разыграно» view, which
 * lifted the real table cards — physical, but it took the player out of the
 * workspace that asked the question and gave them a whole tableau to find two
 * legal targets in. Both composers now descend into the embedded step instead,
 * and «Разыграно» is a BROWSING surface only.)
 */
export type PlayChoiceMode = 'inline' | 'handPick' | 'playedTarget' | 'repeat' | 'followup';

/**
 * `playedNames` = every card on ANY player's table.
 *
 * THE BOUNDARY IS A CAPABILITY, NOT AN OWNER. A pick that points at a card
 * already on the table — whoever owns it — is what the EMBEDDED played-target
 * step exists for. Routing by owner instead was the bug this ordering fixed:
 * Robotic Workforce («Промышленные роботы») targets the viewer's OWN buildings,
 * so an own-table-first check sent the flagship case straight back to the old
 * lift-out-of-the-tableau surface and the new step never appeared.
 */
export function playChoiceMode(
  c: ComposerChoice,
  handNames: ReadonlySet<string>,
  playedNames: ReadonlySet<string>,
  /**
   * The card being PLAYED right now, when there is one.
   *
   * It is still sitting in `cardsInHand` while its play preview is open, which
   * is what made a card whose on-play effect legally targets ITSELF (Titan
   * Floating Launch-pad adds its own two floaters; Jovian Lanterns likewise)
   * read as «every candidate is in hand» and get sent to the HAND screen — which
   * then said «нет карт на руке», because the card being played is not offered
   * there. It cannot be a HAND target of its own on-play effect: by the time the
   * effect resolves the card is on the table, which is exactly where the player
   * must be pointed.
   */
  playedCardName?: string,
): PlayChoiceMode {
  if (c.repeatAction === true) {
    return 'repeat';
  }
  if (c.input.type === 'card') {
    const model = c.input as SelectCardModel;
    // Nothing selectable (e.g. Public Plans with an otherwise-empty hand) —
    // the live play auto-resolves; a dead un-answerable row would deadlock.
    if (model.cards.length === 0) {
      return 'followup';
    }
    const candidates = [...model.cards, ...(model.disabledCards ?? [])];
    // SELECTABLE is the discriminator, not mere presence. Sponsored Academies
    // also lists the card being played — as a DISABLED row reading «эта карта
    // разыгрывается» — and that prompt really is about the hand. Only a card
    // being played that is genuinely CHOOSABLE is choosable as a table object.
    const selfTarget = playedCardName !== undefined &&
      model.cards.some((cd) => cd.name === playedCardName);
    const isSelf = (name: string) => selfTarget && name === playedCardName;
    if (candidates.every((cd) => handNames.has(cd.name) && !isSelf(cd.name))) {
      return 'handPick';
    }
    // Cards already ON THE TABLE, whoever owns them → the embedded step. Not
    // limited to single selection: the step hosts the server's merged up-to-N
    // ask too. The card being played joins them: it is one press away from
    // being a table card, and it is the target the player is looking at.
    if (candidates.every((cd) => playedNames.has(cd.name) || isSelf(cd.name))) {
      return 'playedTarget';
    }
    // Candidates the console doesn't own a surface for (SRR-hosted cards):
    // a single pick stays an inline sub-list; a multi-select keeps the
    // honest follow-up.
    return model.max <= 1 ? 'inline' : 'followup';
  }
  if (c.kind === 'amount' || c.kind === 'player' || c.kind === 'or' || c.kind === 'spendHeat') {
    return 'inline';
  }
  return 'followup';
}

// ── Copied-production fold (Cyberia Systems / Robotic Workforce) ─────────────

/** The six standard production resources, in chip order. */
const STANDARD_PROD_RESOURCES = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;

/**
 * Fold the production COPIED by the answered "copy production box" steps into
 * the branch's base effect chips — desktop `resultEffects` parity: ONE chip per
 * resource (`current → resulting`, base production effects + copied deltas
 * summed), non-production base chips passing through unchanged. So the RESULT
 * shows EXACTLY what the chosen cards copy and updates LIVE on a re-pick.
 * Returns `undefined` when NO copy step is answered yet — the caller keeps the
 * base effects (no behaviour change for every non-copy card).
 */
export function foldCopiedProductionEffects(
  branch: ActionPreviewBranch,
  capturedCardName: (stepIndex: number) => string | undefined,
  playerProduction: (res: string) => number,
): ReadonlyArray<ActionEffect> | undefined {
  const copied: Record<string, number> = {};
  let hasCopy = false;
  branch.steps.forEach((step, i) => {
    if (step.kind !== 'input' || step.copyProductionBox === undefined) {
      return;
    }
    const name = capturedCardName(i);
    const box: Partial<Units> | undefined = name !== undefined ? step.copyProductionBox[name as CardName] : undefined;
    if (box === undefined) {
      return;
    }
    hasCopy = true;
    for (const res of STANDARD_PROD_RESOURCES) {
      const v = box[res] ?? 0;
      if (v !== 0) {
        copied[res] = (copied[res] ?? 0) + v;
      }
    }
  });
  if (!hasCopy) {
    return undefined;
  }
  const totals: Record<string, number> = {...copied};
  const currentByRes: Record<string, number> = {};
  const passthrough: Array<ActionEffect> = [];
  for (const e of branch.effects) {
    if (e.note === 'production' && (STANDARD_PROD_RESOURCES as ReadonlyArray<string>).includes(e.icon)) {
      totals[e.icon] = (totals[e.icon] ?? 0) + (e.direction === 'gain' ? e.amount : -e.amount);
      if (e.current !== undefined) {
        currentByRes[e.icon] = e.current;
      }
    } else {
      passthrough.push(e);
    }
  }
  const prodChips: Array<ActionEffect> = [];
  for (const res of STANDARD_PROD_RESOURCES) {
    const delta = totals[res] ?? 0;
    if (delta === 0) {
      continue;
    }
    const current = currentByRes[res] ?? playerProduction(res);
    prodChips.push({
      direction: delta >= 0 ? 'gain' : 'cost',
      icon: res,
      amount: Math.abs(delta),
      current,
      resulting: current + delta,
      note: 'production',
    });
  }
  return [...prodChips, ...passthrough];
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

/** Which kind of row the cursor is on, as far as A is concerned. */
export type PlayFocusTarget = 'cta' | 'picker' | 'other' | 'none';

/**
 * THE A-BUTTON VERB for the FOCUSED row — one decision, in one place.
 *
 * A always acts on the focused row, so its verb has to be honest about what
 * will happen: «Разыграть» ONLY on the commit rail, «Выбрать»/«Изменить» on a
 * pick, «Далее» on a variant or a stepper. This lived inside the composer
 * component, where nothing could test it and where the ROW's own affordance was
 * free to disagree with the command bar — and did: an answered target row drew
 * a dimmed «Ⓐ Изменить выбор» while the cursor sat on the commit rail, so the
 * screen showed two Ⓐ verbs and only one of them was true. Dimming does not
 * make a promise smaller. Both readers now come from here.
 */
export function playPrimaryVerb(ctx: {
  focused: PlayFocusTarget,
  /** For a `picker` row: does it already hold an answer? */
  pickAnswered?: boolean,
  primary: PrimaryActionState,
}): {label: string, enabled: boolean} {
  if (ctx.focused === 'cta') {
    switch (ctx.primary.kind) {
    case 'ready': return {label: 'Play now', enabled: true};
    case 'blocked-payment': return {label: 'Configure payment', enabled: true};
    case 'need-preselect': return {label: 'Choose an option', enabled: true};
    // Unplayable: nothing A can do here — the CTA itself carries the reason.
    case 'blocked-requirement': return {label: 'Play now', enabled: false};
    }
  }
  if (ctx.focused === 'picker') {
    return {label: ctx.pickAnswered === true ? 'Change' : 'Select', enabled: true};
  }
  // A variant / amount / spend-heat row: A proceeds toward the play CTA.
  return {label: 'Next', enabled: true};
}

// ── Contextual footer command bar (the ONE bottom action bar) ───────────────

export type FootHint = {control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean, spread?: boolean, badge?: number, highlight?: boolean};

/** The focused review row's KIND — drives which local verb the footer offers. */
export type PlayFocusKind = 'variant' | 'amount' | 'spendHeat' | 'pick' | 'none';

export type PlayFootContext = {
  /** The active sub-state (a list pick / the payment lanes), or none = review. */
  sub: 'none' | 'list' | 'payment' | 'playedTarget';
  /** When `sub === 'list'`: the list is a CARD list (X = inspect the card). */
  subIsCardList: boolean;
  /** When `sub === 'playedTarget'`: the step is in TABBED owner mode, so LB/RB
   *  own the owner axis (in split view the d-pad crosses between groups). */
  targetOwnerTabs?: boolean;
  /** When `sub === 'playedTarget'` and the ask is the server's merged up-to-N:
   *  the live accumulation, so the bar can offer RT with an honest badge. */
  targetMulti?: {count: number, valid: boolean, verb: string};
  /** There are navigable pre-select rows (show the Navigate hint). */
  hasRows: boolean;
  /** The focused review row's kind (only meaningful when `sub === 'none'`). */
  focusedKind: PlayFocusKind;
  /** The card accepts a NON-M€ payment mix — LT opens the payment lanes. */
  configurablePayment: boolean;
  paymentReady: boolean;
  /**
   * The A-button verb + enabled for the FOCUSED row (the component decides it):
   * «Разыграть» on the play CTA, «Изменить»/«Выбрать» on a pick, «Далее» on a
   * variant/stepper. A always acts on the FOCUSED row — it only plays when the
   * player is on the explicit CTA — so A can never be mistaken for "change" and
   * silently play instead.
   */
  primaryLabel: string;
  primaryEnabled: boolean;
  /**
   * When set, the INLINE quick-adjust owns LB/RB in review (the simple one-alt-
   * resource payment) — split LB/RB hints with per-side enabled so a dead button
   * never appears. Absent when a focused stepper owns LB/RB, or there's no
   * quick-adjust (complex / auto payment).
   */
  quickAdjust?: {canDecrease: boolean, canIncrease: boolean};
};

/**
 * The footer is fully CONTEXTUAL: LB/RB (−1/+1) and RT (MAX) appear ONLY where a
 * value can actually be dialed — a focused amount stepper, the inline payment
 * quick-adjust, or inside the payment lanes. LT «Configure payment» appears ONLY
 * when the payment is configurable (never for pure-AUTO M€). A is the ONE smart
 * primary action. No dead LB/RB/RT/LT ever appears — unit-tested, not eyeballed.
 */
export function playComposerFootHints(ctx: PlayFootContext): Array<FootHint> {
  if (ctx.sub === 'payment') {
    // The EXPANDED payment editor — the same block, opened. The way back is
    // offered on BOTH the trigger that opened it and B, so the density switch
    // is a toggle the player can never get stuck inside.
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'bumperL', control2: 'bumperR', label: '−1 / +1'},
      {control: 'triggerR', label: 'MAX'},
      {control: 'confirm', label: 'Done', enabled: ctx.paymentReady},
      {control: 'triggerL', label: 'Back to quick payment'},
      {control: 'back', label: 'Back'},
    ];
  }
  if (ctx.sub === 'playedTarget') {
    // The embedded played-target step. LB/RB appear ONLY in tabbed mode — in
    // split view both owner groups are on screen and the d-pad crosses between
    // them spatially, so advertising the bumpers there would offer a second
    // way to do what the stick already does.
    const hints: Array<FootHint> = [{control: 'dpad', label: 'Navigate'}];
    if (ctx.targetOwnerTabs === true) {
      hints.push({control: 'bumperL', control2: 'bumperR', label: 'Player', spread: true});
    }
    if (ctx.targetMulti !== undefined) {
      // The merged up-to-N ask: A accumulates, RT submits — the same grammar
      // the hand's multi pick and the patent sale already speak, so a stray A
      // can never send a half-built selection.
      hints.push({control: 'confirm', label: 'Select / Deselect'});
      hints.push({control: 'triggerR', label: ctx.targetMulti.verb, enabled: ctx.targetMulti.valid, badge: ctx.targetMulti.count, highlight: ctx.targetMulti.count > 0});
    } else {
      hints.push({control: 'confirm', label: 'Select'});
    }
    hints.push({control: 'secondary', label: 'Inspect'});
    hints.push({control: 'back', label: 'Back'});
    return hints;
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
  } else if (ctx.quickAdjust !== undefined) {
    // Inline payment quick-adjust — split so each side reflects its own limit.
    hints.push({control: 'bumperL', label: '−1', enabled: ctx.quickAdjust.canDecrease});
    hints.push({control: 'bumperR', label: '+1', enabled: ctx.quickAdjust.canIncrease});
  }
  // A acts on the FOCUSED row (its verb is `primaryLabel`); it plays ONLY on the
  // explicit CTA row. Y is deliberately NOT used here — it is globally reserved
  // for the information panel.
  hints.push({control: 'confirm', label: ctx.primaryLabel, enabled: ctx.primaryEnabled});
  if (ctx.configurablePayment) {
    hints.push({control: 'triggerL', label: 'Configure payment'});
  }
  hints.push({control: 'secondary', label: 'Inspect'});
  hints.push({control: 'back', label: 'Cancel'});
  return hints;
}
