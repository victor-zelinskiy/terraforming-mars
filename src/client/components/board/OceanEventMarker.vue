<template>
  <!--
    A compact premium "event chip" pinned to an ocean threshold. Reuses the
    board's bonus-zone visual language (octagon glass frame + halo + pointer +
    icon) so it reads as part of the same scale-bonus family as the Venus / O₂ /
    temperature chips, but carries a RICHER, diegetic tooltip describing the
    in-world planetary event (no expansion name is ever shown).

    The pointer aims UP at the band (the chip body sits just outside the arc,
    toward space), mirroring how the Venus chips point at their division.
  -->
  <div
    class="ocean-event bonus-zone bonus-zone--regular bonus-zone--surface-oceans"
    :class="{'ocean-event--reached': reached, 'ocean-event--reward': hasReward}"
    :style="nodeStyle"
    role="img"
    :aria-label="ariaLabel">
    <div class="bonus-zone__pointer" :style="pointerStyle"></div>
    <div class="bonus-zone__rot">
      <div class="bonus-zone__halo"></div>
      <div class="bonus-zone__frame"></div>
      <div class="bonus-zone__icon" :class="marker.icon"></div>
    </div>
    <div class="ocean-event__tip" role="tooltip">
      <span class="ocean-event__tip-kind" v-i18n>{{ marker.title }}</span>
      <span v-if="marker.description" class="ocean-event__tip-desc" v-i18n>{{ marker.description }}</span>
      <span v-if="rewardRecipient === 'none'" class="ocean-event__tip-noreward" v-i18n>No reward to players.</span>
      <span v-else-if="rewardRecipient === 'triggering-player'" class="ocean-event__tip-reward">
        <span class="ocean-event__tip-reward-label" v-i18n>Reward to the player reaching the threshold:</span>
        <span class="ocean-event__tip-reward-value" v-i18n>{{ marker.rewardLabel }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';

export default defineComponent({
  name: 'OceanEventMarker',
  props: {
    marker: {
      type: Object as PropType<GlobalParameterThresholdMarker>,
      required: true,
    },
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
    pointerStyle(): Record<string, string> {
      return {transform: `rotate(${this.point}deg) translateY(${-this.pointerDist}px)`};
    },
    rewardRecipient(): string {
      return this.marker.reward?.recipient ?? 'none';
    },
    hasReward(): boolean {
      return this.rewardRecipient === 'triggering-player';
    },
    ariaLabel(): string {
      return this.marker.title;
    },
  },
});
</script>
