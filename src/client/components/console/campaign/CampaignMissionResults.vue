<template>
  <div class="cmres">
    <div class="cmres__rows">
      <div v-for="row in details.rows" :key="row.seat" class="cmres__row" :class="{'cmres__row--you': row.seat === youSeat}">
        <span class="cmres__place">{{ row.place }}</span>
        <span class="cmres__cube" :class="`player_bg_color_${row.color}`"></span>
        <span class="cmres__name">
          {{ rowName(row) }}
          <span v-if="row.tied" class="cmres__tied">{{ $t('shared place') }}</span>
        </span>
        <span class="cmres__corps">
          <span v-for="corp in row.corporations" :key="corp" class="cmres__corp">{{ $t(corp) }}</span>
          <span v-if="row.isBot && botCorpName !== undefined" class="cmres__corp">{{ $t(botCorpName) }}</span>
        </span>
        <span class="cmres__title-slot">
          <img v-if="row.title !== undefined" class="cmres__title" :src="titleArtUrl(row.title.title)" :alt="$t(titleLabel(row.title.title))">
          <span v-if="row.title !== undefined" class="cmres__tp">+{{ row.title.titlePoints }} {{ $t('TP') }}</span>
        </span>
        <span class="cmres__score">{{ row.score }} {{ $t('VP') }}</span>
      </div>
    </div>
    <div class="cmres__gens">{{ generationsText }}</div>

    <template v-if="details.outgoing !== undefined">
      <div class="cmres__legacy-head">{{ outgoingHeading }}</div>
      <div class="cmres__legacy">
        <div v-if="details.outgoing.bonuses.length > 0" class="cmres__legacy-line">
          <span class="cmres__legacy-cap">{{ $t('Start bonus') }}</span>
          <span v-for="b in details.outgoing.bonuses" :key="b.seat" class="cmres__bonus">
            <span class="cmres__cube cmres__cube--sm" :class="`player_bg_color_${b.color}`"></span>
            +{{ b.megaCredits }} M€
          </span>
        </div>
        <div class="cmres__legacy-line">
          <span class="cmres__legacy-cap">{{ $t('Legacy projects') }}</span>
          <template v-if="!details.outgoing.carried.known">
            <span class="cmres__muted">{{ $t('No record in this save') }}</span>
          </template>
          <template v-else-if="details.outgoing.carried.pending">
            <span class="cmres__muted">{{ $t('The carryover is still being chosen') }}</span>
          </template>
          <template v-else>
            <span v-for="c in carriedRows" :key="c.seat" class="cmres__carry">
              <span class="cmres__cube cmres__cube--sm" :class="`player_bg_color_${c.color}`"></span>
              {{ carryCount(c.count) }}
            </span>
            <span v-if="carriedRows.length === 0" class="cmres__muted">{{ $t('Nothing was carried over') }}</span>
          </template>
        </div>
        <div v-if="yourCarriedCards.length > 0" class="cmres__cards">
          <div v-for="(card, i) in yourCarriedCards" :key="card.name" class="cmres__card" :data-zoom-slot="`cmres:${card.name}:${i}`">
            <Card :card="card" :key="card.name" lightweight :inert="true" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {MissionDetailsVm} from '@/client/console/campaign/campaignOverviewModel';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateTextWithParams} from '@/client/directives/i18n';

/**
 * MISSION RESULTS («Итоги миссии») — the committed facts of one finished
 * mission: place-ordered standings with the HISTORIC corporation
 * composition, earned titles with their TP, and the legacy this result
 * formed for the NEXT mission (start bonus M€ + carried projects). Shared
 * verbatim by the standalone Campaign Map dossier and the in-game
 * Information overview. Read-only: renders zero controller hints; the
 * viewer's own carried cards expose `data-zoom-slot` for the host's
 * fullscreen inspect.
 */
export default defineComponent({
  name: 'CampaignMissionResults',
  components: {Card},
  props: {
    details: {type: Object as PropType<MissionDetailsVm>, required: true},
    youSeat: {type: Number as PropType<number | undefined>, default: undefined},
    botCorporation: {type: String as PropType<MarsBotCorpId | undefined>, default: undefined},
  },
  computed: {
    generationsText(): string {
      return translateTextWithParams('Generations: ${0}', [String(this.details.generations)]);
    },
    outgoingHeading(): string {
      return translateTextWithParams('Legacy for mission ${0}', [String((this.details.outgoing?.nextSlot ?? 0) + 1)]);
    },
    botCorpName(): CardName | undefined {
      return this.botCorporation === undefined ? undefined : marsBotCorpInfo(this.botCorporation).original;
    },
    carriedRows(): ReadonlyArray<{seat: number, color: string, count: number}> {
      return (this.details.outgoing?.carried.bySeat ?? []).filter((s) => s.count > 0);
    },
    yourCarriedCards(): ReadonlyArray<CardModel> {
      return (this.details.outgoing?.carried.yourCards ?? []).map((name) => ({name} as CardModel));
    },
  },
  methods: {
    titleArtUrl,
    titleLabel(title: TitleName): string {
      return TITLE_LABEL[title];
    },
    /** The visible participant label — the ONE name helper. */
    rowName(row: {name: string, isBot: boolean}): string {
      return participantDisplayName({name: row.name, isMarsBot: row.isBot});
    },
    carryCount(count: number): string {
      // «карт: N» — number-form-neutral in RU (never «2 карт»).
      return translateTextWithParams('cards: ${0}', [String(count)]);
    },
  },
});
</script>
