<template>
  <!--
    Unified minimalist line-icon set for the top/bottom HUD bar buttons.
    One shared <svg> wrapper (24×24, currentColor stroke) so every icon
    inherits the button's text colour + idle/hover/active state for free,
    and a single visual language (1.6px round-joined strokes). Inner paths
    switch on `name`; <template v-if> keeps the wrapper attributes DRY.
  -->
  <svg class="bar-btn-icon" :class="'bar-btn-icon--' + name"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" focusable="false">
    <template v-if="name === 'milestones'">
      <path d="M6 21V4" />
      <path d="M6 5h10.5l-2.3 3.2L16.7 11.4H6" />
    </template>
    <template v-else-if="name === 'standard-projects'">
      <path d="M12 3.2l7.6 4.4v8.8L12 20.8 4.4 16.4V7.6z" />
      <circle cx="12" cy="12" r="3.1" />
    </template>
    <template v-else-if="name === 'awards'">
      <path d="M7.8 4h8.4v3.8a4.2 4.2 0 0 1-8.4 0z" />
      <path d="M7.8 5.2H5.2v1.5a3 3 0 0 0 3 3" />
      <path d="M16.2 5.2h2.6v1.5a3 3 0 0 1-3 3" />
      <path d="M12 12v3.4" />
      <path d="M9.6 20h4.8" />
      <path d="M10.5 17.4h3v2.6h-3z" />
    </template>
    <template v-else-if="name === 'cards'">
      <rect x="8.4" y="5.7" width="9" height="12.8" rx="1.5" transform="rotate(9 12 12)" />
      <rect x="6.6" y="5.3" width="9" height="12.8" rx="1.5" transform="rotate(-9 12 12)" />
    </template>
    <template v-else-if="name === 'actions'">
      <path d="M13 3.4 5.6 13.1H10l-1 7.5 7.4-9.8H12z" />
    </template>
    <template v-else-if="name === 'played'">
      <path d="M12 3.7 4.2 7.8 12 11.9l7.8-4.1z" />
      <path d="M4.2 12 12 16.1l7.8-4.1" />
      <path d="M4.2 16.2 12 20.3l7.8-4.1" />
    </template>
    <template v-else-if="name === 'victory-points'">
      <path d="M12 3.7l2.45 5.5 6 .5-4.55 3.95 1.4 5.85L12 16.85 6.25 19.5l1.4-5.85L3.1 9.7l6-.5z" />
    </template>
    <template v-else-if="name === 'effects'">
      <path d="M11 3.6 12.4 9.6 18.4 11 12.4 12.4 11 18.4 9.6 12.4 3.6 11 9.6 9.6z" />
      <path d="M17.6 14.4 18.3 16.9 20.8 17.6 18.3 18.3 17.6 20.8 16.9 18.3 14.4 17.6 16.9 16.9z" />
    </template>
    <template v-else-if="name === 'colonies'">
      <circle cx="12" cy="12" r="5.3" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.4" transform="rotate(-22 12 12)" />
    </template>
    <template v-else-if="name === 'log'">
      <path d="M4.6 6.6h14.8" />
      <path d="M4.6 12h14.8" />
      <path d="M4.6 17.4h9.4" />
    </template>
  </svg>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/**
 * Stateless icon component for the HUD bar buttons. Pass `name` (one of the
 * nine button identities). Renders an inline SVG using `currentColor`, so
 * the host button's colour transitions drive the icon with no extra wiring.
 */
export default defineComponent({
  name: 'BarButtonIcon',
  props: {
    name: {
      type: String,
      required: true,
    },
  },
});
</script>
