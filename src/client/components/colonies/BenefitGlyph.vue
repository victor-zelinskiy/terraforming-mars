<template>
  <!--
    Compact, type-aware renderer for a single colony benefit slot
    (one position on the build / trade / colony bonus tracks). Replaces
    legacy `BuildBenefit`'s absolute-positioned mess with a clean,
    flex-centered glyph + quantity overlay.

    Covers every ColonyBenefit shape in the codebase. For simple
    resource gains and card-resource gains, renders `<resource icon>` +
    `×N` overlay. For VP / TR / cards / specials, renders a recognisable
    glyph and lets the quantity float as an overlay. Falls back to a
    generic placeholder for unrecognised types (so future colonies don't
    crash the component).
  -->
  <div class="benefit-glyph" :data-bg-type="benefit.type">
    <!-- GAIN_RESOURCES — most common: a resource icon, optionally
         multiple of them stacked on top of each other. We render ONE
         icon + an "×N" overlay; the "stacked" presentation belongs in
         the larger card surface, not in a single slot. -->
    <template v-if="benefit.type === BG.GAIN_RESOURCES">
      <span class="benefit-glyph__icon resource"
            :class="resourceClassFromBenefit"></span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- ADD_RESOURCES_TO_CARD — same shape, but the icon is the card
         resource (microbe / animal / floater / ...). -->
    <template v-else-if="benefit.type === BG.ADD_RESOURCES_TO_CARD">
      <span class="benefit-glyph__icon resource"
            :class="cardResourceClass"></span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- ADD_RESOURCES_TO_VENUS_CARD — Venus colony trade reward. Wild
         resource on a Venus-tagged card. We display the Venus tag with
         a "wild" badge so it reads as "resource on a Venus card". -->
    <template v-else-if="benefit.type === BG.ADD_RESOURCES_TO_VENUS_CARD">
      <span class="benefit-glyph__wild">
        <span class="tag tag-venus benefit-glyph__wild-tag"></span>
      </span>
      <span v-if="quantity > 0" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- GAIN_VP — victory points star. The legacy `.points` class is
         tuned for big-card use; we wrap it and scale to slot size. -->
    <template v-else-if="benefit.type === BG.GAIN_VP">
      <span class="benefit-glyph__vp">★</span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- GAIN_TR — terraforming-rating tile icon. -->
    <template v-else-if="benefit.type === BG.GAIN_TR">
      <span class="benefit-glyph__tr" v-i18n>TR</span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- DRAW_CARDS — generic project-card icon. -->
    <template v-else-if="benefit.type === BG.DRAW_CARDS">
      <span class="benefit-glyph__card"></span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- DRAW_EARTH_CARD — card with the Earth tag overlay. -->
    <template v-else-if="benefit.type === BG.DRAW_EARTH_CARD">
      <span class="benefit-glyph__card benefit-glyph__card--earth"></span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- OPPONENT_DISCARD — red-outlined card. -->
    <template v-else-if="benefit.type === BG.OPPONENT_DISCARD">
      <span class="benefit-glyph__card benefit-glyph__card--discard"></span>
    </template>

    <!--
      DRAW_CARDS_AND_DISCARD_ONE (Pluto colonist bonus) — карта со
      стрелочкой-циклом справа сверху, читается как «возьми и сбрось».
      Без явной ветки fall back на `?`-placeholder, и игрок видел
      пустой квадратик вместо иконки.
    -->
    <template v-else-if="benefit.type === BG.DRAW_CARDS_AND_DISCARD_ONE">
      <span class="benefit-glyph__card-cycle">
        <span class="benefit-glyph__card"></span>
        <span class="benefit-glyph__card-cycle-arrow">↻</span>
      </span>
    </template>

    <!-- COPY_TRADE — Pluto colony bonus. Show a "copy" arrow loop. -->
    <template v-else-if="benefit.type === BG.COPY_TRADE">
      <span class="benefit-glyph__copy">↻</span>
    </template>

    <!-- GAIN_INFLUENCE — Turmoil influence. -->
    <template v-else-if="benefit.type === BG.GAIN_INFLUENCE">
      <span class="benefit-glyph__influence"></span>
    </template>

    <!-- GAIN_PRODUCTION — production box with the resource glyph. -->
    <template v-else-if="benefit.type === BG.GAIN_PRODUCTION">
      <div class="production-box benefit-glyph__production">
        <div class="production" :class="resourceClassFromBenefit"></div>
      </div>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>

    <!-- GAIN_SCIENCE_TAG — science-tag chip. -->
    <template v-else-if="benefit.type === BG.GAIN_SCIENCE_TAG">
      <span class="tag tag-science benefit-glyph__tag"></span>
    </template>

    <!-- INCREASE_VENUS_SCALE — Venus tile, +1 step glyph. -->
    <template v-else-if="benefit.type === BG.INCREASE_VENUS_SCALE">
      <span class="tile venus-tile benefit-glyph__tile"></span>
    </template>

    <!-- PLACE_OCEAN_TILE — ocean tile glyph. -->
    <template v-else-if="benefit.type === BG.PLACE_OCEAN_TILE">
      <span class="tile ocean-tile benefit-glyph__tile"></span>
    </template>

    <!-- PLACE_HAZARD_TILE — Ares hazard tile glyph. -->
    <template v-else-if="benefit.type === BG.PLACE_HAZARD_TILE">
      <span class="tile hazard-tile benefit-glyph__tile"></span>
    </template>

    <!-- Fallback for any future / unrecognised benefit type — a neutral
         placeholder chip with the quantity (if any), so the slot isn't
         empty and the player at least sees that SOMETHING is awarded. -->
    <template v-else>
      <span class="benefit-glyph__placeholder">?</span>
      <span v-if="quantity > 1" class="benefit-glyph__num">×{{ quantity }}</span>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {CardResource} from '@/common/CardResource';

// Minimal shape of a benefit chunk passed into this glyph renderer.
// The parent (ColonyDetailView) constructs these on-the-fly from
// `metadata.build` / `metadata.trade` / `metadata.colony` so we can
// uniformly index into a per-position quantity array.
type BenefitInput = {
  type: ColonyBenefit;
  quantity: ReadonlyArray<number>;
  // Resource is `Resource | OneOrArray<Resource>` upstream; we accept
  // anything that .toString()s to a resource name. Detail view wraps
  // arrays into the first entry before passing here.
  resource?: unknown;
};

export default defineComponent({
  name: 'BenefitGlyph',
  props: {
    benefit: {
      type: Object as () => BenefitInput,
      required: true,
    },
    // Which index of the quantity array to render. For single-quantity
    // shapes (colony owner bonus) the parent passes `idx: 0`.
    idx: {
      type: Number,
      default: 0,
    },
    // The card-resource of the parent colony, used for
    // ADD_RESOURCES_TO_CARD benefits.
    cardResource: {
      type: String as () => CardResource | undefined,
      default: undefined,
    },
  },
  computed: {
    // Exposed for the template's v-if chain.
    BG(): typeof ColonyBenefit {
      return ColonyBenefit;
    },
    quantity(): number {
      const q = this.benefit.quantity[this.idx];
      return typeof q === 'number' ? q : 0;
    },
    // Resource icon class for GAIN_RESOURCES — handles the OneOrArray<>
    // shape by collapsing to the first entry. Single-resource cases
    // (Io→heat, Ceres→steel, Luna→megacredits, etc.) hit this path.
    resourceClassFromBenefit(): string {
      const r = this.benefit.resource;
      if (typeof r === 'string') {
        return r.toLowerCase();
      }
      if (Array.isArray(r) && r.length > 0) {
        return String(r[0]).toLowerCase();
      }
      return 'colony-tile__row-reward-icon--abstract';
    },
    cardResourceClass(): string {
      if (this.cardResource !== undefined) {
        return this.cardResource.toString().toLowerCase();
      }
      return 'colony-tile__row-reward-icon--abstract';
    },
  },
});
</script>
