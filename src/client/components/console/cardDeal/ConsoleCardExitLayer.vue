<template>
  <!--
    CARD EXIT LAYER — the ONE app-level stage every exit/transfer cinematic
    flies on (mounted once in ConsoleShell, above the console surfaces and
    below the command bar). Take / collect-all / draft hero-pick / hand→
    play-modal transfers spawn FaceLite proxies here, so a flight survives
    its host surface unmounting mid-animation (e.g. taking the last
    revealed card closes the overlay under the still-flying card).

    Pointer-inert, clipped (flights can never create scrollable overflow),
    empty & free when nothing flies. All motion lives in cardExitDirector.
  -->
  <div class="con-exit-layer" aria-hidden="true">
    <div v-for="f in cardExitState.flights" :key="f.id"
         class="con-exit-proxy"
         :class="{'con-exit-proxy--hero': f.hero}"
         :ref="(el) => registerFlightEl(f.id, el as HTMLElement | null)">
      <ConsoleCardFaceLite :name="f.name" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {cardExitState, registerFlightEl} from '@/client/console/cardDeal/cardExitState';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleCardExitLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {cardExitState};
  },
  methods: {
    registerFlightEl,
  },
});
</script>
