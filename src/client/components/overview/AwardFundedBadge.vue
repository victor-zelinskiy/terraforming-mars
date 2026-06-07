<template>
  <div class="milestone-claimed-badge"
       :class="{'milestone-claimed-badge--filled': award !== undefined}"
       :style="badgeStyle"
       v-on:mouseenter="onEnter"
       v-on:mouseleave="onLeave">
    <!-- Tiny color marker showing which player FUNDED this award.
         The award itself isn't owned — funder is just the one who paid. -->
    <div v-if="award"
         class="milestone-claimed-badge-cube"
         :class="`player_bg_color_${award.color}`"></div>

    <!--
      Teleport tooltip to <body> so it isn't clipped by the badge's circle
      or by any ancestor overflow constraints.
    -->
    <Teleport to="body">
      <div v-if="showTooltip" class="milestone-floating-tooltip" :style="tooltipStyle">
        <template v-if="award">
          <div class="milestone-floating-tooltip-name" v-i18n>{{ award.name }}</div>
          <div class="milestone-floating-tooltip-desc" v-i18n>{{ description }}</div>
          <div class="milestone-floating-tooltip-claimedby">
            <span v-i18n>funded by</span>
            <i class="board-cube" :class="`board-cube--${award.color}`"></i>
            <span>{{ award.playerName }}</span>
          </div>
          <!--
            Live race standings inside the tooltip. Players are sorted by
            score descending; the leader gets a green tint so the user can
            tell who's winning at a glance even when the overlay is closed.
          -->
          <!--
            Cubes are intentionally OMITTED from the rank rows — the funder
            cube above already shows whose award this is, and the player
            names themselves are unambiguous. Keeping each rank row to just
            "rank · name · score" makes the standings scan faster.
          -->
          <div v-if="sortedScores.length > 0" class="milestone-floating-tooltip-standings">
            <div v-for="(s, i) in sortedScores"
                 :key="s.color"
                 class="milestone-floating-tooltip-standings-row"
                 :class="{'milestone-floating-tooltip-standings-row--leader': isLeader(s, i)}">
              <span class="milestone-floating-tooltip-standings-rank">{{ i + 1 }}</span>
              <span class="milestone-floating-tooltip-standings-name">{{ playerName(s.color) }}</span>
              <span class="milestone-floating-tooltip-standings-score">{{ s.score }}</span>
            </div>
          </div>
        </template>
        <div v-else class="milestone-floating-tooltip-status">{{ emptyStatusText }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {FundedAwardModel, AwardScore} from '@/common/models/FundedAwardModel';
import {Color} from '@/common/Color';
import {MAX_AWARDS} from '@/common/constants';
import {getAward} from '@/client/MilestoneAwardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

type TooltipPos = {top: number; left: number};

export default defineComponent({
  name: 'AwardFundedBadge',
  props: {
    // Undefined = empty slot (no award funded yet at this position).
    award: {
      type: Object as PropType<FundedAwardModel | undefined>,
      default: undefined,
    },
    // Total funded awards across the game — for the empty-slot tooltip.
    fundedCount: {
      type: Number,
      required: true,
    },
    // Player list — used to resolve color → name for the standings rows.
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
  },
  data(): {showTooltip: boolean; tooltipPos: TooltipPos} {
    return {
      showTooltip: false,
      tooltipPos: {top: 0, left: 0},
    };
  },
  computed: {
    assetName(): string {
      if (!this.award) {
        return '';
      }
      return this.award.name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    badgeStyle(): Record<string, string> {
      if (!this.award) {
        return {};
      }
      return {backgroundImage: `url(assets/ma/${this.assetName}.png)`};
    },
    description(): string {
      if (!this.award) {
        return '';
      }
      return getAward(this.award.name).description;
    },
    sortedScores(): Array<AwardScore> {
      if (!this.award) {
        return [];
      }
      return [...this.award.scores].sort((x, y) => y.score - x.score);
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
    emptyStatusText(): string {
      return translateTextWithParams(
        'Funded ${0} of ${1} awards',
        [String(this.fundedCount), String(MAX_AWARDS)],
      );
    },
  },
  methods: {
    playerName(color: Color): string {
      return this.players.find((p) => p.color === color)?.name ?? color;
    },
    // A player is "the leader" if their score equals the top score AND that
    // top score is non-zero (so we don't paint everyone green at game start
    // when nobody has any qualifying tags / tiles yet).
    isLeader(s: AwardScore, _i: number): boolean {
      if (this.sortedScores.length === 0) {
        return false;
      }
      const top = this.sortedScores[0].score;
      return s.score === top && top > 0;
    },
    onEnter(e: MouseEvent): void {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const tooltipWidth = 300;
      const margin = 12;
      let left = rect.right + margin;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = rect.left - margin - tooltipWidth;
      }
      this.tooltipPos = {top: rect.bottom + 8, left};
      this.showTooltip = true;
    },
    onLeave(): void {
      this.showTooltip = false;
    },
  },
});
</script>
