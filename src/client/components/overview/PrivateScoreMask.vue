<template>
  <!--
    Premium masked stand-in for the viewer's own VP on a passive surface when
    "Private score" is on. Reads as intentional (eye-off + dots + soft privacy
    glow), never as a bug. Carries NO number anywhere (text / title / aria) so
    the value can't leak; the player opens the VP overlay to see it.
  -->
  <span class="vp-private" :class="{'vp-private--compact': compact}" role="img" :aria-label="$t('Victory points are hidden on screen. Open the overlay to view them.')">
    <svg class="vp-private__eye" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      <path class="vp-private__eye-shape" d="M1 8s4-6 11-6 11 6 11 6-4 6-11 6S1 8 1 8z" fill="none" />
      <circle class="vp-private__eye-pupil" cx="12" cy="8" r="2.4" />
      <line class="vp-private__eye-slash" x1="3" y1="2.5" x2="21" y2="13.5" />
    </svg>
    <span class="vp-private__dots" aria-hidden="true">•••</span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PrivateScoreMask',
  props: {
    // Slightly smaller variant for tight compact indicators.
    compact: {type: Boolean, default: false},
  },
});
</script>
