<template>
  <!--
    THE RECEIVING CARDS — the chosen host card(s) of a trade's reward,
    physically ON STAGE while the reward arrives. ONE presentation for every
    stage a trade resolves on: the colony focus stage (a colony's income / bonus
    onto Titan's holder) and the fleet-dock stage (TR27: the dock pays a card).
    The token lands on the card's own stored-resource capsule; the counter is
    FROZEN at the pre-trade value and ticks — with a contact flash — at each
    touchdown (`presentedTargetModel` over the transfer framework's one landing
    tally): «было → прилетел → стало», never a number that silently changed.

    The stage owns WHEN the scene stands and when it leaves (`leaving`); this
    component owns how it reads. The root keeps the colony stage's class: one
    design, positioned by its stage.
  -->
  <section class="con-colfocus__cardland"
           :class="{
             'con-colfocus__cardland--leaving': leaving,
             'con-colfocus__cardland--rail': rail,
           }"
           :data-cardland-count="targets.length">
    <div v-for="t in targets" :key="t.card"
         class="con-colfocus__landcell"
         :class="{'con-colfocus__landcell--landed': landedOf(t) > 0}"
         :data-played-key="t.card">
      <div class="con-colfocus__landcard">
        <ConsoleCardFaceLite :name="t.card" :card="modelOf(t)" />
        <!-- Re-keyed per touchdown: each landed chip replays the one-shot
             contact flash over the card's own counter capsule. -->
        <span v-if="landedOf(t) > 0" :key="'flash' + landedOf(t)"
              class="con-colfocus__landflash" aria-hidden="true"></span>
      </div>
      <div class="con-colfocus__landmeta">
        <i v-if="t.icon !== ''" :class="iconClass(t.icon)" aria-hidden="true"></i>
        <em>{{ t.before }} → {{ t.before + t.amount }}</em>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {ColonyTradePresentedTarget, presentedTargetModel} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleTradeReceivingCards',
  components: {ConsoleCardFaceLite},
  props: {
    /** The cards that receive, as pinned at the commit boundary. */
    targets: {type: Array as PropType<ReadonlyArray<ColonyTradePresentedTarget>>, required: true},
    /** The transfer framework's landing tally, per card (`cardResourceLandings.by`). */
    landings: {type: Object as PropType<Readonly<Record<string, number>>>, required: true},
    /** Every player — the live card models live in their tableaux. */
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    /** The departure has begun (a beat of its own — the stage owns its timing). */
    leaving: {type: Boolean, default: false},
    /** The rail variant (a build: the card stands in the summary column). */
    rail: {type: Boolean, default: false},
  },
  methods: {
    landedOf(t: ColonyTradePresentedTarget): number {
      return this.landings[t.card] ?? 0;
    },
    modelOf(t: ColonyTradePresentedTarget): CardModel {
      const live = this.players.flatMap((p) => p.tableau).find((c) => c.name === t.card);
      return presentedTargetModel(t, live, this.landedOf(t));
    },
    /** A reward line's sprite — the stage's own sizing (a bare card-resource class is a 0×0 background). */
    iconClass(icon: string): string {
      return iconClassFor(icon) + ' con-task__opt-res';
    },
  },
});
</script>
