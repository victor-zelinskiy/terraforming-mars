/*
 * The play-card composer's bottom command-bar mirror.
 *
 * Hints live ONLY in the shell's ONE bottom command bar (never inline) — same
 * contract as the colony-trade composer (`consoleColoniesUi`). The play
 * composer (ConsolePlayCardConfirm) computes its CONTEXTUAL controls
 * (`playComposerFootHints` — LB/RB only where a value dials, LT only when the
 * payment is configurable, A the smart primary, Y to change a resolved choice,
 * X inspect, B cancel) and publishes them here; the shell's `commands()` reads
 * them verbatim for the `pendingPlayCard` surface. This replaces the old
 * hard-coded, DIVERGED command list (which showed X = «Разыграть» while A
 * actually plays, and static LB/RB −1/+1 even in a pure-auto payment).
 */
import {reactive} from 'vue';
import type {FootHint} from '@/client/console/consolePlayCardComposer';
import type {PlayComposerDraft} from '@/client/console/stagedPlay';

// `FootHint` ({control, control2?, label, enabled?}) is a structural subset of
// the command bar's `ConsoleCommand`, so the shell can render these verbatim.
// (Imported from the pure .ts composer — NOT the .vue command bar — because the
// webpack `*.vue` shim exposes only the default export.)

export const consolePlayCardUi = reactive({
  /** The composer's live footer hints, ready for the command bar. */
  commands: [] as ReadonlyArray<FootHint>,
  /**
   * STAGED PLAY return draft: the capture snapshot the composer wrote at the
   * staged confirm, applied back by `applyPreview` when the player returns
   * from the board with B — so the card, its payment, every resolved choice
   * and the focus survive the round trip. ONE-SHOT: consumed on apply.
   * Written by the shell's `cancelStagedPlay` (from the parked arm), read only
   * by ConsolePlayCardConfirm.
   */
  stagedDraft: undefined as PlayComposerDraft | undefined,
  /**
   * THE COMPOSER HAS LET GO OF THE BAR (PL-084): a hosted step is entering —
   * the composer is fading in place under a Parliament / a colony grid rising
   * out of its rect, its frame already `committed` / `executing` — and for
   * that fade's length the bar may not read «A РАЗЫГРАТЬ · B ОТМЕНА» over a
   * surface that accepts neither. Set by the shell at the START of the fade
   * (one point for every hosted entrance: TR03 / TR04 / TR07 / TR12 / TR31),
   * cleared with the composer (`resetConsolePlayCardUi`) or when a door
   * closes under the release and the composer stays (`restore…`). While it
   * stands the shell's bar reads the step's own contract instead.
   */
  released: false,
});

export function setConsolePlayCardCommands(commands: ReadonlyArray<FootHint>): void {
  consolePlayCardUi.commands = commands;
}

/** The composer lets go of the bar for the hosted step's entrance (the hints stay — a cancelled release gives them back). */
export function releaseConsolePlayCardCommands(): void {
  consolePlayCardUi.released = true;
}

/** The door closed under the release and the composer stays: its hints read again. */
export function restoreConsolePlayCardCommands(): void {
  consolePlayCardUi.released = false;
}

export function setPlayComposerStagedDraft(draft: PlayComposerDraft | undefined): void {
  consolePlayCardUi.stagedDraft = draft;
}

/** The composer consumes the draft exactly once (a later fresh open of the
 *  same card must start clean). */
export function takePlayComposerStagedDraft(cardName: string): PlayComposerDraft | undefined {
  const draft = consolePlayCardUi.stagedDraft;
  if (draft === undefined || draft.cardName !== cardName) {
    return undefined;
  }
  consolePlayCardUi.stagedDraft = undefined;
  return draft;
}

export function resetConsolePlayCardUi(): void {
  consolePlayCardUi.commands = [];
  consolePlayCardUi.stagedDraft = undefined;
  consolePlayCardUi.released = false;
}
