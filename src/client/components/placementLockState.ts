/*
 * placementLockState — module-level reactive coordinator for the
 * "game is waiting for a tile placement on the Mars board" UX.
 *
 * Multiple components can independently raise a placement-pending
 * signal. Currently:
 *   - PlayerHome detects MANDATORY top-level SelectSpace (server in
 *     SelectSpace) and CANCELLABLE convert-plants client picker.
 *     Both flip flags directly on the host-prefixed fields below.
 *   - MandatoryInputModal flips `modalPicker` when its inner
 *     OrOptions picks a board-SelectSpace option (currently the
 *     World Government Terraforming "Add an ocean" prompt, but the
 *     same path catches any future nested SelectSpace hosted in a
 *     modal). The OrOptions selectedOption watcher passes the
 *     option's title through to `modalPickerTitle` so the banner
 *     reads "AWAITING PLACEMENT / Add an ocean" instead of a
 *     generic fallback.
 *
 * `pending` collapses the three sources to a single boolean so
 * PlayerHome's existing watcher (which installs/uninstalls the JS
 * click guard + applies/removes the body lock class + sets/unsets
 * native `title` tooltips on locked buttons) stays the single
 * coordinator. We don't ref-count by source — pending is "any
 * source raised". That's safe because each source independently
 * resets its own flag when it's done; when the last source clears
 * its flag, pending flips to false and the watcher tears down.
 *
 * `bannerTitle` carries the prompt title for the banner. It's
 * pulled in this priority order:
 *   1. modalPickerTitle  — nested picker (most-specific name)
 *   2. server-driven SelectSpace prompt title (top-level)
 *   3. convert-plants prompt title
 * Falls back to a generic localised string in PlacementBanner
 * itself when undefined / empty.
 */

import {reactive, computed, ComputedRef} from 'vue';
import {Message} from '@/common/logs/Message';

export type PlacementBannerSource = 'modal-picker' | 'server' | 'convert-plants';

type PlacementLockState = {
  /** Set by MandatoryInputModal when its nested OrOptions picks a
   *  SelectSpace option. Carries the option's title for the banner. */
  modalPicker: boolean;
  modalPickerTitle: string | Message | undefined;
};

export const placementLockState: PlacementLockState = reactive({
  modalPicker: false,
  modalPickerTitle: undefined,
});

/**
 * Setter for MandatoryInputModal to flip its modal-picker flag.
 * Title is mandatory when active=true (banner needs something to
 * display) and cleared on active=false.
 */
export function setModalPickerActive(active: boolean, title: string | Message | undefined): void {
  placementLockState.modalPicker = active;
  placementLockState.modalPickerTitle = active ? title : undefined;
}

/**
 * Helper for PlayerHome.placementPending — returns true while the
 * modal-picker source has raised the placement-pending signal.
 * Kept as a thin re-export so PlayerHome doesn't reach into the
 * shape of `placementLockState` directly.
 */
export const modalPickerPending: ComputedRef<boolean> = computed(() => placementLockState.modalPicker);
