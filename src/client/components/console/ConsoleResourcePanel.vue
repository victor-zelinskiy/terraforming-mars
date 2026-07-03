<template>
  <aside class="con-res" :aria-label="$t('Resources')">
    <div class="con-res__rows">
      <!-- data-conversion-* anchors (CTS T6): the App-level energy→heat
           transition overlay measures these rects, so the premium
           end-of-generation animation plays in console mode too. -->
      <div v-for="row in rows" :key="row.key" class="con-res__row"
           :class="['con-res__row--' + row.key, conversionRole(row.key) !== '' ? 'con-res__row--conv-' + conversionRole(row.key) : '']"
           :data-conversion-cell="conversionAnchor(row.key)">
        <i class="con-res__icon" :class="'resource_icon resource_icon--' + row.key" aria-hidden="true"
           :data-conversion-icon="conversionAnchor(row.key)"></i>
        <span class="con-res__value">{{ displayValue(row) }}</span>
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
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';

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
    /** The end-of-generation energy→heat transition targets THIS player. */
    conversionActive(): boolean {
      const s = energyConversionState;
      return s.active && s.color !== '' && s.color === this.player.color;
    },
  },
  methods: {
    /** 'source' (energy) / 'target' (heat) while the transition plays. */
    conversionRole(key: string): '' | 'source' | 'target' {
      if (!this.conversionActive) {
        return '';
      }
      return key === 'energy' ? 'source' : key === 'heat' ? 'target' : '';
    },
    /** The overlay's anchor value — set ONLY on the live conversion rows. */
    conversionAnchor(key: string): string | undefined {
      return this.conversionRole(key) !== '' ? key : undefined;
    },
    /**
     * The interpolated stock during the transition (energy counts DOWN,
     * heat counts UP in lock-step with the arrow — desktop PlayerResource
     * parity); the canonical value otherwise.
     */
    displayValue(row: ResourceRow): number {
      const role = this.conversionRole(row.key);
      if (role === 'source') {
        return Math.round(energyConversionState.displayEnergy);
      }
      if (role === 'target') {
        return Math.round(energyConversionState.displayHeat);
      }
      return row.value;
    },
  },
});
</script>
