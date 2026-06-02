<template>
  <section class="played-group" :class="['played-group--' + group.accent, {'played-group--identity': group.identity}]">
    <header class="played-group__header">
      <span class="played-group__accent" aria-hidden="true"></span>
      <span class="played-group__label" v-i18n>{{ group.label }}</span>
      <span class="played-group__count">{{ group.cards.length }}</span>
      <span class="played-group__rule" aria-hidden="true"></span>
    </header>

    <!-- Dense: vertical stacks (columns). -->
    <div v-if="mode === 'stacked'" class="played-group__stacks">
      <PlayedCardsStack
        v-for="(column, i) in columnChunks"
        :key="i"
        :cards="column"
        :player="player"
        @open="$emit('open', $event)" />
    </div>

    <!-- Expanded / compact: full cards in a wrapping grid. -->
    <div v-else class="played-group__grid">
      <PlayedCardItem
        v-for="card in group.cards"
        :key="card.name"
        :card="card"
        :player="player"
        @open="$emit('open', $event)" />
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayedGroup} from '@/client/components/playedCards/playedCardGroups';
import PlayedCardItem from '@/client/components/playedCards/PlayedCardItem.vue';
import PlayedCardsStack from '@/client/components/playedCards/PlayedCardsStack.vue';

/**
 * One card group: a compact premium header (accent + label + count) and
 * the cards in the layout mode chosen by the overlay's engine —
 * full-card wrapping grid (expanded / compact) or vertical stacks
 * (stacked). For stacked mode the overlay passes how many columns fit the
 * width; we chunk the cards evenly across them.
 */
export default defineComponent({
  name: 'PlayedCardsGroup',
  components: {PlayedCardItem, PlayedCardsStack},
  props: {
    group: {
      type: Object as PropType<PlayedGroup>,
      required: true,
    },
    mode: {
      type: String as () => 'expanded' | 'compact' | 'stacked',
      required: true,
    },
    columns: {
      type: Number,
      default: 1,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
  },
  emits: ['open'],
  computed: {
    // Stacks read newest-first (top of each column = most recently
    // played), so reverse the canonical oldest→newest group order. The
    // grid keeps the canonical order (oldest first).
    stackCards(): ReadonlyArray<CardModel> {
      return this.group.cards.slice().reverse();
    },
    // Evenly distribute the (newest-first) cards across the available
    // columns, sequentially so each column is a contiguous, balanced pile
    // with the newest cards on top.
    columnChunks(): ReadonlyArray<ReadonlyArray<CardModel>> {
      const cols = Math.max(1, this.columns);
      const per = Math.ceil(this.stackCards.length / cols);
      if (per <= 0) {
        return [];
      }
      const out: Array<ReadonlyArray<CardModel>> = [];
      for (let i = 0; i < this.stackCards.length; i += per) {
        out.push(this.stackCards.slice(i, i + per));
      }
      return out;
    },
  },
});
</script>
