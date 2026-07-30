/*
 * CONSOLE ACTION FLOW — the ONE vocabulary of the blue-card activation
 * workflow (docs/CONSOLE_BLUE_ACTION_PARITY.md; the ACTION FOCUS iteration).
 *
 * The player's journey is ONE continuous operation:
 *
 *   browse → focus → (pick) → focus → commit(awaiting) → result
 *
 * and every surface involved (the Action Browser grid, the in-frame ACTION
 * FOCUS stage, the hand/tableau pick bridges, the awaiting hold) already
 * keeps its own authoritative state. This module deliberately owns NO new
 * mutable state — duplicating those truths would let them drift. Instead it
 * NAMES the stages, derives the current one from the existing signals, and
 * builds the per-stage command-bar contracts as PURE functions, so the
 * lifecycle is explicit, testable, and the components can't disagree about
 * what stage the player is in.
 *
 * No Vue / DOM / i18n (labels are English i18n KEYS). Unit-tested under the
 * mochapack runner (tests/client/components/console/consoleActionFlow.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

// ── Stages ───────────────────────────────────────────────────────────────────

/**
 * The presentation stage of the action workflow:
 *  - `browse`     — the Action Browser grid owns the screen (filters live).
 *  - `focus`      — one action is being PREPARED in the in-frame focus stage
 *                   (filters yield; the draft is editable; B returns to browse).
 *  - `pick`       — a target pick is out at an existing picker surface
 *                   (hand / «Разыграно»); the focus stage is v-show-hidden and
 *                   its draft survives untouched.
 *  - `committing` — the batch is COMMITTED (awaiting the server's answer):
 *                   input is absorbed, nothing can re-fire or "cancel" it.
 */
export type ActionFlowStage = 'browse' | 'focus' | 'pick' | 'committing';

/**
 * The DRAFT identity of the operation being prepared: WHICH action variant
 * the focus stage is composing. The decision captures themselves (amounts /
 * targets / payment) live in the composer while it stays mounted — the pick
 * roundtrip never unmounts it, so they survive by construction.
 */
export type ActionFlowDraft = {
  cardName: CardName,
  nodeIndex: number,
  /** Repeat-action prefix (replaces the activate pick — the Viron handoff). */
  prefix?: ReadonlyArray<unknown>,
  /** The OUTER draft to restore when this (inner repeat) one cancels. */
  outer?: {cardName: CardName, nodeIndex: number},
};

/** Derive the stage from the existing authoritative signals (never stored). */
export function actionFlowStage(signals: {
  /** A draft is open (the focus stage is mounted). */
  draftOpen: boolean,
  /** A hand/tableau pick bridge is out. */
  pickActive: boolean,
  /** The submitted batch is awaiting the server (surface-motion hold). */
  awaiting: boolean,
}): ActionFlowStage {
  if (signals.draftOpen && signals.awaiting) {
    return 'committing';
  }
  if (signals.draftOpen && signals.pickActive) {
    return 'pick';
  }
  return signals.draftOpen ? 'focus' : 'browse';
}

// ── Focus-stage header ───────────────────────────────────────────────────────

/**
 * The PHASE the focus stage is presenting. This — and nothing else — names
 * the stage.
 *  - `setup`  — the action is being prepared (amounts, targets, payment) and
 *               launched from its own CTA. A CTA does NOT make the screen a
 *               separate «confirmation» step: setup and commit happen on one
 *               surface, so it keeps one honest name for its whole life.
 *  - `reveal` — the post-commit deck-check outcome is on stage.
 *  - `draw`   — the post-commit CARD DRAW is on stage: the cards are coming
 *               off the HUD deck into the stage's own reveal zone and the
 *               player takes them there. A distinct phase from `reveal`
 *               because nothing is being CHECKED — the outcome is the cards
 *               themselves, so «Результат вскрытия» would misname it.
 */
export type FocusPhase = 'setup' | 'reveal' | 'draw';

/**
 * The focus stage's kicker (i18n key), derived ONLY from the phase.
 *
 * It used to be derived from "does this action have decisions?" — a value
 * that depends on the ASYNC action preview, so the title changed one or two
 * frames into the entering animation («Настройка действия» → «Подтверждение»).
 * The phase is known before the transition episode starts and cannot change
 * during it, which makes that jump structurally impossible.
 */
export function focusKicker(phase: FocusPhase): string {
  switch (phase) {
  case 'reveal': return 'Reveal result';
  case 'draw': return 'Card draw';
  // «Настройка», not «Настройка действия»: the stage marker follows the fixed
  // «ДЕЙСТВИЯ КАРТ › <карта> ›» context, so repeating «действия» made the one
  // mutable word read as a third heading (and echoed the root). Off-workspace
  // references (the hand pick's context chip) keep the fuller 'Action setup'.
  default: return 'Setup';
  }
}

// ── Command-bar contracts (pure builders — the bar can never lie) ───────────

/** What kind of row the focus cursor is on (drives the A-verb). */
export type FocusRowKind =
  | 'amount' | 'spendHeat' // inline steppers: LB/RB adjust, A advances (Next)
  | 'branch' // a variant option card: A selects it
  | 'pick' // a card/player/or decision row: A opens (or re-opens) it
  | 'cta' // the confirm row: A commits
  | 'none'; // no decision rows at all (bare confirm)

export type FocusCommandCtx =
  /** The committed hold — input is absorbed; the bar shows the honest beat. */
  | {state: 'awaiting'}
  /** The reveal phase, card still face down (flight / flip in progress). */
  | {state: 'reveal-pending'}
  /** The reveal outcome is on screen — acknowledge / inspect. */
  | {state: 'reveal-shown'}
  /**
   * The DRAW phase, cards still travelling from the HUD deck. Post-commit and
   * pre-arrival: nothing to press yet, and nothing to cancel.
   *
   * There is deliberately no `draw-shown` here: once the cards have landed the
   * contract belongs to the reveal component itself, so the stage forwards the
   * SHARED `drawnRevealCommandRun` verbatim rather than paraphrasing it.
   */
  | {state: 'draw-pending'}
  /** A sub-list pick (card / player / or). X inspects a CARD list's rows. */
  | {state: 'sub-list', cardList: boolean}
  /** The payment lanes sub-state. */
  | {state: 'sub-payment', covers: boolean}
  /** The main decision column. */
  | {
      state: 'main',
      focused: FocusRowKind,
      /** The focused pick row already holds a choice (A = «Изменить»). */
      resolved?: boolean,
      canConfirm: boolean,
      /** The commit-CTA label (i18n key) when it is not the default «Confirm»
       *  (the repeat pick's compose stage reads «Выбрать это действие»). */
      commitLabel?: string,
      /**
       * The INLINE DIAL LB/RB currently drives — the ONE source of the −1/+1
       * (and amount MAX) hints, so the bar can never offer a dead dial. It is
       * deliberately INDEPENDENT of `focused`: a dial is focus-free when it is
       * the only one on screen (`soleInlineDial`), and the payment quick-adjust
       * is focus-free by design. `canDecrease`/`canIncrease` split the hint
       * per-side when the dial reports its limits (payment).
       */
      dial?: {kind: 'amount' | 'spendHeat' | 'payment', canDecrease?: boolean, canIncrease?: boolean},
      /** A non-M€ payment mix exists → the DEDICATED LT «Configure payment»
       *  entry (review-level, never a focus row / never A). */
      configurablePayment?: boolean,
    };

/**
 * The ACTION FOCUS command run for a composer state. X is ALWAYS «Осмотреть»
 * (the source card in the main state, the focused candidate in a card
 * sub-list) — the confirm is ONLY the A press on the CTA row, mirroring the
 * play composer's grammar (committing is a control DISTINCT from A-on-a-row).
 */
export function focusCommandRun(ctx: FocusCommandCtx): Array<ConsoleCommand> {
  switch (ctx.state) {
  case 'awaiting':
    // The batch is committed — the shell absorbs the pad; the bar shows the
    // in-flight beat instead of a stale (and impossible) Confirm/Cancel.
    return [{control: 'confirm', label: 'Performing…', enabled: false}];
  case 'reveal-pending':
    // The card is being pulled off the deck / flipping — post-commit, so
    // nothing can be cancelled; the bar narrates the beat honestly.
    return [{control: 'confirm', label: 'Revealing the card…', enabled: false}];
  case 'draw-pending':
    // The cards are physically leaving the deck — same honest narration, and
    // the same impossibility of a cancel.
    return [{control: 'confirm', label: 'Drawing cards…', enabled: false}];
  case 'reveal-shown':
    return [
      {control: 'confirm', label: 'OK'},
      {control: 'secondary', label: 'Inspect'},
      // L3 = the SOURCE card fullscreen (the console-wide source verb).
      {control: 'stickL', label: 'Source'},
    ];
  case 'sub-list': {
    const run: Array<ConsoleCommand> = [{control: 'confirm', label: 'Select'}];
    if (ctx.cardList) {
      run.push({control: 'secondary', label: 'Inspect'});
    }
    run.push({control: 'back', label: 'Back'});
    return run;
  }
  case 'sub-payment':
    // The EXPANDED payment editor — the same block, opened. d-pad walks the
    // sources; the way back is offered on BOTH the trigger that expanded it and
    // B, so the density switch is a toggle the player can never get stuck in.
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'bumperL', control2: 'bumperR', label: '−1 / +1'},
      {control: 'triggerR', label: 'MAX'},
      {control: 'confirm', label: 'Done', enabled: ctx.covers},
      {control: 'triggerL', label: 'Back to quick payment'},
      {control: 'back', label: 'Back'},
    ];
  default: {
    const run: Array<ConsoleCommand> = [];
    // LB/RB belong to the ACTIVE DIAL (focused stepper / sole focus-free stepper /
    // payment quick-adjust) — resolved by the caller, so the bar shows −1/+1
    // exactly when something can actually be dialed. A dial that reports limits
    // splits the hint per-side, so a dead button never appears.
    if (ctx.dial !== undefined) {
      if (ctx.dial.canDecrease === undefined && ctx.dial.canIncrease === undefined) {
        run.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'});
      } else {
        run.push({control: 'bumperL', label: '−1', enabled: ctx.dial.canDecrease !== false});
        run.push({control: 'bumperR', label: '+1', enabled: ctx.dial.canIncrease !== false});
      }
      if (ctx.dial.kind === 'amount') {
        run.push({control: 'triggerR', label: 'MAX'});
      }
    }
    // The A-verb by the FOCUSED row (never a dial — A never dials anything).
    switch (ctx.focused) {
    case 'amount':
    case 'spendHeat':
      run.push({control: 'confirm', label: 'Next'});
      break;
    case 'branch':
      run.push({control: 'confirm', label: 'Select'});
      break;
    case 'pick':
      run.push({control: 'confirm', label: ctx.resolved === true ? 'Change' : 'Select'});
      break;
    default:
      // The CTA row (or a decision-less confirm) — A commits.
      run.push({control: 'confirm', label: ctx.commitLabel ?? 'Confirm', enabled: ctx.canConfirm});
      break;
    }
    // LT — the DEDICATED payment editor entry (review-level, focus-independent),
    // shown only when a non-M€ mix exists (never for a pure-AUTO M€ payment).
    if (ctx.configurablePayment === true) {
      run.push({control: 'triggerL', label: 'Configure payment'});
    }
    run.push({control: 'secondary', label: 'Inspect'});
    run.push({control: 'back', label: 'Cancel'});
    return run;
  }
  }
}

/** The Action Browser's grid contract (unchanged grammar, now testable). */
export function browseCommandRun(ctx: {empty: boolean, focusedAvailable: boolean}): Array<ConsoleCommand> {
  if (ctx.empty) {
    // Empty state: the reset + the filter chords lead (the filters are what
    // emptied the grid).
    return [
      {control: 'stickR', label: 'Reset'},
      {control: 'bumperL', control2: 'bumperR', label: 'Availability'},
      {control: 'triggerL', control2: 'triggerR', label: 'Activation'},
      {control: 'back', label: 'Close'},
    ];
  }
  return [
    {control: 'confirm', label: 'Perform', enabled: ctx.focusedAvailable},
    {control: 'secondary', label: 'Inspect'},
    {control: 'stickR', label: 'Reset'},
    {control: 'back', label: 'Close'},
  ];
}
