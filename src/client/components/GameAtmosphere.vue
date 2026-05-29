<template>
  <!--
    Layered atmosphere backdrop for in-game screens (PlayerHome /
    SpectatorHome). Mounted from App.vue ONLY when the player is on a
    game screen — not on start / create / load / the-end / etc., which
    have their own backdrops.

    Every layer is `position: fixed; inset: 0; pointer-events: none`
    so it covers the viewport behind every UI element (board z=1,
    sidebars z=99, overlays z=110+, modals z=12000+) without
    intercepting any clicks / hover.

    z-index scale runs in the -50..-44 negative range so the whole
    backdrop stays underneath the lowest UI layer (board at z=1). The
    order back-to-front:
       -50 deep space base gradient
       -49 nebula clouds (cyan + violet)
       -48 distant starfield (scaled up, dimmed, slightly blurred)
       -47 near starfield (full opacity)
       -46 cinematic Mars halo (cyan rim + warm Mars reflectance)
       -45 HUD scanlines (barely-perceptible texture)
       -44 edge vignette + corner ticks

    Tuning happens via CSS custom properties on `.game-atmosphere`
    (see `game_atmosphere.less` for the variable list). Performance:
    pure CSS, no per-frame JS, no animations on the hot path.
  -->
  <div class="game-atmosphere" aria-hidden="true">
    <div class="game-atmosphere__base"></div>
    <div class="game-atmosphere__nebula"></div>
    <div class="game-atmosphere__stars-far"></div>
    <div class="game-atmosphere__stars-near"></div>
    <div class="game-atmosphere__halo"></div>
    <div class="game-atmosphere__hud"></div>
    <div class="game-atmosphere__vignette"></div>
    <div class="game-atmosphere__corner game-atmosphere__corner--tl"></div>
    <div class="game-atmosphere__corner game-atmosphere__corner--tr"></div>
    <div class="game-atmosphere__corner game-atmosphere__corner--bl"></div>
    <div class="game-atmosphere__corner game-atmosphere__corner--br"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'GameAtmosphere',
});
</script>
