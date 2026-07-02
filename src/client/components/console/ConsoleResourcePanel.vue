<template>
  <aside class="con-res" :aria-label="$t('Resources')">
    <div class="con-res__rows">
      <div v-for="row in rows" :key="row.key" class="con-res__row" :class="'con-res__row--' + row.key">
        <i class="con-res__icon" :class="'resource_icon resource_icon--' + row.key" aria-hidden="true"></i>
        <span class="con-res__value">{{ row.value }}</span>
        <span class="con-res__prod" :class="{'con-res__prod--negative': row.production < 0}">
          {{ row.production >= 0 ? '+' + row.production : row.production }}
        </span>
      </div>
    </div>

    <div v-if="tagEntries.length > 0" class="con-res__tags">
      <div class="con-res__tags-title">{{ $t('Tags') }}</div>
      <div class="con-res__tags-grid">
        <tag-count v-for="t in tagEntries"
                   :key="t.tag"
                   :tag="t.tag"
                   :count="t.count"
                   size="big"
                   type="secondary" />
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
/**
 * Console resource + tag panel (feedback iteration: the player's key
 * numbers must NEVER be hidden). Left rail, visible in every section:
 * the six resources (stock BIG + a production chip — the classic TM read)
 * and the premium tag cluster (reuses the shared TagCount holders).
 * Read-only; data straight from the PublicPlayerModel.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import TagCount from '@/client/components/TagCount.vue';

type ResourceRow = {key: string, value: number, production: number};

/** Canonical printed-tag order (mirrors the desktop tag cluster). */
const TAG_ORDER: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON,
  Tag.MARS, Tag.WILD, Tag.EVENT, Tag.CLONE,
];

export default defineComponent({
  name: 'ConsoleResourcePanel',
  components: {'tag-count': TagCount},
  props: {
    player: {type: Object as PropType<PublicPlayerModel>, required: true},
  },
  computed: {
    rows(): Array<ResourceRow> {
      const p = this.player;
      return [
        {key: 'megacredits', value: p.megacredits, production: p.megacreditProduction},
        {key: 'steel', value: p.steel, production: p.steelProduction},
        {key: 'titanium', value: p.titanium, production: p.titaniumProduction},
        {key: 'plants', value: p.plants, production: p.plantProduction},
        {key: 'energy', value: p.energy, production: p.energyProduction},
        {key: 'heat', value: p.heat, production: p.heatProduction},
      ];
    },
    tagEntries(): Array<{tag: Tag, count: number}> {
      const counts = this.player.tags;
      return TAG_ORDER
        .map((tag) => ({tag, count: counts[tag] ?? 0}))
        .filter((e) => e.count > 0);
    },
  },
});
</script>
