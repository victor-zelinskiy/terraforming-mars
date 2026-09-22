<template>
  <!--
    THE COUNTED OBJECT of a resolution's counted term (Turmoil Redux), in ONE
    box. Which drawing appears follows what the rule COUNTS, because the
    rules are different:

      · `vp-card` — «for every Building CARD with a VP icon» (Architecture
        Award): the card silhouette with its tag bubble and VP plate;
      · `tag`     — «for each Power TAG you have» (Central Power Grid): the
        printed tag medallion alone. A card here would read as «per card»,
        and the energy RESOURCE cube as a third rule again;
      · `tags`    — «per Venus AND Jovian tag» (Cloud Development): the
        medallions of every listed tag, joined by the face's own «+» — one
        term, several tags, each worth one. A single medallion would hide a
        tag the rule counts; a card would state a fourth rule.

    All sit in the SAME square per medallion (`--pvpcard-size`), so a formula
    row, a reading and the Polygon keep one rhythm whichever object they count.
  -->
  <PremiumVpCardGlyph v-if="glyph.kind === 'vp-card'" :tag="glyph.tag" />
  <span v-else-if="glyph.kind === 'tags'" class="pcglyph pcglyph--tags" :data-count-tags="glyph.tags.join(' ')" aria-hidden="true">
    <template v-for="(tag, i) in glyph.tags" :key="tag">
      <span v-if="i > 0" class="pcglyph__plus">+</span>
      <span class="pcglyph__tag" :data-count-tag="tag" :style="{backgroundImage: `url(${tagUrlOf(tag)})`}"></span>
    </template>
  </span>
  <span v-else class="pcglyph" :data-count-tag="glyph.tag" aria-hidden="true">
    <span class="pcglyph__tag" :style="{backgroundImage: `url(${tagUrlOf(glyph.tag)})`}"></span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Tag} from '@/common/cards/Tag';
import PremiumVpCardGlyph from './PremiumVpCardGlyph.vue';
import {CountedObjectGlyph, tagIconUrl} from './premiumCardIcons';

export default defineComponent({
  name: 'PremiumCountGlyph',
  components: {PremiumVpCardGlyph},
  props: {
    glyph: {type: Object as PropType<CountedObjectGlyph>, required: true},
  },
  methods: {
    tagUrlOf(tag: Tag): string {
      return tagIconUrl(tag);
    },
  },
});
</script>
