<template>
  <!--
    Premium reward-zone node — the unified "bonus chip" of the board UI.

      __pointer  stylized triangle aiming at the node's scale division (so it's
                 unmistakable which bonus belongs to which tick)
      __rot      rotation wrapper (keeps the pointer + tooltip upright)
        __halo   ambient bloom
        __frame  glassmorphic chip + holographic accent rim
        __icon   the reward pictogram
        __cube-slot reserved claim anchor
      __tip      premium hover tooltip (reward text + future claim line)

    `tier` scales the visual weight (regular vs the legendary gold final);
    `state` is wired for phase 2 — the future mechanic PAINTS the node in the
    claiming player's colour (see `--bonus-claim-color`) and the tooltip names
    who took it.
  -->
  <div class="bonus-zone"
       :class="[`bonus-zone--${tier}`, `bonus-zone--${state}`, `bonus-zone--surface-${surface}`, {'bonus-zone--just-claimed': justClaimed}]"
       :style="nodeStyle">
    <div class="bonus-zone__pointer" :style="pointerStyle"></div>
    <div class="bonus-zone__rot" :style="rotStyle">
      <div class="bonus-zone__halo"></div>
      <div class="bonus-zone__frame"></div>
      <div class="bonus-zone__icon" :class="icon"></div>
      <!-- A claim badge appears here once the bonus is taken (paints in the
           owner's colour); empty + invisible while available. -->
      <div class="bonus-zone__cube-slot"></div>
    </div>
    <div v-if="reward !== ''" class="bonus-zone__tip" role="tooltip">
      <span class="bonus-zone__tip-reward" v-i18n>{{ reward }}</span>
      <!-- Who took the bonus: a player (their colour) or the world government. -->
      <span v-if="state === 'claimed'" class="bonus-zone__tip-claim">
        <span class="bonus-zone__tip-dot" :style="{background: claimColor}"></span>
        <span v-i18n>Taken by</span>&nbsp;{{ claimedBy }}
      </span>
      <span v-else-if="state === 'government'" class="bonus-zone__tip-claim bonus-zone__tip-claim--gov" v-i18n>Taken via world government</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BonusZoneTier, BonusZoneState} from '@/client/components/board/scaleBonusZones';
import {consumeNewScaleBonusClaim} from '@/client/components/board/scaleBonusClaimState';

export default defineComponent({
  name: 'BonusZone',
  props: {
    icon: {
      type: String,
      required: true,
    },
    reward: {
      type: String,
      default: '',
    },
    tier: {
      type: String as PropType<BonusZoneTier>,
      default: 'regular',
    },
    state: {
      type: String as PropType<BonusZoneState>,
      default: 'available',
    },
    // Degrees the node visuals follow the arc tangent. Applied to the inner
    // wrapper only, so the pointer + tooltip stay independent.
    rot: {
      type: Number,
      default: 0,
    },
    // Degrees the triangle pointer is rotated to aim at the scale division.
    point: {
      type: Number,
      default: 0,
    },
    // How far (px) to push the pointer out so its tip reaches the band edge.
    pointerDist: {
      type: Number,
      default: 16,
    },
    // Phase-2 claim: the owner's CSS colour painted on the node (undefined when
    // available or government-claimed — government uses a fixed grey).
    claimColor: {
      type: String,
      default: '',
    },
    // Phase-2 claim: the owner's display name for the hover ('' when none).
    claimedBy: {
      type: String,
      default: '',
    },
    // Stable identity of the bonus (`<scale>-<step>`) for the one-shot claim
    // animation tracking.
    claimKey: {
      type: String,
      default: '',
    },
    // Lets one node language adapt to where it lives (which scale today).
    // Purely a styling hook.
    surface: {
      type: String,
      default: 'venus',
    },
  },
  data() {
    return {
      // Plays the premium capture animation once, the first time THIS client
      // observes this claim (tracked at module level so the board's remount on
      // every server response doesn't replay it).
      justClaimed: false,
    };
  },
  mounted() {
    if (this.state !== 'available') {
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
    nodeStyle(): Record<string, string> {
      return this.claimColor === '' ? {} : {'--bonus-claim-color': this.claimColor};
    },
  },
});
</script>
