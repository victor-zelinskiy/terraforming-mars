<template>
  <span class="player-cube" :class="rootClass" :style="styleVars" role="img" :aria-label="color">
    <!-- Per-instance gradient defs (uid-suffixed ids so many cubes on one page
         can't collide). Lifted out of the 3D scene; never lays out. -->
    <svg class="player-cube__defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient :id="sheenId" x1="0%" y1="0%" x2="78%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42" />
          <stop offset="45%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <radialGradient :id="aoId" cx="86%" cy="92%" r="95%">
          <stop offset="34%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.34" />
        </radialGradient>
        <radialGradient :id="glossId" cx="30%" cy="24%" r="48%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72" />
          <stop offset="58%" stop-color="#ffffff" stop-opacity="0.12" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
    </svg>

    <span v-if="glow" class="player-cube__glow"></span>

    <span class="player-cube__scene">
      <span class="player-cube__cube">
        <!-- right (darkest) -->
        <span class="player-cube__face player-cube__face--right">
          <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="player-cube__base" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(sheenId)" />
            <rect width="64" height="64" :fill="fillUrl(aoId)" />
            <path class="player-cube__bevel" d="M0.7 0 V64 M0 0.7 H64" />
          </svg>
        </span>
        <!-- left (mid) -->
        <span class="player-cube__face player-cube__face--left">
          <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="player-cube__base" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(sheenId)" />
            <rect width="64" height="64" :fill="fillUrl(aoId)" />
            <path class="player-cube__bevel" d="M0.7 0 V64 M0 0.7 H64" />
          </svg>
        </span>
        <!-- top (lit, glossy) -->
        <span class="player-cube__face player-cube__face--top">
          <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="player-cube__base" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(sheenId)" />
            <rect width="64" height="64" :fill="fillUrl(glossId)" />
            <path class="player-cube__bevel" d="M0.7 0 V64 M0 0.7 H64 M63.3 0 V64 M0 63.3 H64" />
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
  pink: [245, 116, 187],
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
    color: {
      type: String as () => Color,
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
    base(): RGB {
      return BASE_RGB[this.color] ?? BASE_RGB.neutral;
    },
    styleVars(): Record<string, string> {
      const base = this.base;
      const top = mixWhite(base, 0.20); // lit face — brightened without clipping
      const left = scaleRgb(base, 0.86); // mid shade (hue preserved)
      const right = scaleRgb(base, 0.56); // deep shade
      const edgeHi = mixWhite(base, 0.66); // machined bevel highlight
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
        ['player-cube--' + this.color]: true,
        'player-cube--animate-in': this.animateIn === true,
      };
    },
    sheenId(): string {
      return 'pc-sheen-' + this.uid;
    },
    aoId(): string {
      return 'pc-ao-' + this.uid;
    },
    glossId(): string {
      return 'pc-gloss-' + this.uid;
    },
    showSymbol(): boolean {
      if (this.overlaySymbol === undefined) {
        return getPreferences().symbol_overlay;
      }
      return this.overlaySymbol === true;
    },
    symbolGlyph(): string {
      return SYMBOL[this.color] ?? SYMBOL.neutral;
    },
  },
  methods: {
    fillUrl(id: string): string {
      return `url(#${id})`;
    },
  },
});
</script>
