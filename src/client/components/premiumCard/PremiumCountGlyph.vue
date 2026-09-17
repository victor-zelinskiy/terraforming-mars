<template>
  <!--
    THE COUNTED OBJECT of a resolution's counted term (Turmoil Redux), in ONE
    box. Which drawing appears follows what the rule COUNTS, because the two
    rules are different:

      · `vp-card` — «for every Building CARD with a VP icon» (Architecture
        Award): the card silhouette with its tag bubble and VP plate;
      · `tag`     — «for each Power TAG you have» (Central Power Grid): the
        printed tag medallion alone. A card here would read as «per card»,
        and the energy RESOURCE cube as a third rule again.

    Both sit in the SAME square (`--pvpcard-size`), so a formula row, a
    reading and the Polygon keep one rhythm whichever object they count.
  -->
  <PremiumVpCardGlyph v-if="glyph.kind === 'vp-card'" :tag="glyph.tag" />
  <span v-else class="pcglyph" :data-count-tag="glyph.tag" aria-hidden="true">
    <span class="pcglyph__tag" :style="{backgroundImage: `url(${tagUrl})`}"></span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import PremiumVpCardGlyph from './PremiumVpCardGlyph.vue';
import {CountedObjectGlyph, tagIconUrl} from './premiumCardIcons';

export default defineComponent({
  name: 'PremiumCountGlyph',
  components: {PremiumVpCardGlyph},
  props: {
    glyph: {type: Object as PropType<CountedObjectGlyph>, required: true},
  },
  computed: {
    tagUrl(): string {
      return tagIconUrl(this.glyph.tag);
    },
  },
});
</script>
