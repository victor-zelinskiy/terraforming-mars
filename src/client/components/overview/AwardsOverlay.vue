<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <div class="awards-overlay">
    <div class="awards-overlay-header">
      <div class="awards-overlay-title" v-i18n>Awards</div>
      <div class="awards-overlay-status">
        <span class="awards-overlay-status-label" v-i18n>Funded</span>
        <span class="awards-overlay-status-value">{{ fundedCount }} / {{ maxAwards }}</span>
      </div>
      <div class="awards-overlay-cost" v-if="!allFunded">
        <span class="awards-overlay-cost-label" v-i18n>Cost</span>
        <span v-if="freeFunding" class="awards-overlay-cost-free" v-i18n>Free</span>
        <span v-else class="mc-coin mc-coin--sm awards-overlay-cost-coin">{{ nextFundingCost }}</span>
      </div>
      <div class="awards-overlay-close" v-on:click="$emit('close')">✕</div>
    </div>

    <!-- Free-sponsorship mode banner (Vitor start action). -->
    <div v-if="freeFunding" class="awards-overlay-free-banner">
      <span class="awards-overlay-free-chip" v-i18n>Free sponsorship</span>
      <span class="awards-overlay-free-hint" v-i18n>Choose an award to sponsor for free.</span>
    </div>

    <div class="awards-overlay-list">
      <div v-for="a in awards"
           :key="a.name"
           class="award-row"
           :class="rowClasses(a)"
           v-on:mouseenter="onRowEnter($event, a)"
           v-on:mouseleave="onRowLeave">
        <!--
          Progress chip: viewer's score / leader's score.
          Awards are a race-to-the-end-of-game, never "locked in" — so the
          chip only signals leadership. Green = viewer leading (or tied),
          red = viewer behind, neutral = no race active yet.
        -->
        <div class="award-row-count" :class="countClass(a)">
          {{ countLabel(a) }}
        </div>

        <!-- Award art (cropped to octagonal HUD silhouette). -->
        <div class="award-row-icon"
             :style="{backgroundImage: `url(assets/ma/${assetName(a.name)}.png)`}">
          <!-- Tiny funder cube overlapping the art, if the award is funded. -->
          <div v-if="a.playerName"
               class="award-row-funder-marker"
               :class="`player_bg_color_${a.color}`"
               :title="a.playerName"></div>
        </div>

        <div class="award-row-body">
          <div class="award-row-name" v-i18n>{{ a.name }}</div>
          <div v-if="a.scores.length > 0" class="award-row-scores">
            <span
              v-for="s in rivalSortedScores(a)"
              :key="s.color"
              class="ma-score"
              :class="[
                `player_bg_color_${s.color}`,
                isLeaderScore(s, sortedScores(a)) ? 'score-leader' : '',
              ]"
              :title="playerName(s.color)"
            >{{ s.score }}</span>
          </div>
          <div v-if="a.playerName" class="award-row-fundedby">
            <span v-i18n>funded by</span>
            <player-cube :color="a.color" :size="14"></player-cube>
            <span>{{ playerName(a.color) }}</span>
          </div>
        </div>

        <!--
          Right side: fund button OR "funded" badge.
          Button is rendered whenever the award is still fundable (not yet
          funded AND not all slots used). Disabled state + tooltip explains
          blockers (turn / cost) — same pattern as milestone claim.
        -->
        <div class="award-row-action">
          <button v-if="isConceptuallyFundable(a)"
                  class="award-fund-btn"
                  :class="{'award-fund-btn--disabled': fundBlockerReason(a) !== null}"
                  :disabled="fundBlockerReason(a) !== null"
                  :title="$t(fundBlockerReason(a) ?? 'Fund this award')"
                  v-on:click.stop="onFundClick(a)">
            <span class="award-fund-btn-label" v-i18n>Fund</span>
            <span class="award-fund-btn-cost">
              <span class="mc-coin mc-coin--sm">{{ effectiveCost }}</span>
            </span>
          </button>
          <div v-else-if="a.playerName" class="award-row-funded-badge" v-i18n>Funded</div>
        </div>
      </div>
    </div>

    <!-- Floating description tooltip; teleported to <body> so it isn't
         clipped by the dropdown's overflow / corner ticks. -->
    <Teleport to="body">
      <div v-if="hoveredAward !== null"
           class="milestone-floating-tooltip"
           :style="tooltipStyle">
        <div class="milestone-floating-tooltip-name" v-i18n>{{ hoveredAward.name }}</div>
        <div class="milestone-floating-tooltip-desc" v-i18n>{{ description(hoveredAward.name) }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {FundedAwardModel, AwardScore} from '@/common/models/FundedAwardModel';
import {Color} from '@/common/Color';
import {AwardName} from '@/common/ma/AwardName';
import {AWARD_COSTS, MAX_AWARDS} from '@/common/constants';
import {getAward} from '@/client/MilestoneAwardManifest';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';

type TooltipPos = {top: number; left: number};

export default defineComponent({
  name: 'AwardsOverlay',
  components: {
    'player-cube': PlayerCube,
  },
  props: {
    awards: {
      type: Array as () => ReadonlyArray<FundedAwardModel>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    thisPlayerColor: {
      type: String as () => Color,
      required: true,
    },
    thisPlayerMegacredits: {
      type: Number,
      required: true,
    },
    viewerActing: {
      type: Boolean,
      required: true,
    },
    // Set of award names the player can fund right THIS instant (it's their
    // turn AND the action prompt currently offers each of them). Computed
    // in PlayerHome by walking the waitingFor tree for a "Fund an award" OR.
    fundableNow: {
      type: Object as PropType<ReadonlySet<AwardName>>,
      default: () => new Set(),
    },
    fundedCount: {
      type: Number,
      required: true,
    },
    // FREE-sponsorship mode (Vitor's start action funds an award for free). Adds
    // the "free sponsorship" banner, shows the cost as 0 / Free, and drops the
    // M€ affordability check. The overlay is auto-opened + minimizable-to-pill by
    // PlayerHome via awardFundingState; the tiles + fund flow are unchanged.
    freeFunding: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['fund', 'close'],
  data(): {hoveredAward: FundedAwardModel | null; tooltipPos: TooltipPos} {
    return {
      hoveredAward: null,
      tooltipPos: {top: 0, left: 0},
    };
  },
  computed: {
    maxAwards(): number {
      return MAX_AWARDS;
    },
    allFunded(): boolean {
      return this.fundedCount >= MAX_AWARDS;
    },
    // The cost of funding the NEXT award (the prompt cost). Server uses
    // `8 + 6 * fundedAwards.length`, exposed as the AWARD_COSTS array.
    nextFundingCost(): number {
      const idx = Math.min(this.fundedCount, AWARD_COSTS.length - 1);
      return AWARD_COSTS[idx];
    },
    // What the fund button + tooltip should display: 0 in free-sponsorship mode,
    // else the normal next-award cost.
    effectiveCost(): number {
      return this.freeFunding ? 0 : this.nextFundingCost;
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
  },
  methods: {
    /** P23: the badge strip shows OTHER players only — the viewer's own
     *  number is the big score chip; leaders still rank vs everyone. */
    rivalSortedScores(a: FundedAwardModel): Array<AwardScore> {
      return this.sortedScores(a).filter((s) => s.color !== this.thisPlayerColor);
    },
    sortedScores(a: FundedAwardModel): Array<AwardScore> {
      return [...a.scores].sort((x, y) => y.score - x.score);
    },
    myScore(a: FundedAwardModel): AwardScore | undefined {
      return a.scores.find((s) => s.color === this.thisPlayerColor);
    },
    leaderScore(a: FundedAwardModel): number {
      if (a.scores.length === 0) {
        return 0;
      }
      return Math.max(...a.scores.map((s) => s.score));
    },
    isLeaderScore(s: AwardScore, sorted: Array<AwardScore>): boolean {
      if (sorted.length === 0) {
        return false;
      }
      // Tied leaders all count as leading. A 0-vs-0 game start isn't
      // leadership — only counts once someone has a non-zero score.
      return s.score === sorted[0].score && s.score > 0;
    },
    // Awards don't have a fixed target threshold (it's a race-to-end-of-game),
    // so we show only the viewer's own score in the chip. Leadership status
    // is encoded in the chip's color modifier (`countClass`) instead.
    countLabel(a: FundedAwardModel): string {
      if (a.scores.length === 0) {
        return '–';
      }
      const mine = this.myScore(a)?.score ?? 0;
      return String(mine);
    },
    countClass(a: FundedAwardModel): string {
      if (a.scores.length === 0) {
        return 'award-row-count--neutral';
      }
      const mine = this.myScore(a)?.score ?? 0;
      const leader = this.leaderScore(a);
      if (mine === 0 && leader === 0) {
        return 'award-row-count--neutral';
      }
      return mine >= leader ? 'award-row-count--leading' : 'award-row-count--behind';
    },
    rowClasses(a: FundedAwardModel): Record<string, boolean> {
      return {
        'award-row--funded': !!a.playerName,
        'award-row--fundable-by-me': this.fundableNow.has(a.name),
      };
    },
    description(name: AwardName): string {
      return getAward(name).description;
    },
    assetName(name: AwardName): string {
      return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    playerName(color: Color | undefined): string {
      return displayNameForColor(this.players, color);
    },
    /**
     * Conceptually fundable: the award itself is still up for grabs AND
     * there's still room in the 3-award pool. The action button is
     * RENDERED whenever this returns true; the disabled-state tooltip
     * (`fundBlockerReason`) explains why it can't be clicked right now
     * (cost / turn / sub-action).
     */
    isConceptuallyFundable(a: FundedAwardModel): boolean {
      return !a.playerName && !this.allFunded;
    },
    fundBlockerReason(a: FundedAwardModel): string | null {
      if (this.fundableNow.has(a.name)) {
        return null;
      }
      if (!this.viewerActing) {
        return 'Not your turn to take any actions';
      }
      // Free sponsorship costs nothing — never block on M€.
      if (!this.freeFunding && this.thisPlayerMegacredits < this.nextFundingCost) {
        return 'Not enough M€';
      }
      // Viewer IS acting and has the money, but the prompt-tree doesn't
      // currently surface the fund action (mid sub-prompt, special phase,
      // etc.). Don't lie about it being someone else's turn — give a
      // generic "complete what you're doing first" hint instead.
      return 'Finish your current action first';
    },
    onFundClick(a: FundedAwardModel): void {
      if (this.fundBlockerReason(a) !== null) {
        return;
      }
      this.$emit('fund', a.name);
    },
    onRowEnter(e: MouseEvent, a: FundedAwardModel): void {
      const row = e.currentTarget as HTMLElement;
      const rect = row.getBoundingClientRect();
      const tooltipWidth = 280;
      const margin = 12;
      let left = rect.right + margin;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = rect.left - margin - tooltipWidth;
      }
      this.tooltipPos = {top: rect.top, left};
      this.hoveredAward = a;
    },
    onRowLeave(): void {
      this.hoveredAward = null;
    },
  },
});
</script>
