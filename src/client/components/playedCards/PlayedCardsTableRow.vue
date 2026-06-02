<template>
  <div
    class="played-table__row"
    :class="'played-table__row--' + accent"
    tabindex="0"
    role="button"
    :aria-label="displayName"
    @click="$emit('open', card)"
    @keydown.enter.prevent="$emit('open', card)"
    @keydown.space.prevent="$emit('open', card)">
    <div class="played-table__cell played-table__cell--order">{{ order }}</div>

    <div class="played-table__cell played-table__cell--type">
      <span class="played-table__type-chip" :class="'played-table__type-chip--' + accent">
        <span class="played-table__type-dot" aria-hidden="true"></span>
        <span class="played-table__type-label" v-i18n>{{ typeLabel }}</span>
      </span>
    </div>

    <!-- Name is the primary element; hovering it asks the table to show the
         card preview (table owns the single shared popover). -->
    <div class="played-table__cell played-table__cell--name"
         @mouseenter="onNameEnter"
         @mouseleave="$emit('namehover', null)">
      <span class="played-table__name" v-i18n>{{ displayName }}</span>
    </div>

    <div class="played-table__cell played-table__cell--tags">
      <span v-for="(tag, i) in tags" :key="i" class="played-table__tag" :class="'tag-' + tag" aria-hidden="true"></span>
      <span v-if="tags.length === 0" class="played-table__dash">—</span>
    </div>

    <div class="played-table__cell played-table__cell--cost">
      <template v-if="cost !== undefined">
        {{ cost }}<i class="resource_icon resource_icon--megacredits played-table__mc" aria-hidden="true"></i>
      </template>
      <span v-else class="played-table__dash">—</span>
    </div>

    <div class="played-table__cell played-table__cell--vp">
      <span v-if="vpDisplay !== undefined" class="played-table__vp">{{ vpDisplay }}</span>
      <span v-else class="played-table__dash">—</span>
    </div>

    <div class="played-table__cell played-table__cell--res">
      <template v-if="resourceCount > 0 && resourceType !== undefined">
        <span class="played-table__res-count">{{ resourceCount }}</span>
        <span class="card-resource" :class="'card-resource-' + resourceType" aria-hidden="true"></span>
      </template>
      <span v-else class="played-table__dash">—</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {Tag} from '@/common/cards/Tag';
import {getCard} from '@/client/cards/ClientCardManifest';
import {PlayedGroupKey} from '@/client/components/playedCards/playedCardGroups';

/**
 * One row of the table view. Presentational — derives its analytic cells
 * (tags / cost / VP / resources) from the client card, and forwards
 * interaction up: click → `open` (overlay's shared fullscreen), name
 * hover → `namehover` (the table owns the single shared preview popover,
 * so we don't mount 100 popovers).
 */
export default defineComponent({
  name: 'PlayedCardsTableRow',
  props: {
    card: {
      type: Object as PropType<CardModel>,
      required: true,
    },
    accent: {
      type: String as () => PlayedGroupKey,
      required: true,
    },
    typeLabel: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  emits: ['open', 'namehover'],
  computed: {
    displayName(): string {
      return this.card.name.split(':')[0];
    },
    tags(): ReadonlyArray<Tag> {
      return getCard(this.card.name)?.tags ?? [];
    },
    cost(): number | undefined {
      return getCard(this.card.name)?.cost;
    },
    vpDisplay(): string | number | undefined {
      const vp = getCard(this.card.name)?.victoryPoints;
      if (typeof vp === 'number') {
        return vp;
      }
      // 'special' / countable (variable) VP → a compact indicator rather
      // than a misleading number.
      return vp !== undefined ? '★' : undefined;
    },
    resourceType(): CardResource | undefined {
      return getCard(this.card.name)?.resourceType;
    },
    resourceCount(): number {
      return this.card.resources ?? 0;
    },
  },
  methods: {
    onNameEnter(e: MouseEvent): void {
      this.$emit('namehover', {
        name: this.card.name,
        rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
      });
    },
  },
});
</script>
