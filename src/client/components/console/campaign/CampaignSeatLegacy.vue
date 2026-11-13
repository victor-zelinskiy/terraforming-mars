<template>
  <div class="cleg">
    <div class="cleg__grid">
      <section class="cleg__zone cleg__zone--corps">
        <h4 class="cleg__cap">{{ $t('Current corporations') }}</h4>
        <div v-if="corpCards.length > 0" class="cleg__cards">
          <div
            v-for="(entry, i) in corpCards"
            :key="entry.card.name"
            class="cleg__card"
            :class="{'cleg__card--cursor': cursorIndex === i}"
            :data-zoom-slot="`cleg:${entry.card.name}:${i}`">
            <Card :card="entry.card" :key="entry.card.name" lightweight :inert="true" />
            <span v-if="entry.origin !== undefined" class="cleg__origin">{{ entry.origin }}</span>
          </div>
        </div>
        <div v-else class="cleg__muted">{{ $t('No corporations acquired yet') }}</div>
      </section>

      <section class="cleg__zone cleg__zone--carried">
        <h4 class="cleg__cap">{{ $t('Projects from the previous mission') }}</h4>
        <div v-if="carriedCards.length > 0" class="cleg__cards">
          <div
            v-for="(entry, i) in carriedCards"
            :key="entry.card.name"
            class="cleg__card"
            :class="{'cleg__card--cursor': cursorIndex === corpCards.length + i}"
            :data-zoom-slot="`cleg:${entry.card.name}:${corpCards.length + i}`">
            <Card :card="entry.card" :key="entry.card.name" lightweight :inert="true" />
          </div>
        </div>
        <div v-else class="cleg__muted">{{ carriedNote }}</div>
        <div v-if="carriedCards.length > 0" class="cleg__note">{{ $t('Carried from the previous mission') }} · {{ $t('View only') }}</div>
      </section>

      <!-- The «Тендеры» mode: the holdings as CERTIFICATES on the cards' own chassis — the ring's third stretch
           (corps → carried → tenders), each wearing the face's own cursor when focused, the reading line under it
           (where it was won); X opens the ONE viewer. A chip list in the facts zone stood here before and could be
           neither walked nor read. -->
      <section v-if="legacy.rewardMode === 'tenders'" class="cleg__zone cleg__zone--tenders" data-cleg-tenders>
        <h4 class="cleg__cap">{{ $t('Tenders') }}</h4>
        <div v-if="legacy.tenders.length > 0" class="cleg__cards cleg__tcards">
          <div
            v-for="(t, i) in legacy.tenders"
            :key="t.instance"
            class="cleg__tcard"
            :data-zoom-slot="`cleg:tender:${t.instance}`"
            :data-cleg-tender="t.instance" :data-cleg-tender-status="t.status"
            :data-cleg-tender-focused="cursorIndex === cardCount + i ? 'yes' : undefined">
            <ConsoleTenderCard :id="t.id" size="table" :state="tenderCardStateOf(t.status)" :focused="cursorIndex === cardCount + i" />
            <span class="cleg__tline">{{ tenderLine(t) }}</span>
          </div>
        </div>
        <div v-else class="cleg__muted">{{ $t('No tenders yet') }}</div>
        <div class="cleg__note">{{ $t(tenderNote) }}</div>
      </section>

      <section class="cleg__zone cleg__zone--facts">
        <h4 class="cleg__cap">{{ $t('Legacy') }}</h4>
        <div v-if="legacy.bonus !== undefined" class="cleg__fact">
          <span class="cleg__fact-label">{{ $t('Mission start bonus') }}</span>
          <span class="cleg__fact-value">+{{ legacy.bonus.amount }} M€</span>
          <span class="cleg__fact-status" :class="`cleg__fact-status--${legacy.bonus.status}`">{{ $t(bonusStatusLabel) }}</span>
        </div>
        <!-- The «Тендеры» mode: the ledger's count — the certificates themselves stand in their own zone. -->
        <template v-if="legacy.rewardMode === 'tenders'">
          <div class="cleg__fact">
            <span class="cleg__fact-label">{{ $t('Tenders') }}</span>
            <span class="cleg__fact-value">{{ legacy.tenders.length }}</span>
          </div>
        </template>
        <template v-else>
          <div class="cleg__fact">
            <span class="cleg__fact-label">{{ $t('Title Points') }}</span>
            <span class="cleg__fact-value">{{ tpText }}</span>
            <span class="cleg__fact-status">{{ $t(tpNote) }}</span>
          </div>
          <div v-if="legacy.titles.length > 0" class="cleg__titles">
            <span v-for="(t, i) in legacy.titles" :key="i" class="cleg__title">
              <img class="cleg__title-art" :src="titleArtUrl(t.title)" :alt="$t(titleLabel(t.title))">
              <span class="cleg__title-text">{{ titleLine(t) }}</span>
            </span>
          </div>
          <div v-else class="cleg__muted">{{ $t('No titles earned') }}</div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
import {computed, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardModel} from '@/common/models/CardModel';
import {OverviewTitle, SeatLegacyVm, tpStatusLabel} from '@/client/console/campaign/campaignOverviewModel';
import {TenderHoldingView} from '@/client/console/campaign/tenderHoldings';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {tenderCardStateOf} from '@/client/console/campaign/tenderPortfolio';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

/**
 * SEAT LEGACY («Наследие участника») — the full campaign legacy of ONE
 * seat in the frame of the context mission: the corporation composition
 * with its mission-of-origin badges, the start bonus M€ with an honest
 * received-status, the projects carried from the previous mission (real
 * card faces, view-only — rendering here NEVER re-grants anything), and
 * the title ledger with the TP semantics note. Shared by both campaign
 * surfaces; the host owns the cursor ring (`cursorIndex` over
 * corps → carried → tenders) and the fullscreen inspect.
 */
defineOptions({name: 'CampaignSeatLegacy'});
const props = defineProps({
  legacy: {type: Object as PropType<SeatLegacyVm>, required: true},
  /**
   * Live CardModels of the viewer's own carried cards (richer than bare
   * names when the host has them — discount chips etc.). Names from the
   * legacy vm are the fallback.
   */
  carriedModels: {type: Array as PropType<ReadonlyArray<CardModel>>, default: undefined},
  cursorIndex: {type: Number as PropType<number | undefined>, default: undefined},
});

const corpCards = computed((): ReadonlyArray<{card: CardModel, origin: string | undefined}> => {
  return props.legacy.corps.map((c) => ({
    card: {name: c.name} as CardModel,
    origin: c.missionSlot === undefined ? undefined :
      translateTextWithParams('Mission ${0}', [String(c.missionSlot + 1)]),
  }));
});
const carriedCards = computed((): ReadonlyArray<{card: CardModel}> => {
  if (props.carriedModels !== undefined && props.carriedModels.length > 0) {
    return props.carriedModels.map((card) => ({card}));
  }
  return (props.legacy.carried.names ?? []).map((name) => ({card: {name} as CardModel}));
});
/** The cards before the tenders in the ring — the index a certificate's cursor is counted from. */
const cardCount = computed((): number => {
  return corpCards.value.length + carriedCards.value.length;
});
const carriedNote = computed((): string => {
  if (!props.legacy.carried.known) {
    return translateText('No record in this save');
  }
  if (props.legacy.carried.count === 0) {
    return translateText('Nothing was carried over');
  }
  // Known count, names private (another participant's row).
  return translateTextWithParams('${0} cards · hidden', [String(props.legacy.carried.count)]);
});
const bonusStatusLabel = computed((): string => {
  switch (props.legacy.bonus?.status) {
  case 'granted': return 'Received';
  case 'settled': return 'Received';
  case 'pending': return 'Awaits the deployment press';
  default: return '';
  }
});
const tpText = computed((): string => {
  return translateTextWithParams('${0} TP', [String(props.legacy.titlePoints)]);
});
const tpNote = computed((): string => {
  return tpStatusLabel(props.legacy.tpStatus);
});
const tenderNote = computed((): string => {
  return 'Tenders execute at the finale\'s start; an unexecuted one pays 3 M€';
});
function tenderLine(t: TenderHoldingView): string {
  return translateTextWithParams('won at mission ${0}', [String(t.wonAtSlot + 1)]);
}
function titleLabel(title: TitleName): string {
  return TITLE_LABEL[title];
}
function titleLine(t: OverviewTitle): string {
  // The exact existing i18n keys of the campaign map rail.
  const keys: Record<TitleName, string> = {
    governor: 'Governor (mission ${0})',
    administrator: 'Administrator (mission ${0})',
    prefect: 'Prefect (mission ${0})',
  };
  return translateTextWithParams(keys[t.title], [String(t.missionSlot + 1)]);
}
</script>
