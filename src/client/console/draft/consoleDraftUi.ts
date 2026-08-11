/*
 * The draft workspace's bottom command-bar mirror + the ONE command-contract
 * builder of the between-generations draft.
 *
 * Hints live ONLY in the shell's ONE bottom command bar (never inline) — the
 * same contract as the start scene (`consoleStartUi`) and the composers. The
 * workspace derives its live state into a `DraftCommandState`, publishes the
 * built list here, and the shell's `commands()` reads it verbatim — the bar
 * can never diverge from what the buttons actually do.
 *
 * The draft grammar (controller-first, user-mandated):
 *  - PICK: A = take the focused card (single pick commits in one press;
 *    keep-2 rounds toggle + RT commits the set), X = fullscreen inspect,
 *    LT = the drafted-cards sub-stage, B = minimize.
 *  - WAIT: LT = drafted cards, B = minimize (the pick is locked — nothing
 *    else is honestly on offer).
 *  - BUY: A = select/deselect, X = inspect, RT = confirm the purchase,
 *    B = minimize.
 *  - INSPECT (LT sub-stage): X = inspect, B = back. No game verbs — the
 *    picks are made; nothing here may mutate anything.
 */
import {reactive} from 'vue';
import type {GlyphControl} from '@/client/gamepad/glyphSets';

/** A structural subset of the command bar's `ConsoleCommand`. */
export type DraftCommand = {control: GlyphControl, label: string, enabled?: boolean, highlight?: boolean};

/** The workspace facts the command contract is derived from (pure — testable). */
export type DraftCommandState = {
  /** An arrival/pass/pick cinematic owns the cards — any press only skips. */
  beatActive: boolean,
  zone: 'pick' | 'wait' | 'buy' | 'inspect' | 'done',
  /** min === max === 1 — A commits the focused card in one press. */
  singlePick: boolean,
  /** The focused card is currently picked (keep-2 rounds / the buy). */
  focusedPicked: boolean,
  /** The pick/buy limit does not block the focused card. */
  canPickFocused: boolean,
  /** The set satisfies min/max (+ affordability) → RT may commit. */
  setValid: boolean,
  /** Cards are on stage (X has something to open). */
  hasCards: boolean,
  /** The drafted shelf has cards (LT has something to show). */
  hasCollected: boolean,
  /** BUY: zero cards selected — RT's honest label is «Skip». */
  buyingNothing: boolean,
};

/** The draft command contract — ONE pure derivation for the bar. */
export function draftCommands(s: DraftCommandState): Array<DraftCommand> {
  if (s.beatActive) {
    return [{control: 'confirm', label: 'Skip'}];
  }
  switch (s.zone) {
  case 'pick': {
    const hints: Array<DraftCommand> = [];
    if (s.singlePick) {
      hints.push({control: 'confirm', label: 'Take', enabled: s.canPickFocused, highlight: true});
    } else if (s.focusedPicked) {
      hints.push({control: 'confirm', label: 'Deselect'});
    } else {
      hints.push({control: 'confirm', label: 'Take', enabled: s.canPickFocused});
    }
    if (s.hasCards) {
      hints.push({control: 'secondary', label: 'Inspect'});
    }
    if (!s.singlePick) {
      hints.push({control: 'triggerR', label: 'Confirm', enabled: s.setValid});
    }
    if (s.hasCollected) {
      hints.push({control: 'triggerL', label: 'Drafted'});
    }
    hints.push({control: 'back', label: 'Minimize'});
    return hints;
  }
  case 'wait': {
    const hints: Array<DraftCommand> = [];
    if (s.hasCollected) {
      hints.push({control: 'triggerL', label: 'Drafted'});
    }
    hints.push({control: 'back', label: 'Minimize'});
    return hints;
  }
  case 'buy': {
    const hints: Array<DraftCommand> = [
      {control: 'confirm', label: s.focusedPicked ? 'Deselect' : 'Select', enabled: s.focusedPicked || s.canPickFocused},
    ];
    if (s.hasCards) {
      hints.push({control: 'secondary', label: 'Inspect'});
    }
    hints.push({
      control: 'triggerR',
      label: s.buyingNothing ? 'Skip' : 'Buy',
      enabled: s.setValid,
      highlight: s.setValid && !s.buyingNothing,
    });
    hints.push({control: 'back', label: 'Minimize'});
    return hints;
  }
  case 'inspect': {
    const hints: Array<DraftCommand> = [];
    if (s.hasCollected) {
      hints.push({control: 'secondary', label: 'Inspect'});
    }
    hints.push({control: 'back', label: 'Back'});
    return hints;
  }
  case 'done':
    // The terminal beat — nothing is asked; the frame releases by itself.
    return [];
  }
}

export const consoleDraftUi = reactive({
  /** The workspace's live footer hints, ready for the command bar. */
  commands: [] as ReadonlyArray<DraftCommand>,
});

export function setConsoleDraftCommands(commands: ReadonlyArray<DraftCommand>): void {
  consoleDraftUi.commands = commands;
}

export function resetConsoleDraftUi(): void {
  consoleDraftUi.commands = [];
}
