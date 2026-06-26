<template>
  <!--
    ArcScaleMarkerChip — the UNIFIED marker chip for every global-parameter
    scale. The single premium chassis (pointer + halo + glass frame + icon +
    cube-slot) behind BOTH the scale REWARD bonuses (BonusZone: Venus / O₂ /
    temperature) and the OCEAN planetary-EVENT chips (OceanEventMarker). Each
    caller passes its own tooltip via the default <slot>.

    Reuses the proven `.bonus-zone__*` visual language (bonus_zones.less); the
    `variant` (reward / standard-bonus / planetary-event / hazard-event) and the
    `surface` (per-scale tint) drive the look, `state` (available / claimed /
    government) the claim painting, and `claimKey` the one-shot capture animation.
  -->
  <div
    class="bonus-zone arc-marker"
    :class="[
      `bonus-zone--${tier}`,
      `bonus-zone--${state}`,
      `bonus-zone--surface-${surface}`,
      `arc-marker--${variant}`,
      {'bonus-zone--reached': reached, 'bonus-zone--just-claimed': justClaimed},
    ]"
    :style="rootStyle">
    <div class="bonus-zone__pointer" :style="pointerStyle"></div>
    <div class="bonus-zone__rot" :style="rotStyle">
      <div class="bonus-zone__halo"></div>
      <div class="bonus-zone__frame"></div>
      <div class="bonus-zone__icon" :class="icon"></div>
      <div class="bonus-zone__cube-slot"></div>
    </div>
    <slot></slot>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BonusZoneTier, BonusZoneState} from '@/client/components/board/scaleBonusZones';
import {consumeNewScaleBonusClaim} from '@/client/components/board/scaleBonusClaimState';

export type ArcScaleMarkerVariant = 'reward' | 'standard-bonus' | 'planetary-event' | 'hazard-event' | 'custom';

export default defineComponent({
  name: 'ArcScaleMarkerChip',
  props: {
    /** What kind of marker this is (drives the accent / event styling). */
    variant: {type: String as PropType<ArcScaleMarkerVariant>, default: 'standard-bonus'},
    /** Which scale it belongs to — drives the per-scale colour tint. */
    surface: {type: String, default: 'venus'},
    /** Visual weight (regular vs the legendary gold final). */
    tier: {type: String as PropType<BonusZoneTier>, default: 'regular'},
    /** Claim state (rewards): available / claimed / government. */
    state: {type: String as PropType<BonusZoneState>, default: 'available'},
    /** Event chips: highlight once the threshold has been reached. */
    reached: {type: Boolean, default: false},
    /** Icon class for the pictogram (`bonus-zone-icon--*` / event icon). */
    icon: {type: String, required: true},
    /** Degrees the node visuals follow the arc tangent (pointer/tooltip stay upright). */
    rot: {type: Number, default: 0},
    /** Degrees the triangle pointer is rotated to aim at the scale division. */
    point: {type: Number, default: 0},
    /** How far (px) to push the pointer out so its tip reaches the band edge. */
    pointerDist: {type: Number, default: 16},
    /** Owner colour for a claimed reward ('' otherwise). */
    claimColor: {type: String, default: ''},
    /** Stable id (`<scale>-<step>`) for the one-shot claim animation tracking. */
    claimKey: {type: String, default: ''},
  },
  data() {
    return {
      // Plays the premium capture animation once, the first time THIS client
      // observes the claim (tracked at module level so the board's remount on
      // every server response doesn't replay it).
      justClaimed: false,
    };
  },
  mounted() {
    if (this.state !== 'available' && this.claimKey !== '') {
      const identity = `${this.claimKey}:${this.state}:${this.claimColor}`;
      if (consumeNewScaleBonusClaim(identity)) {
        this.justClaimed = true;
        window.setTimeout(() => {
          this.justClaimed = false;
        }, 1100);
      }
    }
  },
  computed: {
    rotStyle(): Record<string, string> {
      return this.rot === 0 ? {} : {transform: `rotate(${this.rot}deg)`};
    },
    pointerStyle(): Record<string, string> {
      // Rotate to aim at the division, then push the triangle out so its tip
      // reaches the band edge ("up" is the tip direction in the rotated frame).
      return {transform: `rotate(${this.point}deg) translateY(${-this.pointerDist}px)`};
    },
    rootStyle(): Record<string, string> {
      return this.claimColor === '' ? {} : {'--bonus-claim-color': this.claimColor};
    },
  },
});
</script>
