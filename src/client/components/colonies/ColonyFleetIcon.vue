<template>
  <!--
    Premium trade-fleet SHIP — a crisp sci-fi shuttle SVG that replaced the
    legacy raster fleet sprite EVERYWHERE (console colonies surfaces + the
    desktop colonies overlay / tiles / detail / card) AND is the flying proxy
    of the console trade-launch cinematic. One set of paths; the player colour
    rides inheritable CSS custom props set by the `fleet-hue--<color>` class
    (styles/colony_fleet.less). The PRESENTATION (size / placement / backing)
    is owned by each host context — this is the ship primitive + its states.

    States (CSS-driven, layered from the same paths — no extra DOM cost when
    idle): `free` lights the warm idle exhaust ("ready to launch"); `mode`
    'hero' is the bigger, higher-contrast presentation the flight proxy uses;
    `state` drives the launch charge / in-flight thrust / docked settle. A
    docked/spent fleet omits the exhaust. Mirrors the BarButtonIcon philosophy
    (inline SVG, colour + state via CSS).
  -->
  <svg class="colony-fleet-icon"
       :class="[
         'fleet-hue--' + color,
         'colony-fleet-icon--' + mode,
         state !== 'idle' ? 'colony-fleet-icon--' + state : '',
         {'colony-fleet-icon--free': free},
       ]"
       viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <!-- Engine thrust plume (in-flight / launch) — behind the hull. -->
    <path class="cfi-thrust" d="M12.4 22.5 16 31.5 19.6 22.5 16 24.4Z" />
    <!-- Swept fins (darker structural tone). -->
    <path class="cfi-fin" d="M10.6 15.5 6.2 22.2 10.6 20.1Z  M21.4 15.5 25.8 22.2 21.4 20.1Z" />
    <!-- Hull — a sleek shuttle nose→body (one fill: --fleet-fill). -->
    <path class="cfi-hull"
      d="M16 2.2C19.1 5.0 20.8 9.4 20.8 14.4L20.8 20.4
         C20.8 21.3 20.1 22 19.2 22L12.8 22C11.9 22 11.2 21.3 11.2 20.4
         L11.2 14.4C11.2 9.4 12.9 5.0 16 2.2Z" />
    <!-- Nose highlight sheen (subtle depth). -->
    <path class="cfi-sheen" d="M16 3.6C17.7 5.9 18.7 9.0 18.9 12.2 17.9 9.2 16.9 6.4 16 4.9Z" />
    <!-- Engine band + cockpit window (--fleet-accent). -->
    <rect class="cfi-accent" x="11.2" y="19.2" width="9.6" height="2.4" rx="0.9" />
    <circle class="cfi-glass" cx="16" cy="11.4" r="2.35" />
    <!-- Idle exhaust — only in the "free fleet" resting state. -->
    <path class="cfi-flame" d="M13.9 21.9 16 27.8 18.1 21.9Z" />
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

export default defineComponent({
  name: 'ColonyFleetIcon',
  props: {
    color: {type: String as PropType<Color>, required: true},
    free: {type: Boolean, default: false},
    mode: {type: String as PropType<'icon' | 'hero'>, default: 'icon'},
    state: {type: String as PropType<FleetShipState>, default: 'idle'},
  },
});
</script>
