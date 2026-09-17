<template>
  <!--
    A CARD THAT PRINTS A TAG AND A VP ICON — the premium vocabulary's glyph for
    «a Building card with a VP icon» (Turmoil Redux's Architecture Award, render
    item `VP_CARD`). ONE drawing, reused wherever the counted object is named:
    the card face's mechanics (PremiumMechNode), the influence-yield block's
    formula and readings, the Polygon.

    Built from the face's own language, never a new asset: the card cover
    (`card.webp`), the printed tag as the corner medallion the face's tag
    cluster wears, and the gold VP PLATE the face prints in its bottom-right
    corner, engraved «VP» instead of a number (the counted cards share no VP
    value) — so the glyph reads «a card like these, with a VP plate», never a
    bare tag («every building tag you have»). Which VP icons qualify
    (non-negative, variable…) is the rule text's, stated in the fullscreen.

    Sized by `--pvpcard-size` (default: the face's mechanics icon) so a rem-
    authored host and the px-designed face both set it in their own units.
  -->
  <span class="pvpcard" :data-vp-card-tag="tag" aria-hidden="true">
    <span class="pvpcard__cover"></span>
    <span v-if="tagUrl !== undefined" class="pvpcard__tag" :style="{backgroundImage: `url(${tagUrl})`}"></span>
    <span class="pvpcard__vp"><span class="pvpcard__vp-mark">{{ $t('VP') }}</span></span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {tagIconUrl} from './premiumCardIcons';

export default defineComponent({
  name: 'PremiumVpCardGlyph',
  props: {
    /** The tag the counted card prints (absent = any card with a VP icon). */
    tag: {type: String as PropType<Tag | undefined>, default: undefined},
  },
  computed: {
    tagUrl(): string | undefined {
      return this.tag === undefined ? undefined : tagIconUrl(this.tag);
    },
  },
});
</script>
