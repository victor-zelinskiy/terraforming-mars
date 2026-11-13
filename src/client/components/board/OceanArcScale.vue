<template>
  <div class="global-numbers-oceans" aria-hidden="true">
    <arc-scale :theme="oceanTheme" :config="oceanConfig" :value="value" :identityMiddle="eventsOutside" />

    <scale-event-marker
      v-for="m in eventMarkers"
      :key="m.marker.id"
      :marker="m.marker"
      surface="oceans"
      :top="m.top"
      :left="m.left"
      :size="m.size"
      :point="m.point"
      :pointerDist="m.pointerDist"
      :pointerLen="m.pointerLen"
      :reached="m.reached"
      :players="players" />
  </div>
</template>

<script setup vapor lang="ts">
/*
 * OceanArcScale — the OCEAN global parameter at the bottom of the planet.
 *
 * Band + digits + indicator + identity are all the shared ArcScale now (one
 * visual family with O₂ / temperature / Venus). This wrapper only adds the
 * ocean planetary-event chips: the LIVE Ares thresholds when `aresMarkers` is
 * supplied (a real game), else the forward-looking dev markers at 3 / 6 (hidden
 * in a normal game — see oceanThresholdMarkers.ts / aresThresholdMarkers.ts).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import ScaleEventMarker from '@/client/components/board/ScaleEventMarker.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {DynamicArcConfig, OCEAN_ARC} from '@/client/components/board/arcScaleConfigs';
import {ArcScaleConfig, markerChip} from '@/client/components/board/arcScaleGeometry';
import {GlobalParameterThresholdMarker, oceanThresholdMarkers} from '@/client/components/board/oceanThresholdMarkers';
import {glidedThreshold} from '@/client/components/board/aresMarkerGlide';

// Geometry — the band's own config (`OCEAN_ARC` on the classic ring; the eleven-row field's `LARGE_ARCS.oceans`):
// the event chips line up with the band by reading the same circle.
// Match the standard scale-bonus markers (scaleBonusZones.ts): size 25, gap 2,
// connector 7 — one unified size + distance for events AND reward bonuses.
const CHIP = 25;
const MARKER_POINTER = 7;
const MARKER_GAP = 2;


type EventMarkerView = {
  marker: GlobalParameterThresholdMarker;
  top: number; left: number; size: number; point: number; pointerDist: number; pointerLen: number; reached: boolean;
};

defineOptions({name: 'OceanArcScale'});
const props = defineProps({
  /** Current ocean count (0..9). */
  value: {type: Number, default: 0},
  /** Whether the dev planetary-event markers are active (else hidden). */
  planetaryEvents: {type: Boolean, default: false},
  /**
   * LIVE Ares ocean markers (built from the real hazard thresholds). When
   * provided, these REPLACE the dev markers — a real Ares game shows them.
   */
  aresMarkers: {type: Array as PropType<ReadonlyArray<GlobalParameterThresholdMarker>>, default: undefined},
  /** Players (colour + name) — passed to the event markers to name a claimer. */
  players: {type: Array as PropType<ReadonlyArray<{color: string, name: string}>>, default: () => []},
  /** The band (the classic ring's `OCEAN_ARC` by default; Amazonis Planitia's flat arc under its grid). */
  config: {type: Object as PropType<DynamicArcConfig>, default: () => OCEAN_ARC},
  /**
   * The event chips stand OUTSIDE the band (under it) — the eleven-row field's grid reaches the band's inner edge,
   * so a chip toward the planet would sit on row L; the identity badge then stands inside at 6 o'clock (`identityMiddle`).
   */
  eventsOutside: {type: Boolean, default: false},
});

const oceanTheme = ARC_SCALE_THEMES.oceans;
const oceanConfig = computed((): DynamicArcConfig => {
  return props.config;
});
/** The pure geometry view of the band (centre, radius, the value range). */
const geometry = computed((): ArcScaleConfig => {
  const c = props.config;
  return {center: c.center, radius: c.bandRadius, startAngle: c.startAngle, endAngle: c.endAngle, startValue: c.startValue, endValue: c.endValue};
});
const sourceMarkers = computed((): ReadonlyArray<GlobalParameterThresholdMarker> => {
  if (props.aresMarkers !== undefined && props.aresMarkers.length > 0) {
    return props.aresMarkers;
  }
  return oceanThresholdMarkers({planetaryEvents: props.planetaryEvents}).filter((m) => m.visible);
});
const eventMarkers = computed((): ReadonlyArray<EventMarkerView> => {
  return sourceMarkers.value.map((marker) => {
    // INSIDE the band (toward the planet) — above the bottom arc — pointer
    // aiming down at the threshold. Mirror of the Venus chips. Position uses
    // the GLIDED threshold so a Butterfly-Effect shift animates along the arc.
    const band = props.config.bandWidth;
    const chip = markerChip(geometry.value, glidedThreshold(marker.id, marker.value), props.eventsOutside ? 'outside' : 'inside', {
      bandInner: props.config.bandRadius - band / 2, bandOuter: props.config.bandRadius + band / 2, gap: MARKER_GAP, pointer: MARKER_POINTER, size: CHIP,
    });
    return {
      marker,
      top: Math.round(chip.y - CHIP / 2),
      left: Math.round(chip.x - CHIP / 2),
      size: CHIP,
      point: chip.point,
      pointerDist: chip.pointerDist,
      pointerLen: chip.pointerLen,
      reached: props.value >= marker.value,
    };
  });
});
</script>
