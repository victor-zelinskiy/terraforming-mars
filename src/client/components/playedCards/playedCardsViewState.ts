/**
 * @deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
 * All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
 * desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
 * here cannot affect console. Fix only what breaks the shared layer or play.
 * See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
 */
import {reactive} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {PlayedGroupKey} from '@/client/components/playedCards/playedCardGroups';

/*
 * playedCardsViewState — module-level reactive state for the premium
 * "РАЗЫГРАНО" (played cards) board overlay: the type filter, the tag
 * filter, and the Cards/Table view mode.
 *
 * WHY module scope (mirrors `journalState` / `handFilterState`): the overlay
 * is mounted with `v-if` in PlayerHome (unmounted on close) AND PlayerHome is
 * remounted on every server response (`<player-home :key="playerkey">`). A
 * `data()` filter would reset on close→reopen and on every board update.
 * Keeping it here makes the player's filters + view mode persist.
 *
 * Filter model (two independent dimensions):
 *  - `hiddenGroups` — card-type groups the player has toggled OFF (the
 *    existing "РАЗЫГРАНО" semantics: every group shown by default, click a
 *    chip to hide it). A card-type GROUP is hidden wholesale.
 *  - `activeTags`  — tags the player has selected to narrow to (POSITIVE
 *    narrowing, like the hand overlay: empty = no tag narrowing). Operates
 *    per-card across the still-visible groups.
 * The two AND together (a card shows iff its group isn't hidden AND it
 * passes the tag filter).
 */
export type PlayedViewMode = 'cards' | 'table';

export type PlayedFilterState = {
  hiddenGroups: Array<PlayedGroupKey>;
  activeTags: Array<Tag>;
  viewMode: PlayedViewMode;
};

export const playedCardsViewState = reactive<PlayedFilterState>({
  hiddenGroups: [],
  activeTags: [],
  viewMode: 'cards',
});
