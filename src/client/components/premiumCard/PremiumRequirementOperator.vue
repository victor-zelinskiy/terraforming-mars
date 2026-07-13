<template>
  <span class="pcard-op" :class="'pcard-op--' + comparator" aria-hidden="true">
    <svg class="pcard-op__svg" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" focusable="false">
      <!-- engraved depth (dark shadow, offset down-right) -->
      <g class="pcard-op__shadow" transform="translate(0.4 0.95)">
        <path :d="chevron"></path>
        <path :d="bar"></path>
      </g>
      <!-- raised metal glyph (warm satin metal; crimson-cream under «{all}») -->
      <g class="pcard-op__metal">
        <path :d="chevron"></path>
        <path :d="bar"></path>
      </g>
      <!-- top-left highlight — the emboss -->
      <g class="pcard-op__hi" transform="translate(-0.25 -0.5)">
        <path :d="chevron"></path>
        <path :d="bar"></path>
      </g>
    </svg>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/*
 * PREMIUM REQUIREMENT OPERATOR — the ≥ / ≤ threshold glyph, rendered as a
 * custom SVG rather than a font character. The card font (Prototype) has no
 * dedicated ≥/≤ glyph, so a text operator falls back to a thin generic serif
 * form that reads weakly at gameplay/console scale. This draws a deliberate,
 * geometric symbol in THREE stroke layers (dark engrave → themed metal →
 * top highlight) so it reads as an embossed control-plate symbol — the
 * CONNECTOR of the requirement formula, tuned to the digit's weight (a warm
 * satin metal, never a dominating gold emblem). The metal colour rides CSS vars
 * (`--pcard-op-metal` / `--pcard-op-hi`) so the «{all}» crimson-copper variant
 * is a one-line theme swap on the parent cassette.
 *
 * `comparator` is the SAME 'min' | 'max' the view-model already carries
 * (min → ≥, max → ≤) — DISPLAY-ONLY, never touches playability.
 */
const VIEW_BOX = '0 0 24 28';

const GLYPH: Readonly<Record<'min' | 'max', {chevron: string, bar: string}>> = {
  // ≥ — chevron opens LEFT (apex on the right), equal-bar beneath.
  min: {chevron: 'M5 4 L19 13.5 L5 23', bar: 'M5 26.6 L19.5 26.6'},
  // ≤ — mirrored: chevron opens RIGHT (apex on the left).
  max: {chevron: 'M19 4 L5 13.5 L19 23', bar: 'M4.5 26.6 L19 26.6'},
};

export default defineComponent({
  name: 'PremiumRequirementOperator',
  props: {
    comparator: {
      type: String as () => 'min' | 'max',
      required: true,
    },
  },
  computed: {
    viewBox(): string {
      return VIEW_BOX;
    },
    chevron(): string {
      return GLYPH[this.comparator].chevron;
    },
    bar(): string {
      return GLYPH[this.comparator].bar;
    },
  },
});
</script>
