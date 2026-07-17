<template>
  <!--
    HAND DELIVERY LAYER — the fixed stage of the starting-cards delivery
    (handDeliveryDirector.ts). One proxy per bought card: the deal language's
    3D flip chassis — it departs the payment grid FACE UP (the card the player
    just bought, the FaceLite twin) and flips to its BACK mid-flight as it
    arcs down into the hand dock (the hand is backs). Pointer-inert, clipped;
    ABOVE the footer so the flights land INTO the dock plate.
  -->
  <div class="con-handdelivery-layer" aria-hidden="true">
    <div v-for="f in handDeliveryState.flights" :key="f.id"
         class="con-deal-proxy"
         :ref="(el) => registerDeliveryEl(f.id, el as HTMLElement | null)">
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
import {handDeliveryState, registerDeliveryEl} from '@/client/console/handDock/handDeliveryState';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleHandDeliveryLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {handDeliveryState};
  },
  methods: {
    registerDeliveryEl,
  },
});
</script>
