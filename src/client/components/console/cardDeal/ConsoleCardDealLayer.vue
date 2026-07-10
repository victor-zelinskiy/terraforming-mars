<template>
  <!--
    CARD DEAL LAYER — the fixed full-viewport stage the deal cinematic
    plays on: the dealer's deck stack (card backs, bottom-centre) + one
    lite proxy flyer per card. Pointer-inert, clipped (overflow: clip), and
    alive ONLY while a deal runs (v-if in the host) — will-change on the
    flyers is scoped to the animation's lifetime by construction.

    All positioning/motion is owned by cardDealDirector (GSAP, transform +
    opacity only). This component just provides the DOM and exposes the
    element handles the director animates.
  -->
  <div class="con-deal-layer" ref="layer" aria-hidden="true">
    <div class="con-deal-deck" ref="deck">
      <div class="con-card-back con-deal-deck__c con-deal-deck__c--3"></div>
      <div class="con-card-back con-deal-deck__c con-deal-deck__c--2"></div>
      <div class="con-card-back con-deal-deck__c con-deal-deck__c--1"></div>
    </div>
    <div v-for="(name, i) in cards" :key="nonce + '|' + name + '#' + i"
         class="con-deal-proxy"
         :ref="(el) => setProxyRef(el, i)">
      <div class="con-deal-proxy__flip">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="name" />
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
import {CardName} from '@/common/cards/CardName';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleCardDealLayer',
  components: {ConsoleCardFaceLite},
  props: {
    cards: {
      type: Array as () => Array<CardName>,
      required: true,
    },
    /** Keys the proxy set per prepared deal (sequence.state.nonce). */
    nonce: {
      type: Number,
      required: true,
    },
  },
  data() {
    return {
      proxyRefs: [] as Array<HTMLElement | null>,
    };
  },
  watch: {
    nonce() {
      this.proxyRefs = [];
    },
  },
  methods: {
    // v-for string refs don't guarantee order — function refs keep the
    // proxy index aligned with the card index (the director relies on it).
    setProxyRef(el: unknown, i: number): void {
      this.proxyRefs[i] = (el as HTMLElement | null);
    },
    /** The director's element handles (host passes them to launch()). */
    proxyEls(): Array<HTMLElement> {
      return this.cards.map((_, i) => this.proxyRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    deckEl(): HTMLElement | null {
      return (this.$refs.deck as HTMLElement | undefined) ?? null;
    },
  },
});
</script>
