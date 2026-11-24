<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible && name !== undefined"
        ref="box"
        class="journal-colony-preview"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <ColonyTile :colony="colonyModel" mode="view" :selectable="false" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup vapor lang="ts">
import {computed, PropType, useTemplateRef} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {useMeasuredPreviewStyle} from '@/client/components/journal/previewPlacement';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import ColonyTile from '@/client/components/colonies/ColonyTile.vue';

/**
 * Hover preview for a COLONY token (journal feed / notifications / the
 * drawn-cards source link) — a read-only colony MINI-CARD (planet image +
 * trade / build / colony bonuses), reusing the overlay's `ColonyTile`. Teleported
 * to body (floats above the feed clipping), `pointer-events: none` (never steals
 * hover from the token), and the tile's SELECT footer is hidden via CSS so it
 * reads as a pure preview. Placed beside its token by its MEASURED box (`previewPlacement.ts` — the tile sizes to
 * its content, and the constants that once assumed 286 × 360 put it 150 px above the name it explained).
 */
/** The guess of the one unpainted pass before the measure. */
const GUESS = {width: 180, height: 140};

defineOptions({name: 'ColonyPreviewPopover'});
const props = defineProps({
  name: {
    type: String as () => ColonyName | undefined,
    default: undefined,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  anchor: {
    type: Object as PropType<DOMRect | undefined>,
    default: undefined,
  },
});

const colonyModel = computed((): ColonyModel => {
  // A static preview: the colony at track position 0, no fleet / owners.
  return simpleColonyModel(props.name as ColonyName);
});
const box = useTemplateRef<HTMLElement>('box');
const positionStyle = useMeasuredPreviewStyle(box, () => props.visible && props.name !== undefined, () => props.anchor, GUESS);
</script>
