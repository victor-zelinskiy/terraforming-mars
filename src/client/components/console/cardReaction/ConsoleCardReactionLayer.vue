<template>
  <div v-if="cardReactionState.phase !== 'idle' || cardReactionState.faces.length > 0"
       class="con-reaction" aria-hidden="true"
       :data-reaction-phase="cardReactionState.phase"
       :data-reaction-groups="cardReactionState.chain?.cards.length"
       :data-reaction-landed="cardReactionState.chain?.landed"
       :data-reaction-seats="cardReactionState.chain?.seats"
       :data-reaction-hurried="cardReactionState.hurried ? '1' : undefined"
       :data-reaction-summarized="cardReactionState.chain === undefined || cardReactionState.chain.summarized.length === 0 ? undefined : cardReactionState.chain.summarized.join('|')"
       :data-reaction-degraded="cardReactionState.degraded">
    <!-- A WARM face (iteration 3) is mounted ahead of its rise — laid out and decoded under the cause's own scene,
         never painted (`--warm`: visibility hidden) — and taken over by the rise with the same key, so the element
         survives the take and the tween starts on a face the browser has already built. A RIVAL's face wears a
         CAPTION naming its seat (the stage is one place for everyone). -->
    <div v-for="face in cardReactionState.faces" :key="face.key"
         class="con-reaction__face"
         :class="{'con-reaction__face--warm': face.warm === true}"
         :data-reaction-card="face.warm === true ? undefined : face.name"
         :data-reaction-warm="face.warm === true ? face.name : undefined"
         :data-reaction-key="face.key"
         :data-reaction-kind="face.kind ?? 'card'"
         :ref="(el) => setFaceRef(face.key, el as HTMLElement | null)">
      <div v-if="face.caption !== undefined" class="con-reaction__caption" :data-reaction-caption="face.caption.color">
        <span class="con-reaction__caption-dot" :class="'player_bg_color_' + face.caption.color" aria-hidden="true"></span>
        <span class="con-reaction__caption-name">{{ face.caption.name }}</span>
      </div>
      <!-- THE CAUSE PLATE (P46): what ANOTHER seat did that woke the card — the colony's planet, its name, the seat
           that built it (MarsBot is one more seat) — read off the server's `cause.colony`; it stands with the face. -->
      <div v-if="face.cause !== undefined && face.warm !== true" class="con-reaction__cause"
           :data-reaction-cause="face.cause.kind"
           :data-cause-colony="face.cause.colony"
           :data-cause-builder="face.cause.builder.color">
        <ConsolePlanetDisc class="con-reaction__cause-planet" :colony="face.cause.colony" />
        <span class="con-reaction__cause-name">{{ $t(face.cause.colony) }}</span>
        <span class="con-reaction__cause-sep" aria-hidden="true">·</span>
        <span class="con-reaction__caption-dot" :class="'player_bg_color_' + face.cause.builder.color" aria-hidden="true"></span>
        <span class="con-reaction__cause-seat">{{ face.cause.builder.name }}</span>
      </div>
      <!-- An ENACTED LAW's face (iteration 4): the resolution's own anatomy from the parliament manifest — the same
           object the government shows and the composer's law hero; its printed effect row carries the icons the
           tokens are born on. -->
      <PremiumCard v-if="face.kind === 'resolution' && lawVmOf(face.name) !== undefined" :vmOverride="lawVmOf(face.name)" :inert="true" aria-hidden="true" />
      <!-- A PARTY's face (iteration 6): the party's CHARTER — the composer's party hero, the inspector's and the
           effects explorer's one object (the owner's Р2) — its printed effect rows carry the icons the tokens leave. -->
      <PremiumCard v-else-if="face.kind === 'party' && partyVmOf(face.name) !== undefined" :vmOverride="partyVmOf(face.name)" :inert="true" aria-hidden="true" />
      <ConsoleCardFaceLite v-else :name="face.name" :card="face.card" />
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the app-level stage of «a card's
 * printed effect fired» (the director: cardReaction/cardReactionDirector.ts;
 * the rise primitive: cardReactionStage.ts). Mounted beside the other flight
 * layers and never inside a teleported surface, so a fixed face resolves
 * against the viewport.
 *
 * It paints only the REACTOR FACES that surface at a seat beside the receiver
 * (a real lite face with the card's LIVE model — the one physical object the
 * player knows); a reactor standing in the receiving stage rises out of its
 * own place there and never comes here. The tokens are the shared Resource
 * Transfer Framework's. Its root carries the scene's state for the probes
 * (`data-reaction-*`).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {onBeforeUnmount, onMounted} from 'vue';
import {$t} from '@/client/directives/i18n';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import ConsolePlanetDisc from '@/client/components/console/ConsolePlanetDisc.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
// The two caches of built faces (the party charters, the law faces) are MODULE state: they live in the sibling module
// (inside `<script setup>` a top-level `Map` would start empty in every instance of the layer).
import {lawVms, partyVms} from '@/client/components/console/cardReaction/consoleCardReactionLayerState';
import {cardReactionState, registerCardReactionStage} from '@/client/console/cardReaction/cardReactionStage';
import {abortCardReactions} from '@/client/console/cardReaction/cardReactionDirector';

defineOptions({name: 'ConsoleCardReactionLayer'});

const faceEls = new Map<string, HTMLElement>();
let unregister: (() => void) | undefined;

function partyVmOf(party: string): PremiumCardVM | undefined {
  if (!partyVms.has(party)) {
    partyVms.set(party, partyPremiumVm(party as ReduxParty));
  }
  return partyVms.get(party);
}
function lawVmOf(id: string): PremiumCardVM | undefined {
  if (!lawVms.has(id)) {
    lawVms.set(id, resolutionPremiumVmById(id));
  }
  return lawVms.get(id);
}
function setFaceRef(key: string, el: HTMLElement | null): void {
  if (el === null) {
    faceEls.delete(key);
  } else {
    faceEls.set(key, el);
  }
}

onMounted(() => {
  unregister = registerCardReactionStage({
    faceEl: (key: string): HTMLElement | null => {
      const el = faceEls.get(key);
      return el !== undefined && el.isConnected ? el : null;
    },
    stageRect: () => ({left: 0, top: 0, width: window.innerWidth, height: window.innerHeight}),
  });
});
onBeforeUnmount(() => {
  unregister?.();
  // Shell teardown / game switch mid-scene: every owed hold is paid at once.
  abortCardReactions();
});
</script>
