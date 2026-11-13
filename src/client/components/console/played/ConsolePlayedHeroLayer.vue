<template>
  <div v-if="playedHeroState.active || playedReturnState.active" class="con-played-hero" aria-hidden="true"
       :data-hero-phase="playedHeroState.phase"
       :data-hero-wait="playedHeroState.awaitingTarget ? 'target' : undefined"
       :data-hero-discard="playedHeroState.discard !== '' ? playedHeroState.discard : undefined"
       :data-hero-payback="playedHeroState.payback !== '' ? playedHeroState.payback : undefined">
    <div v-if="playedHeroState.proxy !== undefined" ref="proxy" class="con-played-hero__proxy">
      <div ref="shade" class="con-played-hero__shade"></div>
      <div ref="flip" class="con-deal-proxy__flip">
        <!-- THE FACE IS THE HOST'S PICTURE: the source's at the lift, the
             destination's from the apex on (`proxy.face` — tier + live model),
             so the two copies at the handoff are the same picture. -->
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="playedHeroState.proxy.card" :card="playedHeroState.proxy.face.card" :lightweight="playedHeroState.proxy.face.lightweight" />
        </div>
        <!-- The event back — revealed by the mid-arc 3D flip (90° swap rides
             the shared backface chassis; non-events never mount it). -->
        <div v-if="playedHeroState.proxy.isEvent" class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
      <div ref="sweep" class="con-played-hero__sweep"></div>
    </div>

    <!-- THE RETURN BEAT (playedCardReturn): the cards this play sent back to
         hand, rising out of the pile they were lying in and turning face to
         the camera before the standard intake carries them to the dock. Same
         flip chassis / lite face pipeline as every console flight — one
         physical object per card, never a lookalike. -->
    <div v-for="f in playedReturnState.flights"
         :key="playedReturnState.nonce + '|' + f.id"
         class="con-played-hero__ret"
         :ref="(el) => setReturnProxy(f.id, el)">
      <div class="con-deal-proxy__flip" :ref="(el) => setReturnFlip(f.id, el)">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="f.name" />
        </div>
        <div v-if="f.faceDown" class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * PLAYED-CARD HERO STAGE — the fixed, app-level proxy layer of the "card
 * lands on my tableau" scene (consolePlayedHero / playedHeroDirector).
 * Mounted for the WHOLE transaction (arm → done), so:
 *  - the flight survives the composer unmounting beneath it;
 *  - the leak detector counts `.con-played-hero` as the serving surface
 *    while the scene briefly holds a fresh follow-up prompt.
 * The proxy is the SAME lite face pipeline every console flight uses
 * (ConsoleCardFaceLite + the shared flip chassis classes), spawned from the
 * real card's measured rect — one physical object, never a lookalike.
 * `data-hero-phase` / `data-hero-wait` are the scene's witnesses: written in
 * the director's own task (a Vue patch, no frame needed), so a probe tells
 * «the lifted card waits for its target» (`data-hero-wait="target"`) from
 * «no frame was painted» during the lift or the arc (PL-625).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {onBeforeUnmount, onMounted, ref, useTemplateRef} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {playedHeroState, registerPlayedHeroStage} from '@/client/console/played/consolePlayedHero';
import {playedReturnState, registerReturnFlightEls} from '@/client/console/played/playedCardReturn';
import {HeroStageEls} from '@/client/console/played/playedHeroDirector';

defineOptions({name: 'ConsolePlayedHeroLayer'});

const proxy = useTemplateRef<HTMLElement>('proxy');
const flip = useTemplateRef<HTMLElement>('flip');
const shade = useTemplateRef<HTMLElement>('shade');
const sweep = useTemplateRef<HTMLElement>('sweep');
/** Half-registered chassis per return flight (both refs land in one
 *  patch; the director only ever reads a complete pair). */
const returnEls = ref(new Map<number, {proxy: HTMLElement | null, flip: HTMLElement | null}>());
let unregister: (() => void) | undefined;

function setReturnProxy(id: number, el: unknown): void {
  trackReturnEl(id, 'proxy', el);
}
function setReturnFlip(id: number, el: unknown): void {
  trackReturnEl(id, 'flip', el);
}
function trackReturnEl(id: number, key: 'proxy' | 'flip', el: unknown): void {
  const node = el instanceof HTMLElement ? el : null;
  const cur = returnEls.value.get(id) ?? {proxy: null, flip: null};
  cur[key] = node;
  if (cur.proxy === null && cur.flip === null) {
    returnEls.value.delete(id);
  } else {
    returnEls.value.set(id, cur);
  }
  registerReturnFlightEls(id, cur.proxy, cur.flip);
}

onMounted(() => {
  // Live element getter — the orchestrator reads it after its own
  // nextTick, so the refs are always current for the active proxy.
  unregister = registerPlayedHeroStage({
    els: (): HeroStageEls | undefined => {
      const proxyNow = proxy.value ?? undefined;
      // The ref is `null` while the `v-if` keeps the proxy out (read as `undefined` above).
      if (!proxyNow || !proxyNow.isConnected) {
        return undefined;
      }
      return {
        proxy: proxyNow,
        flip: flip.value ?? undefined,
        shade: shade.value ?? undefined,
        sweep: sweep.value ?? undefined,
      };
    },
  });
});
onBeforeUnmount(() => {
  unregister?.();
});
</script>
