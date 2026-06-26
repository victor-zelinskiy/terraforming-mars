<template>
  <!--
    OceanArcScale — the OCEAN global parameter at the bottom of the planet.

    The premium BAND + identity badge are now the shared ArcScale component (one
    visual family with O₂ / temperature / Venus). This wrapper adds the parts
    that are ocean-specific:
      • the 1–9 digits (computed positions; also the anchors the indicator glides
        between) with future / visited / current states,
      • the gliding indicator (shared AnimatedScaleMarker, ocean accent),
      • the forward-looking planetary-event chips at 3 / 6 (hidden in a normal
        game — see oceanThresholdMarkers.ts).
  -->
  <div class="global-numbers-oceans" aria-hidden="true">
    <!-- shared themed band + identity badge -->
    <arc-scale :theme="oceanTheme" :config="oceanConfig" :value="value" />

    <!-- digit labels = AnimatedScaleMarker anchors -->
    <div
      v-for="d in digits"
      :key="'digit-' + d.value"
      :class="['global-numbers-value', 'val-' + d.value, {
        'val-is-active': d.value === value,
        'ocean-arc__digit--visited': d.value < value,
      }]"
      :style="{left: d.left + 'px', top: d.top + 'px'}">{{ d.value }}</div>

    <!-- gliding current-value cursor (shared dial component, ocean accent) -->
    <animated-scale-marker accent="oceans" :value="value" />

    <!-- forward-looking planetary-event chips (hidden unless the mechanic is on) -->
    <ocean-event-marker
      v-for="m in eventMarkers"
      :key="m.marker.id"
      :marker="m.marker"
      :top="m.top"
      :left="m.left"
      :size="m.size"
      :point="m.point"
      :pointerDist="m.pointerDist"
      :reached="value >= m.marker.value" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import AnimatedScaleMarker from '@/client/components/board/AnimatedScaleMarker.vue';
import OceanEventMarker from '@/client/components/board/OceanEventMarker.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {OCEAN_ARC} from '@/client/components/board/arcScaleConfigs';
import {ArcScaleConfig, pointForValue, markerChip} from '@/client/components/board/arcScaleGeometry';
import {GlobalParameterThresholdMarker, oceanThresholdMarkers} from '@/client/components/board/oceanThresholdMarkers';

// Geometry knobs — must match OCEAN_ARC (radius / angles / band) so the digits
// and event chips line up with the shared band ArcScale draws.
const CENTER = {x: 300, y: 301};
const RADIUS = 264;
const START_ANGLE = 116;
const END_ANGLE = 64;
const OCEAN_STEPS = 9;
const BAND = 18;
const DIGIT = 22;
const CHIP = 18;
const MARKER_POINTER = 9;
const MARKER_GAP = 9;

const OUTER_R = RADIUS + BAND / 2;
const INNER_R = RADIUS - BAND / 2;

// ArcScaleConfig (geometry) for the digit + event-chip maths (linear arc).
const CFG: ArcScaleConfig = {
  center: CENTER, radius: RADIUS, startAngle: START_ANGLE, endAngle: END_ANGLE, startValue: 1, endValue: OCEAN_STEPS,
};

type EventMarkerView = {
  marker: GlobalParameterThresholdMarker;
  top: number; left: number; size: number; point: number; pointerDist: number;
};

export default defineComponent({
  name: 'OceanArcScale',
  components: {ArcScale, AnimatedScaleMarker, OceanEventMarker},
  props: {
    /** Current ocean count (0..9). */
    value: {type: Number, default: 0},
    /** Whether the future planetary-event mechanic is active (else markers hidden). */
    planetaryEvents: {type: Boolean, default: false},
  },
  data() {
    return {
      oceanTheme: ARC_SCALE_THEMES.oceans,
      oceanConfig: OCEAN_ARC,
      digits: Array.from({length: OCEAN_STEPS}, (_, i) => {
        const v = i + 1;
        const p = pointForValue(CFG, v);
        return {value: v, left: Math.round(p.x - DIGIT / 2), top: Math.round(p.y - DIGIT / 2)};
      }),
    };
  },
  computed: {
    eventMarkers(): ReadonlyArray<EventMarkerView> {
      return oceanThresholdMarkers({planetaryEvents: this.planetaryEvents})
        .filter((m) => m.visible)
        .map((marker) => {
          // INSIDE the band (toward the planet) — above the bottom arc — with the
          // pointer aiming down at the threshold. Mirror of the Venus chips.
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
          };
        });
    },
  },
});
</script>
