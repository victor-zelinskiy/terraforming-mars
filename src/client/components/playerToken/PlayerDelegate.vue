<template>
  <span class="player-delegate" :class="rootClass" :style="styleVars" role="img" :aria-label="color" :data-player-token="resolvedColor">
    <!-- Per-instance gradient defs (uid-suffixed ids so many figures on one
         page can't collide). Zero-size, never lays out. -->
    <svg class="player-delegate__defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <!-- BODY depth — the WEIGHT gradient the cube's sides carry: a lit
             crown falling to a heavy base, so the figure's mass collects where
             it meets the disc (light up top, pressed at the foot). -->
        <linearGradient :id="depthId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16" />
          <stop offset="34%" stop-color="#ffffff" stop-opacity="0.02" />
          <stop offset="70%" stop-color="#000000" stop-opacity="0.10" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.38" />
        </linearGradient>
        <!-- SATIN sheen — the cube's top-face catch of light, off-centre to
             the upper left: a controlled semi-gloss, never a wet hotspot. -->
        <radialGradient :id="sheenId" cx="34%" cy="18%" r="62%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.40" />
          <stop offset="44%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <!-- Turned-away side: the right half sits in the figure's own shade. -->
        <linearGradient :id="turnId" x1="0" y1="0" x2="1" y2="0">
          <stop offset="52%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.26" />
        </linearGradient>
        <!-- The DISC's lit top: lighter toward the viewer's upper left. -->
        <radialGradient :id="discId" cx="40%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.18" />
        </radialGradient>
        <!-- Rim light on the far (right) edge of the silhouette: the edge's
             own stroke, fading in across the figure (no hard clip line). -->
        <linearGradient :id="rimId" x1="14" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" class="player-delegate__rim-stop" stop-opacity="0" />
          <stop offset="100%" class="player-delegate__rim-stop" stop-opacity="1" />
        </linearGradient>
      </defs>
    </svg>

    <!-- The CONTACT SHADOW lives on the table, never on the figure: in flight
         it stays on the floor while the body lifts (`--pd-lift`), so the gap
         between the two IS the height. -->
    <span v-if="shadow" class="player-delegate__shadow"></span>
    <span v-if="glow" class="player-delegate__glow"></span>

    <span class="player-delegate__body">
      <svg class="player-delegate__svg" viewBox="0 0 40 50" aria-hidden="true" focusable="false">
        <!-- THE BASE — a lacquered disc: its side (the darkest tone: the mass
             gathers at the support point) and its lit top. -->
        <path class="player-delegate__disc-side" d="M3 43.4V45.6A17 4.2 0 0 0 37 45.6V43.4Z" />
        <ellipse class="player-delegate__disc-top" cx="20" cy="43.4" rx="17" ry="4.2" />
        <ellipse cx="20" cy="43.4" rx="17" ry="4.2" :fill="fillUrl(discId)" />
        <!-- THE FIGURE — the card's silhouette as a standee on the disc. -->
        <g class="player-delegate__figure" transform="translate(4 2.24) scale(0.8)">
          <path class="player-delegate__silhouette" :d="path" />
          <path :d="path" :fill="fillUrl(depthId)" />
          <path :d="path" :fill="fillUrl(turnId)" />
          <path :d="path" :fill="fillUrl(sheenId)" />
          <path class="player-delegate__rim" :d="path" :stroke="fillUrl(rimId)" />
          <path class="player-delegate__edge" :d="path" />
        </g>
        <!-- Ambient occlusion where the figure stands in the disc. -->
        <ellipse class="player-delegate__ao" cx="20" cy="43.2" rx="13.2" ry="1.7" />
      </svg>
      <span v-if="showSymbol" class="player-delegate__symbol">{{ symbolGlyph }}</span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {tokenStyleVars, tokenSymbol} from '@/client/components/playerToken/playerTokenPalette';
import {DELEGATE_PATH} from '@/client/components/playerToken/delegateGlyph';

// Per-page unique id source for the gradient defs.
let pdUid = 0;

/**
 * THE DELEGATE PIECE — the Parliament's figure on the table (Turmoil Redux).
 *
 * The card's silhouette (`delegateGlyph.ts`) as a lacquered STANDEE on a disc
 * base, in exactly its player's cube RGB (`playerTokenPalette.ts` — both pieces
 * paint with the one `--pt-*` set) or in the neutral delegate's steel. The
 * cube stays the mark of OWNERSHIP (a city, a greenery, a colony, a milestone);
 * wherever the object IS a delegate, it is this figure — the eye recognises on
 * a resolution's ribbon what it read on the card.
 *
 * Props mirror `PlayerCube` so a seat swaps one tag for the other. `size` is
 * the figure's HEIGHT in px (its box is 0.8 × size wide); without it the place
 * sizes the figure (`--pd-host`, floor `.9rem` = 18 logical px). Never put a CSS
 * `filter` on the piece (the console strips them; the shadow and the glow are
 * flat siblings that carry their own softness).
 */
export default defineComponent({
  name: 'player-delegate',
  props: {
    // `Color | undefined` for the same reason as the cube: a seat binds an
    // optional model field; an undefined owner falls back to neutral.
    color: {
      type: String as unknown as PropType<Color | undefined>,
      required: true,
    },
    // The figure's height in px (its box is 0.8 × size wide). Absent → the
    // HOST sizes it: the place it stands in declares `--pd-host` (a socket,
    // a ribbon slot, a plaque's place), so the place, its footprint and the
    // figure live in ONE stylesheet and scale with the profile's rem. The
    // floor is 18 logical px (`.9rem`).
    size: {
      type: Number as PropType<number | undefined>,
      default: undefined,
    },
    // A whisper of the player's colour behind the upper body.
    glow: {
      type: Boolean,
      default: true,
    },
    // The contact shadow on the table under the base.
    shadow: {
      type: Boolean,
      default: true,
    },
    // Play the placement (set down + settle) on mount.
    animateIn: {
      type: Boolean,
      default: false,
    },
    // Tri-state, as the cube: true / false force the colour-blind glyph,
    // undefined follows the `symbol_overlay` preference.
    overlaySymbol: {
      type: Boolean as unknown as PropType<boolean | undefined>,
      default: undefined,
    },
    // The NEUTRAL delegate: the same figure in the steel alloy.
    steel: {
      type: Boolean,
      default: false,
    },
    // The FLIGHT PROXY: a figure carried over the table (the director drives
    // `--pd-lift` / `--pd-tilt`; the resting pose is pixel-identical).
    solid: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {uid: ++pdUid, path: DELEGATE_PATH};
  },
  computed: {
    resolvedColor(): Color {
      return this.color ?? 'neutral';
    },
    styleVars(): Record<string, string> {
      const vars = tokenStyleVars(this.resolvedColor, {steel: this.steel});
      return this.size === undefined ? vars : {'--pd-size': `${this.size}px`, ...vars};
    },
    rootClass(): Record<string, boolean> {
      return {
        ['player-delegate--' + this.resolvedColor]: true,
        'player-delegate--steel': this.steel,
        'player-delegate--solid': this.solid,
        'player-delegate--animate-in': this.animateIn === true,
      };
    },
    depthId(): string {
      return 'pd-depth-' + this.uid;
    },
    sheenId(): string {
      return 'pd-sheen-' + this.uid;
    },
    turnId(): string {
      return 'pd-turn-' + this.uid;
    },
    discId(): string {
      return 'pd-disc-' + this.uid;
    },
    rimId(): string {
      return 'pd-rim-' + this.uid;
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
