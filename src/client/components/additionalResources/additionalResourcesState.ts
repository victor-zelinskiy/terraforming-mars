import {reactive} from 'vue';
import {CardResource} from '@/common/CardResource';
import {Color} from '@/common/Color';

/**
 * Module-level reactive bridge between the "ДОП. РЕСУРСЫ" side panel (mounted
 * inside the remount-prone PlayerHome subtree) and the detail overlay (mounted
 * App-level, like the journal, so the `:key="playerkey"` remount can't tear it
 * down while open). The panel WRITES which resource/player to detail; the
 * overlay READS it and re-resolves the live player by colour each render.
 */
export const additionalResourcesState = reactive<{
  detailResource: CardResource | undefined;
  detailPlayerColor: Color | undefined;
}>({
  detailResource: undefined,
  detailPlayerColor: undefined,
});

export function openAdditionalResourceDetail(resource: CardResource, color: Color): void {
  additionalResourcesState.detailResource = resource;
  additionalResourcesState.detailPlayerColor = color;
}

export function closeAdditionalResourceDetail(): void {
  additionalResourcesState.detailResource = undefined;
  additionalResourcesState.detailPlayerColor = undefined;
}
