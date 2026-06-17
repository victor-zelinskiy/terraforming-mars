import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {AvailabilityFilter, ActivationFilter} from '@/client/components/actions/actionModel';

/**
 * Module-level state for the master-detail ДЕЙСТВИЯ overlay. Lives at module scope
 * — like `playedCardsViewState` / `journalState` / `handSelectState` — so it
 * SURVIVES App.vue's `playerkey` remount of <player-home> on every server response.
 * Without it, the overlay's SELECTION (which action the details panel shows) + the
 * lazily-fetched per-card preview cache would reset on every poll while the overlay
 * is open. Cleared on player switch (`resetActionsOverlay`).
 *
 * `selectedKey` identifies the selected action ROW as `cardName + '#' + nodeIndex`
 * (a card with an `or` action draws several rows / nodes); the overlay maps it to a
 * `branchPosition` for the confirm modal.
 */
export const actionsOverlayState = reactive<{
  /** True while the overlay is open — drives the remount re-arm in PlayerHome. */
  open: boolean;
  /** The selected action row (`cardName#nodeIndex`), or undefined (auto-select). */
  selectedKey: string | undefined;
  /** Faceted filters — persisted here so they survive the remount. */
  availability: AvailabilityFilter;
  activation: ActivationFilter;
  /** Snapshot key for the game/player state the cached previews were built from. */
  previewCacheScope: string | undefined;
  /** Per-card read-only action preview, fetched lazily for the SELECTED card. */
  previewCache: Record<string, ActionPreview>;
  /** Snapshot key (generation) the cached per-game ACTION-usage stats were fetched for. */
  statsScope: string | undefined;
  /** Per-player whole-game action-usage stats (`/api/game/action-stats`), by colour. */
  statsCache: Partial<Record<Color, ReadonlyArray<EffectOverlayStat>>>;
}>({
  open: false,
  selectedKey: undefined,
  availability: 'all',
  activation: 'dormant',
  previewCacheScope: undefined,
  previewCache: {},
  statsScope: undefined,
  statsCache: {},
});

export function setActionStatsScope(scope: string): void {
  if (actionsOverlayState.statsScope !== scope) {
    actionsOverlayState.statsScope = scope;
    actionsOverlayState.statsCache = {};
  }
}

export function setActionStats(color: Color, stats: ReadonlyArray<EffectOverlayStat>, expectedScope?: string): void {
  if (expectedScope !== undefined && expectedScope !== actionsOverlayState.statsScope) {
    return;
  }
  actionsOverlayState.statsCache = {...actionsOverlayState.statsCache, [color]: stats};
}

export function getActionStats(color: Color): ReadonlyArray<EffectOverlayStat> | undefined {
  return actionsOverlayState.statsCache[color];
}

/** The selection key for a given card + node ordinal. */
export function actionRowKey(cardName: CardName, nodeIndex: number): string {
  return cardName + '#' + nodeIndex;
}

export function setActionSelection(key: string | undefined): void {
  actionsOverlayState.selectedKey = key;
}

export function getActionPreview(cardName: CardName): ActionPreview | undefined {
  return actionsOverlayState.previewCache[cardName];
}

export function setActionPreviewScope(scope: string): void {
  if (actionsOverlayState.previewCacheScope !== scope) {
    actionsOverlayState.previewCacheScope = scope;
    actionsOverlayState.previewCache = {};
  }
}

export function setActionPreview(cardName: CardName, preview: ActionPreview, expectedScope?: string): void {
  if (expectedScope !== undefined && expectedScope !== actionsOverlayState.previewCacheScope) {
    return;
  }
  actionsOverlayState.previewCache = {...actionsOverlayState.previewCache, [cardName]: preview};
}

/** Drop selection + preview/stats caches (on player switch); keep the filters. */
export function resetActionsOverlay(): void {
  actionsOverlayState.selectedKey = undefined;
  actionsOverlayState.previewCache = {};
  actionsOverlayState.statsCache = {};
}
