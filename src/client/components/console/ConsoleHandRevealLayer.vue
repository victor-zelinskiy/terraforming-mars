<template>
  <!--
    HAND REVEAL LAYER — the fixed stage of the dock ↔ hand-overlay physical
    transition (handRevealDirector.ts). One proxy per hand card: the deal
    language's 3D flip chassis (back = the canonical sleeve, face = the
    FaceLite twin). Off-window scroll-tail proxies carry NO face (cheap
    back-only flyers). Pointer-inert, clipped; sits UNDER the footer band
    (console_card_deal.less) so a card descending into the dock is occluded
    by the REAL tray/bar texture per pixel — it slots in BEHIND the
    furniture, never painting over it.
  -->
  <div class="con-handreveal-layer" aria-hidden="true">
    <div v-for="f in handRevealState.flights" :key="f.id"
         class="con-deal-proxy"
         :ref="(el) => registerRevealEl(f.id, el as HTMLElement | null)">
      <div class="con-deal-proxy__flip">
        <div v-if="f.face" class="con-deal-proxy__face">
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
import {handRevealState, registerRevealEl} from '@/client/console/handDock/handRevealState';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleHandRevealLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {handRevealState};
  },
  methods: {
    registerRevealEl,
  },
});
</script>
