<template>
  <span class="player-cube" :class="rootClass" :style="styleVars" role="img" :aria-label="color" :data-player-token="resolvedColor">
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
        <!-- THE BACK FACES — only on a SOLID cube (the flight proxy): a cube
             that TUMBLES turns its bottom, back and far side to the camera,
             and a three-faced shell would show the void through them. The
             board's resting cubes keep the three visible faces (their pose
             never turns; six SVGs per cube would double the board's DOM). -->
        <template v-if="solid">
          <span class="player-cube__face player-cube__face--bottom">
            <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
              <rect class="player-cube__base" width="64" height="64" />
              <rect width="64" height="64" :fill="fillUrl(aoId)" />
            </svg>
          </span>
          <span class="player-cube__face player-cube__face--back">
            <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
              <rect class="player-cube__base" width="64" height="64" />
              <rect width="64" height="64" :fill="fillUrl(depthSideId)" />
              <path class="player-cube__bevel" d="M0.9 0 V64 M0 0.9 H64" />
              <path class="player-cube__bevel-lo" d="M0 63.1 H64 M63.1 0 V64" />
            </svg>
          </span>
          <span class="player-cube__face player-cube__face--far">
            <svg class="player-cube__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
              <rect class="player-cube__base" width="64" height="64" />
              <rect width="64" height="64" :fill="fillUrl(depthSideId)" />
              <rect width="64" height="64" :fill="fillUrl(aoId)" />
              <path class="player-cube__bevel" d="M0.9 0 V64 M0 0.9 H64" />
              <path class="player-cube__bevel-lo" d="M0 63.1 H64 M63.1 0 V64" />
            </svg>
          </span>
        </template>
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
import {tokenStyleVars, tokenSymbol} from '@/client/components/playerToken/playerTokenPalette';

// Per-page unique id source for the gradient defs.
let pcUid = 0;

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
    /**
     * A NEUTRAL DELEGATE (the Mars Parliament's neutral player): the same
     * physical cube in a cool steel material. One visual system for every
     * delegate on the board — a player's cube and a neutral one differ by
     * colour and the colour-blind glyph, never by geometry or finish.
     */
    steel: {
      type: Boolean,
      default: false,
    },
    /**
     * ALL SIX FACES (the flight proxy): a cube that tumbles in the air shows
     * its bottom, back and far side. Off for every resting cube on the board.
     */
    solid: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {uid: ++pcUid};
  },
  computed: {
    resolvedColor(): Color {
      return this.color ?? 'neutral';
    },
    // The colour tones come from the ONE player-token palette — the delegate
    // figure paints with the very same `--pt-*` set; the cube adds its size.
    styleVars(): Record<string, string> {
      return {
        '--pc-size': `${this.size}px`,
        ...tokenStyleVars(this.resolvedColor, {steel: this.steel}),
      };
    },
    rootClass(): Record<string, boolean> {
      return {
        ['player-cube--' + this.resolvedColor]: true,
        'player-cube--steel': this.steel,
        'player-cube--solid': this.solid,
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
      return tokenSymbol(this.resolvedColor, {steel: this.steel});
    },
  },
  methods: {
    fillUrl(id: string): string {
      return `url(#${id})`;
    },
  },
});
</script>
