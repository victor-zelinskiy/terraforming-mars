/*
 * Console-native «Разыграно» (played cards) overlay UI state — the mirror the
 * shell's command bar reads (WHICH sub-surface owns input, what the X verb is
 * on the focused object) without poking component refs from a computed.
 *
 * The fields are MIRRORS ConsolePlayedOverlay syncs from its live state — the
 * bar never guesses. Transient by design: reset when the overlay closes.
 */
import {reactive} from 'vue';

export const consolePlayedUi = reactive({
  /** The nested face-up EVENTS list is open (over the tableau). */
  eventsOpen: false,
  /** What the cursor is on: a face-up card / the events pile / nothing. */
  focusKind: 'none' as 'card' | 'events' | 'none',
  /** ≥2 participants — LB/RB cycles the viewed player. */
  canCyclePlayer: false,
});

export function resetConsolePlayedUi(): void {
  consolePlayedUi.eventsOpen = false;
  consolePlayedUi.focusKind = 'none';
  consolePlayedUi.canCyclePlayer = false;
}
