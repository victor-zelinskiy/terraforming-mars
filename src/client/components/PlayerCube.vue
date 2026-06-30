<template>
  <span class="player-cube" :class="rootClass" :style="styleVars" role="img" :aria-label="color">
    <!-- Per-instance gradient defs (uid-suffixed ids so many cubes on one page
         can't collide). Lifted out of the 3D scene; never lays out. -->
    <svg class="player-cube__defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <!-- TOP-face depth: a gentle light-top → soft-base falloff. The top is
             the LIT face, so it stays mostly light (the sheen sits on it). -->
        <linearGradient :id="depthId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16" />
          <stop offset="40%" stop-color="#ffffff" stop-opacity="0.02" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.20" />
        </linearGradient>
        <!-- SIDE-face depth: the WEIGHT / SEATING gradient. A light upper edge
             (where it meets the lit top) falling to a HEAVY, concentrated dark
             BASE — the cube's mass collects at the support point and the lower
             body reads as the contact zone (this is the on-cube half of the
             grounding: top light, base heavy + pressed). -->
        <linearGradient :id="depthSideId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.10" />
          <stop offset="30%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="55%" stop-color="#000000" stop-opacity="0.06" />
          <stop offset="84%" stop-color="#000000" stop-opacity="0.26" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.46" />
        </linearGradient>
        <!-- Top-face SATIN sheen: a soft, broad, off-centre catch of light — a
             controlled semi-gloss, NOT a wet glossy hotspot. -->
        <radialGradient :id="sheenId" cx="34%" cy="26%" r="66%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34" />
          <stop offset="46%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <!-- Side-face ambient occlusion: deepen the lower-OUTER corner (the
             point furthest from the light + nearest the surface) so the corner
             reads as the deepest contact. Eased back since `depthSideId` now
             carries the base mass — together they keep the base rich, not
             muddy. -->
        <radialGradient :id="aoId" cx="64%" cy="104%" r="92%">
          <stop offset="44%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.16" />
        </radialGradient>
      </defs>
    </svg>

    <span v-if="glow" class="player-cube__glow"></span>

    <span class="player-cube__scene">
      <span class="player-cube__cube">
        <!-- right (deep shadow side): colour → weighted depth → AO → bevels -->
        <span class="player-cube__face player-cube__face--right">
          <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="player-cube__base" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(depthSideId)" />
            <rect width="64" height="64" :fill="fillUrl(aoId)" />
            <path class="player-cube__bevel" d="M0.9 0 V64 M0 0.9 H64" />
            <path class="player-cube__bevel-lo" d="M0 63.1 H64 M63.1 0 V64" />
          </svg>
        </span>
        <!-- left (mid side) -->
        <span class="player-cube__face player-cube__face--left">
          <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="player-cube__base" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(depthSideId)" />
            <rect width="64" height="64" :fill="fillUrl(aoId)" />
            <path class="player-cube__bevel" d="M0.9 0 V64 M0 0.9 H64" />
            <path class="player-cube__bevel-lo" d="M0 63.1 H64 M63.1 0 V64" />
          </svg>
        </span>
        <!-- top (lit satin face): colour → depth → satin sheen → bevel -->
        <span class="player-cube__face player-cube__face--top">
          <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="player-cube__base" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(depthId)" />
            <rect width="64" height="64" :fill="fillUrl(sheenId)" />
            <path class="player-cube__bevel" d="M0.9 0 V64 M0 0.9 H64" />
            <path class="player-cube__bevel-lo" d="M0 63.1 H64 M63.1 0 V64" />
          </svg>
        </span>
      </span>
    </span>

    <span v-if="shadow" class="player-cube__shadow"></span>
    <span v-if="showSymbol" class="player-cube__symbol">{{ symbolGlyph }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {getPreferences} from '@/client/utils/PreferencesManager';

// Per-page unique id source for the gradient defs.
let pcUid = 0;

type RGB = [number, number, number];

// Base player-token colours. The eight player colours mirror the game palette
// (`src/styles/variables.less`); `black` is a dark gunmetal so the cube reads
// as a black token (the UI `player_black` grey is for chips/text, not the
// physical cube), and `bronze`/`neutral` share one bronze tone.
const BASE_RGB: Record<Color, RGB> = {
  red: [153, 17, 0],
  green: [0, 153, 0],
  yellow: [170, 170, 0],
  blue: [0, 102, 255],
  black: [86, 90, 98],
  purple: [140, 0, 255],
  orange: [236, 113, 12],
  // Pink deepened from the flat UI value (245,116,187) into a richer satin
  // rose so the cube reads as lacquered acrylic, not a candy sticker — still
  // unmistakably the pink player.
  pink: [240, 100, 174],
  bronze: [176, 121, 71],
  neutral: [176, 121, 71],
};

// Colour-blind overlay glyphs (carried over from the legacy sprite overlay).
const SYMBOL: Record<Color, string> = {
  red: '▲',
  blue: '+',
  black: '∇',
  yellow: '∗',
  green: '◆',
  purple: '◉',
  orange: '▢',
  pink: '◈',
  bronze: '▦',
  neutral: '★',
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function scaleRgb(c: RGB, f: number): RGB {
  return [clampByte(c[0] * f), clampByte(c[1] * f), clampByte(c[2] * f)];
}
function mixWhite(c: RGB, t: number): RGB {
  return [
    clampByte(c[0] + (255 - c[0]) * t),
    clampByte(c[1] + (255 - c[1]) * t),
    clampByte(c[2] + (255 - c[2]) * t),
  ];
}
function toRgb(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function toRgba(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}
function luma(c: RGB): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

export default defineComponent({
  name: 'player-cube',
  props: {
    // Accepts `Color | undefined` so call sites can bind a model field that is
    // optional in its type (a milestone/award/space colour that is only present
    // once a player owns it). The cube only renders when the owner exists, so
    // `color` is a real Color at runtime; an undefined slips through as the
    // neutral fallback rather than a type error at every guarded call site.
    color: {
      type: String as unknown as PropType<Color | undefined>,
      required: true,
    },
    // Footprint in px (the projected cube fits inside a size×size box).
    size: {
      type: Number,
      default: 21,
    },
    // Soft coloured bloom behind the cube (the premium "lit token" glow).
    glow: {
      type: Boolean,
      default: true,
    },
    // Grounding contact shadow under the cube.
    shadow: {
      type: Boolean,
      default: true,
    },
    // Play the placement (drop + settle) animation on mount.
    animateIn: {
      type: Boolean,
      default: false,
    },
    // Tri-state: true → force the colour-blind glyph, false → force-hide,
    // undefined (default) → follow the `symbol_overlay` preference. `default:
    // undefined` is what enables the fall-back — Vue's Boolean casting only
    // forces an absent prop to `false` when NO default is set, so an explicit
    // `undefined` default keeps the absent value `undefined`.
    overlaySymbol: {
      type: Boolean as unknown as PropType<boolean | undefined>,
      default: undefined,
    },
  },
  data() {
    return {uid: ++pcUid};
  },
  computed: {
    resolvedColor(): Color {
      return this.color ?? 'neutral';
    },
    base(): RGB {
      return BASE_RGB[this.resolvedColor] ?? BASE_RGB.neutral;
    },
    styleVars(): Record<string, string> {
      const base = this.base;
      // Keep the body RICH — the per-face depth gradient + satin sheen supply
      // the lighting, so the base shades stay saturated (not washed toward
      // white). DEEPER sides (esp. the right/shadow face) give clear physical
      // thickness at real board scale (18–28px). The top lift is ADAPTIVE: an
      // already-light body (pink / yellow) gets barely any whitening so it
      // reads as deep satin acrylic, not a milky candy chip; a dark body gets a
      // touch more lift to read as the lit face.
      const lightBody = luma(base) > 140;
      const top = mixWhite(base, lightBody ? 0.05 : 0.13);
      const left = scaleRgb(base, 0.80); // mid side
      const right = scaleRgb(base, 0.50); // deep shadow side — physical thickness
      const edgeHi = mixWhite(base, 0.55);
      const symbol = luma(top) > 150 ? 'rgba(20, 18, 14, 0.92)' : 'rgba(255, 255, 255, 0.95)';
      return {
        '--pc-size': `${this.size}px`,
        '--pc-top': toRgb(top),
        '--pc-left': toRgb(left),
        '--pc-right': toRgb(right),
        '--pc-edge-hi': toRgb(edgeHi),
        '--pc-glow': toRgba(base, 0.55),
        '--pc-symbol': symbol,
      };
    },
    rootClass(): Record<string, boolean> {
      return {
        ['player-cube--' + this.resolvedColor]: true,
        'player-cube--animate-in': this.animateIn === true,
      };
    },
    depthId(): string {
      return 'pc-depth-' + this.uid;
    },
    depthSideId(): string {
      return 'pc-depth-side-' + this.uid;
    },
    sheenId(): string {
      return 'pc-sheen-' + this.uid;
    },
    aoId(): string {
      return 'pc-ao-' + this.uid;
    },
    showSymbol(): boolean {
      if (this.overlaySymbol === undefined) {
        return getPreferences().symbol_overlay;
      }
      return this.overlaySymbol === true;
    },
    symbolGlyph(): string {
      return SYMBOL[this.resolvedColor] ?? SYMBOL.neutral;
    },
  },
  methods: {
    fillUrl(id: string): string {
      return `url(#${id})`;
    },
  },
});
</script>
