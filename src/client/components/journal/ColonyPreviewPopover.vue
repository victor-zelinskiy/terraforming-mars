<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible && name !== undefined"
        class="journal-colony-preview"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <ColonyTile :colony="colonyModel" mode="view" :selectable="false" />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import ColonyTile from '@/client/components/colonies/ColonyTile.vue';

/**
 * Hover preview for a COLONY token (journal feed / notifications / the
 * drawn-cards source link) — a read-only colony MINI-CARD (planet image +
 * trade / build / colony bonuses), reusing the overlay's `ColonyTile`. Teleported
 * to body (floats above the feed clipping), `pointer-events: none` (never steals
 * hover from the token), and the tile's SELECT footer is hidden via CSS so it
 * reads as a pure preview. Mirrors `CardPreviewPopover`'s smart positioning.
 */
const PREVIEW_WIDTH = 286;
const PREVIEW_HEIGHT = 360;
const GAP = 14;
const VIEWPORT_MARGIN = 8;

export default defineComponent({
  name: 'ColonyPreviewPopover',
  components: {ColonyTile},
  props: {
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
  },
  computed: {
    colonyModel(): ColonyModel {
      // A static preview: the colony at track position 0, no fleet / owners.
      return simpleColonyModel(this.name as ColonyName);
    },
    positionStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = a.left - GAP - PREVIEW_WIDTH;
      if (left < VIEWPORT_MARGIN) {
        left = a.right + GAP;
      }
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - PREVIEW_WIDTH - VIEWPORT_MARGIN));
      let top = a.top + a.height / 2 - PREVIEW_HEIGHT / 2;
      top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - PREVIEW_HEIGHT - VIEWPORT_MARGIN));
      return {left: `${Math.round(left)}px`, top: `${Math.round(top)}px`};
    },
  },
});
</script>
