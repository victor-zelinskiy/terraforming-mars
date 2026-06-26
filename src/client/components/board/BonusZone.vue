<template>
  <!--
    Scale REWARD bonus (Venus / O₂ / temperature). Now a thin wrapper over the
    unified ArcScaleMarkerChip — it only supplies the reward + claim TOOLTIP and
    forwards the claim props; the chip is the shared premium chassis (one visual
    language with the ocean event chips). Positioning (`:style`) and the surface
    tint flow through to the chip's root.
  -->
  <arc-scale-marker-chip
    variant="standard-bonus"
    :surface="surface"
    :tier="tier"
    :state="state"
    :rot="rot"
    :point="point"
    :pointerDist="pointerDist"
    :icon="icon"
    :claimColor="claimColor"
    :claimKey="claimKey">
    <div v-if="reward !== ''" class="bonus-zone__tip" role="tooltip">
      <span class="bonus-zone__tip-reward" v-i18n>{{ reward }}</span>
      <!-- Who took the bonus: a player (their colour) or the world government. -->
      <span v-if="state === 'claimed'" class="bonus-zone__tip-claim">
        <span class="bonus-zone__tip-dot" :style="{background: claimColor}"></span>
        <span v-i18n>Taken by</span>&nbsp;{{ claimedBy }}
      </span>
      <span v-else-if="state === 'government'" class="bonus-zone__tip-claim bonus-zone__tip-claim--gov" v-i18n>Taken via world government</span>
    </div>
  </arc-scale-marker-chip>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ArcScaleMarkerChip from '@/client/components/board/ArcScaleMarkerChip.vue';
import {BonusZoneTier, BonusZoneState} from '@/client/components/board/scaleBonusZones';

export default defineComponent({
  name: 'BonusZone',
  components: {ArcScaleMarkerChip},
  props: {
    icon: {type: String, required: true},
    reward: {type: String, default: ''},
    tier: {type: String as PropType<BonusZoneTier>, default: 'regular'},
    state: {type: String as PropType<BonusZoneState>, default: 'available'},
    // Degrees the node visuals follow the arc tangent.
    rot: {type: Number, default: 0},
    // Degrees the triangle pointer is rotated to aim at the scale division.
    point: {type: Number, default: 0},
    // How far (px) to push the pointer out so its tip reaches the band edge.
    pointerDist: {type: Number, default: 16},
    // Owner colour painted on a claimed node ('' when available / government).
    claimColor: {type: String, default: ''},
    // Owner display name for the hover ('' when none).
    claimedBy: {type: String, default: ''},
    // Stable identity (`<scale>-<step>`) for the one-shot claim animation.
    claimKey: {type: String, default: ''},
    // Which scale this bonus lives on (per-scale colour tint).
    surface: {type: String, default: 'venus'},
  },
});
</script>
