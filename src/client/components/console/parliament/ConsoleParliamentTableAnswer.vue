<template>
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

<script setup vapor lang="ts">
/*
 * ══ «ОТВЕТ СТОЛА» (Turmoil Redux — TR78 Arwind Inc.): ONE stage for a card of the table answering a walk of the
 * Career, wherever the marker walked (the chairman quest, the sitting's winner step, a law's step, a card's own
 * walk). The ASKER's face stands on the hero — the card whose printed effect fired, the WHY — and the ZONE holds
 * the answer: a RECEIPT (the units already landed: the recipients as a row of faces, each token born on the asker's
 * printed icon and landing on its capsule in turn — `tableAnswerBeat.playTableAnswer`), or a QUESTION (a second
 * holder: the family's pick / layout teleported into the zone, the chosen capsules receiving from the asker's face).
 * HOST-AGNOSTIC: it titles nothing (the crumb's tail names the stage — «ИСТРЕБИТЕЛЬ»), owns no input, scrolls
 * nothing; the hero wears the framework's hooks (`data-reaction-home` — the attached flight lifts the asker IN ITS
 * PLACE, its effect row lit; law 17 of «СРАБАТЫВАНИЕ КАРТЫ»). ══
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, PropType, watch} from 'vue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleTableReceipt from '@/client/components/console/parliament/ConsoleTableReceipt.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceLanded} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {ReceiptCard, TableReceipt, TableReceiptPhase} from '@/client/console/parliament/tableReceiptBeat';
import {TableAnswer, TableAnswerAsk, TableAnswerPhase, tableAnswerState} from '@/client/console/parliament/tableAnswerBeat';

defineOptions({name: 'ConsoleParliamentTableAnswer'});
const props = defineProps({
  /** The RECEIPT on stage (the units landed) — undefined while a question stands. */
  answer: {type: Object as PropType<TableAnswer | undefined>, default: undefined},
  /** The QUESTION on stage (the picker is teleported into the zone) — undefined for a receipt. */
  asking: {type: Object as PropType<TableAnswerAsk | undefined>, default: undefined},
  /** The asker's LIVE model (its face, its count) — the viewer's own tableau entry. */
  askerModel: {type: Object as PropType<CardModel | undefined>, default: undefined},
  /** Hosted as a layer of another surface (the sitting's reward chassis) — nothing of its own frame to draw. */
  embedded: {type: Boolean, default: false},
});

const asker = computed((): CardName | undefined => {
  return props.answer?.asker ?? props.asking?.asker;
});
const cause = computed((): string | undefined => {
  return props.answer?.cause ?? props.asking?.cause;
});
const walk = computed((): {from: number, to: number} => {
  return props.answer?.walk ?? {from: 0, to: 0};
});
const amount = computed((): number => {
  return props.answer?.amount ?? props.asking?.amount ?? 0;
});
const resource = computed((): string => {
  return props.answer?.resource ?? props.asking?.resource ?? 'resources';
});
const unitClass = computed((): string => {
  return iconClassFor(resource.value);
});
const phase = computed((): TableAnswerPhase => {
  return tableAnswerState.phase;
});
/** The asker's own share of the receipt — lands on the hero's capsule. */
const askerShare = computed((): ReceiptCard | undefined => {
  const askerName = asker.value;
  return askerName === undefined ? undefined : props.answer?.cards.find((c) => c.card === askerName);
});
/** The face's model: the card as the viewer holds it — its count the receipt's «before» plus what has touched down. */
const askerFaceModel = computed((): CardModel | undefined => {
  const askerName = asker.value;
  if (askerName === undefined) {
    return undefined;
  }
  const base = props.askerModel ?? ({name: askerName} as CardModel);
  const share = askerShare.value;
  if (share === undefined) {
    return base;
  }
  return {...base, resources: share.before + Math.min(share.amount, cardResourceLanded(askerName))};
});
/** Every recipient but the asker, in the record's order. */
const recipients = computed((): ReadonlyArray<ReceiptCard> => {
  const askerName = asker.value;
  return (props.answer?.cards ?? []).filter((c) => c.card !== askerName);
});
const recipientsReceipt = computed((): TableReceipt => {
  const answer = props.answer;
  const cards = recipients.value;
  return {
    key: answer?.key ?? '',
    player: answer?.player ?? ('' as TableReceipt['player']),
    generation: answer?.generation ?? 0,
    cards,
    specs: cards.map((c) => ({channel: 'card-resource' as const, resource: c.iconKey, amount: c.amount, targetCard: c.card})),
  };
});
/** The receipt faces' pose follows the stage's phase (the lift while they receive). */
const receiptPhase = computed((): TableReceiptPhase => {
  switch (phase.value) {
  case 'rise': return 'present';
  case 'pay': return 'pay';
  case 'read': return 'read';
  case 'leave': return 'leave';
  default: return props.answer !== undefined ? 'enter' : '';
  }
});
const zoneOn = computed((): boolean => {
  return props.asking !== undefined || recipients.value.length > 0;
});
/** THE ZONE IS READY for the picker: a question stands AND the stage has entered (its unfold played). */
const zoneReady = computed((): boolean => {
  return props.asking !== undefined && tableAnswerState.paneIn;
});

watch(() => zoneReady.value, (ready: boolean): void => {
  // THE ZONE IS PUBLISHED BY ITS OWN HOST: the shell teleports the picker in only while the node is in the DOM
  // and the stage has arrived (a surface that paints inside an unfolding one reads as a modal that arrived).
  consoleParliamentUi.answerZone = ready;
}, {immediate: true});
onBeforeUnmount(() => {
  consoleParliamentUi.answerZone = false;
});
</script>
