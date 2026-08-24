<template>
  <!--
    THE MARS NOMADS MARKER — the one physical token of the travelling camp.

    A sibling of PlayerCube.vue (the same proven orthographic-isometric
    3-face construction, the same flat-scene animation discipline), but a
    DIFFERENT OBJECT, not a recoloured player cube: a low-profile mobile
    module machined from dark iridium-titanium, its panel seams inlaid with
    warm electrum-copper light, and a wayfinder mark engraved into the lid.
    Identity is carried by MATERIAL + SEAMS + THE ENGRAVED MARK — never by
    hue alone — so it stays unmistakable for colour-blind players and can
    never be read as any player's ownership cube.

    ONE component serves every representation: the board cell, the premium
    card face (PremiumMechNode), and the console flight proxies — only
    `size` changes. The landing entrance (`landing` prop) is Flow A of the
    Mars Nomads choreography: the module materializes over the cell,
    descends with its contact shadow converging, seats with one micro-
    compression and a retiring halo. It grants NOTHING — the cell's printed
    bonuses deliberately do not react (see markerPlacementAnimation.ts).

    Perf contract: transform/opacity animations only; the glow/shadow are
    flat gradient siblings (no `filter` dependency — the console paint
    baseline strips filters, and this token must read identically with
    them stripped); no ambient loops — the premium sits in the material.
  -->
  <span class="nomad-token" :class="rootClass" :style="styleVars" role="img" aria-label="Mars Nomads">
    <svg class="nomad-token__defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <!-- LID depth: cool top light falling into the body's dark mass. -->
        <linearGradient :id="lidId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#aebfd6" stop-opacity="0.20" />
          <stop offset="42%" stop-color="#7f92ad" stop-opacity="0.05" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.28" />
        </linearGradient>
        <!-- SIDE depth: the weight gradient — mass collects at the base. -->
        <linearGradient :id="sideId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c3d2e4" stop-opacity="0.10" />
          <stop offset="30%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="60%" stop-color="#000000" stop-opacity="0.10" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.48" />
        </linearGradient>
        <!-- Iridescent satin sheen on the lid: a broad off-centre catch of
             cold light with the faintest violet cast (oiled titanium). -->
        <radialGradient :id="sheenId" cx="36%" cy="24%" r="68%">
          <stop offset="0%" stop-color="#cfe0ff" stop-opacity="0.26" />
          <stop offset="40%" stop-color="#a9b4ff" stop-opacity="0.07" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <!-- The copper seam light: brightest at the lit corner, cooling off
             along the run — an inlay carrying current, not a painted line. -->
        <linearGradient :id="seamId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffd9a0" />
          <stop offset="45%" stop-color="#f0a95e" />
          <stop offset="100%" stop-color="#b96f34" />
        </linearGradient>
      </defs>
    </svg>

    <!-- Flow A stage furniture (rendered only while landing): the target
         cell's calm focus halo + the one-shot landing dust ring. Both sit at
         GROUND level, under the descending module. -->
    <span v-if="isLanding" class="nomad-token__halo"></span>
    <span v-if="isLanding" class="nomad-token__dust"></span>

    <span v-if="glow" class="nomad-token__glow"></span>

    <span class="nomad-token__scene">
      <span class="nomad-token__cube">
        <!-- right (deep shadow side) -->
        <span class="nomad-token__face nomad-token__face--right">
          <svg class="nomad-token__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="nomad-token__base nomad-token__base--right" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(sideId)" />
            <!-- side panel seam: one recessed service line, faint copper -->
            <path class="nomad-token__panel" d="M14 6 V58" />
            <path class="nomad-token__seam nomad-token__seam--dim" :stroke="fillUrl(seamId)" d="M1.6 0 V64 M0 1.6 H64" />
            <path class="nomad-token__edge-lo" d="M0 62.4 H64 M62.4 0 V64" />
          </svg>
        </span>
        <!-- left (mid side) -->
        <span class="nomad-token__face nomad-token__face--left">
          <svg class="nomad-token__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="nomad-token__base nomad-token__base--left" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(sideId)" />
            <path class="nomad-token__panel" d="M50 6 V58" />
            <path class="nomad-token__seam" :stroke="fillUrl(seamId)" d="M1.6 0 V64 M0 1.6 H64" />
            <path class="nomad-token__edge-lo" d="M0 62.4 H64 M62.4 0 V64" />
          </svg>
        </span>
        <!-- top (the lit lid, carrying the engraved wayfinder mark) -->
        <span class="nomad-token__face nomad-token__face--top">
          <svg class="nomad-token__svg" viewBox="0 0 64 64" preserveAspectRatio="none">
            <rect class="nomad-token__base nomad-token__base--top" width="64" height="64" />
            <rect width="64" height="64" :fill="fillUrl(lidId)" />
            <rect width="64" height="64" :fill="fillUrl(sheenId)" />
            <!-- the full seam frame of the lid — the panel's charged inlay -->
            <path class="nomad-token__seam nomad-token__seam--lid" :stroke="fillUrl(seamId)"
                  d="M2 2 H62 V62 H2 Z" fill="none" />
            <!-- THE WAYFINDER — the engraved route mark: a four-point course
                 star over an orbital chord. Engraving = a dark groove with a
                 copper inlay lit inside it (two aligned strokes, no filters).
                 Kept ≥3 viewBox-units thick so it survives a 16px cell. -->
            <g class="nomad-token__mark">
              <path class="nomad-token__mark-groove"
                    d="M32 10 L37.5 26.5 L54 32 L37.5 37.5 L32 54 L26.5 37.5 L10 32 L26.5 26.5 Z" />
              <path class="nomad-token__mark-inlay" :stroke="fillUrl(seamId)"
                    d="M32 10 L37.5 26.5 L54 32 L37.5 37.5 L32 54 L26.5 37.5 L10 32 L26.5 26.5 Z" />
              <circle class="nomad-token__mark-core" cx="32" cy="32" r="4.4" />
              <!-- the travelled course: an engraved chord arcing past the star -->
              <path class="nomad-token__mark-orbit" d="M12 49 Q 32 40 52 15" />
            </g>
          </svg>
        </span>
      </span>
    </span>

    <span v-if="shadow" class="nomad-token__shadow"></span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

// Per-page unique id source for the gradient defs (PlayerCube's discipline —
// many tokens on one page must not collide).
let ntUid = 0;

export default defineComponent({
  name: 'nomad-token',
  props: {
    // Footprint in px (the projected module fits inside a size×size box).
    size: {
      type: Number,
      default: 18,
    },
    // Warm copper presence bloom behind the module.
    glow: {
      type: Boolean,
      default: true,
    },
    // Grounding contact shadow.
    shadow: {
      type: Boolean,
      default: true,
    },
    /**
     * Flow A — the FIRST-LANDING entrance: 'drop' plays the full descent
     * (cell focus halo → materialize above the surface → descend with the
     * shadow converging → micro-compression + dust at contact → settle).
     * The host drives duration/delay via the `--nomad-landing-duration` /
     * `--nomad-landing-delay` custom properties (a negative delay RESUMES a
     * beat interrupted by a remount — the marker framework's contract).
     */
    landing: {
      type: String as () => 'none' | 'drop',
      default: 'none',
    },
  },
  data() {
    return {uid: ++ntUid};
  },
  computed: {
    styleVars(): Record<string, string> {
      return {'--nt-size': `${this.size}px`};
    },
    isLanding(): boolean {
      return this.landing === 'drop';
    },
    rootClass(): Record<string, boolean> {
      return {'nomad-token--landing': this.isLanding};
    },
    lidId(): string {
      return 'nt-lid-' + this.uid;
    },
    sideId(): string {
      return 'nt-side-' + this.uid;
    },
    sheenId(): string {
      return 'nt-sheen-' + this.uid;
    },
    seamId(): string {
      return 'nt-seam-' + this.uid;
    },
  },
  methods: {
    fillUrl(id: string): string {
      return `url(#${id})`;
    },
  },
});
</script>
