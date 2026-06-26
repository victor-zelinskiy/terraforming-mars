<template>
  <!--
    A compact planetary-EVENT chip pinned to an ocean threshold. Now a thin
    wrapper over the unified ArcScaleMarkerChip (one visual language with the
    scale reward bonuses) — it only supplies the richer, diegetic tooltip and
    the ocean surface tint / event variant. Hidden in a normal game (gated in
    oceanThresholdMarkers.ts); no expansion name is ever shown.
  -->
  <arc-scale-marker-chip
    class="ocean-event"
    :variant="marker.kind"
    surface="oceans"
    :reached="reached"
    :point="point"
    :pointerDist="pointerDist"
    :icon="marker.icon"
    :style="nodeStyle"
    role="img"
    :aria-label="ariaLabel">
    <div class="ocean-event__tip" role="tooltip">
      <span class="ocean-event__tip-kind" v-i18n>{{ marker.title }}</span>
      <span v-if="marker.description" class="ocean-event__tip-desc" v-i18n>{{ marker.description }}</span>
      <span v-if="rewardRecipient === 'none'" class="ocean-event__tip-noreward" v-i18n>No reward to players.</span>
      <span v-else-if="rewardRecipient === 'triggering-player'" class="ocean-event__tip-reward">
        <span class="ocean-event__tip-reward-label" v-i18n>Reward to the player reaching the threshold:</span>
        <span class="ocean-event__tip-reward-value" v-i18n>{{ marker.rewardLabel }}</span>
      </span>
    </div>
  </arc-scale-marker-chip>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ArcScaleMarkerChip from '@/client/components/board/ArcScaleMarkerChip.vue';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';

export default defineComponent({
  name: 'OceanEventMarker',
  components: {ArcScaleMarkerChip},
  props: {
    marker: {type: Object as PropType<GlobalParameterThresholdMarker>, required: true},
    /** Marker top-left margin (`.global-numbers` space) + box size. */
    top: {type: Number, required: true},
    left: {type: Number, required: true},
    size: {type: Number, default: 20},
    /** Pointer rotation (deg) so the triangle aims at the band. */
    point: {type: Number, default: 0},
    /** How far (px) to push the pointer toward the band edge. */
    pointerDist: {type: Number, default: 16},
    /** True once the ocean count has reached this threshold (highlight state). */
    reached: {type: Boolean, default: false},
  },
  computed: {
    nodeStyle(): Record<string, string> {
      return {
        'margin': `${this.top}px 0 0 ${this.left}px`,
        'width': `${this.size}px`,
        'height': `${this.size}px`,
      };
    },
    rewardRecipient(): string {
      return this.marker.reward?.recipient ?? 'none';
    },
    ariaLabel(): string {
      return this.marker.title;
    },
  },
});
</script>
