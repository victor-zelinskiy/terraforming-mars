<template>
  <!--
    A CARD THAT HOLDS RESOURCES — the premium vocabulary's glyph for «a card that
    ALREADY has a resource» (Turmoil Redux TR53 Frontier Labs, render item
    `RESOURCE_CARD`). The scan prints a white card with three orange cubes on its
    face: the object of the rule is the HOLDER, never one cube (a unit) and
    never a tag. Built from CSS only (the face's cover silhouette, the cubes in
    the cube-resource orange), sized by `--pvpcard-size` like the VP card glyph
    so «per card» rows keep one rhythm.
  -->
  <span class="presourcecard" aria-hidden="true">
    <span class="presourcecard__cover">
      <span class="presourcecard__band"></span>
      <span class="presourcecard__cube presourcecard__cube--a"></span>
      <span class="presourcecard__cube presourcecard__cube--b"></span>
      <span class="presourcecard__cube presourcecard__cube--c"></span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PremiumResourceCardGlyph',
});
</script>
