<template>
  <!--
    OceanArcScale — the OCEAN global parameter as a compact premium arc on the
    Mars board, drawn ENTIRELY in code (no baked-in PNG band under it).

    It sits in the free window at the BOTTOM of the planet, concentric with the
    O₂ (left) and temperature (right) arcs — so the four global parameters read
    as ONE system. All geometry is computed by arcScaleGeometry.ts; nothing is
    hand-placed.

    Structure mirrors the existing scales (continuous band + tick graduations +
    digits + a gliding cursor), so it feels native:
      • SVG band  — a dim channel + a bright WATER fill that grows from 1 toward
                    the current count (revealed via stroke-dashoffset, so the
                    fill end lands exactly under the indicator) + sheen + ticks.
      • digits    — 1–9 labels; these double as the anchors the shared
                    AnimatedScaleMarker glides between (identical cursor + motion
                    to the other dials).
      • indicator — the gliding current-value cursor.
      • markers   — future planetary-event chips at 3 & 6, hidden in a normal
                    game (see oceanThresholdMarkers.ts).

    This component is the PILOT for migrating the remaining scales off the PNG:
    the geometry helper + this render approach generalise to O₂ / temperature /
    Venus when that work is taken on.
  -->
  <div class="global-numbers-oceans ocean-arc" :class="{'ocean-arc--empty': value <= 0}" aria-hidden="true">
    <svg class="ocean-arc__svg" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" :width="SVG_W" :height="SVG_H">
      <defs>
        <linearGradient :id="GRAD_ID" gradientUnits="userSpaceOnUse"
          :x1="cfg.center.x" :y1="GRAD_TOP_Y" :x2="cfg.center.x" :y2="GRAD_BOT_Y">
          <stop offset="0%" class="ocean-arc__grad-bright" />
          <stop offset="55%" class="ocean-arc__grad-mid" />
          <stop offset="100%" class="ocean-arc__grad-deep" />
        </linearGradient>
      </defs>
      <!-- dim full-length channel (the empty track) -->
      <path class="ocean-arc__channel" :d="bandPath" />
      <!-- water fill: same path, revealed from value 1 up to the current count
           via stroke-dashoffset so its leading edge sits under the indicator -->
      <path
        v-if="fillFraction > 0"
        class="ocean-arc__fill"
        :d="bandPath"
        :stroke="gradStroke"
        :style="fillStyle" />
      <!-- precision graduation ticks just outside the band -->
      <line
        v-for="t in ticks"
        :key="'tick-' + t.value"
        class="ocean-arc__tick"
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
      <!-- glass sheen along the inner edge -->
      <path class="ocean-arc__sheen" :d="sheenPath" />
    </svg>

    <!-- digit labels = AnimatedScaleMarker anchors (same as the other scales) -->
    <div
      v-for="d in digits"
      :key="'digit-' + d.value"
      :class="['global-numbers-value', 'val-' + d.value, {'val-is-active': d.value === value}]"
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
import AnimatedScaleMarker from '@/client/components/board/AnimatedScaleMarker.vue';
import OceanEventMarker from '@/client/components/board/OceanEventMarker.vue';
import {
  ArcScaleConfig,
  pointForValue,
  pointerRotationForValue,
  bandPath,
  tick,
} from '@/client/components/board/arcScaleGeometry';
import {GlobalParameterThresholdMarker, oceanThresholdMarkers} from '@/client/components/board/oceanThresholdMarkers';

// ── Geometry knobs (the only positioning constants) ───────────────────────
// Concentric with the O₂ / temperature / Venus arcs (circle-fit centre from
// scaleBonusZones.ts) so the ocean scale reads as part of one system. The
// values span the free ~52° window at the bottom of the planet, value 1 down-
// left → value 9 down-right, centred on 6 o'clock. Verified against the
// neighbouring O₂-0 / Temp-30 digits in arcScaleGeometry.spec.ts.
const CENTER = {x: 300, y: 301};
const RADIUS = 264; // centreline / digit ring
const START_ANGLE = 116; // value 1 (down-left)
const END_ANGLE = 64; // value 9 (down-right)
const OCEAN_STEPS = 9;
const BAND = 18; // radial band thickness (px)
const DIGIT = 22; // digit box (px)
const CHIP = 20; // event-marker chip box (px)
const POINTER = 8; // event-marker pointer length (px)
const GAP = 2; // gap between band edge and pointer base

const OUTER_R = RADIUS + BAND / 2;
const INNER_R = RADIUS - BAND / 2;
// Chip body sits just OUTSIDE the band, pointer aiming back at it.
const CHIP_R = OUTER_R + GAP + POINTER + CHIP / 2;
const CHIP_POINTER_DIST = CHIP / 2 + GAP + POINTER / 2;

const CFG: ArcScaleConfig = {
  center: CENTER,
  radius: RADIUS,
  startAngle: START_ANGLE,
  endAngle: END_ANGLE,
  startValue: 1,
  endValue: OCEAN_STEPS,
};

// Exact circular-arc length of the band (r·θ) — drives the dashoffset fill.
const ARC_LENGTH = RADIUS * Math.abs(END_ANGLE - START_ANGLE) * Math.PI / 180;

const GRAD_ID = 'oceanArcWater';
// Vertical gradient across the band region — sunlit (bright) toward the planet,
// deeper toward space, giving the water band depth.
const GRAD_TOP_Y = CENTER.y + INNER_R - 6;
const GRAD_BOT_Y = CENTER.y + OUTER_R + 10;
const SVG_W = 600;
const SVG_H = 600;

type EventMarkerView = {
  marker: GlobalParameterThresholdMarker;
  top: number;
  left: number;
  size: number;
  point: number;
  pointerDist: number;
};

/**
 * Cross-remount baseline for the WATER FILL — survives the
 * `<player-home :key="playerkey">` remount App.vue forces on every poll, exactly
 * like AnimatedScaleMarker's `accentBaseline`. On remount the fill starts at the
 * PREVIOUS count, then animates (CSS dashoffset transition) to the current one,
 * so the water grows IN SYNC with the gliding indicator instead of snapping.
 */
let oceanFillBaseline: number | undefined;

export default defineComponent({
  name: 'OceanArcScale',
  components: {
    AnimatedScaleMarker,
    OceanEventMarker,
  },
  props: {
    /** Current ocean count (0..9). */
    value: {
      type: Number,
      default: 0,
    },
    /**
     * Whether the future planetary-event mechanic is active in THIS game.
     * Defaults false; the markers also self-gate on the `?oceanMarkers` dev
     * flag (see oceanThresholdMarkers.ts) so a normal game shows none.
     */
    planetaryEvents: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      cfg: CFG,
      // The count the FILL is currently drawn at — seeded from the cross-remount
      // baseline so it can animate from the previous value to the current one.
      displayValue: oceanFillBaseline ?? this.value,
      SVG_W,
      SVG_H,
      GRAD_ID,
      GRAD_TOP_Y,
      GRAD_BOT_Y,
      gradStroke: `url(#${GRAD_ID})`,
      // Static geometry — the config is constant, so these never change.
      bandPath: bandPath(CFG),
      sheenPath: bandPath(CFG, INNER_R + 1.6),
      ticks: Array.from({length: OCEAN_STEPS}, (_, i) => {
        const v = i + 1;
        return {value: v, ...tick(CFG, v, OUTER_R + 1, OUTER_R + 4.5)};
      }),
      digits: Array.from({length: OCEAN_STEPS}, (_, i) => {
        const v = i + 1;
        const p = pointForValue(CFG, v);
        return {value: v, left: Math.round(p.x - DIGIT / 2), top: Math.round(p.y - DIGIT / 2)};
      }),
    };
  },
  mounted(): void {
    const prev = oceanFillBaseline;
    oceanFillBaseline = this.value;
    // First mount of the session, or no change → already showing the right
    // value (no transition). A real change → start at `prev` (set in data) and
    // animate to the current value on the next tick.
    if (prev !== undefined && prev !== this.value) {
      this.$nextTick(() => {
        this.displayValue = this.value;
      });
    } else {
      this.displayValue = this.value;
    }
  },
  watch: {
    // Handle an in-place value change (no remount) too — keep the baseline in
    // sync and let the dashoffset transition animate the fill.
    value(newVal: number): void {
      oceanFillBaseline = newVal;
      this.displayValue = newVal;
    },
  },
  computed: {
    // Fraction of the band to reveal as water — 0 at ≤1 ocean (cursor sits at
    // the first tick with nothing filled behind it), 1 at 9 (full). The leading
    // edge lands exactly under the indicator because both use the same mapping.
    // Driven by `displayValue` so the fill animates from the previous count.
    fillFraction(): number {
      const f = (this.displayValue - 1) / (OCEAN_STEPS - 1);
      return Math.max(0, Math.min(1, f));
    },
    fillStyle(): Record<string, string> {
      return {
        'stroke-dasharray': `${ARC_LENGTH}`,
        'stroke-dashoffset': `${ARC_LENGTH * (1 - this.fillFraction)}`,
      };
    },
    eventMarkers(): ReadonlyArray<EventMarkerView> {
      return oceanThresholdMarkers({planetaryEvents: this.planetaryEvents})
        .filter((m) => m.visible)
        .map((marker) => {
          const c = pointForValue(this.cfg, marker.value, CHIP_R);
          return {
            marker,
            top: Math.round(c.y - CHIP / 2),
            left: Math.round(c.x - CHIP / 2),
            size: CHIP,
            point: pointerRotationForValue(this.cfg, marker.value, 'outer'),
            pointerDist: CHIP_POINTER_DIST,
          };
        });
    },
  },
});
</script>
