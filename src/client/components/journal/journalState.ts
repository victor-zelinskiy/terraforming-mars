import {reactive} from 'vue';

/*
 * journalState — module-level reactive open/closed flag for the premium
 * journal side-panel.
 *
 * WHY this lives outside any component's `data()`:
 *
 * App.vue mounts `<player-home :key="playerkey">` and bumps `playerkey`
 * on every server response — a FULL remount of the PlayerHome subtree
 * (same mechanism the draft / buy-cards overlays had to escape). If the
 * journal's open flag lived in PlayerHome's `data()`, every board update
 * would reset it to false and the panel would close itself out from
 * under the player. Keeping the flag here (module scope) means it
 * survives the remount, so once the player opens the journal it stays
 * open until they explicitly close it.
 *
 * The panel itself is mounted at App level (next to DraftFlowOverlay) for
 * the same reason — so it is never destroyed by the remount, preserving
 * the selected generation, scroll position and live-follow state across
 * updates. PlayerHome only READS this flag (to toggle the board-slide
 * `#player-home.journal-open` class) and WRITES it (the bottom-bar Log
 * button).
 */
/**
 * Journal display mode (a TOP-LEVEL control, replacing per-group collapse):
 *   - 'detailed' — root actions WITH their consequence rows (the full feed);
 *   - 'summary'  — only the root actions, each with a compact consequence count.
 * Module-scoped so it survives the PlayerHome remount, like `open`.
 */
export type JournalDetailMode = 'detailed' | 'summary';

/**
 * A pulse request for a specific root event — set by the premium notification
 * system's "Show in journal" CTA. `correlationId` names the entry to scroll to +
 * flash; `token` is a monotonic nonce so requesting the SAME entry again still
 * retriggers the watcher (the value, not just identity, changes). `generation`
 * lets the panel jump to the right generation when the entry isn't in view.
 */
export type JournalHighlight = {
  correlationId: number;
  generation: number;
  token: number;
};

export const journalState = reactive<{open: boolean; detail: JournalDetailMode; highlight: JournalHighlight | undefined}>({
  open: false,
  detail: 'detailed',
  highlight: undefined,
});

let highlightSeq = 0;

/**
 * Open the journal and ask the feed to scroll to + flash the given root event.
 * Used by the notification system so a card and the journal never diverge.
 */
export function openJournalToEvent(correlationId: number, generation: number): void {
  journalState.open = true;
  highlightSeq++;
  journalState.highlight = {correlationId, generation, token: highlightSeq};
}
