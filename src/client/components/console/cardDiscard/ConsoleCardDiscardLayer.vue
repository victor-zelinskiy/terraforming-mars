<template>
  <!--
    CARD DISCARD LAYER — the fixed stage of the ONE "a card physically leaves
    the hand" cinematic (consoleCardDiscard.ts / discardDirector.ts).

    Two objects only: the travelling cards and the pile they land on. Each
    flyer is the shared deal flip chassis — it departs the hand FACE UP (the
    card the player chose, still readable) and turns to its BACK across the
    throw, because a discarded card stops being yours. The pile is the table's
    ONE discard pile (`ConsoleDiscardPile`) — the very pile a search's thrown-
    away cards land on: one place, reached from the other side.

    Pointer-inert and clipped — a flight can never create scrollable overflow.
    All motion lives in the director; this file owns no timings.
  -->
  <div v-if="cardDiscardState.live" class="con-discard" aria-hidden="true">
    <!-- (The pile is not this layer's any more: a card leaving the hand lands on the table's ONE discard pile beside
         the HUD deck — `ConsoleDiscardPile` — the same object the conditional draw's thrown-away cards land on, in
         every host (the colonies' corner seat and the viewport tray are gone — TR52, PL-264). This layer holds the
         pile out from the hand-off beat until the scene withdraws.) -->

    <!-- One flyer per discarded card. -->
    <div v-for="f in cardDiscardState.flights" :key="f.id"
         class="con-deal-proxy con-discard-proxy"
         :style="{zIndex: f.z}"
         :ref="(el) => registerDiscardEl(f.id, el as HTMLElement | null)">
      <div class="con-deal-proxy__flip">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="f.name" />
        </div>
        <div class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {HAND_DISCARD_PILE_LEASE, cardDiscardState, registerDiscardEl, registerDiscardTrayEl} from '@/client/console/cardDiscard/cardDiscardState';
import {discardPileSlotEl, openDiscardPile, releaseDiscardPile} from '@/client/console/discardPile/discardPile';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleCardDiscardLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {cardDiscardState};
  },
  watch: {
    /**
     * The scene's «tray» is the table's pile now: visible ⇔ this scene holds a lease on it, and the landing box the
     * director measures is the pile's own slot (registered once the pile has rendered).
     */
    'cardDiscardState.trayVisible': {
      immediate: true,
      handler(visible: boolean): void {
        if (!visible) {
          registerDiscardTrayEl(null);
          releaseDiscardPile(HAND_DISCARD_PILE_LEASE);
          return;
        }
        openDiscardPile(HAND_DISCARD_PILE_LEASE);
        void this.$nextTick(() => {
          registerDiscardTrayEl(discardPileSlotEl() ?? null);
        });
      },
    },
  },
  beforeUnmount() {
    registerDiscardTrayEl(null);
    releaseDiscardPile(HAND_DISCARD_PILE_LEASE);
  },
  methods: {
    registerDiscardEl,
  },
});
</script>
