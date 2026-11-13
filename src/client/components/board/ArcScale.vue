<template>
  <div class="arc-scale" :class="`arc-scale--${theme.name}`" :style="themeStyle" aria-hidden="true">
    <svg class="arc-scale__svg" :viewBox="SVG" :width="SVG_W + 2 * SVG_PAD" :height="SVG_H + 2 * SVG_PAD" :style="svgStyle">
      <defs>
        <linearGradient :id="gradId" gradientUnits="userSpaceOnUse"
          :x1="gradFrom.x" :y1="gradFrom.y" :x2="gradTo.x" :y2="gradTo.y">
          <stop v-for="(s, i) in theme.gradient" :key="i" :offset="s.offset + '%'" :stop-color="s.color" />
        </linearGradient>
      </defs>
      <!-- recessed backing rail -->
      <path class="arc-scale__rail" :d="channelPathD" />
      <!-- empty / not-reached channel (extends a touch past the end digits) -->
      <path class="arc-scale__channel" :d="channelPathD" />
      <!-- themed progress fill — spans only the DIGIT range (value start→current)
           via dashoffset, so the channel's lead-in/out margin stays empty -->
      <path
        v-if="fillFraction > 0"
        class="arc-scale__fill"
        :d="fillPathD"
        :stroke="`url(#${gradId})`"
        :style="fillStyle" />
      <!-- outer rim highlight -->
      <path class="arc-scale__edge" :d="edgePathD" />
      <!-- inner glass sheen -->
      <path class="arc-scale__sheen" :d="sheenPathD" />
      <!-- segment dividers between values — unified across every scale (per-scale
           tint). Over the bright fill they read as lit cells, over the dim
           channel they recede, so progress reads for free. -->
      <line
        v-for="d in dividers"
        :key="'dv-' + d.key"
        class="arc-scale__divider"
        :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" />
      <!-- transparent RAIL hit-area: hovering anywhere on the band shows the
           scale overview tooltip (no dead zones between digits). pointer-events
           ride only the stroke so it never blocks the board hexes inside. -->
      <path
        class="arc-scale__hit"
        :d="channelPathD"
        @mouseenter="onRail"
        @mousemove="onRail"
        @mouseleave="onLeave" />
    </svg>

    <!-- UNIFIED digit layer (upright, future/visited/current states) — also the
         anchors the shared indicator glides between. Replaces the legacy globs
         `.val-N` digits for every scale. -->
    <div
      v-for="d in digitViews"
      :key="'num-' + d.value"
      :class="['global-numbers-value', 'val-' + d.value, 'arc-scale__digit', {
        'arc-scale__digit--visited': d.visited,
        'arc-scale__digit--current': d.current,
      }]"
      :style="{left: d.left + 'px', top: d.top + 'px'}"
      @mouseenter="onDigit($event, d)"
      @mouseleave="onLeave">{{ d.label }}</div>

    <!-- gliding current-value cursor (shared dial, per-scale accent) -->
    <animated-scale-marker :accent="theme.accent" :value="value" />

    <!-- SCALE IDENTITY badge — a flat HUD scale-TYPE label (NOT a bonus chip).
         Hovering it shows the unified scale-overview tooltip. -->
    <div
      class="arc-scale__identity"
      :style="identityStyle"
      role="img"
      :aria-label="ariaLabel"
      @mouseenter="onIdentity"
      @mouseleave="onLeave">
      <span class="arc-scale__identity-glyph" :class="theme.glyphClass"></span>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * ArcScale — the GENERIC dynamic band for a global-parameter scale (O₂ /
 * temperature / Venus). It draws the premium code band that REPLACES the arc
 * baked into mars.png: recessed rail · channel · themed progress fill · edge
 * light · sheen · segment dividers · end caps · identity badge.
 *
 * It deliberately renders ONLY the band + identity. The DIGITS, the moving
 * INDICATOR (AnimatedScaleMarker) and the BONUS chips for these three scales
 * are already dynamic (Board.vue / globs.less / BonusZone) and sit ON TOP of
 * this band, so migrating to a code scale = swapping the PNG band for this one.
 *
 * Geometry comes from arcScaleConfigs (per-value angles derived from the exact
 * globs digit positions, so the band lands on the same arc as the digits).
 * Colour / gradient / glyph come from the per-scale theme (arcScaleTheme).
 * This is the unified foundation the four scales share — see OceanArcScale.vue
 * for the same language applied to the (already code-rendered) ocean scale.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, watch} from 'vue';
import AnimatedScaleMarker from '@/client/components/board/AnimatedScaleMarker.vue';
import {ArcScaleTheme} from '@/client/components/board/arcScaleTheme';
import {DynamicArcConfig, arcFillFraction} from '@/client/components/board/arcScaleConfigs';
import {pointAtAngle, arcPath} from '@/client/components/board/arcScaleGeometry';
import {arcFillBaseline} from '@/client/components/board/arcScaleState';
import {translateText} from '@/client/directives/i18n';
import {ScaleTooltipContent, showScaleTooltip, showScaleTooltipAt, hideScaleTooltip} from '@/client/components/board/scaleTooltipState';
import {consoleState} from '@/client/console/consoleRouter';

const SVG_W = 600;
const SVG_H = 600;
/**
 * The canvas reaches this far past the dials' 600 × 600 square on every side. A ring may sit anywhere around its centre
 * (the eleven-row field's one ring stands right at the square's edge, its rail and caps past it), and an `<svg>` that
 * clips at its own box cuts the band along a straight line — the left oxygen / right temperature bands of Amazonis
 * Planitia's first ring were sliced exactly at x 0 / 600 on the TV. The square stays the coordinate space (the viewBox
 * starts at −PAD), so nothing drawn moves.
 */
const SVG_PAD = 60;
// Uniform digit box across every scale (kept small enough for the dense
// temperature track — 20 values — not to overlap).
const ARC_DIGIT = 19;

defineOptions({name: 'ArcScale'});
const props = defineProps({
  theme: {type: Object as PropType<ArcScaleTheme>, required: true},
  config: {type: Object as PropType<DynamicArcConfig>, required: true},
  value: {type: Number, required: true},
  /** The identity badge stands OUTSIDE whatever the scale's habit (the eleven-row field's ocean — its grid reaches the band). */
  identityOutside: {type: Boolean, default: false},
  /**
   * The identity badge stands INSIDE the band at its MIDDLE value (the eleven-row field's oceans: under the grid's flat
   * bottom row there is room at 6 o'clock, while a badge at the first value — inside or out — would sit on the corner
   * hex or hang below the ring and cost the planet its height).
   */
  identityMiddle: {type: Boolean, default: false},
});

const displayValue = ref(arcFillBaseline[props.theme.name] ?? props.value);
const SVG = computed((): string => {
  return `${-SVG_PAD} ${-SVG_PAD} ${SVG_W + 2 * SVG_PAD} ${SVG_H + 2 * SVG_PAD}`;
});
const svgStyle = computed((): Record<string, string> => {
  return {left: `${-SVG_PAD}px`, top: `${-SVG_PAD}px`};
});
const gradId = computed((): string => {
  return `arcFill-${props.theme.name}`;
});
const themeStyle = computed((): Record<string, string> => {
  // Band thickness is per-scale (the PNG-covering scales need a wider band),
  // so it rides a CSS var alongside the theme colours.
  return {...props.theme.vars, '--arc-band-width': `${props.config.bandWidth}px`};
});
const center = computed((): {x: number; y: number} => {
  return props.config.center;
});
const outerR = computed((): number => {
  return props.config.bandRadius + props.config.bandWidth / 2;
});
const innerR = computed((): number => {
  return props.config.bandRadius - props.config.bandWidth / 2;
});
// The band spans exactly the DIGIT range; its ROUND line-caps add a small
// dark rounded lead-out past the end digits (no separate bright cap node,
// which used to wash out the endpoint numbers). Keeping the span tight here
// is also what preserves the gaps BETWEEN neighbouring scales — extending it
// is what caused the overlap.
const channelPathD = computed((): string => {
  return arcPath(center.value, props.config.bandRadius, props.config.startAngle, props.config.endAngle);
});
const fillPathD = computed((): string => {
  return arcPath(center.value, props.config.bandRadius, props.config.startAngle, props.config.endAngle);
});
const edgePathD = computed((): string => {
  return arcPath(center.value, outerR.value - 0.8, props.config.startAngle, props.config.endAngle);
});
const sheenPathD = computed((): string => {
  return arcPath(center.value, innerR.value + 1.8, props.config.startAngle, props.config.endAngle);
});
const arcLength = computed((): number => {
  return props.config.bandRadius * Math.abs(props.config.endAngle - props.config.startAngle) * Math.PI / 180;
});
const gradFrom = computed((): {x: number; y: number} => {
  return pointAtAngle(center.value, props.config.bandRadius, props.config.startAngle);
});
const gradTo = computed((): {x: number; y: number} => {
  return pointAtAngle(center.value, props.config.bandRadius, props.config.endAngle);
});
// Boundary dividers between consecutive values — the unified segment-tick
// layer across EVERY scale (per-scale `--arc-divider` tint). Dense scales
// (15–20 values) read as a fine graduation; few-value scales (oceans) as
// distinct cells.
const dividers = computed((): ReadonlyArray<{key: number; x1: number; y1: number; x2: number; y2: number}> => {
  const d = props.config.digits;
  const r1 = innerR.value + 1.5;
  const r2 = outerR.value - 1.5;
  const out: Array<{key: number; x1: number; y1: number; x2: number; y2: number}> = [];
  for (let i = 0; i < d.length - 1; i++) {
    const a = (d[i].angle + d[i + 1].angle) / 2;
    const p1 = pointAtAngle(center.value, r1, a);
    const p2 = pointAtAngle(center.value, r2, a);
    out.push({
      key: i,
      x1: Math.round(p1.x * 100) / 100, y1: Math.round(p1.y * 100) / 100,
      x2: Math.round(p2.x * 100) / 100, y2: Math.round(p2.y * 100) / 100,
    });
  }
  return out;
});
// Unified digit layer — upright, at the band radius, one per config value.
// future (> current): dim · visited (< current): brighter · current: strongest.
const digitViews = computed((): ReadonlyArray<{value: number; left: number; top: number; label: string; visited: boolean; current: boolean}> => {
  return props.config.digits.map((d) => {
    const p = pointAtAngle(center.value, props.config.bandRadius, d.angle);
    const label = props.theme.name === 'temperature' && d.value > 0 ? '+' + d.value : String(d.value);
    return {
      value: d.value,
      left: Math.round(p.x - ARC_DIGIT / 2),
      top: Math.round(p.y - ARC_DIGIT / 2),
      label,
      visited: d.value < props.value,
      current: d.value === props.value,
    };
  });
});
const fillFraction = computed((): number => {
  return arcFillFraction(props.config, displayValue.value);
});
const fillStyle = computed((): Record<string, string> => {
  return {
    'stroke-dasharray': `${arcLength.value}`,
    'stroke-dashoffset': `${arcLength.value * (1 - fillFraction.value)}`,
  };
});
const identityStyle = computed((): Record<string, string> => {
  const size = 22;
  // Venus + oceans place their bonus chips on the INNER side of the
  // band (toward the planet), so the identity badge follows them inside
  // — it clears the outer off-Mars cells AND reads consistent with the
  // scale's own bonus direction. The other scales keep the outer badge.
  const radius = props.identityMiddle ? innerR.value - 18 : identityInside.value ? innerR.value - 16 : outerR.value + 16;
  const angle = props.identityMiddle ? (props.config.startAngle + props.config.endAngle) / 2 : props.config.startAngle;
  const p = pointAtAngle(center.value, radius, angle);
  return {
    left: `${Math.round(p.x - size / 2)}px`,
    top: `${Math.round(p.y - size / 2)}px`,
    width: `${size}px`,
    height: `${size}px`,
  };
});
/** Venus + oceans: bonuses (and thus the identity badge) sit inside. */
const identityInside = computed((): boolean => {
  return !props.identityOutside && (props.theme.accent === 'venus' || props.theme.accent === 'oceans');
});
const ariaLabel = computed((): string => {
  return `${props.theme.noun}: ${props.value}${props.theme.unit}`;
});
// The scale-overview tooltip shared by the rail (band) hover and the identity
// badge — name + current value + what the scale is.
const overviewContent = computed((): ScaleTooltipContent => {
  const t = props.theme;
  return {
    accent: t.accent,
    kicker: translateText(t.title),
    rows: [
      {text: `${translateText(t.noun)}: ${props.value}${t.unit}`, tone: 'value'},
      {text: translateText(t.description), tone: 'desc'},
    ],
  };
});

// In console-native mode the mouse is NOT the input; the console shows scale
// info in its own panel. Suppress the real-mouse overview tooltip there — on
// an Electron load a stray mouseenter fires under the stationary cursor and,
// with no subsequent mouse movement, no mouseleave ever follows, so the
// tooltip would hang forever (the R3 track-inspect flow drives the marker
// chips via synthetic events, not these handlers).
function mouseTooltipsSuppressed(): boolean {
  return consoleState.shellMounted;
}
function onRail(ev: MouseEvent): void {
  if (mouseTooltipsSuppressed()) {
    return;
  }
  // Band/rail hover follows the cursor along the arc.
  showScaleTooltipAt(ev.clientX, ev.clientY, overviewContent.value);
}
function onIdentity(ev: MouseEvent): void {
  if (mouseTooltipsSuppressed()) {
    return;
  }
  showScaleTooltip(ev.currentTarget as HTMLElement, overviewContent.value);
}
function onDigit(ev: MouseEvent, d: {label: string; current: boolean}): void {
  if (mouseTooltipsSuppressed()) {
    return;
  }
  // Only the CURRENT digit is hoverable (pointer-events in arc_scale.less);
  // it is the literal current-value indicator. The kicker calls it out.
  const t = props.theme;
  const content: ScaleTooltipContent = {
    accent: t.accent,
    kicker: d.current ? translateText('Current') : translateText(t.title),
    rows: [{text: `${translateText(t.noun)}: ${d.label}${t.unit}`, tone: 'value'}],
  };
  showScaleTooltip(ev.currentTarget as HTMLElement, content);
}
function onLeave(): void {
  hideScaleTooltip();
}

watch(() => props.value, (newVal: number): void => {
  arcFillBaseline[props.theme.name] = newVal;
  displayValue.value = newVal;
});
onMounted((): void => {
  const prev = arcFillBaseline[props.theme.name];
  arcFillBaseline[props.theme.name] = props.value;
  if (prev !== undefined && prev !== props.value) {
    void nextTick(() => {
      displayValue.value = props.value;
    });
  } else {
    displayValue.value = props.value;
  }
});
onBeforeUnmount((): void => {
  hideScaleTooltip();
});
</script>
