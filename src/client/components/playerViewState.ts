import {reactive} from 'vue';
import {Color} from '@/common/Color';

/**
 * Module-level reactive state for which seat the HUD is currently VIEWING — the
 * player whose resources / tags / tableau the bottom panel and the РАЗЫГРАНО /
 * ЭФФЕКТЫ overlays render. Lives at module scope (like `journalState` /
 * `actionsOverlayState` / `playedCardsViewState`) so it SURVIVES App.vue's
 * `<player-home :key="playerkey">` remount that fires on every server response.
 *
 * Why it must survive the remount: `selectedPlayerColor` used to live in
 * PlayerHome.data(), so a poll-driven remount reset it to `undefined`. While the
 * player was inspecting an OPPONENT's tableau, ANOTHER player taking their turn
 * (a routine poll) silently snapped the view back to the player's own seat.
 * Keeping it here makes the chosen view persist until the player switches it
 * themselves — OR a mandatory own-seat sub-prompt (payment / discard / a board
 * pick) deliberately resets it. Those resets still run; they just target this
 * object now (PlayerHome proxies it via a get/set computed of the same name).
 *
 * `displayedPlayer` resolves the colour with `.find()` and falls back to the
 * viewer's own seat, so a stale colour from a previous game in the same session
 * is harmless.
 */
export const playerViewState = reactive<{selectedPlayerColor: Color | undefined}>({
  selectedPlayerColor: undefined,
});
