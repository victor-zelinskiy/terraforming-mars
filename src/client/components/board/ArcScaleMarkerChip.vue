<template>
  <div
    class="bonus-zone arc-marker"
    :class="[
      `bonus-zone--${tier}`,
      `bonus-zone--${state}`,
      `bonus-zone--surface-${surface}`,
      `arc-marker--${variant}`,
      {'bonus-zone--reached': reached, 'bonus-zone--just-claimed': justClaimed},
    ]"
    :style="rootStyle"
    :data-arc-marker="markerNavId"
    @mouseenter="onEnter"
    @mouseleave="onLeave">
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

<script setup vapor lang="ts">
/*
 * ArcScaleMarkerChip — the UNIFIED marker chip for every global-parameter
 * scale. The single premium chassis (pointer + halo + glass frame + icon +
 * cube-slot) behind BOTH the scale REWARD bonuses (BonusZone: Venus / O₂ /
 * temperature) and the planetary-EVENT chips (ScaleEventMarker: oceans /
 * temperature / oxygen). Each caller passes its own tooltip via the default <slot>.
 *
 * Reuses the proven `.bonus-zone__*` visual language (bonus_zones.less); the
 * `variant` (reward / standard-bonus / planetary-event / hazard-event) and the
 * `surface` (per-scale tint) drive the look, `state` (available / claimed /
 * government) the claim painting, and `claimKey` the one-shot capture animation.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, PropType, ref, watch} from 'vue';
import {BonusZoneTier, BonusZoneState} from '@/client/components/board/scaleBonusZones';
import {consumeNewScaleBonusClaim} from '@/client/components/board/scaleBonusClaimState';
import {ScaleTooltipContent, showScaleTooltip, hideScaleTooltip} from '@/client/components/board/scaleTooltipState';
import {useFlowScope} from '@/client/console/session/useFlowScope';

export type ArcScaleMarkerVariant = 'reward' | 'standard-bonus' | 'planetary-event' | 'hazard-event' | 'custom';

defineOptions({name: 'ArcScaleMarkerChip'});
const props = defineProps({
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
  /** Degrees the connector is rotated to aim at the scale division. */
  point: {type: Number, default: 0},
  /** How far (px) to push the connector out so its tip reaches the band edge. */
  pointerDist: {type: Number, default: 16},
  /** Connector visible length (px) — chip edge → rail edge. */
  pointerLen: {type: Number, default: 9},
  /** Owner colour for a claimed reward ('' otherwise). */
  claimColor: {type: String, default: ''},
  /** Stable id (`<scale>-<step>`) for the one-shot claim animation tracking. */
  claimKey: {type: String, default: ''},
  /** Unified hover tooltip content (reward / event). Null → no tooltip. */
  tooltip: {type: Object as PropType<ScaleTooltipContent | null>, default: null},
});

const flow = useFlowScope('arc-scale-marker-chip');
// Plays the premium capture animation once per claim TRANSITION the
// player actually witnessed (tracked at module level so a component
// recreation can't replay it).
const justClaimed = ref(false);
/** The one-shot capture key: '' while unclaimed / untracked. */
const claimIdentity = computed((): string => {
  if (props.state === 'available' || props.claimKey === '') {
    return '';
  }
  return `${props.claimKey}:${props.state}:${props.claimColor}`;
});
const rotStyle = computed((): Record<string, string> => {
  return props.rot === 0 ? {} : {transform: `rotate(${props.rot}deg)`};
});
const pointerStyle = computed((): Record<string, string> => {
  // The connector is a luminous STEM of length `pointerLen`. It is CENTRED on
  // the chip via negative margins (half its own size — the proven idiom, so
  // `transform-origin: center` pivots exactly on the chip centre), then
  // rotated to aim at the division and pushed out (`translateY`) so its TIP
  // (the rail-anchor end) lands exactly on the band edge. The variable height
  // is what lets a fanned chip's longer connector still reach the rail.
  return {
    height: `${props.pointerLen}px`,
    marginTop: `${-props.pointerLen / 2}px`,
    transform: `rotate(${props.point}deg) translateY(${-props.pointerDist}px)`,
  };
});
const rootStyle = computed((): Record<string, string> => {
  return props.claimColor === '' ? {} : {'--bonus-claim-color': props.claimColor};
});
/**
 * P27: a stable identity for controller navigation (console Board
 * Inspection Mode enumerates `[data-arc-marker]` to walk the scale
 * bonuses/events without a mouse). `claimKey` when present (reward
 * chips), else a deterministic surface/icon/angle composite.
 */
const markerNavId = computed((): string => {
  if (props.claimKey !== '') {
    return props.claimKey;
  }
  return `${props.surface}:${props.icon}:${Math.round(props.point)}`;
});
function onEnter(ev: MouseEvent): void {
  if (props.tooltip !== null) {
    showScaleTooltip(ev.currentTarget as HTMLElement, props.tooltip);
  }
}
function onLeave(): void {
  hideScaleTooltip();
}

// The REAL capture: the claim identity changes while the chip is on
// screen (available → claimed, or the world government takes the step).
watch(() => claimIdentity.value, (now: string): void => {
  if (now === '' || !consumeNewScaleBonusClaim(now)) {
    return;
  }
  justClaimed.value = true;
  flow.after(1100, 'the chip\'s capture animation ends', () => {
    justClaimed.value = false;
  });
});
onMounted(() => {
  // HYDRATION IS NOT A GAME EVENT: a chip that mounts already claimed is
  // the board being ADOPTED (entering an existing game / F5), never a
  // capture happening now — seed the ledger silently, exactly like the
  // tile/cube/marker baselines. The module ledger used to be consulted
  // only here, which had the behaviour precisely inverted since the
  // no-remount rework: every already-claimed bonus IGNITED on entry while
  // a live claim (a prop change, no remount) never animated at all.
  if (claimIdentity.value !== '') {
    consumeNewScaleBonusClaim(claimIdentity.value);
  }
});
onBeforeUnmount(() => {
  hideScaleTooltip();
});
</script>
