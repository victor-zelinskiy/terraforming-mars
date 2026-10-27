<template>
  <!--
    «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the app-level stage of «a card's
    printed effect fired» (the director: cardReaction/cardReactionDirector.ts;
    the rise primitive: cardReactionStage.ts). Mounted beside the other flight
    layers and never inside a teleported surface, so a fixed face resolves
    against the viewport.

    It paints only the REACTOR FACES that surface at a seat beside the receiver
    (a real lite face with the card's LIVE model — the one physical object the
    player knows); a reactor standing in the receiving stage rises out of its
    own place there and never comes here. The tokens are the shared Resource
    Transfer Framework's. Its root carries the scene's state for the probes
    (`data-reaction-*`).
  -->
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

<script lang="ts">
import {defineComponent} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';

/** The party charters built so far — one VM per party, stable across renders. */
const partyVms = new Map<string, PremiumCardVM | undefined>();

/** The law faces built so far — one VM per resolution, stable across renders (a fresh object per render would re-mount the face). */
const lawVms = new Map<string, PremiumCardVM | undefined>();
import {cardReactionState, registerCardReactionStage} from '@/client/console/cardReaction/cardReactionStage';
import {abortCardReactions} from '@/client/console/cardReaction/cardReactionDirector';

export default defineComponent({
  name: 'ConsoleCardReactionLayer',
  components: {ConsoleCardFaceLite, PremiumCard},
  data() {
    return {
      cardReactionState,
      faceEls: new Map<string, HTMLElement>(),
      unregister: undefined as (() => void) | undefined,
    };
  },
  methods: {
    partyVmOf(party: string): PremiumCardVM | undefined {
      if (!partyVms.has(party)) {
        partyVms.set(party, partyPremiumVm(party as ReduxParty));
      }
      return partyVms.get(party);
    },
    lawVmOf(id: string): PremiumCardVM | undefined {
      if (!lawVms.has(id)) {
        lawVms.set(id, resolutionPremiumVmById(id));
      }
      return lawVms.get(id);
    },
    setFaceRef(key: string, el: HTMLElement | null): void {
      if (el === null) {
        this.faceEls.delete(key);
      } else {
        this.faceEls.set(key, el);
      }
    },
  },
  mounted() {
    this.unregister = registerCardReactionStage({
      faceEl: (key: string): HTMLElement | null => {
        const el = this.faceEls.get(key);
        return el !== undefined && el.isConnected ? el : null;
      },
      stageRect: () => ({left: 0, top: 0, width: window.innerWidth, height: window.innerHeight}),
    });
  },
  beforeUnmount() {
    this.unregister?.();
    // Shell teardown / game switch mid-scene: every owed hold is paid at once.
    abortCardReactions();
  },
});
</script>
