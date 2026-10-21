<template>
  <!--
    A CARD THAT HOLDS RESOURCES — the premium vocabulary's glyph for «a card that
    ALREADY has a resource» (Turmoil Redux TR53 Frontier Labs, render item
    `RESOURCE_CARD`). The scan prints a white card with three orange cubes on its
    face: the object of the rule is the HOLDER, never one cube (a unit) and
    never a tag. Built from CSS only (the face's cover silhouette, the cubes in
    the cube-resource orange), sized by `--pvpcard-size` like the VP card glyph
    so «per card» rows keep one rhythm.

    `wild` — the SAME holder carrying ONE «?» square instead of the cubes: «a
    KIND of resource on your cards» (Tax Breaks RX41 — the scan prints the holder
    with the coloured «?»). The square is the set's existing WILD icon
    (`wild.png`, `b.wild(1)` — Tradesman's own «?»), never a cube with a «?»
    drawn over it: three cubes count the cards that hold, one «?» counts the kinds.
  -->
  <span class="presourcecard" :class="{'presourcecard--wild': wild}" :data-resource-card-wild="wild ? 'true' : undefined" aria-hidden="true">
    <span class="presourcecard__cover">
      <span class="presourcecard__band"></span>
      <span v-if="wild" class="presourcecard__wild"></span>
      <template v-else>
        <span class="presourcecard__cube presourcecard__cube--a"></span>
        <span class="presourcecard__cube presourcecard__cube--b"></span>
        <span class="presourcecard__cube presourcecard__cube--c"></span>
      </template>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PremiumResourceCardGlyph',
  props: {
    /** The holder carries the WILD «?» — a kind of resource — instead of its three cubes. */
    wild: {type: Boolean, default: false},
  },
});
</script>
