<template>
  <!--
    A compact planetary-EVENT chip pinned to a global-parameter threshold. A thin
    wrapper over the unified ArcScaleMarkerChip (one visual language with the
    scale reward bonuses) — it builds the richer, diegetic event TOOLTIP content
    (routed through the unified ScaleTooltip) and the per-scale surface tint /
    event variant. No expansion name is ever shown (titles read "Planetary
    event"). Used by OceanArcScale (oceans) and Board.vue (temperature / oxygen).
  -->
  <arc-scale-marker-chip
    class="scale-event"
    :variant="marker.kind"
    :surface="surface"
    :reached="reached"
    :point="point"
    :pointerDist="pointerDist"
    :pointerLen="pointerLen"
    :icon="marker.icon"
    :tooltip="tooltipContent"
    :style="nodeStyle"
    role="img"
    :aria-label="ariaLabel" />
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ArcScaleMarkerChip from '@/client/components/board/ArcScaleMarkerChip.vue';
import {GlobalParameterName, GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';
import {ScaleTooltipContent, ScaleTooltipRow} from '@/client/components/board/scaleTooltipState';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ScaleEventMarker',
  components: {ArcScaleMarkerChip},
  props: {
    marker: {type: Object as PropType<GlobalParameterThresholdMarker>, required: true},
    /** Which scale the chip sits on — drives the surface tint + tooltip accent. */
    surface: {type: String as PropType<GlobalParameterName>, default: 'oceans'},
    /** Marker top-left margin (`.global-numbers` space) + box size. */
    top: {type: Number, required: true},
    left: {type: Number, required: true},
    size: {type: Number, default: 20},
    /** Pointer rotation (deg) so the triangle aims at the band. */
    point: {type: Number, default: 0},
    /** How far (px) to push the pointer toward the band edge. */
    pointerDist: {type: Number, default: 16},
    /** Connector visible length (px) — chip edge → rail edge. */
    pointerLen: {type: Number, default: 9},
    /** True once the parameter has reached this threshold (highlight state). */
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
    tooltipContent(): ScaleTooltipContent {
      const rows: Array<ScaleTooltipRow> = [];
      if (this.marker.description) {
        rows.push({text: translateText(this.marker.description), tone: 'desc'});
      }
      if (this.rewardRecipient === 'none') {
        rows.push({text: translateText('No reward to players.'), tone: 'note'});
      } else if (this.rewardRecipient === 'triggering-player') {
        rows.push({text: translateText('Reward to the player reaching the threshold:'), tone: 'desc'});
        rows.push({text: translateText(this.marker.rewardLabel ?? ''), tone: 'reward'});
      }
      return {
        accent: this.surface,
        kicker: translateText(this.marker.title),
        rows,
      };
    },
  },
});
</script>
