<template>
  <!--
    ArcScale — the GENERIC dynamic band for a global-parameter scale (O₂ /
    temperature / Venus). It draws the premium code band that REPLACES the arc
    baked into mars.png: recessed rail · channel · themed progress fill · edge
    light · sheen · segment dividers · end caps · identity badge.

    It deliberately renders ONLY the band + identity. The DIGITS, the moving
    INDICATOR (AnimatedScaleMarker) and the BONUS chips for these three scales
    are already dynamic (Board.vue / globs.less / BonusZone) and sit ON TOP of
    this band, so migrating to a code scale = swapping the PNG band for this one.

    Geometry comes from arcScaleConfigs (per-value angles derived from the exact
    globs digit positions, so the band lands on the same arc as the digits).
    Colour / gradient / glyph come from the per-scale theme (arcScaleTheme).
    This is the unified foundation the four scales share — see OceanArcScale.vue
    for the same language applied to the (already code-rendered) ocean scale.
  -->
  <div class="arc-scale" :class="`arc-scale--${theme.name}`" :style="themeStyle" aria-hidden="true">
    <svg class="arc-scale__svg" :viewBox="`0 0 ${SVG}`" :width="SVG_W" :height="SVG_H">
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

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import AnimatedScaleMarker from '@/client/components/board/AnimatedScaleMarker.vue';
import {ArcScaleName, ArcScaleTheme} from '@/client/components/board/arcScaleTheme';
import {DynamicArcConfig, arcFillFraction} from '@/client/components/board/arcScaleConfigs';
import {pointAtAngle, arcPath} from '@/client/components/board/arcScaleGeometry';
import {translateText} from '@/client/directives/i18n';
import {ScaleTooltipContent, showScaleTooltip, showScaleTooltipAt, hideScaleTooltip} from '@/client/components/board/scaleTooltipState';

const SVG_W = 600;
const SVG_H = 600;
// Uniform digit box across every scale (kept small enough for the dense
// temperature track — 20 values — not to overlap).
const ARC_DIGIT = 19;

/**
 * Cross-remount fill baseline per scale (survives the `<player-home :key>`
 * remount, like AnimatedScaleMarker.accentBaseline / OceanArcScale). Lets the
 * progress fill animate from the previous value to the current one.
 */
const arcFillBaseline: Partial<Record<ArcScaleName, number>> = {};

export default defineComponent({
  name: 'ArcScale',
  components: {AnimatedScaleMarker},
  props: {
    theme: {type: Object as PropType<ArcScaleTheme>, required: true},
    config: {type: Object as PropType<DynamicArcConfig>, required: true},
    value: {type: Number, required: true},
  },
  data() {
    return {
      SVG_W,
      SVG_H,
      displayValue: arcFillBaseline[this.theme.name] ?? this.value,
    };
  },
  mounted(): void {
    const prev = arcFillBaseline[this.theme.name];
    arcFillBaseline[this.theme.name] = this.value;
    if (prev !== undefined && prev !== this.value) {
      this.$nextTick(() => {
        this.displayValue = this.value;
      });
    } else {
      this.displayValue = this.value;
    }
  },
  watch: {
    value(newVal: number): void {
      arcFillBaseline[this.theme.name] = newVal;
      this.displayValue = newVal;
    },
  },
  computed: {
    SVG(): string {
      return `${SVG_W} ${SVG_H}`;
    },
    gradId(): string {
      return `arcFill-${this.theme.name}`;
    },
    themeStyle(): Record<string, string> {
      // Band thickness is per-scale (the PNG-covering scales need a wider band),
      // so it rides a CSS var alongside the theme colours.
      return {...this.theme.vars, '--arc-band-width': `${this.config.bandWidth}px`};
    },
    center(): {x: number; y: number} {
      return this.config.center;
    },
    outerR(): number {
      return this.config.bandRadius + this.config.bandWidth / 2;
    },
    innerR(): number {
      return this.config.bandRadius - this.config.bandWidth / 2;
    },
    // The band spans exactly the DIGIT range; its ROUND line-caps add a small
    // dark rounded lead-out past the end digits (no separate bright cap node,
    // which used to wash out the endpoint numbers). Keeping the span tight here
    // is also what preserves the gaps BETWEEN neighbouring scales — extending it
    // is what caused the overlap.
    channelPathD(): string {
      return arcPath(this.center, this.config.bandRadius, this.config.startAngle, this.config.endAngle);
    },
    fillPathD(): string {
      return arcPath(this.center, this.config.bandRadius, this.config.startAngle, this.config.endAngle);
    },
    edgePathD(): string {
      return arcPath(this.center, this.outerR - 0.8, this.config.startAngle, this.config.endAngle);
    },
    sheenPathD(): string {
      return arcPath(this.center, this.innerR + 1.8, this.config.startAngle, this.config.endAngle);
    },
    arcLength(): number {
      return this.config.bandRadius * Math.abs(this.config.endAngle - this.config.startAngle) * Math.PI / 180;
    },
    gradFrom(): {x: number; y: number} {
      return pointAtAngle(this.center, this.config.bandRadius, this.config.startAngle);
    },
    gradTo(): {x: number; y: number} {
      return pointAtAngle(this.center, this.config.bandRadius, this.config.endAngle);
    },
    // Boundary dividers between consecutive values — the unified segment-tick
    // layer across EVERY scale (per-scale `--arc-divider` tint). Dense scales
    // (15–20 values) read as a fine graduation; few-value scales (oceans) as
    // distinct cells.
    dividers(): ReadonlyArray<{key: number; x1: number; y1: number; x2: number; y2: number}> {
      const d = this.config.digits;
      const r1 = this.innerR + 1.5;
      const r2 = this.outerR - 1.5;
      const out: Array<{key: number; x1: number; y1: number; x2: number; y2: number}> = [];
      for (let i = 0; i < d.length - 1; i++) {
        const a = (d[i].angle + d[i + 1].angle) / 2;
        const p1 = pointAtAngle(this.center, r1, a);
        const p2 = pointAtAngle(this.center, r2, a);
        out.push({
          key: i,
          x1: Math.round(p1.x * 100) / 100, y1: Math.round(p1.y * 100) / 100,
          x2: Math.round(p2.x * 100) / 100, y2: Math.round(p2.y * 100) / 100,
        });
      }
      return out;
    },
    // Unified digit layer — upright, at the band radius, one per config value.
    // future (> current): dim · visited (< current): brighter · current: strongest.
    digitViews(): ReadonlyArray<{value: number; left: number; top: number; label: string; visited: boolean; current: boolean}> {
      return this.config.digits.map((d) => {
        const p = pointAtAngle(this.center, this.config.bandRadius, d.angle);
        const label = this.theme.name === 'temperature' && d.value > 0 ? '+' + d.value : String(d.value);
        return {
          value: d.value,
          left: Math.round(p.x - ARC_DIGIT / 2),
          top: Math.round(p.y - ARC_DIGIT / 2),
          label,
          visited: d.value < this.value,
          current: d.value === this.value,
        };
      });
    },
    fillFraction(): number {
      return arcFillFraction(this.config, this.displayValue);
    },
    fillStyle(): Record<string, string> {
      return {
        'stroke-dasharray': `${this.arcLength}`,
        'stroke-dashoffset': `${this.arcLength * (1 - this.fillFraction)}`,
      };
    },
    identityStyle(): Record<string, string> {
      const size = 22;
      // Venus + oceans place their bonus chips on the INNER side of the
      // band (toward the planet), so the identity badge follows them inside
      // — it clears the outer off-Mars cells AND reads consistent with the
      // scale's own bonus direction. The other scales keep the outer badge.
      const radius = this.identityInside ? this.innerR - 16 : this.outerR + 16;
      const p = pointAtAngle(this.center, radius, this.config.startAngle);
      return {
        left: `${Math.round(p.x - size / 2)}px`,
        top: `${Math.round(p.y - size / 2)}px`,
        width: `${size}px`,
        height: `${size}px`,
      };
    },
    /** Venus + oceans: bonuses (and thus the identity badge) sit inside. */
    identityInside(): boolean {
      return this.theme.accent === 'venus' || this.theme.accent === 'oceans';
    },
    ariaLabel(): string {
      return `${this.theme.noun}: ${this.value}${this.theme.unit}`;
    },
    // The scale-overview tooltip shared by the rail (band) hover and the identity
    // badge — name + current value + what the scale is.
    overviewContent(): ScaleTooltipContent {
      const t = this.theme;
      return {
        accent: t.accent,
        kicker: translateText(t.title),
        rows: [
          {text: `${translateText(t.noun)}: ${this.value}${t.unit}`, tone: 'value'},
          {text: translateText(t.description), tone: 'desc'},
        ],
      };
    },
  },
  beforeUnmount(): void {
    hideScaleTooltip();
  },
  methods: {
    onRail(ev: MouseEvent): void {
      // Band/rail hover follows the cursor along the arc.
      showScaleTooltipAt(ev.clientX, ev.clientY, this.overviewContent);
    },
    onIdentity(ev: MouseEvent): void {
      showScaleTooltip(ev.currentTarget as HTMLElement, this.overviewContent);
    },
    onDigit(ev: MouseEvent, d: {label: string; current: boolean}): void {
      // Only the CURRENT digit is hoverable (pointer-events in arc_scale.less);
      // it is the literal current-value indicator. The kicker calls it out.
      const t = this.theme;
      const content: ScaleTooltipContent = {
        accent: t.accent,
        kicker: d.current ? translateText('Current') : translateText(t.title),
        rows: [{text: `${translateText(t.noun)}: ${d.label}${t.unit}`, tone: 'value'}],
      };
      showScaleTooltip(ev.currentTarget as HTMLElement, content);
    },
    onLeave(): void {
      hideScaleTooltip();
    },
  },
});
</script>
