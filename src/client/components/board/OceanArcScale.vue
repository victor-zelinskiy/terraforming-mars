<template>
  <!--
    OceanArcScale — the OCEAN global parameter at the bottom of the planet.

    Band + digits + indicator + identity are all the shared ArcScale now (one
    visual family with O₂ / temperature / Venus). This wrapper only adds the
    ocean planetary-event chips: the LIVE Ares thresholds when `aresMarkers` is
    supplied (a real game), else the forward-looking dev markers at 3 / 6 (hidden
    in a normal game — see oceanThresholdMarkers.ts / aresThresholdMarkers.ts).
  -->
  <div class="global-numbers-oceans" aria-hidden="true">
    <arc-scale :theme="oceanTheme" :config="oceanConfig" :value="value" />

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
      :reached="m.reached" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import ScaleEventMarker from '@/client/components/board/ScaleEventMarker.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {OCEAN_ARC} from '@/client/components/board/arcScaleConfigs';
import {ArcScaleConfig, markerChip} from '@/client/components/board/arcScaleGeometry';
import {GlobalParameterThresholdMarker, oceanThresholdMarkers} from '@/client/components/board/oceanThresholdMarkers';

// Geometry — must match OCEAN_ARC so the event chips line up with the band.
const CENTER = {x: 300, y: 301};
const RADIUS = 264;
const START_ANGLE = 116;
const END_ANGLE = 64;
const OCEAN_STEPS = 9;
const BAND = 22; // matches OCEAN_ARC.bandWidth so the event chips hug the band
const CHIP = 18;
const MARKER_POINTER = 10;
const MARKER_GAP = 12; // a touch more clearance above the rail

const OUTER_R = RADIUS + BAND / 2;
const INNER_R = RADIUS - BAND / 2;

const CFG: ArcScaleConfig = {
  center: CENTER, radius: RADIUS, startAngle: START_ANGLE, endAngle: END_ANGLE, startValue: 1, endValue: OCEAN_STEPS,
};

type EventMarkerView = {
  marker: GlobalParameterThresholdMarker;
  top: number; left: number; size: number; point: number; pointerDist: number; pointerLen: number; reached: boolean;
};

export default defineComponent({
  name: 'OceanArcScale',
  components: {ArcScale, ScaleEventMarker},
  props: {
    /** Current ocean count (0..9). */
    value: {type: Number, default: 0},
    /** Whether the dev planetary-event markers are active (else hidden). */
    planetaryEvents: {type: Boolean, default: false},
    /**
     * LIVE Ares ocean markers (built from the real hazard thresholds). When
     * provided, these REPLACE the dev markers — a real Ares game shows them.
     */
    aresMarkers: {type: Array as PropType<ReadonlyArray<GlobalParameterThresholdMarker>>, default: undefined},
  },
  data() {
    return {
      oceanTheme: ARC_SCALE_THEMES.oceans,
      oceanConfig: OCEAN_ARC,
    };
  },
  computed: {
    sourceMarkers(): ReadonlyArray<GlobalParameterThresholdMarker> {
      if (this.aresMarkers !== undefined && this.aresMarkers.length > 0) {
        return this.aresMarkers;
      }
      return oceanThresholdMarkers({planetaryEvents: this.planetaryEvents}).filter((m) => m.visible);
    },
    eventMarkers(): ReadonlyArray<EventMarkerView> {
      return this.sourceMarkers.map((marker) => {
        // INSIDE the band (toward the planet) — above the bottom arc — pointer
        // aiming down at the threshold. Mirror of the Venus chips.
        const chip = markerChip(CFG, marker.value, 'inside', {
          bandInner: INNER_R, bandOuter: OUTER_R, gap: MARKER_GAP, pointer: MARKER_POINTER, size: CHIP,
        });
        return {
          marker,
          top: Math.round(chip.y - CHIP / 2),
          left: Math.round(chip.x - CHIP / 2),
          size: CHIP,
          point: chip.point,
          pointerDist: chip.pointerDist,
          pointerLen: chip.pointerLen,
          reached: this.value >= marker.value,
        };
      });
    },
  },
});
</script>
