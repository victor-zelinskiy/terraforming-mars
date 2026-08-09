<template>
  <div v-if="cards.length > 0" class="con-deckpick-fly" aria-hidden="true">
    <div v-for="(name, i) in cards" :key="nonce + '#' + i + '#' + name"
         class="con-deal-proxy"
         :ref="(el) => registerDeckPickProxy(i, el as HTMLElement | null)">
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
/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DRAW & SELECT FLIGHT STAGE — app level, exactly like every other flight
 * layer in the console (`ConsoleCardExitLayer`, `ConsoleHandDeliveryLayer`,
 * `ConsoleDeckDrawLayer`), and for a reason that is not stylistic.
 *
 * The bodies are `position: fixed` and the director writes ABSOLUTE SCREEN
 * COORDINATES into them. That is only true while no ancestor establishes a
 * containing block — and the surface these belong to is TELEPORTED into a
 * host's zone, which has plenty: the start workspace's embed zone runs a
 * 260 ms arrival `animation`, and an animating `transform` contains fixed
 * descendants for its whole duration. That is precisely the window the deal
 * launches in, so every coordinate was resolved against the zone's origin —
 * the deck's position plus the zone's offset, which lands off the right edge.
 * The cards appeared to fly in from the right instead of off the deck.
 *
 * Mounted ONCE by the shell; the surface only names the faces
 * (`armDeckPickFlight`) and reads the bodies back (`deckPickProxyEls`).
 */
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {deckPickFlightState, registerDeckPickProxy} from '@/client/console/deckPick/consoleDeckPick';

export default defineComponent({
  name: 'ConsoleDeckPickLayer',
  components: {ConsoleCardFaceLite},
  computed: {
    cards(): Array<CardName> {
      return deckPickFlightState.cards;
    },
    nonce(): number {
      return deckPickFlightState.nonce;
    },
  },
  methods: {registerDeckPickProxy},
});
</script>
