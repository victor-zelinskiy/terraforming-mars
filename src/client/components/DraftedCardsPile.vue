<template>
  <!--
    Compact sci-fi pile of cards the player has already drafted this
    round but not yet bought. Sits inside DraftFlowOverlay so it stays
    visible across both the card-selection view and the between-rounds
    waiting view — same "stack to the side" feel you'd get with a real
    Terraforming Mars draft going around a physical table.

    Data source is the server-managed `playerView.draftedCards` field
    (populated in src/server/Draft.ts:128 on each successful pick and
    cleared in the round's endRound hook). No client-side mirror is
    kept; the pile reactively follows the prop.

    Visual: cards rendered at ~1/3 scale and stacked vertically with
    overlap so only the top header of each earlier pick is visible.
    Hover lifts the hovered card out of the stack for a quick read.
    Single click opens the full CardZoomModal for a proper inspection
    — that path is owned by Card.vue itself (Steam-like global UX:
    any card opens fullscreen on click). The pile no longer mounts
    its own modal; Card.vue's built-in flow is identical (no actions
    slot needed here — the pile is informational only).

    Teleport to body so the pile escapes DraftFlowOverlay's modal
    card and lives in the top-left corner of the viewport. Without
    that escape it would render inside the centred modal area and
    visually compete with the main title — exactly the issue the
    player flagged.
  -->
  <Teleport to="body">
  <div v-if="cards.length > 0" class="drafted-pile" :data-test="'drafted-pile-' + cards.length">
    <div class="drafted-pile__header">
      <span class="drafted-pile__label" v-i18n>DRAFTED CARDS</span>
      <span class="drafted-pile__count">{{ cards.length }}</span>
    </div>
    <div class="drafted-pile__cards">
      <div v-for="(card, idx) in cards"
           :key="card.name + '-' + idx"
           class="drafted-pile__card-slot"
           :style="{ zIndex: idx + 1 }"
           :title="$t('Click to view')">
        <Card :card="card" />
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/Card.vue';

export default defineComponent({
  name: 'DraftedCardsPile',
  components: {Card},
  props: {
    cards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      required: true,
    },
  },
});
</script>
