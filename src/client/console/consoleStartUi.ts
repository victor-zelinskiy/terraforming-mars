/*
 * The start-scene's bottom command-bar mirror + the ONE command-contract
 * builder of the initial setup.
 *
 * Hints live ONLY in the shell's ONE bottom command bar (never inline) — same
 * contract as the play-card composer (`consolePlayCardUi`) and the colony-trade
 * composer (`consoleColoniesUi`). ConsoleStartScene derives its live state into
 * a `StartSceneCommandState` and publishes `startSceneCommands(state)` here;
 * the shell's `commands()` reads them verbatim for the `startTask` surface —
 * the bar can never diverge from what the buttons actually do.
 *
 * The setup grammar (the 2026-07 polish pass):
 *  - A is CONTEXT-EXACT: «Выбрать» on a pickable card, «Снять выбор» on a
 *    picked card, ABSENT while the pick limit blocks the focused card (the
 *    context rail explains the limit), the launch verb on the summary.
 *  - LT / RT are the ONE symmetric step navigation (prev / next step). RT is
 *    gated on the step being valid; it stops AT the summary — starting the
 *    game is ONLY the explicit A commit there. LB / RB are NOT used anywhere
 *    in the initial setup (they keep their in-game role untouched).
 *  - No generic «Навигация» hint: d-pad browsing is base behaviour.
 */
import {reactive} from 'vue';
import type {GlyphControl} from '@/client/gamepad/glyphSets';

// A structural subset of the command bar's `ConsoleCommand`, so the shell can
// render these verbatim.
export type StartCommand = {control: GlyphControl, label: string, enabled?: boolean, highlight?: boolean};

/** The scene facts the command contract is derived from (pure — testable). */
export type StartSceneCommandState = {
  /** The deal cinematic is running — any press only skips it. */
  dealActive: boolean,
  mode: 'wizard' | 'ceremony',
  /** Wizard: on the final summary (no live card step). */
  onSummary: boolean,
  // ── wizard card step ──
  /** min === max === 1 (corporation / CEO): A selects AND advances. */
  singlePick: boolean,
  /** The focused card is currently picked (multi-pick steps). */
  focusedPicked: boolean,
  /** A can pick the focused card right now (limit not reached / replace). */
  canPickFocused: boolean,
  /** The step has cards to inspect. */
  hasCards: boolean,
  /** The step satisfies the server's min/max (+ budget) → RB may advance. */
  stepComplete: boolean,
  /** A previous wizard step exists (LT). */
  hasPrevStep: boolean,
  // ── wizard summary ──
  /** «Begin the game» / «Submit your choice» (the launch readout's verb). */
  launchVerb: string,
  /** This press is the LAST input the game needs (earns the highlight). */
  launches: boolean,
  /** Every step complete → the summary A can submit. */
  wizardReady: boolean,
  // ── ceremony ──
  /** The card-payment beat is the one live decision. */
  payBeat: boolean,
  /** The ceremony A verb (Play now / Copy / Select). */
  ceremonyVerb: string,
  /** The ceremony has an actionable focus target. */
  hasFocusables: boolean,
};

/**
 * The initial-setup command contract — ONE pure derivation for the bar.
 * Order follows the console convention: A · X · LB · RB · B.
 */
export function startSceneCommands(s: StartSceneCommandState): Array<StartCommand> {
  // While the deal cinematic runs, selection is NOT interactive yet — the
  // bar advertises only the skip (any button skips).
  if (s.dealActive) {
    return [{control: 'confirm', label: 'Skip'}];
  }
  if (s.mode === 'wizard') {
    if (s.onSummary) {
      // The launch is the explicit A commit — RT deliberately does NOT
      // exist here (step navigation stops AT the summary; a second,
      // less obvious way to start the game is exactly what this removed).
      const hints: Array<StartCommand> = [
        {control: 'confirm', label: s.launchVerb, enabled: s.wizardReady, highlight: s.launches && s.wizardReady},
      ];
      if (s.hasCards) {
        hints.push({control: 'secondary', label: 'Inspect'});
      }
      hints.push({control: 'triggerL', label: 'Prev step'});
      hints.push({control: 'back', label: 'Minimize'});
      return hints;
    }
    // A card step. A carries its EXACT verb — or is absent when the limit
    // blocks the focused card (the context rail names the recovery).
    const hints: Array<StartCommand> = [];
    if (s.singlePick) {
      hints.push({control: 'confirm', label: 'Select'});
    } else if (s.focusedPicked) {
      hints.push({control: 'confirm', label: 'Deselect'});
    } else if (s.canPickFocused) {
      hints.push({control: 'confirm', label: 'Select'});
    }
    if (s.hasCards) {
      hints.push({control: 'secondary', label: 'Inspect'});
    }
    if (s.hasPrevStep) {
      hints.push({control: 'triggerL', label: 'Prev step'});
    }
    hints.push({control: 'triggerR', label: 'Next step', enabled: s.stepComplete});
    hints.push({control: 'back', label: 'Minimize'});
    return hints;
  }
  // The ceremony. The card-payment beat is ONE press naming its own cost.
  if (s.payBeat) {
    return [
      {control: 'confirm', label: 'Pay'},
      {control: 'back', label: 'Minimize'},
    ];
  }
  return [
    {control: 'confirm', label: s.ceremonyVerb, enabled: s.hasFocusables},
    {control: 'secondary', label: 'Inspect', enabled: s.hasFocusables},
    {control: 'back', label: 'Minimize'},
  ];
}

export const consoleStartUi = reactive({
  /** The scene's live footer hints, ready for the command bar. */
  commands: [] as ReadonlyArray<StartCommand>,
});

export function setConsoleStartCommands(commands: ReadonlyArray<StartCommand>): void {
  consoleStartUi.commands = commands;
}

export function resetConsoleStartUi(): void {
  consoleStartUi.commands = [];
}
