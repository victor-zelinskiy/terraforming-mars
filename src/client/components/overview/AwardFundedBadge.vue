<template>
  <div class="milestone-claimed-badge"
       :class="{'milestone-claimed-badge--filled': award !== undefined}"
       :style="badgeStyle"
       v-on:mouseenter="onEnter"
       v-on:mouseleave="onLeave">
    <!-- Primary marker = the current LEADER(S) of the award race (who would
         score its VP at game end), NOT the funder. Updates live as the race
         shifts; the funder stays in the tooltip below. Ties → a small stack of
         leader cubes. No leader yet (all zero) → no cube (neutral art). -->
    <div v-if="leaders.length > 0" class="milestone-claimed-badge-leaders">
      <div v-for="l in leaders.slice(0, 3)"
           :key="l.color"
           class="milestone-claimed-badge-cube"
           :class="`player_bg_color_${l.color}`"></div>
    </div>

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
            <player-cube :color="award.color" :size="14"></player-cube>
            <span>{{ award.playerName }}</span>
          </div>
          <!--
            Current race LEADER(S) — the player(s) who would score this award's
            VP at game end. This is who matters going forward, NOT the funder;
            tied top scores mean MULTIPLE co-leaders (they all score), so every
            one is listed.
          -->
          <div v-if="leaders.length > 0" class="milestone-floating-tooltip-leader">
            <span class="milestone-floating-tooltip-leader-label" v-i18n>Leader</span>
            <span v-for="l in leaders" :key="l.color" class="milestone-floating-tooltip-leader-name">
              <player-cube :color="l.color" :size="13"></player-cube>
              <span>{{ playerName(l.color) }}</span>
            </span>
            <span class="milestone-floating-tooltip-leader-score">{{ leaders[0].score }}</span>
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
import {awardLeaders} from '@/common/models/awardDisplay';
import {Color} from '@/common/Color';
import {MAX_AWARDS} from '@/common/constants';
import {getAward} from '@/client/MilestoneAwardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerCube from '@/client/components/PlayerCube.vue';

type TooltipPos = {top: number; left: number};

export default defineComponent({
  name: 'AwardFundedBadge',
  components: {
    'player-cube': PlayerCube,
  },
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
    // The current leader(s) via the SHARED derivation — every player tied at the
    // (non-zero) top score; these are exactly who scores this award's VP at game
    // end (a multi-way tie for 1st gives them all 5 VP).
    leaders(): Array<AwardScore> {
      return this.award ? awardLeaders(this.award.scores) : [];
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
    // A player is "the leader" iff they're in the shared leader set (top score,
    // non-zero) — the same derivation the plaque cube + the leader line use.
    isLeader(s: AwardScore, _i: number): boolean {
      return this.leaders.some((l) => l.color === s.color);
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
