import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {EffectOverlayStat} from '@/common/events/aggregate';

/**
 * Module-level state for the master-detail Эффекты overlay. Lives at module scope
 * — like `actionsOverlayState` / `playedCardsViewState` / `journalState` — so it
 * SURVIVES App.vue's `playerkey` remount of <player-home> on every server response.
 * Without it, the SELECTION (which effect the details panel shows) + the per-game
 * stats cache would reset on every poll while the overlay is open.
 *
 * `selectedKey` is the selected SOURCE card name (the `EffectGroup.key`) — a card's
 * several effect nodes share ONE whole-game aggregate, so selection is per source.
 * `statsCache` keys the fetched per-player stats by colour (the overlay can view any
 * seat); `statsScope` (the generation) invalidates them when the game advances.
 */
export const effectsOverlayState = reactive<{
  /** The selected source card name, or undefined (auto-select the first). */
  selectedKey: CardName | undefined;
  /** Snapshot key (generation) the cached stats were fetched for. */
  statsScope: string | undefined;
  /** Per-player whole-game effect stats, fetched on open + on seat/generation change. */
  statsCache: Partial<Record<Color, ReadonlyArray<EffectOverlayStat>>>;
}>({
  selectedKey: undefined,
  statsScope: undefined,
  statsCache: {},
});

export function setEffectSelection(key: CardName | undefined): void {
  effectsOverlayState.selectedKey = key;
}

export function setEffectStatsScope(scope: string): void {
  if (effectsOverlayState.statsScope !== scope) {
    effectsOverlayState.statsScope = scope;
    effectsOverlayState.statsCache = {};
  }
}

export function setEffectStats(color: Color, stats: ReadonlyArray<EffectOverlayStat>, expectedScope?: string): void {
  if (expectedScope !== undefined && expectedScope !== effectsOverlayState.statsScope) {
    return;
  }
  effectsOverlayState.statsCache = {...effectsOverlayState.statsCache, [color]: stats};
}

export function getEffectStats(color: Color): ReadonlyArray<EffectOverlayStat> | undefined {
  return effectsOverlayState.statsCache[color];
}

/** Drop the selection + the stats cache (on player switch). */
export function resetEffectsOverlay(): void {
  effectsOverlayState.selectedKey = undefined;
  effectsOverlayState.statsCache = {};
}
