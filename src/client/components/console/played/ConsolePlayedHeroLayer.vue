<template>
  <!--
    PLAYED-CARD HERO STAGE — the fixed, app-level proxy layer of the "card
    lands on my tableau" scene (consolePlayedHero / playedHeroDirector).
    Mounted for the WHOLE transaction (arm → done), so:
     - the flight survives the composer unmounting beneath it;
     - the leak detector counts `.con-played-hero` as the serving surface
       while the scene briefly holds a fresh follow-up prompt.
    The proxy is the SAME lite face pipeline every console flight uses
    (ConsoleCardFaceLite + the shared flip chassis classes), spawned from the
    real card's measured rect — one physical object, never a lookalike.
  -->
  <div v-if="playedHeroState.active" class="con-played-hero" aria-hidden="true">
    <div v-if="playedHeroState.proxy !== undefined" ref="proxy" class="con-played-hero__proxy">
      <div ref="shade" class="con-played-hero__shade"></div>
      <div ref="flip" class="con-deal-proxy__flip">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="playedHeroState.proxy.card" />
        </div>
        <!-- The event back — revealed by the mid-arc 3D flip (90° swap rides
             the shared backface chassis; non-events never mount it). -->
        <div v-if="playedHeroState.proxy.isEvent" class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
      <div ref="sweep" class="con-played-hero__sweep"></div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {playedHeroState, registerPlayedHeroStage} from '@/client/console/played/consolePlayedHero';
import {HeroStageEls} from '@/client/console/played/playedHeroDirector';

export default defineComponent({
  name: 'ConsolePlayedHeroLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      playedHeroState,
      unregister: undefined as (() => void) | undefined,
    };
  },
  mounted() {
    // Live element getter — the orchestrator reads it after its own
    // nextTick, so the refs are always current for the active proxy.
    this.unregister = registerPlayedHeroStage({
      els: (): HeroStageEls | undefined => {
        const proxy = this.$refs.proxy as HTMLElement | undefined;
        if (proxy === undefined || !proxy.isConnected) {
          return undefined;
        }
        return {
          proxy,
          flip: this.$refs.flip as HTMLElement | undefined,
          shade: this.$refs.shade as HTMLElement | undefined,
          sweep: this.$refs.sweep as HTMLElement | undefined,
        };
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
