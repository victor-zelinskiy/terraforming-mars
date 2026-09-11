<template>
  <div class="map-fp" :class="[`map-fp--${variant}`, {'map-fp--random': random, 'map-fp--reveal': reveal}]" :style="{'--map-accent': accent}">
    <!-- Random: layered ghost silhouettes + shuffle glyph + warm glow. -->
    <template v-if="random">
      <div class="map-fp__stack" aria-hidden="true">
        <svg v-for="o in [2, 1, 0]" :key="o" class="map-fp__ghost" :style="{'--g': o}" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <polygon v-for="(h, i) in ghostLayout" :key="i" :points="h.points" class="map-fp__ghost-hex" />
        </svg>
        <span class="map-fp__shuffle">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7 H9 L17 17 H20 M16 14 L20 17 L16 20 M4 17 H9 L11 14.5 M14 9.5 L17 7 H20 M16 4 L20 7 L16 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
    </template>

    <!-- Specific map: the REAL board layout (genfiles/boardLayouts.json) —
         actual ocean/cove zones, volcanic sites, restricted cells and the
         printed placement bonuses as color regions + signature glyphs. -->
    <template v-else>
      <div class="map-fp__board-wrap" aria-hidden="true">
        <svg class="map-fp__board" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <polygon
            v-for="h in hexes"
            :key="h.key"
            :points="h.points"
            class="map-fp__hex"
            :class="h.cls"
            :style="h.style" />
        </svg>
        <div v-if="markers.length > 0" class="map-fp__icons">
          <span
            v-for="m in markers"
            :key="m.key"
            class="map-fp__icon"
            :class="{'map-fp__icon--volcano': m.volcano}"
            :style="m.style"
            v-html="m.svg"></span>
        </div>
      </div>
      <div v-if="variant === 'hero' && legend.length > 0" class="map-fp__legend">
        <span v-for="b in legend" :key="b" class="map-fp__legend-chip" :style="{color: `rgb(${bonusRgb(b)})`}" v-html="glyphSvg(b)"></span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {BoardLayoutSpace} from '@/common/boards/BoardLayout';
import {clientBoardLayout} from '@/client/boards/clientBoardLayouts';
import {SIGNATURE_BONUSES, SPACE_BONUS_RGB, spaceBonusGlyphSvg} from './boardMiniatureArt';

// Shared silhouette geometry (rows 5-6-7-8-9-8-7-6-5, 61 hexes) — the same
// grid every server board is built on, so the real x/y land exactly.
const ROWS = [5, 6, 7, 8, 9, 8, 7, 6, 5];
const R = 10;
const HEX_W = Math.sqrt(3) * R;
const V_STEP = 1.5 * R;
const VB_W = 9 * HEX_W;
const VB_H = 8 * V_STEP + 2 * R;
const VIEWBOX = `0 0 ${VB_W.toFixed(1)} ${VB_H.toFixed(1)}`;

function hexPoints(cx: number, cy: number): string {
  const pts: Array<string> = [];
  for (let a = 0; a < 6; a++) {
    const ang = (Math.PI / 180) * (60 * a - 90);
    pts.push(`${(cx + R * Math.cos(ang)).toFixed(1)},${(cy + R * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Screen center of the server-grid cell (x carries the row offset already). */
function cellCenter(x: number, y: number): {cx: number, cy: number} {
  const n = ROWS[y];
  const cx = VB_W / 2 + (x - (9 - n) / 2 - (n - 1) / 2) * HEX_W;
  const cy = y * V_STEP + R;
  return {cx, cy};
}

// The random-preview ghost silhouette (unchanged look).
const GHOST_LAYOUT: Array<{points: string}> = (() => {
  const out: Array<{points: string}> = [];
  ROWS.forEach((n, y) => {
    for (let j = 0; j < n; j++) {
      const {cx, cy} = cellCenter((9 - n) + j, y);
      out.push({points: hexPoints(cx, cy)});
    }
  });
  return out;
})();

const MAX_DIST = Math.hypot(VB_W / 2, VB_H / 2);
// Reveal choreography (base ms; CSS multiplies by --motion-scale).
const HEX_WAVE_MS = 420;
const GLYPH_START_MS = 340;
const GLYPH_WAVE_MS = 260;

type HexRender = {key: string, points: string, cls: Record<string, boolean>, style: Record<string, string>};
type MarkerRender = {key: string, svg: string, volcano: boolean, style: Record<string, string>};

const VOLCANO_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10 L4.5 19.5 H19.5 L15 10 M9 10 L11 12.5 L12.5 10.5 L14 12.5 L15 10 M10.5 6 L12 3.5 L13.5 6.5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export default defineComponent({
  name: 'PremiumMapFingerprint',
  props: {
    mapId: {type: String as PropType<BoardName | undefined>, default: undefined},
    random: {type: Boolean, default: false},
    accent: {type: String, default: '240,168,80'},
    variant: {type: String as PropType<'hero' | 'card' | 'thumb'>, default: 'card'},
    /** Play the board-reveal choreography (silhouette wave → glyphs). */
    reveal: {type: Boolean, default: false},
    /** Extra delay before the reveal starts (stagger between mission cards). */
    revealDelayMs: {type: Number, default: 0},
  },
  data() {
    return {ghostLayout: GHOST_LAYOUT, viewBox: VIEWBOX};
  },
  computed: {
    layout(): ReadonlyArray<BoardLayoutSpace> {
      if (this.random || this.mapId === undefined) {
        return [];
      }
      return clientBoardLayout(this.mapId);
    },
    hexes(): Array<HexRender> {
      return this.layout.map((s) => {
        const {cx, cy} = cellCenter(s.x, s.y);
        const style: Record<string, string> = {fill: this.hexFill(s)};
        if (this.reveal) {
          const d = Math.hypot(cx - VB_W / 2, cy - VB_H / 2) / MAX_DIST;
          style['--d'] = `${Math.round(this.revealDelayMs + d * HEX_WAVE_MS)}ms`;
        }
        return {
          key: `${s.x}-${s.y}`,
          points: hexPoints(cx, cy),
          cls: {
            'map-fp__hex--ocean': s.t === SpaceType.OCEAN || s.t === SpaceType.COVE,
            'map-fp__hex--feature': s.t === SpaceType.LAND && s.b.length > 0,
            'map-fp__hex--special': s.t === SpaceType.RESTRICTED || s.t === SpaceType.DEFLECTION_ZONE,
          },
          style,
        };
      });
    },
    markers(): Array<MarkerRender> {
      if (this.variant === 'thumb') {
        return [];
      }
      const out: Array<MarkerRender> = [];
      for (const s of this.layout) {
        const glyph = this.glyphOf(s);
        const volcano = s.v === true;
        if (glyph === undefined && !volcano) {
          continue;
        }
        const {cx, cy} = cellCenter(s.x, s.y);
        const style: Record<string, string> = {
          left: `${((cx / VB_W) * 100).toFixed(2)}%`,
          top: `${((cy / VB_H) * 100).toFixed(2)}%`,
          color: glyph !== undefined ? `rgb(${this.bonusRgb(glyph)})` : 'rgb(240, 150, 92)',
        };
        if (this.reveal) {
          const d = Math.hypot(cx - VB_W / 2, cy - VB_H / 2) / MAX_DIST;
          style['--d'] = `${Math.round(this.revealDelayMs + GLYPH_START_MS + d * GLYPH_WAVE_MS)}ms`;
        }
        out.push({
          key: `${s.x}-${s.y}-m`,
          svg: glyph !== undefined ? this.glyphSvg(glyph) : VOLCANO_SVG,
          volcano: glyph === undefined && volcano,
          style,
        });
      }
      return out;
    },
    legend(): ReadonlyArray<SpaceBonus> {
      const counts = new Map<SpaceBonus, number>();
      for (const s of this.layout) {
        for (const b of s.b) {
          if (b === SpaceBonus.OCEAN) {
            continue;
          }
          counts.set(b, (counts.get(b) ?? 0) + 1);
        }
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([b]) => b);
    },
  },
  methods: {
    hexFill(s: BoardLayoutSpace): string {
      if (s.t === SpaceType.OCEAN) {
        return 'rgba(96, 168, 238, 0.5)';
      }
      if (s.t === SpaceType.COVE) {
        return 'rgba(96, 210, 200, 0.42)';
      }
      if (s.t === SpaceType.RESTRICTED) {
        return 'rgba(120, 52, 44, 0.5)';
      }
      if (s.t === SpaceType.DEFLECTION_ZONE) {
        return 'rgba(168, 120, 236, 0.28)';
      }
      const first = s.b[0];
      if (first !== undefined) {
        // A land cell reads as a soft region of its printed bonus.
        return `rgba(${this.bonusRgb(first)}, 0.34)`;
      }
      return 'rgba(8, 13, 20, 0.55)';
    },
    glyphOf(s: BoardLayoutSpace): SpaceBonus | undefined {
      if (s.b.length === 0) {
        return undefined;
      }
      if (this.variant === 'hero') {
        return s.b[0];
      }
      // Card tier: only the map-distinguishing bonuses earn a glyph — the
      // base five already read as color regions.
      return s.b.find((b) => SIGNATURE_BONUSES.has(b));
    },
    bonusRgb(b: SpaceBonus): string {
      return SPACE_BONUS_RGB[b] ?? this.accent;
    },
    glyphSvg(b: SpaceBonus): string {
      return spaceBonusGlyphSvg(b);
    },
  },
});
</script>
