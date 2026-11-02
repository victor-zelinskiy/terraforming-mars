<template>
  <!-- ══ «ПРИЁМКА» (the owner, 2026-11-02): a card drawn in the Parliament is RECEIVED in the Parliament — the ONE
       reveal instance is teleported into this stage's zone (`[data-embed-slot="parliament-draw"]`, the shell's
       `revealEmbedTarget`), the card flies into its slot from its real source (the Career's step / the deck pile), the
       player takes it, and the flow that drew it waits for that take (`parliamentDraw.ts`). Two hosts, one chassis —
       the «ОТВЕТ СТОЛА» family's: the section's own stage kind (the quest, a card's walk — unfolded over the TABLE by the
       body swap) and a LAYER of the sitting's reward chassis (the enactment's tail, the Career's walks).
       The HERO is the card that drew, when a card did (TR62 Tharsis Alliance answering the change of power) — the WHY on
       stage, beside its result; a Career step needs none (its cover rises off the step itself, in plain view below), so
       the zone takes the stage. HOST-AGNOSTIC: it titles nothing — the reveal's own head names the cause («Карьера»,
       or the card on the hero), and the crumb keeps the FLOW's stage (a card step is a beat of the walk, and a crumb
       that read «ДОБОР КАРТ» and then «КАРЬЕРА» again would walk backwards); it owns no input (the reveal does) and
       scrolls nothing. Invariant 15: no halo. ══ -->
  <div class="con-pdraw" :class="{'con-pdraw--solo': heroCard === undefined}"
       :data-pdraw-source="sourceKind"
       :data-pdraw-card="heroCard"
       data-parl-draw>
    <div v-if="heroCard !== undefined" class="con-pdraw__hero" data-pdraw-hero>
      <div class="con-pdraw__face" :data-reaction-home="heroCard">
        <Card :card="heroModel" :lightweight="true" :inert="true" />
      </div>
      <div v-if="party !== undefined" class="con-pdraw__why" data-pdraw-why>
        <img class="con-pdraw__emblem" :src="emblemUrl" alt="" />
        <b class="con-pdraw__party">{{ $t(partyKey) }}</b>
        <span class="con-pdraw__rule">{{ $t('came to power') }}</span>
      </div>
    </div>
    <div class="con-pdraw__zone" data-pdraw-zone>
      <div v-embed-zone class="con-pdraw__embed" data-embed-slot="parliament-draw"></div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {isReduxParty, ReduxParty} from '@/common/parliament/ParliamentTypes';
import Card from '@/client/components/card/CardFace.vue';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {vEmbedZone} from '@/client/console/embedZoneRegistry';
import {noteParliamentDrawPaneOut} from '@/client/console/parliament/parliamentDraw';

export default defineComponent({
  name: 'ConsoleParliamentDrawStage',
  components: {Card},
  directives: {embedZone: vEmbedZone},
  props: {
    /** The ROOT source of the batch the stage hosts (`agenda` · `ruling-change`). */
    source: {type: Object as PropType<CardDrawRevealSource | undefined>, default: undefined},
    /** The hero card's LIVE model — the viewer's own tableau entry (its face as the player holds it). */
    heroLive: {type: Object as PropType<CardModel | undefined>, default: undefined},
  },
  computed: {
    sourceKind(): string {
      return this.source?.type ?? '';
    },
    /** The card that drew — a card's answer to a change of power names it; a Career step has none. */
    heroCard(): CardName | undefined {
      return this.source?.type === 'ruling-change' ? this.source.cardName : undefined;
    },
    heroModel(): CardModel {
      return this.heroLive ?? ({name: this.heroCard} as CardModel);
    },
    /** The party that came to power — the change the card answered. */
    party(): ReduxParty | undefined {
      const source = this.source;
      return source?.type === 'ruling-change' && isReduxParty(source.party) ? source.party : undefined;
    },
    partyKey(): string {
      return this.party === undefined ? '' : partyNameKey(this.party);
    },
    emblemUrl(): string {
      return this.party === undefined ? '' : partyEmblemUrl(this.party);
    },
  },
  beforeUnmount() {
    // The zone leaves with the stage: the reveal may no longer be teleported here.
    noteParliamentDrawPaneOut();
  },
});
</script>
