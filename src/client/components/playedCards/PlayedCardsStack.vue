<template>
  <div class="played-stack" :class="{'played-stack--peek': peek}">
    <div
      v-for="(card, i) in cards"
      :key="card.name"
      class="played-stack__slot"
      :class="{'played-stack__slot--last': i === cards.length - 1}">
      <PlayedCardItem :card="card" :player="player" :lightweight="true"
                      :pickMode="pickMode" :selectable="selectable"
                      @open="$emit('open', $event)" @pick="$emit('pick', $event)" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayedCardItem from '@/client/components/playedCards/PlayedCardItem.vue';

/**
 * One vertical column of the dense ("columns") layout — the classic tableau
 * fan. Cards read top→bottom (oldest at the top, newest at the bottom). When
 * `peek` is set every card except the last is clipped to a fixed PEEK height
 * (`--played-stack-peek`) so its top strip (name / tags / cost) stays
 * readable; the last (newest) card shows in full so the pile reads as a neat
 * stack. Hovering a peeked card reveals it fully over its neighbours (CSS),
 * and clicking opens fullscreen. Vertical (not horizontal) so the informative
 * top of each card is never hidden. With few cards (`peek` false) every card
 * shows full.
 */
export default defineComponent({
  name: 'PlayedCardsStack',
  components: {PlayedCardItem},
  props: {
    cards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      required: true,
    },
    peek: {
      type: Boolean,
      default: true,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    pickMode: {
      type: Boolean,
      default: false,
    },
    selectable: {
      type: Object as PropType<ReadonlySet<CardName>>,
      default: () => new Set<CardName>(),
    },
  },
  emits: ['open', 'pick'],
});
</script>
