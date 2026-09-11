<template>
  <div class="map-fp" :class="[`map-fp--${variant}`, {'map-fp--random': random, 'map-fp--reveal': reveal}]" :style="{'--map-accent': accent}">
    <!-- Random: layered ghost silhouettes + shuffle glyph + warm glow. -->
    <template v-if="random">
      <div class="map-fp__stack" aria-hidden="true">
        <svg v-for="o in [2, 1, 0]" :key="o" class="map-fp__ghost" :style="{'--g': o}" :viewBox="ghostViewBox" preserveAspectRatio="xMidYMid meet">
          <polygon v-for="(h, i) in ghostLayout" :key="i" :points="h" class="map-fp__ghost-hex" />
        </svg>
        <span class="map-fp__shuffle">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7 H9 L17 17 H20 M16 14 L20 17 L16 20 M4 17 H9 L11 14.5 M14 9.5 L17 7 H20 M16 4 L20 7 L16 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
    </template>

    <!-- Specific map: a literal miniature of the REAL board
         (genfiles/boardLayouts.json through the ONE shared grid mapping,
         boardLayoutGeometry.ts). Every cell is one SVG group — hex surface,
         printed bonus glyphs and special markers share the cell's own
         transform, so nothing can ever detach from its hex. -->
    <template v-else>
      <div class="map-fp__board-wrap" aria-hidden="true">
        <svg class="map-fp__board" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
          <!-- Two group levels ON PURPOSE: the outer <g> carries the cell's
               POSITION as an attribute, the inner one carries the reveal
               animation — a CSS `transform` from keyframes REPLACES the
               transform attribute of the same element (fill-mode both held
               `scale(1)` forever and all 61 cells collapsed onto (0,0)). -->
          <g v-for="cell in cells" :key="cell.key" :transform="cell.transform">
            <g class="map-fp__cell" :style="cell.style">
              <polygon :points="hexOutline" class="map-fp__hex" :class="cell.cls" :style="{fill: cell.fill}" />
              <g v-if="cell.glyphs.length > 0" class="map-fp__glyphs">
                <g
                  v-for="(glyph, gi) in cell.glyphs"
                  :key="gi"
                  :transform="glyph.transform"
                  :style="{color: glyph.color}"
                  v-html="glyph.paths"></g>
              </g>
            </g>
          </g>
        </svg>
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
import {
  MINI_HEX_R,
  MINI_HEX_W,
  MINI_ROWS,
  MINI_V_STEP,
  miniCellCenter,
  miniHexPoints,
  miniLayoutBounds,
} from '@/common/boards/boardLayoutGeometry';
import {clientBoardLayout} from '@/client/boards/clientBoardLayouts';
import {SPACE_BONUS_GLYPHS, SPACE_BONUS_GLYPHS_BOLD, SPACE_BONUS_RGB, spaceBonusGlyphSvg} from './boardMiniatureArt';

/** Even margin around the surface (miniature units). */
const FRAME_PAD = 4;

// Reveal choreography (base ms; CSS multiplies by --motion-scale).
const HEX_WAVE_MS = 420;

/** The volcanic-site marker — a small caldera triangle in the cell's upper
 *  corner (its own path, not a bonus; oranged by CSS class). */
const VOLCANO_PATHS = '<path d="M8.5 18 L12 10.5 L15.5 18 Z M10.6 10.5 L12 7.5 L13.4 10.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
const VOLCANO_COLOR = 'rgb(244, 152, 96)';
/** The restricted-area cross (Amazonis) — drawn as a cell glyph. */
const RESTRICTED_PATHS = SPACE_BONUS_GLYPHS[SpaceBonus._RESTRICTED];

type CellGlyph = {transform: string, paths: string, color: string};
type CellRender = {
  key: string,
  transform: string,
  style: Record<string, string>,
  cls: Record<string, boolean>,
  fill: string,
  glyphs: ReadonlyArray<CellGlyph>,
};

/** Glyph slots inside one hex (24×24 art → cell units), by count. Sized
 *  for LEGIBILITY at miniature scale: a lone bonus claims most of its hex,
 *  pairs and triples adapt — meaning survives, detail yields. */
function glyphSlots(count: number): ReadonlyArray<{dx: number, dy: number, k: number}> {
  if (count <= 1) {
    return [{dx: 0, dy: 0, k: 0.58}];
  }
  if (count === 2) {
    return [{dx: -4.3, dy: 0, k: 0.4}, {dx: 4.3, dy: 0, k: 0.4}];
  }
  // 3+ (Hollandia's triple steel): a tight row — detail adapts, meaning stays.
  return [{dx: -5.1, dy: 0, k: 0.3}, {dx: 0, dy: 0, k: 0.3}, {dx: 5.1, dy: 0, k: 0.3}];
}

function glyphTransform(dx: number, dy: number, k: number): string {
  // 24×24 art centred on the slot.
  return `translate(${(dx - 12 * k).toFixed(2)} ${(dy - 12 * k).toFixed(2)}) scale(${k})`;
}

export default defineComponent({
  name: 'PremiumMapFingerprint',
  props: {
    mapId: {type: String as PropType<BoardName | undefined>, default: undefined},
    random: {type: Boolean, default: false},
    accent: {type: String, default: '240,168,80'},
    variant: {type: String as PropType<'hero' | 'card' | 'thumb'>, default: 'card'},
    /** Play the board-reveal choreography (surface wave; glyphs bloom in). */
    reveal: {type: Boolean, default: false},
    /** Extra delay before the reveal starts (stagger between mission cards). */
    revealDelayMs: {type: Number, default: 0},
  },
  computed: {
    layout(): ReadonlyArray<BoardLayoutSpace> {
      if (this.random || this.mapId === undefined) {
        return [];
      }
      return clientBoardLayout(this.mapId);
    },
    bounds() {
      return miniLayoutBounds(this.layout);
    },
    viewBox(): string {
      const b = this.bounds;
      return `${(b.minX - FRAME_PAD).toFixed(1)} ${(b.minY - FRAME_PAD).toFixed(1)} ` +
        `${(b.width + 2 * FRAME_PAD).toFixed(1)} ${(b.height + 2 * FRAME_PAD).toFixed(1)}`;
    },
    hexOutline(): string {
      return miniHexPoints();
    },
    /** Reveal wave: distance from the surface's own centre, normalized. */
    waveCenter(): {x: number, y: number, max: number} {
      const b = this.bounds;
      const x = (b.minX + b.maxX) / 2;
      const y = (b.minY + b.maxY) / 2;
      return {x, y, max: Math.max(1, Math.hypot(b.width / 2, b.height / 2))};
    },
    cells(): ReadonlyArray<CellRender> {
      const showGlyphs = this.variant !== 'thumb';
      const wave = this.waveCenter;
      return this.layout.map((s) => {
        const rowLen = MINI_ROWS[s.y] ?? 9;
        const {cx, cy} = miniCellCenter(s.x, s.y, rowLen);
        const style: Record<string, string> = {};
        if (this.reveal) {
          const d = Math.hypot(cx - wave.x, cy - wave.y) / wave.max;
          style['--d'] = `${Math.round(this.revealDelayMs + d * HEX_WAVE_MS)}ms`;
        }
        const glyphs: Array<CellGlyph> = [];
        if (showGlyphs) {
          // The compact card tier draws the BOLD stroke build of the same
          // shapes — at ≈10 px per glyph the printed weight dissolves.
          const art = this.variant === 'card' ? SPACE_BONUS_GLYPHS_BOLD : SPACE_BONUS_GLYPHS;
          const printed = s.b.slice(0, 3);
          const slots = glyphSlots(printed.length);
          printed.forEach((bonus, i) => {
            const slot = slots[i];
            if (slot === undefined || art[bonus] === undefined) {
              return;
            }
            glyphs.push({
              transform: glyphTransform(slot.dx, slot.dy, slot.k),
              paths: art[bonus],
              color: `rgb(${SPACE_BONUS_RGB[bonus]})`,
            });
          });
          if (s.v === true) {
            // Volcanic site: a small caldera mark in the upper corner —
            // never displacing the printed bonuses.
            glyphs.push({transform: glyphTransform(4.6, -5.2, 0.26), paths: VOLCANO_PATHS, color: VOLCANO_COLOR});
          }
          if (s.t === SpaceType.RESTRICTED && printed.length === 0) {
            glyphs.push({transform: glyphTransform(0, 0, 0.34), paths: RESTRICTED_PATHS, color: 'rgba(180, 150, 140, 0.8)'});
          }
        }
        return {
          key: `${s.x}-${s.y}`,
          transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)})`,
          style,
          cls: {
            'map-fp__hex--ocean': s.t === SpaceType.OCEAN,
            'map-fp__hex--cove': s.t === SpaceType.COVE,
            'map-fp__hex--special': s.t === SpaceType.RESTRICTED || s.t === SpaceType.DEFLECTION_ZONE,
          },
          fill: this.hexFill(s),
          glyphs,
        };
      });
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
    // Random-preview ghost: the standard silhouette through the same grid.
    ghostLayout(): ReadonlyArray<string> {
      const out: Array<string> = [];
      MINI_ROWS.forEach((n, y) => {
        for (let i = 0; i < n; i++) {
          const {cx, cy} = miniCellCenter((9 - n) + i, y, n);
          out.push(miniHexPoints().split(' ').map((p) => {
            const [px, py] = p.split(',').map(Number);
            return `${(px + cx).toFixed(1)},${(py + cy).toFixed(1)}`;
          }).join(' '));
        }
      });
      return out;
    },
    ghostViewBox(): string {
      const w = 9 * MINI_HEX_W;
      const h = 8 * MINI_V_STEP + 2 * MINI_HEX_R;
      return `${(-MINI_HEX_W / 2).toFixed(1)} ${-MINI_HEX_R} ${w.toFixed(1)} ${h}`;
    },
  },
  methods: {
    /**
     * The SURFACE is calm — Mars-toned land, the recognisable blue ocean
     * reserves, teal coves, the special areas. Printed bonuses are GLYPHS
     * inside their cells (like the real board), never a colour fill: a
     * plant bonus must not read as a placed greenery tile.
     */
    hexFill(s: BoardLayoutSpace): string {
      switch (s.t) {
      case SpaceType.OCEAN:
        return 'rgba(56, 126, 208, 0.52)';
      case SpaceType.COVE:
        return 'rgba(52, 158, 168, 0.44)';
      case SpaceType.RESTRICTED:
        return 'rgba(16, 10, 9, 0.72)';
      case SpaceType.DEFLECTION_ZONE:
        return 'rgba(152, 102, 232, 0.30)';
      default:
        return s.v === true ? 'rgba(206, 112, 62, 0.26)' : 'rgba(186, 100, 62, 0.15)';
      }
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
