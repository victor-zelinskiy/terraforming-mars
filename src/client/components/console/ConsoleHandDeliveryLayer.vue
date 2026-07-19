<template>
  <!--
    HAND INTAKE LAYER — the fixed stage of every "cards arrive in the hand"
    cinematic (handDeliveryDirector.ts): the starting-cards delivery, the
    reveal-modal takes, the fullscreen take, the research-buy purchase. One
    proxy per travelling card: the deal language's 3D flip chassis — it
    departs its surface FACE UP (the FaceLite twin) and flips to its BACK
    mid-flight as it arcs down into the hand dock (the hand is backs). Each
    proxy carries its DOCK-ORDER z, so mid-flight overlap always matches the
    final pack stacking (a later hand card paints over the one it covers).
    Pointer-inert, clipped; UNDER the footer band (console_card_deal.less)
    so an arriving card dives BEHIND the tray plate/bar texture and
    materializes as its dock back — never painting over the furniture.
  -->
  <div class="con-handdelivery-layer" aria-hidden="true">
    <div v-for="f in handDeliveryState.flights" :key="f.id"
         class="con-deal-proxy"
         :style="{zIndex: f.z}"
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
