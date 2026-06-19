import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';

/**
 * Module-level reactive state for the premium "Гидросеть" overlay. Lives outside
 * the component so it survives PlayerHome's `:key="playerkey"` remount on every
 * server response (mirrors journalState / actionsOverlayState).
 *
 * `selectedSpend === -1` is the "not yet chosen" sentinel — the model snaps the
 * selector to the max-legal default until the player adjusts it.
 */
export const hydroNetworkState = reactive<{
  open: boolean;
  selectedSpend: number;
  rewardChoice: number | undefined;
  /** Cache scope key (generation + viewed colour) for the fetched preview. */
  previewScope: string | undefined;
  preview: DeltaTrackPreviewModel | undefined;
  previewColor: Color | undefined;
}>({
  open: false,
  selectedSpend: -1,
  rewardChoice: undefined,
  previewScope: undefined,
  preview: undefined,
  previewColor: undefined,
});

/** Reset the planning state (spend + reward choice) — on open / player switch / submit. */
export function resetHydroPlan(): void {
  hydroNetworkState.selectedSpend = -1;
  hydroNetworkState.rewardChoice = undefined;
}
