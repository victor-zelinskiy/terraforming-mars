<template>
  <!--
    Trade-fleet SHIP — the per-player vessel mark used by the console
    colonies surfaces, the desktop colonies overlay / tiles / detail /
    card, AND the flying proxy of the console trade-launch cinematic.

    DESIGN (the minimalist pass): a faceted STEALTH DART — one clean
    geometric silhouette, two dark-glass facets for dimension, a hairline
    edge, and the player colour reduced to a LIVERY of three restrained
    marks (the keel line, the two wingtip edges, the engine slit). No
    cockpit windows, no cargo latches, no beacon dots — a premium glyph,
    not an illustrated toy. Every tone is EXPLICIT (flat fills + one plume
    gradient): the console paint baseline strips CSS `filter` permanently,
    so the mark must carry its own depth.

    The plume gradient is declared per instance with a unique id (many
    ships stand on one screen; `url(#…)` resolves document-wide).
    States (CSS-driven): `free` lights the resting exhaust; `mode` 'hero'
    is the flight proxy's higher-presence pass; `state` drives the launch
    charge / in-flight thrust / docked settle.
  -->
  <svg class="colony-fleet-icon"
       :class="[
         'fleet-hue--' + color,
         'colony-fleet-icon--' + mode,
         state !== 'idle' ? 'colony-fleet-icon--' + state : '',
         {'colony-fleet-icon--free': free},
       ]"
       viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <defs>
      <!-- Engine jet: white-hot core falling into the owner glow. -->
      <linearGradient :id="uid + '-plume'" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" class="cfi-stop-plume-core" />
        <stop offset="0.4" class="cfi-stop-plume-mid" />
        <stop offset="1" class="cfi-stop-plume-tip" />
      </linearGradient>
    </defs>

    <!-- Engine jet (launch / in-flight) — a slim blade, behind the hull. -->
    <path class="cfi-thrust" :fill="'url(#' + uid + '-plume)'"
      d="M14.7 23.2 L16 30.8 L17.3 23.2 Z" />
    <!-- Resting exhaust — the "free fleet" idle (shorter, softer). -->
    <path class="cfi-flame" :fill="'url(#' + uid + '-plume)'"
      d="M15.0 23.0 L16 27.6 L17.0 23.0 Z" />

    <!-- HULL — a chevron dart in two dark-glass facets (the one tone split
         that gives the mark dimension without illustration). -->
    <path class="cfi-facet-l" d="M16 2.2 L8.6 25.2 L16 21.4 Z" />
    <path class="cfi-facet-r" d="M16 2.2 L23.4 25.2 L16 21.4 Z" />

    <!-- LIVERY — the player colour as three restrained marks. -->
    <!-- The keel line, nose → engine. -->
    <path class="cfi-keel" d="M16 4.6 L16.62 19.9 L16 21.0 L15.38 19.9 Z" />
    <!-- The wingtip trailing edges. -->
    <path class="cfi-tip" d="M9.55 22.25 L8.6 25.2 L11.4 23.75 Z" />
    <path class="cfi-tip" d="M22.45 22.25 L23.4 25.2 L20.6 23.75 Z" />
    <!-- The engine slit in the tail notch. -->
    <path class="cfi-slit" d="M14.85 22.05 L16 22.75 L17.15 22.05 L16 21.55 Z" />

    <!-- EDGE — one hairline so the dark hull separates from any backdrop. -->
    <path class="cfi-edge" fill="none"
      d="M16 2.2 L23.4 25.2 L16 21.4 L8.6 25.2 Z" />
  </svg>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';

/**
 * Stateless per-player fleet ship. Pass `color` (the fleet owner's player
 * colour) and, optionally: `free` (an untraded fleet → resting exhaust),
 * `mode` ('icon' the compact host token, 'hero' the bigger flight-proxy
 * presentation), and `state` (the launch cinematic phase). Colour + state
 * are applied via classes, so the component is self-contained anywhere.
 */
export type FleetShipState = 'idle' | 'armed' | 'launch' | 'flight' | 'docked';

let fleetIconUid = 0;

export default defineComponent({
  name: 'ColonyFleetIcon',
  props: {
    color: {type: String as PropType<Color>, required: true},
    free: {type: Boolean, default: false},
    mode: {type: String as PropType<'icon' | 'hero'>, default: 'icon'},
    state: {type: String as PropType<FleetShipState>, default: 'idle'},
  },
  data() {
    // Unique per instance: many ships stand on one screen and `url(#…)`
    // resolves document-wide — shared ids would all point at the first.
    return {uid: `cfi${++fleetIconUid}`};
  },
});
</script>
