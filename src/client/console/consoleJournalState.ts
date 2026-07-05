/*
 * Console-native JOURNAL UI state (the console-only layer OVER the shared
 * journal feed brain — journalDataSource / journalState). Module-level
 * reactive so the shell's command bar — the truth of the current context —
 * can read WHICH journal surface owns input (the filter popover / the feed)
 * and whether the per-entry verbs (A = details, X = card) are live, without
 * poking component refs from a computed.
 *
 * The fields are MIRRORS the ConsoleJournalPanel syncs from its live state —
 * the bar never guesses. Transient by design: reset when the journal closes.
 */
import {reactive} from 'vue';

export const consoleJournalUi = reactive({
  /** The console-native filter popover (Y) is open. */
  filterOpen: false,
  /** Mirror: the focused entry is a GROUP (A = expand/collapse is live). */
  focusIsGroup: false,
  /** Mirror: the focused entry is currently expanded (A = collapse). */
  focusExpanded: false,
  /** Mirror: the focused entry references ≥1 zoomable card (X is live). */
  focusHasCard: false,
  /** Mirror: an older generation exists (LT steps back). */
  canPrevGen: false,
  /** Mirror: a newer generation exists (RT steps forward). */
  canNextGen: false,
  /** Mirror: the player filter row is meaningful (≥2 players). */
  filterAvailable: false,
});

export function resetConsoleJournalUi(): void {
  consoleJournalUi.filterOpen = false;
  consoleJournalUi.focusIsGroup = false;
  consoleJournalUi.focusExpanded = false;
  consoleJournalUi.focusHasCard = false;
  consoleJournalUi.canPrevGen = false;
  consoleJournalUi.canNextGen = false;
  consoleJournalUi.filterAvailable = false;
}
