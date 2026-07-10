<template>
  <!--
    Trade-fleet LAUNCH PAD — a compact premium SVG platform each fleet berths
    on in the console colonies header. A dark docking cradle with a raised
    deck + landing lights; `occupied` lights the owner-hue glow (a fleet sits
    here), an EMPTY pad (its fleet is out trading / spent) stays dim — the
    slot never collapses, so a launched fleet leaves a clean empty pad with
    no reflow. Colour rides the `fleet-hue--<color>` custom props like the
    ship. Presentation (size) is owned by the host; this is the pad primitive.
  -->
  <svg class="colony-fleet-pad"
       :class="['fleet-hue--' + color, {'colony-fleet-pad--occupied': occupied}]"
       viewBox="0 0 34 16" aria-hidden="true" focusable="false">
    <!-- Cradle base (perspective trapezoid). -->
    <path class="cfp-base" d="M5 10.5 L29 10.5 L32 15.4 L2 15.4 Z" />
    <!-- Raised deck bar the ship rests on. -->
    <rect class="cfp-deck" x="6.5" y="8.9" width="21" height="2.4" rx="1.1" />
    <!-- Landing lights along the deck. -->
    <circle class="cfp-light" cx="10" cy="10.1" r="0.95" />
    <circle class="cfp-light" cx="17" cy="10.1" r="0.95" />
    <circle class="cfp-light" cx="24" cy="10.1" r="0.95" />
    <!-- Guide struts. -->
    <path class="cfp-strut" d="M6.5 8.9 L4.4 15.4 M27.5 8.9 L29.6 15.4" />
  </svg>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';

/**
 * Stateless per-fleet launch pad. `color` = the owning player's colour (the
 * occupied-glow hue), `occupied` = a fleet currently berths here (lights on).
 */
export default defineComponent({
  name: 'ColonyFleetPad',
  props: {
    color: {type: String as PropType<Color>, required: true},
    occupied: {type: Boolean, default: false},
  },
});
</script>
