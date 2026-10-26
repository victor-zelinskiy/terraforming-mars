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
       :data-reaction-summarized="cardReactionState.chain === undefined || cardReactionState.chain.summarized.length === 0 ? undefined : cardReactionState.chain.summarized.join('|')"
       :data-reaction-degraded="cardReactionState.degraded">
    <div v-for="face in cardReactionState.faces" :key="face.key"
         class="con-reaction__face"
         :data-reaction-card="face.name"
         :data-reaction-key="face.key"
         :ref="(el) => setFaceRef(face.key, el as HTMLElement | null)">
      <ConsoleCardFaceLite :name="face.name" :card="face.card" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {cardReactionState, registerCardReactionStage} from '@/client/console/cardReaction/cardReactionStage';
import {abortCardReactions} from '@/client/console/cardReaction/cardReactionDirector';

export default defineComponent({
  name: 'ConsoleCardReactionLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      cardReactionState,
      faceEls: new Map<string, HTMLElement>(),
      unregister: undefined as (() => void) | undefined,
    };
  },
  methods: {
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
