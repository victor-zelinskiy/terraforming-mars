<template>
  <!--
    OceanArcScale — the OCEAN global parameter as a compact premium arc on the
    Mars board, drawn ENTIRELY in code (no baked-in PNG band under it).

    It sits in the free window at the BOTTOM of the planet, concentric with the
    O₂ (left) and temperature (right) arcs — so the four global parameters read
    as ONE system. All geometry is computed by arcScaleGeometry.ts; nothing is
    hand-placed.

    This component is the PILOT for migrating the remaining scales off the PNG.
    It deliberately separates THREE visual roles that must never be confused:
      1. IDENTITY emblem (a water droplet badge) — "this scale is oceans".
      2. INDICATOR (the gliding glass cursor) — "the count is N right now".
      3. EVENT chips at 3 / 6 — "a planetary event may fire here" (gated, hidden
         in a normal game).

    Material build (back → front): recessed rail · dim channel · water fill
    (grows via stroke-dashoffset so its edge lands under the cursor) · segment
    dividers · outer rim highlight · inner glass sheen · graduation ticks · end
    caps. Digits sit in the band with future / visited / current states.
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
      <!-- recessed backing rail — the carved groove the gauge sits in -->
      <path class="ocean-arc__rail" :d="bandPath" />
      <!-- dim full-length channel (the empty / not-yet-reached track) -->
      <path class="ocean-arc__channel" :d="bandPath" />
      <!-- water fill: same path, revealed from value 1 up to the current count
           via stroke-dashoffset so its leading edge sits under the indicator -->
      <path
        v-if="fillFraction > 0"
        class="ocean-arc__fill"
        :d="bandPath"
        :stroke="gradStroke"
        :style="fillStyle" />
      <!-- segment dividers — cut the band into the 9 ocean slots -->
      <line
        v-for="d in dividers"
        :key="'div-' + d.key"
        class="ocean-arc__divider"
        :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" />
      <!-- outer rim highlight (edge light) -->
      <path class="ocean-arc__edge" :d="edgePath" />
      <!-- inner glass sheen -->
      <path class="ocean-arc__sheen" :d="sheenPath" />
      <!-- graduation ticks just outside the band; visited ones light up -->
      <line
        v-for="t in ticks"
        :key="'tick-' + t.value"
        class="ocean-arc__tick"
        :class="{'ocean-arc__tick--visited': t.value <= value}"
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
      <!-- premium end-cap nodes (the gauge terminals) -->
      <circle class="ocean-arc__cap" :cx="capStart.x" :cy="capStart.y" r="3.2" />
      <circle class="ocean-arc__cap" :cx="capEnd.x" :cy="capEnd.y" r="3.2" />
    </svg>

    <!-- digit labels = AnimatedScaleMarker anchors (same as the other scales).
         future (>count) dim · visited (<count) brighter · current = val-is-active -->
    <div
      v-for="d in digits"
      :key="'digit-' + d.value"
      :class="['global-numbers-value', 'val-' + d.value, {
        'val-is-active': d.value === value,
        'ocean-arc__digit--visited': d.value < value,
      }]"
      :style="{left: d.left + 'px', top: d.top + 'px'}">{{ d.value }}</div>

    <!-- SCALE IDENTITY — a compact water droplet badge (NOT a bonus/event chip:
         flat HUD label, no pointer, no reward glow). Names the parameter without
         a big text label. Hover shows the current count + a short description. -->
    <div class="ocean-arc__identity" :style="identityStyle" role="img" :aria-label="identityAria">
      <span class="ocean-arc__identity-glyph"></span>
      <div class="ocean-arc__identity-tip" role="tooltip">
        <span class="ocean-arc__identity-tip-title" v-i18n>Ocean scale</span>
        <span class="ocean-arc__identity-tip-count"><span v-i18n>Oceans</span>: {{ value }}/{{ OCEAN_STEPS }}</span>
        <span class="ocean-arc__identity-tip-desc" v-i18n>Shows the number of oceans placed.</span>
      </div>
    </div>

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
  pointAtAngle,
  markerChip,
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
const CHIP = 18; // event-marker chip box (px)
const MARKER_POINTER = 9; // event-marker pointer length (px) — a slightly longer connector
const MARKER_GAP = 9; // clearance between the band edge and the chip — lifts the chips clear of the rail

const OUTER_R = RADIUS + BAND / 2;
const INNER_R = RADIUS - BAND / 2;

// Identity droplet — a flat HUD badge just outside the START of the arc (in the
// rim gap, clear of the O₂ digits). Radially aligned with value 1 so it reads
// as the gauge's start label.
const IDENTITY_SIZE = 22;
const IDENTITY_R = OUTER_R + 16;
const IDENTITY_ANGLE = START_ANGLE;

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
    const capStart = pointForValue(CFG, 1);
    const capEnd = pointForValue(CFG, OCEAN_STEPS);
    const ident = pointAtAngle(CENTER, IDENTITY_R, IDENTITY_ANGLE);
    return {
      cfg: CFG,
      OCEAN_STEPS,
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
      edgePath: bandPath(CFG, OUTER_R - 0.6),
      sheenPath: bandPath(CFG, INNER_R + 1.6),
      capStart: {x: Math.round(capStart.x * 100) / 100, y: Math.round(capStart.y * 100) / 100},
      capEnd: {x: Math.round(capEnd.x * 100) / 100, y: Math.round(capEnd.y * 100) / 100},
      identityStyle: {
        left: `${Math.round(ident.x - IDENTITY_SIZE / 2)}px`,
        top: `${Math.round(ident.y - IDENTITY_SIZE / 2)}px`,
        width: `${IDENTITY_SIZE}px`,
        height: `${IDENTITY_SIZE}px`,
      },
      ticks: Array.from({length: OCEAN_STEPS}, (_, i) => {
        const v = i + 1;
        return {value: v, ...tick(CFG, v, OUTER_R + 2, OUTER_R + 5.5)};
      }),
      // Segment dividers at the boundaries between values (1.5 … 8.5), drawn
      // across the band so the continuous water reads as 9 distinct ocean slots.
      dividers: Array.from({length: OCEAN_STEPS - 1}, (_, i) => {
        const b = i + 1.5;
        return {key: b, ...tick(CFG, b, INNER_R + 1.5, OUTER_R - 1.5)};
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
    identityAria(): string {
      return `Oceans: ${this.value}/${OCEAN_STEPS}`;
    },
    eventMarkers(): ReadonlyArray<EventMarkerView> {
      return oceanThresholdMarkers({planetaryEvents: this.planetaryEvents})
        .filter((m) => m.visible)
        .map((marker) => {
          // INSIDE the band (toward the planet) — i.e. ABOVE the bottom arc —
          // with the pointer aiming down at the threshold. Mirror of the Venus
          // chips on the top arc; keeps the chips out of the bottom-bar zone.
          const chip = markerChip(this.cfg, marker.value, 'inside', {
            bandInner: INNER_R,
            bandOuter: OUTER_R,
            gap: MARKER_GAP,
            pointer: MARKER_POINTER,
            size: CHIP,
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
