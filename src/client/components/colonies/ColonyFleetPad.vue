<template>
  <!--
    Trade-fleet LAUNCH PAD — the berth a fleet sits on in the console
    colonies header. The minimalist pass: a low dark plate with ONE
    luminous deck line (lit in the owner hue while a fleet berths on it)
    and two quiet edge ticks — a modern landing marker, not an illustrated
    platform. An EMPTY pad (its fleet is out trading / spent) keeps the
    plate + a dim deck line, and its slot never collapses — a launched
    fleet leaves a clean vacant berth with no reflow. Colour rides the
    `fleet-hue--<color>` custom props like the ship.
  -->
  <svg class="colony-fleet-pad"
       :class="['fleet-hue--' + color, {'colony-fleet-pad--occupied': occupied}]"
       viewBox="0 0 34 16" aria-hidden="true" focusable="false">
    <!-- The plate (a shallow perspective slab). -->
    <path class="cfp-base" d="M6 9.6 L28 9.6 L31 15.2 L3 15.2 Z" />
    <!-- The deck line the ship rests on (the one light of the pad). -->
    <rect class="cfp-deck" x="7.5" y="8.6" width="19" height="1.5" rx="0.75" />
    <!-- Quiet edge ticks. -->
    <path class="cfp-tick" d="M5.2 11.6 L4.4 13.2 M28.8 11.6 L29.6 13.2" />
  </svg>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';

/**
 * Stateless per-fleet launch pad. `color` = the owning player's colour (the
 * occupied deck-line hue), `occupied` = a fleet currently berths here.
 */
export default defineComponent({
  name: 'ColonyFleetPad',
  props: {
    color: {type: String as PropType<Color>, required: true},
    occupied: {type: Boolean, default: false},
  },
});
</script>
