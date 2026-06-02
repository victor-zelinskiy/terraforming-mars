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
export const journalState = reactive<{open: boolean}>({
  open: false,
});
