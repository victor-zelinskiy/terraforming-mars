<template>
  <div class="ccard" :class="rootClasses">
    <div v-if="mission.final" class="ccard__final-banner">{{ $t('Finale') }}</div>
    <div class="ccard__map">
      <PremiumMapFingerprint :map-id="mission.board" variant="card" :accent="accent" :reveal="reveal" :reveal-delay-ms="revealDelayMs" />
    </div>
    <div class="ccard__board-name">{{ $t(boardLabel) }}</div>
    <div class="ccard__state" :class="`ccard__state--${mission.state}`">{{ $t(stateLabel) }}</div>
    <div v-if="mission.podium !== undefined" class="ccard__results">
      <div v-for="p in mission.podium" :key="p.seat" class="ccard__result-row">
        <span class="ccard__result-place">{{ p.place }}</span>
        <span class="ccard__result-cube" :class="`player_bg_color_${p.color}`"></span>
        <img v-if="p.title !== undefined" class="ccard__result-title" :src="titleArtUrl(p.title)" :alt="$t(titleLabel(p.title))">
        <span class="ccard__result-score">{{ p.score }} {{ $t('VP') }}</span>
      </div>
      <div v-if="mission.generations !== undefined" class="ccard__gens">{{ generationsText }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {OverviewMissionCard} from '@/client/console/campaign/campaignOverviewModel';
import {mapLabelKey, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {translateTextWithParams} from '@/client/directives/i18n';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {TitleName} from '@/common/campaign/CampaignTypes';

/**
 * ONE mission card of the campaign route — shared by the standalone
 * Campaign Map and the in-game Information overview, so board art, state
 * dressing and the compact result strip can never drift between the two.
 * The host owns cursor semantics (this component only paints `cursor`) and
 * every verb — the card renders zero controller hints.
 */
export default defineComponent({
  name: 'CampaignMissionCard',
  components: {PremiumMapFingerprint},
  props: {
    mission: {type: Object as PropType<OverviewMissionCard>, required: true},
    cursor: {type: Boolean, default: false},
    reveal: {type: Boolean, default: false},
    revealDelayMs: {type: Number, default: 0},
  },
  computed: {
    rootClasses(): Record<string, boolean> {
      return {
        'ccard--cursor': this.cursor,
        'ccard--done': this.mission.state === 'committed',
        'ccard--current': this.mission.isCurrent,
        'ccard--future': this.mission.state === 'locked' && !this.mission.isCurrent,
        'ccard--final': this.mission.final,
      };
    },
    accent(): string {
      return mapMeta(this.mission.board).accent;
    },
    boardLabel(): string {
      return mapLabelKey(this.mission.board);
    },
    stateLabel(): string {
      switch (this.mission.state) {
      case 'committed': return 'Mission complete';
      case 'active': return 'Mission in progress';
      case 'ready': return this.mission.isCurrent ? 'Next mission' : 'Ahead';
      default: return 'Ahead';
      }
    },
    generationsText(): string {
      return translateTextWithParams('Generations: ${0}', [String(this.mission.generations)]);
    },
  },
  methods: {
    titleArtUrl,
    titleLabel(title: TitleName): string {
      return TITLE_LABEL[title];
    },
  },
});
</script>
