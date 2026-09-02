<template>
  <!--
    Premium trade-fleet SHIP — the per-player freighter used by BOTH the
    console colonies surfaces AND the desktop colonies overlay / tiles /
    detail / card, AND the flying proxy of the console trade-launch
    cinematic. One set of paths; the player colour rides inheritable CSS
    custom props set by the `fleet-hue--<color>` class (colony_fleet.less).
    The PRESENTATION (size / placement / backing) is owned by each host
    context — this is the ship primitive + its states.

    DESIGN CONTRACT (the premium rework): every tone of the vessel is
    EXPLICIT — SVG gradients + dedicated shade/light paths — because the
    console paint baseline strips CSS `filter` permanently, so a ship whose
    depth relied on drop-shadows/brightness rendered as a flat arcade
    sprite there (the reported «дешевая аркада»). The hull is neutral
    titanium; the player colour is a LIVERY (nose cap, wings, tail band),
    the way real vessels carry an operator's colours — identifiable at a
    glance, never a toy-coloured blob.

    Gradients are declared per instance with unique ids (many ships stand
    on one screen; `url(#…)` must never resolve into a hidden sibling).
    States (CSS-driven): `free` lights the warm idle exhaust; `mode` 'hero'
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
      <!-- Titanium hull: lit from the upper-left, falling to a cool belly. -->
      <linearGradient :id="uid + '-hull'" x1="0.22" y1="0" x2="0.78" y2="1">
        <stop offset="0" class="cfi-stop-hull-hi" />
        <stop offset="0.52" class="cfi-stop-hull-mid" />
        <stop offset="1" class="cfi-stop-hull-lo" />
      </linearGradient>
      <!-- Livery: the player colour with its own top-light → shade fall. -->
      <linearGradient :id="uid + '-livery'" x1="0.3" y1="0" x2="0.7" y2="1">
        <stop offset="0" class="cfi-stop-livery-hi" />
        <stop offset="1" class="cfi-stop-livery-lo" />
      </linearGradient>
      <!-- Engine plume: white-hot core falling into the owner glow. -->
      <linearGradient :id="uid + '-plume'" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" class="cfi-stop-plume-core" />
        <stop offset="0.45" class="cfi-stop-plume-mid" />
        <stop offset="1" class="cfi-stop-plume-tip" />
      </linearGradient>
    </defs>

    <!-- Engine thrust plume (launch / in-flight) — behind the hull. -->
    <path class="cfi-thrust" :fill="'url(#' + uid + '-plume)'"
      d="M13.1 24.6 C13.6 27.8 14.7 30.4 16 31.6 C17.3 30.4 18.4 27.8 18.9 24.6
         C17.9 25.3 14.1 25.3 13.1 24.6 Z" />
    <!-- Idle exhaust — the "free fleet" resting flame (softer, shorter). -->
    <path class="cfi-flame" :fill="'url(#' + uid + '-plume)'"
      d="M13.9 24.4 C14.3 26.4 15.1 28.1 16 28.9 C16.9 28.1 17.7 26.4 18.1 24.4
         C17.2 25.0 14.8 25.0 13.9 24.4 Z" />

    <!-- Swept WINGS — player livery over a darker structural underlay. -->
    <path class="cfi-wing-under"
      d="M11.9 12.6 L4.6 21.8 L5.6 23.0 L11.9 20.4 Z
         M20.1 12.6 L27.4 21.8 L26.4 23.0 L20.1 20.4 Z" />
    <path class="cfi-wing" :fill="'url(#' + uid + '-livery)'"
      d="M11.9 13.6 L5.6 21.6 L6.3 22.4 L11.9 19.9 Z
         M20.1 13.6 L26.4 21.6 L25.7 22.4 L20.1 19.9 Z" />
    <!-- Wingtip beacons (static riding lights — part of the livery). -->
    <circle class="cfi-beacon" cx="5.6" cy="21.9" r="0.75" />
    <circle class="cfi-beacon" cx="26.4" cy="21.9" r="0.75" />

    <!-- HULL — an elongated freighter fuselage (titanium gradient). -->
    <path class="cfi-hull" :fill="'url(#' + uid + '-hull)'"
      d="M16 1.6 C18.6 3.6 20.3 7.2 20.3 11.4 L20.3 21.6
         C20.3 23.4 19.5 24.6 18.2 24.9 L13.8 24.9
         C12.5 24.6 11.7 23.4 11.7 21.6 L11.7 11.4
         C11.7 7.2 13.4 3.6 16 1.6 Z" />
    <!-- Belly shade — the hull's own right-side falloff (explicit, not a
         CSS filter): what keeps the vessel volumetric on the console. -->
    <path class="cfi-hull-shade"
      d="M18.1 3.4 C19.5 5.5 20.3 8.3 20.3 11.4 L20.3 21.6
         C20.3 23.4 19.5 24.6 18.2 24.9 L16.6 24.9
         C17.7 23.9 18.3 22.4 18.3 20.6 L18.3 9.6
         C18.3 7.2 18.2 5.1 18.1 3.4 Z" />
    <!-- Rim light — the lit port edge (a thin explicit highlight). -->
    <path class="cfi-rim"
      d="M15.4 2.4 C13.6 4.4 12.5 7.6 12.5 11.4 L12.5 21.4
         C12.5 22.4 12.8 23.3 13.4 23.9 L13.0 24.0
         C12.2 23.4 11.7 22.4 11.7 21.6 L11.7 11.4
         C11.7 7.4 13.2 4.0 15.4 2.4 Z" />

    <!-- NOSE CAP — the livery's leading mark. -->
    <path class="cfi-nose" :fill="'url(#' + uid + '-livery)'"
      d="M16 1.6 C17.3 2.6 18.4 4.1 19.2 6.0 L12.8 6.0
         C13.6 4.1 14.7 2.6 16 1.6 Z" />

    <!-- COCKPIT — inset glass with a fixed sheen arc. -->
    <path class="cfi-glass"
      d="M13.4 8.2 C14.1 7.6 17.9 7.6 18.6 8.2
         C18.9 9.4 18.9 10.8 18.6 12.0 C17.9 12.6 14.1 12.6 13.4 12.0
         C13.1 10.8 13.1 9.4 13.4 8.2 Z" />
    <path class="cfi-glass-sheen"
      d="M13.8 8.5 C14.9 8.0 16.4 7.9 17.6 8.2 C16.7 9.0 14.9 9.3 13.7 9.2
         C13.7 9.0 13.75 8.7 13.8 8.5 Z" />

    <!-- CARGO BAND — the freighter's mid-hull livery stripe + latches. -->
    <rect class="cfi-band" :fill="'url(#' + uid + '-livery)'" x="11.7" y="14.2" width="8.6" height="2.6" />
    <rect class="cfi-band-shade" x="11.7" y="16.1" width="8.6" height="0.7" />
    <rect class="cfi-latch" x="13.3" y="14.8" width="1.3" height="1.3" rx="0.25" />
    <rect class="cfi-latch" x="15.35" y="14.8" width="1.3" height="1.3" rx="0.25" />
    <rect class="cfi-latch" x="17.4" y="14.8" width="1.3" height="1.3" rx="0.25" />

    <!-- ENGINE BLOCK — dark thruster housing + three nozzles. -->
    <path class="cfi-engine"
      d="M12.6 22.6 L19.4 22.6 L19.0 24.9 L13.0 24.9 Z" />
    <rect class="cfi-nozzle" x="13.4" y="23.3" width="1.5" height="1.1" rx="0.3" />
    <rect class="cfi-nozzle" x="15.25" y="23.3" width="1.5" height="1.1" rx="0.3" />
    <rect class="cfi-nozzle" x="17.1" y="23.3" width="1.5" height="1.1" rx="0.3" />

    <!-- OUTLINE — one crisp dark rim so the vessel separates from any
         backdrop (planet art, dark plates) without a drop-shadow. -->
    <path class="cfi-outline" fill="none"
      d="M16 1.6 C18.6 3.6 20.3 7.2 20.3 11.4 L20.3 21.6
         C20.3 23.4 19.5 24.6 18.2 24.9 L13.8 24.9
         C12.5 24.6 11.7 23.4 11.7 21.6 L11.7 11.4
         C11.7 7.2 13.4 3.6 16 1.6 Z" />
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
