<template>
  <arc-scale-marker-chip
    class="scale-event"
    :class="`scale-event--${eventState.lifecycle}`"
    :variant="marker.kind"
    :surface="surface"
    :reached="reached"
    :state="eventState.chipState"
    :claimColor="eventState.claimColor"
    :claimKey="eventState.claimKey"
    :point="point"
    :pointerDist="pointerDist"
    :pointerLen="pointerLen"
    :icon="marker.icon"
    :tooltip="tooltipContent"
    :style="nodeStyle"
    role="img"
    :aria-label="ariaLabel" />
</template>

<script setup lang="ts">
/*
 * A compact planetary-EVENT chip pinned to a global-parameter threshold. A thin
 * wrapper over the unified ArcScaleMarkerChip (one visual language with the
 * scale reward bonuses) — it builds the richer, diegetic event TOOLTIP content
 * (routed through the unified ScaleTooltip) and the per-scale surface tint /
 * event variant. No expansion name is ever shown (titles read "Planetary
 * event"). Used by OceanArcScale (oceans) and Board.vue (temperature / oxygen).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import ArcScaleMarkerChip from '@/client/components/board/ArcScaleMarkerChip.vue';
import {GlobalParameterName, GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';
import {resolveScaleEventState, ScaleEventState} from '@/client/components/board/aresThresholdMarkers';
import {ScaleTooltipContent, ScaleTooltipRow} from '@/client/components/board/scaleTooltipState';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ScaleEventMarker'});
const props = defineProps({
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
  /** Players (colour + name) — to name the claimer of a rewarded event. */
  players: {type: Array as PropType<ReadonlyArray<{color: string, name: string}>>, default: () => []},
});

// The single source of truth for "how is this chip painted now"
// (upcoming / resolved / claimed-in-player-colour). See resolveScaleEventState.
const eventState = computed((): ScaleEventState => {
  return resolveScaleEventState(props.marker, props.reached, props.players);
});
const nodeStyle = computed((): Record<string, string> => {
  return {
    'margin': `${props.top}px 0 0 ${props.left}px`,
    'width': `${props.size}px`,
    'height': `${props.size}px`,
  };
});
const rewardRecipient = computed((): string => {
  return props.marker.reward?.recipient ?? 'none';
});
const ariaLabel = computed((): string => {
  return props.marker.title;
});
const tooltipContent = computed((): ScaleTooltipContent => {
  const rows: Array<ScaleTooltipRow> = [];
  if (props.marker.description) {
    rows.push({text: translateText(props.marker.description), tone: 'desc'});
  }
  const state = eventState.value;
  if (rewardRecipient.value === 'none') {
    // A hazard event with no payout: forward-looking before it fires, settled after.
    rows.push({
      text: translateText(state.lifecycle === 'resolved' ? 'Event resolved — no reward to players.' : 'No reward to players.'),
      tone: 'note',
    });
  } else if (rewardRecipient.value === 'triggering-player') {
    if (state.lifecycle === 'claimed') {
      // Already fired — name who claimed the reward (painted in their colour).
      rows.push({
        text: state.claimedByName !== '' ?
          translateTextWithParams('Reward claimed by ${0}:', [state.claimedByName]) :
          translateText('Reward claimed by the player who reached the threshold:'),
        tone: 'desc',
      });
    } else {
      rows.push({text: translateText('Reward to the player reaching the threshold:'), tone: 'desc'});
    }
    rows.push({text: translateText(props.marker.rewardLabel ?? ''), tone: 'reward'});
  }
  return {
    accent: props.surface,
    kicker: translateText(props.marker.title),
    rows,
  };
});
</script>
