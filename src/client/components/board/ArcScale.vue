<template>
  <!--
    ArcScale — the GENERIC dynamic band for a global-parameter scale (O₂ /
    temperature / Venus). It draws the premium code band that REPLACES the arc
    baked into mars.png: recessed rail · channel · themed progress fill · edge
    light · sheen · graduation ticks · end caps · identity badge.

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
      <path class="arc-scale__rail" :d="bandPathD" />
      <!-- empty / not-reached channel -->
      <path class="arc-scale__channel" :d="bandPathD" />
      <!-- themed progress fill (revealed start → current via dashoffset) -->
      <path
        v-if="fillFraction > 0"
        class="arc-scale__fill"
        :d="bandPathD"
        :stroke="`url(#${gradId})`"
        :style="fillStyle" />
      <!-- outer rim highlight -->
      <path class="arc-scale__edge" :d="edgePathD" />
      <!-- inner glass sheen -->
      <path class="arc-scale__sheen" :d="sheenPathD" />
      <!-- segment dividers — only for low-value scales (e.g. oceans 1–9), where
           they read as distinct slots; busier scales (15–20 ticks) skip them -->
      <line
        v-for="d in dividers"
        :key="'dv-' + d.key"
        class="arc-scale__divider"
        :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" />
      <!-- graduation ticks; visited (reached) ones light up -->
      <line
        v-for="t in ticks"
        :key="'t-' + t.value"
        class="arc-scale__tick"
        :class="{'arc-scale__tick--visited': t.value <= value}"
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
      <!-- end-cap terminals -->
      <circle class="arc-scale__cap" :cx="capStart.x" :cy="capStart.y" r="3.2" />
      <circle class="arc-scale__cap" :cx="capEnd.x" :cy="capEnd.y" r="3.2" />
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
      :style="{left: d.left + 'px', top: d.top + 'px'}">{{ d.label }}</div>

    <!-- gliding current-value cursor (shared dial, per-scale accent) -->
    <animated-scale-marker :accent="theme.accent" :value="value" />

    <!-- SCALE IDENTITY badge — a flat HUD scale-TYPE label (NOT a bonus chip). -->
    <div class="arc-scale__identity" :style="identityStyle" role="img" :aria-label="ariaLabel">
      <span class="arc-scale__identity-glyph" :style="{backgroundImage: theme.glyph}"></span>
      <div class="arc-scale__identity-tip" role="tooltip">
        <span class="arc-scale__identity-tip-title" v-i18n>{{ theme.title }}</span>
        <span class="arc-scale__identity-tip-count"><span v-i18n>{{ theme.noun }}</span>: {{ value }}{{ theme.unit }}</span>
        <span class="arc-scale__identity-tip-desc" v-i18n>{{ theme.description }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import AnimatedScaleMarker from '@/client/components/board/AnimatedScaleMarker.vue';
import {ArcScaleName, ArcScaleTheme} from '@/client/components/board/arcScaleTheme';
import {DynamicArcConfig, arcFillFraction} from '@/client/components/board/arcScaleConfigs';
import {pointAtAngle, arcPath} from '@/client/components/board/arcScaleGeometry';

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
    bandPathD(): string {
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
    capStart(): {x: number; y: number} {
      const p = pointAtAngle(this.center, this.config.bandRadius, this.config.startAngle);
      return {x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100};
    },
    capEnd(): {x: number; y: number} {
      const p = pointAtAngle(this.center, this.config.bandRadius, this.config.endAngle);
      return {x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100};
    },
    // Boundary dividers between consecutive values — segment the band into
    // discrete slots. Only for compact scales (≤10 values); the dense O₂ /
    // temperature / Venus scales would look cluttered, so they get none.
    dividers(): ReadonlyArray<{key: number; x1: number; y1: number; x2: number; y2: number}> {
      const d = this.config.digits;
      if (d.length > 10) {
        return [];
      }
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
    ticks(): ReadonlyArray<{value: number; x1: number; y1: number; x2: number; y2: number}> {
      const r1 = this.outerR + 2;
      const r2 = this.outerR + 5.5;
      return this.config.digits.map((d) => {
        const a = pointAtAngle(this.center, r1, d.angle);
        const b = pointAtAngle(this.center, r2, d.angle);
        return {
          value: d.value,
          x1: Math.round(a.x * 100) / 100, y1: Math.round(a.y * 100) / 100,
          x2: Math.round(b.x * 100) / 100, y2: Math.round(b.y * 100) / 100,
        };
      });
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
      const p = pointAtAngle(this.center, this.outerR + 16, this.config.startAngle);
      return {
        left: `${Math.round(p.x - size / 2)}px`,
        top: `${Math.round(p.y - size / 2)}px`,
        width: `${size}px`,
        height: `${size}px`,
      };
    },
    ariaLabel(): string {
      return `${this.theme.noun}: ${this.value}${this.theme.unit}`;
    },
  },
});
</script>
