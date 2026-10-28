<template>
  <!-- ══ «ОТВЕТ СТОЛА» (Turmoil Redux — TR78 Arwind Inc.): ONE stage for a card of the table answering a walk of the
       Career, wherever the marker walked (the chairman quest, the sitting's winner step, a law's step, a card's own
       walk). The ASKER's face stands on the hero — the card whose printed effect fired, the WHY — and the ZONE holds
       the answer: a RECEIPT (the units already landed: the recipients as a row of faces, each token born on the asker's
       printed icon and landing on its capsule in turn — `tableAnswerBeat.playTableAnswer`), or a QUESTION (a second
       holder: the family's pick / layout teleported into the zone, the chosen capsules receiving from the asker's face).
       HOST-AGNOSTIC: it titles nothing (the crumb's tail names the stage — «ИСТРЕБИТЕЛЬ»), owns no input, scrolls
       nothing; the hero wears the framework's hooks (`data-reaction-home` — the attached flight lifts the asker IN ITS
       PLACE, its effect row lit; law 17 of «СРАБАТЫВАНИЕ КАРТЫ»). ══ -->
  <div ref="root" class="con-tans"
       :class="{'con-tans--question': asking !== undefined, 'con-tans--solo': asking === undefined && recipients.length === 0, 'con-tans--embedded': embedded}"
       :data-tans-mode="asking !== undefined ? 'question' : 'receipt'"
       :data-tans-asker="asker"
       :data-tans-phase="phase || undefined"
       :data-tans-cause="cause"
       data-parl-answer>
    <div class="con-tans__hero" data-tans-hero>
      <!-- The asker's face: `data-tans-card` only while it RECEIVES on this stage (a receipt) — in a question the chosen
           capsule is the picker's own candidate, never this face (the player pressed there). -->
      <div class="con-tans__face" :data-reaction-home="asker" :data-tans-card="asking === undefined ? asker : undefined" data-tans-asker-face>
        <Card v-if="askerFaceModel !== undefined" :card="askerFaceModel" :lightweight="true" :inert="true" />
      </div>
      <div class="con-tans__why" data-tans-why>
        <span class="con-tans__why-kicker">{{ $t('Agenda step') }}</span>
        <span class="con-tans__why-walk" data-tans-walk>{{ walk.from }}<span class="con-tans__arrow" aria-hidden="true">→</span>{{ walk.to }}</span>
        <span class="con-tans__why-gain" data-tans-gain>
          <b>+{{ amount }}</b>
          <i class="con-tans__unit" :class="unitClass" aria-hidden="true"></i>
        </span>
      </div>
    </div>
    <div class="con-tans__zone" :class="{'con-tans__zone--on': zoneOn}" :data-tans-zone-open="zoneOn ? '' : undefined">
      <!-- THE QUESTION's zone: the shell teleports the family's pick / layout here once the stage has ENTERED. -->
      <div v-if="asking !== undefined" class="con-tans__embed" data-embed-slot="parliament-answer"></div>
      <!-- THE RECEIPT's row: every recipient but the asker (whose own share lands on the hero), the capsule ticking
           on the touchdown — the sitting's own receipt chassis (`ConsoleTableReceipt`). -->
      <div v-else-if="recipients.length > 0" class="con-tans__row" data-tans-row>
        <ConsoleTableReceipt :receipt="recipientsReceipt" :phase="receiptPhase" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleTableReceipt from '@/client/components/console/parliament/ConsoleTableReceipt.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceLanded} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {ReceiptCard, TableReceipt, TableReceiptPhase} from '@/client/console/parliament/tableReceiptBeat';
import {TableAnswer, TableAnswerAsk, TableAnswerPhase, tableAnswerState} from '@/client/console/parliament/tableAnswerBeat';

export default defineComponent({
  name: 'ConsoleParliamentTableAnswer',
  components: {Card, ConsoleTableReceipt},
  props: {
    /** The RECEIPT on stage (the units landed) — undefined while a question stands. */
    answer: {type: Object as PropType<TableAnswer | undefined>, default: undefined},
    /** The QUESTION on stage (the picker is teleported into the zone) — undefined for a receipt. */
    asking: {type: Object as PropType<TableAnswerAsk | undefined>, default: undefined},
    /** The asker's LIVE model (its face, its count) — the viewer's own tableau entry. */
    askerModel: {type: Object as PropType<CardModel | undefined>, default: undefined},
    /** Hosted as a layer of another surface (the sitting's reward chassis) — nothing of its own frame to draw. */
    embedded: {type: Boolean, default: false},
  },
  computed: {
    asker(): CardName | undefined {
      return this.answer?.asker ?? this.asking?.asker;
    },
    cause(): string | undefined {
      return this.answer?.cause ?? this.asking?.cause;
    },
    walk(): {from: number, to: number} {
      return this.answer?.walk ?? {from: 0, to: 0};
    },
    amount(): number {
      return this.answer?.amount ?? this.asking?.amount ?? 0;
    },
    resource(): string {
      return this.answer?.resource ?? this.asking?.resource ?? 'resources';
    },
    unitClass(): string {
      return iconClassFor(this.resource);
    },
    phase(): TableAnswerPhase {
      return tableAnswerState.phase;
    },
    /** The asker's own share of the receipt — lands on the hero's capsule. */
    askerShare(): ReceiptCard | undefined {
      const asker = this.asker;
      return asker === undefined ? undefined : this.answer?.cards.find((c) => c.card === asker);
    },
    /** The face's model: the card as the viewer holds it — its count the receipt's «before» plus what has touched down. */
    askerFaceModel(): CardModel | undefined {
      const asker = this.asker;
      if (asker === undefined) {
        return undefined;
      }
      const base = this.askerModel ?? ({name: asker} as CardModel);
      const share = this.askerShare;
      if (share === undefined) {
        return base;
      }
      return {...base, resources: share.before + Math.min(share.amount, cardResourceLanded(asker))};
    },
    /** Every recipient but the asker, in the record's order. */
    recipients(): ReadonlyArray<ReceiptCard> {
      const asker = this.asker;
      return (this.answer?.cards ?? []).filter((c) => c.card !== asker);
    },
    recipientsReceipt(): TableReceipt {
      const answer = this.answer;
      const cards = this.recipients;
      return {
        key: answer?.key ?? '',
        player: answer?.player ?? ('' as TableReceipt['player']),
        generation: answer?.generation ?? 0,
        cards,
        specs: cards.map((c) => ({channel: 'card-resource' as const, resource: c.iconKey, amount: c.amount, targetCard: c.card})),
      };
    },
    /** The receipt faces' pose follows the stage's phase (the lift while they receive). */
    receiptPhase(): TableReceiptPhase {
      switch (this.phase) {
      case 'rise': return 'present';
      case 'pay': return 'pay';
      case 'read': return 'read';
      case 'leave': return 'leave';
      default: return this.answer !== undefined ? 'enter' : '';
      }
    },
    zoneOn(): boolean {
      return this.asking !== undefined || this.recipients.length > 0;
    },
    /** THE ZONE IS READY for the picker: a question stands AND the stage has entered (its unfold played). */
    zoneReady(): boolean {
      return this.asking !== undefined && tableAnswerState.paneIn;
    },
  },
  watch: {
    zoneReady: {
      immediate: true,
      handler(ready: boolean): void {
        // THE ZONE IS PUBLISHED BY ITS OWN HOST: the shell teleports the picker in only while the node is in the DOM
        // and the stage has arrived (a surface that paints inside an unfolding one reads as a modal that arrived).
        consoleParliamentUi.answerZone = ready;
      },
    },
  },
  beforeUnmount() {
    consoleParliamentUi.answerZone = false;
  },
});
</script>
