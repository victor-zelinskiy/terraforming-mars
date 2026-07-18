<template>
  <!--
    HAND DELIVERY LAYER — the fixed stage of the starting-cards delivery
    (handDeliveryDirector.ts). One card-back proxy per bought card flies
    from the project deck (top HUD) down into the hand dock bay. Backs the
    whole way (the dock is backs; the faces were seen during the buy),
    reusing the deal card-back sleeve. Pointer-inert, clipped; ABOVE the
    footer so the flights land INTO the dock plate.
  -->
  <div class="con-handdelivery-layer" aria-hidden="true">
    <div v-for="f in handDeliveryState.flights" :key="f.id"
         class="con-deal-proxy"
         :ref="(el) => registerDeliveryEl(f.id, el as HTMLElement | null)">
      <div class="con-card-back con-card-back--flyer"></div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {handDeliveryState, registerDeliveryEl} from '@/client/console/handDock/handDeliveryState';

export default defineComponent({
  name: 'ConsoleHandDeliveryLayer',
  data() {
    return {handDeliveryState};
  },
  methods: {
    registerDeliveryEl,
  },
});
</script>
