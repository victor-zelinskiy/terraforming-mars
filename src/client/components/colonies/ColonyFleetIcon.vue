<template>
  <!--
    Premium trade-fleet TOKEN — a crisp two-tone SVG rocket that replaced the
    legacy raster fleet sprite EVERYWHERE (console colonies surfaces + the
    desktop colonies overlay / tiles / detail / card). One set of paths; the
    player colour rides three inheritable CSS custom props set by the
    `fleet-hue--<color>` class (styles/colony_fleet.less). The PRESENTATION
    (size / placement / backing) is owned by each host context — this is only
    the icon primitive. `free` lights the warm exhaust ("ready to launch");
    a docked/spent fleet omits it. Mirrors the BarButtonIcon philosophy
    (inline SVG, colour via CSS).
  -->
  <svg class="colony-fleet-icon"
       :class="['fleet-hue--' + color, {'colony-fleet-icon--free': free}]"
       viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <!-- Hull + fins (one fill: --fleet-fill). -->
    <path class="cfi-hull"
      d="M12 2.4C14.3 4.3 15.5 7.5 15.5 11.1L15.5 14.2 8.5 14.2 8.5 11.1C8.5 7.5 9.7 4.3 12 2.4Z
         M8.5 12 5.8 16.9 8.5 15.3Z  M15.5 12 18.2 16.9 15.5 15.3Z" />
    <!-- Window + engine band (--fleet-accent). -->
    <rect class="cfi-accent" x="8.5" y="13.9" width="7" height="1.9" rx="0.7" />
    <circle class="cfi-accent" cx="12" cy="8.9" r="1.75" />
    <!-- Exhaust — only in the "free fleet" state. -->
    <path class="cfi-flame" d="M10.4 15.9 12 20.6 13.6 15.9Z" />
  </svg>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';

/**
 * Stateless per-player fleet emblem. Pass `color` (the fleet owner's player
 * colour) and, optionally, `free` (the owner still has an untraded fleet →
 * show the exhaust). Colour is applied via the `fleet-hue--<color>` class,
 * so the component is self-contained anywhere.
 */
export default defineComponent({
  name: 'ColonyFleetIcon',
  props: {
    color: {type: String as PropType<Color>, required: true},
    free: {type: Boolean, default: false},
  },
});
</script>
