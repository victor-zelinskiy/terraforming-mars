<template>
  <div
    class="played-card-item"
    tabindex="0"
    role="button"
    :aria-label="$t(label)"
    @click.capture.stop="$emit('open', card)"
    @keydown.enter.prevent="$emit('open', card)"
    @keydown.space.prevent="$emit('open', card)">
    <Card :card="card" :actionUsed="actionUsed" :cubeColor="cubeColor" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {isCardActivated} from '@/client/utils/CardUtils';
import Card from '@/client/components/card/Card.vue';

/**
 * One played card on the board. Renders the shared `<Card>` (scaled by the
 * `--played-card-zoom` CSS variable set on the group), and on single click
 * opens the modern fullscreen viewer — `@click.capture.stop` suppresses
 * Card.vue's own (preference-gated) click so a single tap always zooms.
 * The overlay owns the shared `CardZoomModal`; we just emit `open`.
 */
export default defineComponent({
  name: 'PlayedCardItem',
  components: {Card},
  props: {
    card: {
      type: Object as PropType<CardModel>,
      required: true,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
  },
  emits: ['open'],
  computed: {
    actionUsed(): boolean {
      return isCardActivated(this.card, this.player);
    },
    cubeColor(): Color {
      return this.player.color;
    },
    label(): string {
      return this.card.name.split(':')[0];
    },
  },
});
</script>
