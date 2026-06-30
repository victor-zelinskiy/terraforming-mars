<template>
  <div class="map-fp" :class="[`map-fp--${variant}`, {'map-fp--random': random}]" :style="{'--map-accent': accent}">
    <!-- Random: stacked ghost silhouettes + shuffle glyph. -->
    <template v-if="random">
      <div class="map-fp__stack" aria-hidden="true">
        <svg v-for="o in [2, 1, 0]" :key="o" class="map-fp__ghost" :style="{'--g': o}" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <polygon v-for="(h, i) in hexLayout" :key="i" :points="h.points" class="map-fp__ghost-hex" />
        </svg>
        <span class="map-fp__shuffle">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7 H9 L17 17 H20 M16 14 L20 17 L16 20 M4 17 H9 L11 14.5 M14 9.5 L17 7 H20 M16 4 L20 7 L16 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
    </template>

    <!-- Specific map: bonus-distribution hex heatmap. -->
    <template v-else>
      <svg class="map-fp__board" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <polygon
          v-for="(h, i) in hexLayout"
          :key="i"
          :points="h.points"
          class="map-fp__hex"
          :style="{fill: `rgba(${cellColor(i)}, ${cells[i] === 'ocean' ? 0.5 : 0.34})`}"
        />
      </svg>
      <div v-if="variant === 'hero' && legend.length > 0" class="map-fp__legend">
        <span v-for="b in legend" :key="b" class="map-fp__legend-chip" :style="{'--b': BONUS_RGB[b]}">
          <span class="map-fp__legend-glyph" v-html="glyph(b)"></span>
        </span>
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

function hexPoints(cx: number, cy: number): string {
  const pts: Array<string> = [];
  for (let a = 0; a < 6; a++) {
    const ang = (Math.PI / 180) * (60 * a - 90);
    pts.push(`${(cx + R * Math.cos(ang)).toFixed(1)},${(cy + R * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const HEX_LAYOUT: Array<{points: string}> = (() => {
  const centerX = (9 * HEX_W) / 2;
  const out: Array<{points: string}> = [];
  ROWS.forEach((n, ri) => {
    const y = ri * V_STEP + R;
    for (let j = 0; j < n; j++) {
      const x = (j - (n - 1) / 2) * HEX_W + centerX;
      out.push({points: hexPoints(x, y)});
    }
  });
  return out;
})();
const HEX_COUNT = HEX_LAYOUT.reduce((s) => s + 1, 0);
const VIEWBOX = `0 0 ${(9 * HEX_W).toFixed(1)} ${(8 * V_STEP + 2 * R).toFixed(1)}`;

const BONUS_RGB: Record<FingerprintBonus, string> = {
  plant: '90,190,90',
  steel: '200,140,80',
  titanium: '150,160,190',
  card: '214,194,150',
  heat: '240,120,80',
  ocean: '80,150,230',
  energy: '232,202,84',
  microbe: '120,200,150',
  animal: '200,150,100',
  temperature: '235,110,110',
  colony: '184,124,224',
};

const GLYPHS: Record<FingerprintBonus, string> = {
  plant: '<path d="M12 21 C12 13 7 9 4 8 C5 14 8 18 12 19 M12 21 C12 13 17 9 20 8 C19 14 16 18 12 19" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  steel: '<rect x="5" y="9" width="14" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  titanium: '<path d="M12 4 L20 12 L12 20 L4 12 Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  card: '<rect x="6" y="5" width="12" height="14" rx="1.8" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M9 9 H15 M9 12 H15" stroke="currentColor" stroke-width="1.4"/>',
  heat: '<path d="M12 4 C9 8 14 9 12 13 C16 12 16 6 12 4 M12 21 C8 21 6 18 6 15 C6 12 9 11 9 13 C9 15 11 14 11 12 C13 14 18 14 18 17 C18 19 15 21 12 21 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  ocean: '<path d="M12 4 C8 10 6 13 6 16 A6 6 0 0 0 18 16 C18 13 16 10 12 4 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
  energy: '<path d="M13 3 L6 13 H11 L10 21 L18 10 H13 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
  microbe: '<circle cx="9" cy="10" r="2.2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="15" cy="13" r="2.2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="11" cy="16" r="1.6" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  animal: '<ellipse cx="12" cy="15" rx="5" ry="4" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="1.6" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="16" cy="8" r="1.6" stroke="currentColor" stroke-width="1.3" fill="none"/>',
  temperature: '<path d="M12 5 V15 M12 5 A2 2 0 0 1 14 7 V14 A3.5 3.5 0 1 1 10 14 V7 A2 2 0 0 1 12 5 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  colony: '<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
};

export default defineComponent({
  name: 'PremiumMapFingerprint',
  props: {
    mapId: {type: String as PropType<BoardName | undefined>, default: undefined},
    random: {type: Boolean, default: false},
    accent: {type: String, default: '240,168,80'},
    variant: {type: String as PropType<'hero' | 'thumb'>, default: 'thumb'},
  },
  data() {
    return {hexLayout: HEX_LAYOUT, viewBox: VIEWBOX, BONUS_RGB};
  },
  computed: {
    cells(): Array<FingerprintBonus> {
      if (this.random || this.mapId === undefined) {
        return [];
      }
      return fingerprintCells(this.mapId, HEX_COUNT);
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
    cellColor(i: number): string {
      const b = this.cells[i];
      return b !== undefined ? (BONUS_RGB[b] ?? this.accent) : this.accent;
    },
    glyph(b: FingerprintBonus): string {
      return GLYPHS[b] ?? '';
    },
  },
});
</script>
