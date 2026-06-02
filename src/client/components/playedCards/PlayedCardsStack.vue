<template>
  <div class="played-stack">
    <div
      v-for="(card, i) in cards"
      :key="card.name"
      class="played-stack__slot"
      :class="{'played-stack__slot--last': i === cards.length - 1}">
      <PlayedCardItem :card="card" :player="player" @open="$emit('open', $event)" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayedCardItem from '@/client/components/playedCards/PlayedCardItem.vue';

/**
 * One vertical column of the dense ("stacked") layout — the classic
 * tableau fan. Every card except the last is clipped to a fixed PEEK
 * height (`--played-stack-peek`) so its top strip (name / tags / cost)
 * stays readable; the last card shows in full so the column reads as a
 * neat pile. Hovering a peeked card reveals it fully over its neighbours
 * (CSS), and clicking opens fullscreen. Vertical (not horizontal) so the
 * informative top of each card is never hidden.
 */
export default defineComponent({
  name: 'PlayedCardsStack',
  components: {PlayedCardItem},
  props: {
    cards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      required: true,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
  },
  emits: ['open'],
});
</script>
