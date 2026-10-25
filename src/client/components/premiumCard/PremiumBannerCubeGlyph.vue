<template>
  <!--
    «YOUR CUBE ON A PARTY'S BANNER» — the premium vocabulary's glyph for the
    printed Septem Tribus:redux mark (render item `BANNER_CUBE`): the owner's
    purple wild-party pill («?» — any party, `assets/misc/wild-party.png`,
    256×184, alpha kept) with the player's WHITE cube seated in its lower-left
    corner, exactly as the scan prints it. One drawing wherever the concept is
    named on a card face.

    Material, never light: the cube is a white block with an inset hairline
    edge (invariant 15 — no halo, no glow). Sized by `--pbcube-size` — the
    pill's HEIGHT (default: a step above the face's mechanics icon, as the
    scan's pills lead their rows); every part is a share of that one size.
  -->
  <span class="pbcube" aria-hidden="true">
    <span class="pbcube__pill"></span>
    <span class="pbcube__cube"></span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PremiumBannerCubeGlyph',
});
</script>
