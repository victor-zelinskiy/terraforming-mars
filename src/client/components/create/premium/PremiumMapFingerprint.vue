<template>
  <div class="map-fp" :class="[`map-fp--${variant}`, {'map-fp--random': random}]" :style="{'--map-accent': accent}">
    <!-- Random: layered ghost silhouettes + shuffle glyph + warm glow. -->
    <template v-if="random">
      <div class="map-fp__stack" aria-hidden="true">
        <svg v-for="o in [2, 1, 0]" :key="o" class="map-fp__ghost" :style="{'--g': o}" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <polygon v-for="(h, i) in hexLayout" :key="i" :points="h.points" class="map-fp__ghost-hex" />
        </svg>
        <span class="map-fp__shuffle">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7 H9 L17 17 H20 M16 14 L20 17 L16 20 M4 17 H9 L11 14.5 M14 9.5 L17 7 H20 M16 4 L20 7 L16 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
    </template>

    <!-- Specific map: hex board heatmap + bonus icon overlay. -->
    <template v-else>
      <div class="map-fp__board-wrap" aria-hidden="true">
        <svg class="map-fp__board" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <polygon
            v-for="(h, i) in hexLayout"
            :key="i"
            :points="h.points"
            class="map-fp__hex"
            :class="{'map-fp__hex--ocean': cellOf(i) === 'ocean', 'map-fp__hex--feature': cellOf(i) !== undefined && cellOf(i) !== 'ocean'}"
            :style="hexStyle(i)" />
        </svg>
        <div v-if="showIcons" class="map-fp__icons">
          <span
            v-for="(f, k) in iconFeatures"
            :key="k"
            class="map-fp__icon"
            :style="{left: f.left + '%', top: f.top + '%', color: `rgb(${bonusRgb(f.bonus)})`}"
            v-html="iconSvg(f.bonus)"></span>
        </div>
      </div>
      <div v-if="variant === 'hero' && legend.length > 0" class="map-fp__legend">
        <span v-for="b in legend" :key="b" class="map-fp__legend-chip" :style="{color: `rgb(${bonusRgb(b)})`}" v-html="iconSvg(b)"></span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {boardFingerprint, fingerprintCells, FingerprintBonus} from './boardFingerprints';

// Static Mars silhouette (rows 5-6-7-8-9-8-7-6-5 = 61 hexes), built once.
const ROWS = [5, 6, 7, 8, 9, 8, 7, 6, 5];
const R = 10;
const HEX_W = Math.sqrt(3) * R;
const V_STEP = 1.5 * R;
const VB_W = 9 * HEX_W;
const VB_H = 8 * V_STEP + 2 * R;

function hexPoints(cx: number, cy: number): string {
  const pts: Array<string> = [];
  for (let a = 0; a < 6; a++) {
    const ang = (Math.PI / 180) * (60 * a - 90);
    pts.push(`${(cx + R * Math.cos(ang)).toFixed(1)},${(cy + R * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const HEX_LAYOUT: Array<{points: string, cx: number, cy: number}> = (() => {
  const centerX = VB_W / 2;
  const out: Array<{points: string, cx: number, cy: number}> = [];
  ROWS.forEach((n, ri) => {
    const y = ri * V_STEP + R;
    for (let j = 0; j < n; j++) {
      const x = (j - (n - 1) / 2) * HEX_W + centerX;
      out.push({points: hexPoints(x, y), cx: x, cy: y});
    }
  });
  return out;
})();
const VIEWBOX = `0 0 ${VB_W.toFixed(1)} ${VB_H.toFixed(1)}`;

const FEATURE_COUNT: Record<string, number> = {hero: 19, card: 16, thumb: 14};

const BONUS_RGB: Record<FingerprintBonus, string> = {
  plant: '120,214,120',
  steel: '214,150,86',
  titanium: '170,182,210',
  card: '230,210,150',
  heat: '248,138,92',
  ocean: '96,168,238',
  energy: '244,214,96',
  microbe: '136,216,166',
  animal: '214,164,112',
  temperature: '244,128,128',
  colony: '198,140,236',
};

// Bolder glyphs (stroke-width 2.2) so they read at small sizes.
const GLYPHS: Record<FingerprintBonus, string> = {
  plant: '<path d="M12 21 C12 13 7 9 4 8 C5 14 8 18 12 19 M12 21 C12 13 17 9 20 8 C19 14 16 18 12 19" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  steel: '<rect x="4.5" y="9" width="15" height="6" rx="1.4" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  titanium: '<path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  card: '<rect x="6" y="4.5" width="12" height="15" rx="1.8" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M9 9 H15 M9 12 H15" stroke="currentColor" stroke-width="1.8"/>',
  heat: '<path d="M13 2.5 C9.5 7 14.5 8.5 12.5 13 C16.5 11.5 16.5 6 13 2.5 M12 21.5 C8 21.5 5.5 18.5 5.5 15 C5.5 12 8.5 11 8.5 13 C8.5 15 11 14 11 11.5 C13 14 18.5 14 18.5 17.5 C18.5 19.8 15.5 21.5 12 21.5 Z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
  ocean: '<path d="M12 3 C8 9.5 5.5 13 5.5 16.5 A6.5 6.5 0 0 0 18.5 16.5 C18.5 13 16 9.5 12 3 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  energy: '<path d="M13.5 2.5 L5.5 13.5 H11 L10 21.5 L18.5 9.5 H13 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  microbe: '<circle cx="9" cy="10" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="15.5" cy="13.5" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/>',
  animal: '<ellipse cx="12" cy="15" rx="5.5" ry="4.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="16.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  temperature: '<path d="M12 4 V15 M12 4 A2.2 2.2 0 0 1 14.2 6.2 V14 A4 4 0 1 1 9.8 14 V6.2 A2.2 2.2 0 0 1 12 4 Z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
  colony: '<circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/>',
};

function seededShuffle<T>(arr: Array<T>, seedStr: string): Array<T> {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) & 0x7fffffff;
  }
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default defineComponent({
  name: 'PremiumMapFingerprint',
  props: {
    mapId: {type: String as PropType<BoardName | undefined>, default: undefined},
    random: {type: Boolean, default: false},
    accent: {type: String, default: '240,168,80'},
    variant: {type: String as PropType<'hero' | 'card' | 'thumb'>, default: 'card'},
  },
  data() {
    return {hexLayout: HEX_LAYOUT, viewBox: VIEWBOX};
  },
  computed: {
    showIcons(): boolean {
      return this.variant !== 'thumb';
    },
    // hexIndex → bonus, for the feature hexes of this map.
    assignment(): Map<number, FingerprintBonus> {
      const map = new Map<number, FingerprintBonus>();
      if (this.random || this.mapId === undefined) {
        return map;
      }
      const count = FEATURE_COUNT[this.variant] ?? 16;
      const cells = fingerprintCells(this.mapId, count);
      const indices = seededShuffle(HEX_LAYOUT.map((_, i) => i), this.mapId).slice(0, count);
      indices.forEach((hexIndex, k) => map.set(hexIndex, cells[k]));
      return map;
    },
    iconFeatures(): Array<{left: number, top: number, bonus: FingerprintBonus}> {
      const out: Array<{left: number, top: number, bonus: FingerprintBonus}> = [];
      this.assignment.forEach((bonus, hexIndex) => {
        if (bonus === 'ocean') {
          return;
        }
        const h = HEX_LAYOUT[hexIndex];
        out.push({left: (h.cx / VB_W) * 100, top: (h.cy / VB_H) * 100, bonus});
      });
      return out;
    },
    legend(): ReadonlyArray<FingerprintBonus> {
      if (this.random || this.mapId === undefined) {
        return [];
      }
      const w = boardFingerprint(this.mapId).weights;
      return (Object.entries(w) as Array<[FingerprintBonus, number]>)
        .filter(([b]) => b !== 'ocean')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([b]) => b);
    },
  },
  methods: {
    cellOf(i: number): FingerprintBonus | undefined {
      return this.assignment.get(i);
    },
    bonusRgb(b: FingerprintBonus): string {
      return BONUS_RGB[b] ?? this.accent;
    },
    iconSvg(b: FingerprintBonus): string {
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${GLYPHS[b] ?? ''}</svg>`;
    },
    hexStyle(i: number): Record<string, string> {
      const b = this.cellOf(i);
      if (b === 'ocean') {
        return {fill: `rgba(${BONUS_RGB.ocean}, 0.55)`};
      }
      if (b !== undefined && this.variant === 'thumb') {
        // Thumb has no icon overlay → tint the feature hex for a heatmap read.
        return {fill: `rgba(${BONUS_RGB[b]}, 0.42)`};
      }
      if (b !== undefined) {
        return {fill: `rgba(${this.accent}, 0.16)`};
      }
      return {fill: 'rgba(8, 13, 20, 0.55)'};
    },
  },
});
</script>
