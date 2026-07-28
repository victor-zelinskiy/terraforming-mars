/*
 * EFFECT DECISION — the tiny slice of state that must OUTLIVE the screen.
 *
 * The decision modal unmounts whenever it hands off to a specialized overlay
 * (the hand grid), and re-mounts when the player comes back with B. The prompt
 * is unchanged, so from the player's point of view they never left — which
 * means the focus must be exactly where they put it, on the action card that
 * opened the overlay. A component-local `data()` cannot carry that across the
 * unmount, so it lives here.
 *
 * Deliberately minimal: no view model, no callbacks, nothing the adapter can
 * derive. Module-level reactive state per the console's state rule (it must
 * also survive the `playerkey` reset epoch).
 */

import {reactive} from 'vue';

export const effectDecisionState = reactive({
  /** Index INTO the view model's `actions` the player last focused. */
  focusIdx: 0,
});

export function rememberDecisionFocus(index: number): void {
  effectDecisionState.focusIdx = Math.max(0, index);
}

/** A genuinely NEW decision starts at the top — never on a stale index. */
export function resetDecisionFocus(): void {
  effectDecisionState.focusIdx = 0;
}
