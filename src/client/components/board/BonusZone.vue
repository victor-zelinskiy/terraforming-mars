<template>
  <arc-scale-marker-chip
    variant="standard-bonus"
    :surface="surface"
    :tier="tier"
    :state="state"
    :rot="rot"
    :point="point"
    :pointerDist="pointerDist"
    :pointerLen="pointerLen"
    :icon="icon"
    :claimColor="claimColor"
    :claimKey="claimKey"
    :tooltip="tooltipContent" />
</template>

<script setup vapor lang="ts">
/*
 * Scale REWARD bonus (Venus / O₂ / temperature). A thin wrapper over the
 * unified ArcScaleMarkerChip — it only builds the reward + claim TOOLTIP
 * content and forwards the claim props; the chip is the shared premium chassis
 * (one visual language with the ocean event chips) and routes the hover through
 * the unified ScaleTooltip. Positioning (`:style`) + the surface tint flow
 * through to the chip's root.
 */
import {computed, PropType} from 'vue';
import ArcScaleMarkerChip from '@/client/components/board/ArcScaleMarkerChip.vue';
import {BonusZoneTier, BonusZoneState} from '@/client/components/board/scaleBonusZones';
import {ScaleTooltipContent, ScaleTooltipRow, ScaleTooltipAccent} from '@/client/components/board/scaleTooltipState';
import {translateText} from '@/client/directives/i18n';

defineOptions({name: 'BonusZone'});
const props = defineProps({
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
  // Connector visible length (px) — chip edge → rail edge.
  pointerLen: {type: Number, default: 9},
  // Owner colour painted on a claimed node ('' when available / government).
  claimColor: {type: String, default: ''},
  // Owner display name for the hover ('' when none).
  claimedBy: {type: String, default: ''},
  // Stable identity (`<scale>-<step>`) for the one-shot claim animation.
  claimKey: {type: String, default: ''},
  // Which scale this bonus lives on (per-scale colour tint).
  surface: {type: String, default: 'venus'},
});

const tooltipContent = computed((): ScaleTooltipContent | null => {
  if (props.reward === '') {
    return null;
  }
  const rows: Array<ScaleTooltipRow> = [{text: translateText(props.reward), tone: 'reward'}];
  if (props.state === 'claimed') {
    rows.push({text: `${translateText('Taken by')} ${props.claimedBy}`, tone: 'claim', dot: props.claimColor});
  } else if (props.state === 'government') {
    rows.push({text: translateText('Taken via world government'), tone: 'claim'});
  }
  return {
    accent: props.surface as ScaleTooltipAccent,
    kicker: translateText('Bonus'),
    rows,
  };
});
</script>
