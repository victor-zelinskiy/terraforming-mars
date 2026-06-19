import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
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
  /** The clicked/selected track position (-1 = use the max-legal default). A
   *  position > current = a plan target; <= current = a details/history view. */
  selectedPosition: number;
  rewardChoice: number | undefined;
  /** Pre-collected target card for a card-pick reward (pos 7 / pos 9). */
  selectedCard: CardName | undefined;
  /** Cache scope key (generation + viewed colour) for the fetched preview. */
  previewScope: string | undefined;
  preview: DeltaTrackPreviewModel | undefined;
  previewColor: Color | undefined;
}>({
  open: false,
  selectedPosition: -1,
  rewardChoice: undefined,
  selectedCard: undefined,
  previewScope: undefined,
  preview: undefined,
  previewColor: undefined,
});

/** Reset the planning state (selection + reward choice + card) — on open / player switch / submit. */
export function resetHydroPlan(): void {
  hydroNetworkState.selectedPosition = -1;
  hydroNetworkState.rewardChoice = undefined;
  hydroNetworkState.selectedCard = undefined;
}
