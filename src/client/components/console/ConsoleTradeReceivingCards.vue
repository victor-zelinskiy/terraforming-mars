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

    THE CARD IS THE PROTAGONIST (the owner, 2026-10-25: «карта выглядит слишком
    мелкой»): it stands at the scene's scale, and every card names WHO PAYS IT —
    the trade's income, the colony bonus, or both on one face (`parts`). When
    the two acts pay DIFFERENT cards (Titan: the income's floaters onto one
    card, a settlement's floater onto another) the waves fly IN TURN and the
    scene says which card is receiving NOW (`activeRole` — the transaction's own
    beat): that card stands forward, the other waits a step back, by opacity
    and a hair of scale (never a glow); once everything has landed both stand
    level for the read.

    The stage owns WHEN the scene stands and when it leaves (`leaving`); this
    component owns how it reads. The root keeps the colony stage's class: one
    design, positioned by its stage.
  -->
  <section class="con-colfocus__cardland"
           :class="{
             'con-colfocus__cardland--leaving': leaving,
             'con-colfocus__cardland--rail': rail,
           }"
           :data-cardland-count="targets.length"
           :data-cardland-active="activeRole !== '' && !settled ? activeRole : undefined">
    <div v-for="t in targets" :key="t.card"
         class="con-colfocus__landcell"
         :class="{
           'con-colfocus__landcell--landed': landedOf(t) > 0,
           'con-colfocus__landcell--done': landedOf(t) >= t.amount,
           'con-colfocus__landcell--receiving': cellState(t) === 'receiving',
           'con-colfocus__landcell--waiting': cellState(t) === 'waiting',
         }"
         :data-played-key="t.card"
         :data-landcell-state="cellState(t)">
      <!-- WHO PAYS THIS CARD — one line per act, the act's own name and what it lays here. -->
      <div class="con-colfocus__landroles">
        <span v-for="part in partsOf(t)" :key="part.role"
              class="con-colfocus__landrole"
              :class="'con-colfocus__landrole--' + part.role"
              :data-landrole="part.role">
          <span class="con-colfocus__landrole-name">{{ $t(roleLabel(part.role)) }}</span>
          <b class="con-colfocus__landrole-amount">+{{ part.amount }}</b>
          <i v-if="t.icon !== ''" :class="iconClass(t.icon)" aria-hidden="true"></i>
        </span>
      </div>
      <div class="con-colfocus__landcard">
        <ConsoleCardFaceLite :name="t.card" :card="modelOf(t)" />
        <!-- Re-keyed per touchdown: each landed chip replays the one-shot
             contact flash over the card's own counter capsule. -->
        <span v-if="landedOf(t) > 0" :key="'flash' + landedOf(t)"
              class="con-colfocus__landflash" aria-hidden="true"></span>
      </div>
      <div class="con-colfocus__landmeta">
        <i v-if="t.icon !== ''" :class="iconClass(t.icon)" aria-hidden="true"></i>
        <span class="con-colfocus__landcount">
          <span>{{ t.before }}</span>
          <span class="con-colfocus__landarrow" aria-hidden="true">→</span>
          <b>{{ t.before + t.amount }}</b>
        </span>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ColonyTradeFollowUpRole} from '@/common/models/ColonyTradePreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {ColonyTradePresentedTarget, presentedTargetModel, presentedTargetParts} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

/** The act that pays a card, in the player's words. */
const ROLE_LABEL: Readonly<Record<ColonyTradeFollowUpRole, string>> = {
  tradeReward: 'Trade reward',
  colonyBonus: 'Colony bonus',
  buildBonus: 'Colony placement bonus',
};

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
    /** The act whose wave is landing NOW ('' = none in the air) — the card it pays stands forward. */
    activeRole: {type: String as PropType<ColonyTradeFollowUpRole | ''>, default: ''},
  },
  computed: {
    /** Everything has landed: the scene is read level, nothing waits. */
    settled(): boolean {
      return this.targets.every((t) => this.landedOf(t) >= t.amount);
    },
  },
  methods: {
    landedOf(t: ColonyTradePresentedTarget): number {
      return this.landings[t.card] ?? 0;
    },
    partsOf(t: ColonyTradePresentedTarget): ReadonlyArray<{role: ColonyTradeFollowUpRole, amount: number}> {
      return presentedTargetParts(t);
    },
    /**
     * Who stands forward. Only a scene of SEVERAL cards orders them (one card is always the subject), and only
     * while a wave is in the air: the card the landing act pays receives, the others wait a step back.
     */
    cellState(t: ColonyTradePresentedTarget): 'receiving' | 'waiting' | 'idle' {
      if (this.targets.length < 2 || this.activeRole === '' || this.settled) {
        return 'idle';
      }
      return this.partsOf(t).some((p) => p.role === this.activeRole) ? 'receiving' : 'waiting';
    },
    roleLabel(role: ColonyTradeFollowUpRole): string {
      return ROLE_LABEL[role];
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
