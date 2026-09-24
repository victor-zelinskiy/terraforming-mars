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
        tag the rule counts; a card would state a fourth rule;
      · `tile`    — «per SPACE CITY you have» (Colonization Funding): the city
        pictogram with the face's own footnote spark (`.pcard-sym--asterix`,
        the physical card's «*» — a city on a reserved area OFF Mars). The
        same asset the mechanics print for `b.city()` and the same spark, so
        the reading cannot draw a different city than the card; a bare city
        would read «every city you have», a card a fifth rule;
      · `metric`  — «per complete SET of 5 TR over 15» (Generous Funding): the
        rating badge the mechanics print for `b.tr()`, alone. The threshold
        and the step are not drawn here (the face prints «5» inside the badge
        and «over 15» under it; a reading prints the breakdown in words) — a
        card would state a sixth rule, a number inside the badge would collide
        with the value standing next to the glyph;
      · `production` — «per STEP of steel, titanium and energy PRODUCTION»
        (Industrialist Budget): the resources' own icons joined by «+» inside
        the brown production frame the mechanics print for `b.production(…)`.
        Bare cubes would read as the SUPPLY (which does not count); a card as
        a seventh rule.

    All sit in the SAME square per medallion (`--pvpcard-size`), so a formula
    row, a reading and the Polygon keep one rhythm whichever object they count.
  -->
  <PremiumVpCardGlyph v-if="glyph.kind === 'vp-card'" :tag="glyph.tag" />
  <span v-else-if="glyph.kind === 'metric'" class="pcglyph pcglyph--metric" :data-count-metric="glyph.metric" aria-hidden="true">
    <span class="pcglyph__metric" :style="{backgroundImage: `url(${metricUrlOf(glyph.metric)})`}"></span>
  </span>
  <span v-else-if="glyph.kind === 'production'" class="pcglyph pcglyph--production" :data-count-production="glyph.resources.join(' ')" aria-hidden="true">
    <template v-for="(resource, i) in glyph.resources" :key="resource">
      <span v-if="i > 0" class="pcglyph__plus">+</span>
      <span class="pcglyph__res" :data-count-resource="resource" :style="{backgroundImage: `url(${resourceUrlOf(resource)})`}"></span>
    </template>
  </span>
  <span v-else-if="glyph.kind === 'tags'" class="pcglyph pcglyph--tags" :data-count-tags="glyph.tags.join(' ')" aria-hidden="true">
    <template v-for="(tag, i) in glyph.tags" :key="tag">
      <span v-if="i > 0" class="pcglyph__plus">+</span>
      <span class="pcglyph__tag" :data-count-tag="tag" :style="{backgroundImage: `url(${tagUrlOf(tag)})`}"></span>
    </template>
  </span>
  <span v-else-if="glyph.kind === 'tile'" class="pcglyph pcglyph--tile" :data-count-tile="glyph.tile" aria-hidden="true">
    <span class="pcglyph__tile" :style="{backgroundImage: `url(${tileUrlOf(glyph.tile)})`}"></span>
    <span class="pcard-sym pcard-sym--asterix pcglyph__spark">*</span>
  </span>
  <span v-else class="pcglyph" :data-count-tag="glyph.tag" aria-hidden="true">
    <span class="pcglyph__tag" :style="{backgroundImage: `url(${tagUrlOf(glyph.tag)})`}"></span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {BoardCountedTile, ResolutionCountMetric} from '@/common/parliament/resolutionCounts';
import PremiumVpCardGlyph from './PremiumVpCardGlyph.vue';
import {CountedObjectGlyph, countedMetricIconUrl, countedTileIconUrl, standardResourceIconUrl, tagIconUrl} from './premiumCardIcons';

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
    tileUrlOf(tile: BoardCountedTile): string {
      return countedTileIconUrl(tile);
    },
    metricUrlOf(metric: ResolutionCountMetric): string {
      return countedMetricIconUrl(metric);
    },
    /** The SAME sprite the face prints inside its production box — the reading and the card draw one resource. */
    resourceUrlOf(resource: Resource): string {
      return standardResourceIconUrl(resource);
    },
  },
});
</script>
