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

<script lang="ts">
import {defineComponent, PropType} from 'vue';
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
    /** Players (colour + name) — passed to the event markers to name a claimer. */
    players: {type: Array as PropType<ReadonlyArray<{color: string, name: string}>>, default: () => []},
    /** The band (the classic ring's `OCEAN_ARC` by default; Amazonis Planitia's flat arc under its grid). */
    config: {type: Object as PropType<DynamicArcConfig>, default: () => OCEAN_ARC},
    /**
     * The event chips stand OUTSIDE the band (under it) — the eleven-row field's grid reaches the band's inner edge,
     * so a chip toward the planet would sit on row L; the identity badge then stands inside at 6 o'clock (`identityMiddle`).
     */
    eventsOutside: {type: Boolean, default: false},
  },
  data() {
    return {
      oceanTheme: ARC_SCALE_THEMES.oceans,
    };
  },
  computed: {
    oceanConfig(): DynamicArcConfig {
      return this.config;
    },
    /** The pure geometry view of the band (centre, radius, the value range). */
    geometry(): ArcScaleConfig {
      const c = this.config;
      return {center: c.center, radius: c.bandRadius, startAngle: c.startAngle, endAngle: c.endAngle, startValue: c.startValue, endValue: c.endValue};
    },
    sourceMarkers(): ReadonlyArray<GlobalParameterThresholdMarker> {
      if (this.aresMarkers !== undefined && this.aresMarkers.length > 0) {
        return this.aresMarkers;
      }
      return oceanThresholdMarkers({planetaryEvents: this.planetaryEvents}).filter((m) => m.visible);
    },
    eventMarkers(): ReadonlyArray<EventMarkerView> {
      return this.sourceMarkers.map((marker) => {
        // INSIDE the band (toward the planet) — above the bottom arc — pointer
        // aiming down at the threshold. Mirror of the Venus chips. Position uses
        // the GLIDED threshold so a Butterfly-Effect shift animates along the arc.
        const band = this.config.bandWidth;
        const chip = markerChip(this.geometry, glidedThreshold(marker.id, marker.value), this.eventsOutside ? 'outside' : 'inside', {
          bandInner: this.config.bandRadius - band / 2, bandOuter: this.config.bandRadius + band / 2, gap: MARKER_GAP, pointer: MARKER_POINTER, size: CHIP,
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
