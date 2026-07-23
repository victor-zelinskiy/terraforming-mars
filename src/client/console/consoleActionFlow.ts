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
 * The focus stage's kicker (i18n key): an action with decisions reads as a
 * SETUP («Настройка действия»), a decision-less one as a plain CONFIRMATION.
 */
export function focusKicker(hasDecisions: boolean): string {
  return hasDecisions ? 'Action setup' : 'Confirmation';
}

// ── Command-bar contracts (pure builders — the bar can never lie) ───────────

/** What kind of row the focus cursor is on (drives the A-verb). */
export type FocusRowKind =
  | 'amount' | 'spendHeat' // inline steppers: LB/RB adjust, A advances (Next)
  | 'branch' // a variant option card: A selects it
  | 'pick' // a card/player/or/payment decision row: A opens (or re-opens) it
  | 'cta' // the confirm row: A commits
  | 'none'; // no decision rows at all (bare confirm)

export type FocusCommandCtx =
  /** The committed hold — input is absorbed; the bar shows the honest beat. */
  | {state: 'awaiting'}
  /** The reveal phase, card still face down (flight / flip in progress). */
  | {state: 'reveal-pending'}
  /** The reveal outcome is on screen — acknowledge / inspect. */
  | {state: 'reveal-shown'}
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
    return [
      {control: 'bumperL', control2: 'bumperR', label: '−1 / +1'},
      {control: 'triggerR', label: 'MAX'},
      {control: 'confirm', label: 'Done', enabled: ctx.covers},
      {control: 'back', label: 'Back'},
    ];
  default: {
    const run: Array<ConsoleCommand> = [];
    switch (ctx.focused) {
    case 'amount':
      run.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'});
      run.push({control: 'triggerR', label: 'MAX'});
      run.push({control: 'confirm', label: 'Next'});
      break;
    case 'spendHeat':
      run.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'});
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
