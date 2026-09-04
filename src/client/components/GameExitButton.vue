<template>
  <!--
    Persistent "exit to main menu" affordance. Mounted at App level (a sibling
    of <player-home> / the initial-draft overlay) so it is available in EVERY
    in-game state — including the initial draft, where the right sidebar is
    covered / not yet present. It floats in the bottom-right corner OVER the
    right bar (never wider than it) and sits above the draft overlay's z-index,
    so it is always reachable. Hidden once the game is over (the endgame screen
    owns the exit then).
  -->
  <button
    type="button"
    class="game-exit-btn"
    :aria-label="$t('To main menu')"
    @click="goHome">
    <span class="game-exit-btn__glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11 L12 4 L20 11 M6 9.5 V19 H18 V9.5 M10 19 V14 H14 V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </span>
    <span class="game-exit-btn__label" v-i18n>Menu</span>
  </button>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {exitGameToMenu} from '@/client/console/loadingScreenState';

export default defineComponent({
  name: 'GameExitButton',
  methods: {
    goHome(): void {
      // Leave the game through the ONE exit funnel: the game is saved
      // server-side and re-enterable, the shell registered the honest
      // destination (campaign mission → its campaign map, ordinary game →
      // main menu), and the transition curtain covers the deliberate reload
      // — a raw location.assign here used to be the one door that flashed
      // the teardown.
      exitGameToMenu();
    },
  },
});
</script>
