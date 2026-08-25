<template>
  <!--
    HAND REVEAL LAYER — the fixed stage of the dock ↔ hand-overlay physical
    transition (handRevealDirector.ts). One proxy per hand card: the deal
    language's 3D flip chassis (back = the canonical sleeve, face = the
    FaceLite twin). Off-window scroll-tail proxies carry NO face (cheap
    back-only flyers, sampled down by the director). Pointer-inert, clipped;
    sits UNDER the footer band AND under the hand section's status rail
    (console_card_deal.less / `.con-main--hand` in console.less) so a card
    descending into the dock is occluded by the REAL tray/bar texture per
    pixel — it slots in BEHIND the furniture, never painting over it.

    THE STATE FLIES WITH THE CARD: the face renders the card's LANDED
    presentation — the LIVE model, the unplayable / select-disabled dim and
    the compact blocker chip (`flight.visual`, threaded by the shell) — so
    the state is readable DURING the flight and nothing pops at the handoff.

    ⚠️ The face must be the SAME PICTURE the grid slot under it renders, and
    that takes both halves of the contract: the live `card` (the discount
    chip, the stored-resource capsule, the disabled wash — and, through the
    cost chip's title safe-area, the name's size and line breaks) and
    `lightweight`, the grid's own `thumb` quality tier (solid warm ink title,
    no plate textures). Omitting either does not make the flight cheaper in
    any way the player cannot see: it flies a different card and the handoff
    reads as a swap — the reported «карты мигают при открытии руки».
  -->
  <div class="con-handreveal-layer" aria-hidden="true">
    <div v-for="f in handRevealState.flights" :key="f.id"
         class="con-deal-proxy"
         :data-reveal-card="f.name"
         :ref="(el) => registerRevealEl(f.id, el as HTMLElement | null)">
      <div class="con-deal-proxy__flip">
        <div v-if="f.face"
             class="con-deal-proxy__face"
             :class="{
               'con-deal-proxy__face--dim': f.visual?.dim === 'soft',
               'con-deal-proxy__face--dim-strong': f.visual?.dim === 'strong',
             }">
          <ConsoleCardFaceLite :name="f.name" :card="f.visual?.card" :artTier="handRevealState.artTier" lightweight />
          <span v-if="f.visual?.chip !== undefined" class="con-deal-proxy__chip">{{ $t(f.visual.chip) }}</span>
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
import {handRevealState, registerRevealEl} from '@/client/console/handDock/handRevealState';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleHandRevealLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {handRevealState};
  },
  methods: {
    registerRevealEl,
  },
});
</script>
