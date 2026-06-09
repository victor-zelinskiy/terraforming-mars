import {reactive} from 'vue';
import {DEFAULT_HAND_FILTER, HandFilterState} from '@/client/components/handCards/handCardModel';

/*
 * handFilterState — module-level reactive filter state for the premium
 * "cards in hand" overlay (availability / type / tag narrowing + sort).
 *
 * WHY this lives outside the component's `data()` (same rationale as
 * `journalState`): `HandCardsOverlay` is mounted with `v-if` in PlayerHome
 * (unmounted on close) AND the whole PlayerHome subtree is remounted on
 * every server response via `<player-home :key="playerkey">`. If the filter
 * lived in `data()` it would reset to the default on every board update and
 * on every close→reopen. Keeping it here (module scope) makes the player's
 * chosen filters survive both — they persist until the client reloads.
 *
 * The overlay READS this object (binds `:filter`) and WRITES it (mutates the
 * fields from its filter-event handlers).
 */
export const handFilterState = reactive<HandFilterState>({...DEFAULT_HAND_FILTER});
