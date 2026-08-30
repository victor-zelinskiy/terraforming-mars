import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';

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
  /**
   * MULTI-REWARD TRAVERSAL DRAFTS (Delta Surge) — per-POSITION answers of one
   * planned move: the crossed choice stages' picked alternative and the
   * crossed target stages' picked card. The single-landing fields above stay
   * the historical draft (byte-parity with every pre-traversal flow); these
   * exist only while the plan's reward set holds more than the destination.
   */
  planChoices: Record<number, number>;
  planPicks: Partial<Record<number, CardName>>;
  /** Set while a pos 7/9 pick is delegated to the ДЕЙСТВИЯ / РАЗЫГРАНО overlay,
   *  so PlayerHome restores this overlay when the pick resolves or is abandoned. */
  awaitingPick: 'reuse-action' | 'animal-target' | undefined;
  /** Cache scope key (generation + viewed colour) for the fetched preview. */
  previewScope: string | undefined;
  preview: DeltaTrackPreviewModel | undefined;
  previewColor: Color | undefined;
}>({
  open: false,
  selectedPosition: -1,
  rewardChoice: undefined,
  selectedCard: undefined,
  planChoices: {},
  planPicks: {},
  awaitingPick: undefined,
  previewScope: undefined,
  preview: undefined,
  previewColor: undefined,
});

/** Reset the planning state (selection + reward choice + card) — on open / player switch / submit. */
export function resetHydroPlan(): void {
  hydroNetworkState.selectedPosition = -1;
  hydroNetworkState.rewardChoice = undefined;
  hydroNetworkState.selectedCard = undefined;
  hydroNetworkState.planChoices = {};
  hydroNetworkState.planPicks = {};
  hydroNetworkState.awaitingPick = undefined;
}

/**
 * The SHARED preview fetch (desktop overlay + console screen — one brain).
 * Best-effort: on failure the track still renders from the public positions.
 */
export function fetchHydroPreview(viewerId: string, color: Color, scope: string): void {
  if (typeof fetch !== 'function' || viewerId === '') {
    return;
  }
  const url = apiUrl(paths.API_GAME_DELTA_PREVIEW) +
    '?id=' + encodeURIComponent(viewerId) +
    '&color=' + encodeURIComponent(color);
  fetch(url)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((p) => {
      if (p !== undefined) {
        hydroNetworkState.preview = p as DeltaTrackPreviewModel;
        hydroNetworkState.previewColor = color;
        hydroNetworkState.previewScope = scope;
      }
    })
    .catch(() => { /* best-effort: the track still renders from public positions */ });
}
