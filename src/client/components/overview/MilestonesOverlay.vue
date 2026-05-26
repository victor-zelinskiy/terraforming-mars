<template>
  <div class="milestones-overlay">
    <div class="milestones-overlay-header">
      <div class="milestones-overlay-title" v-i18n>Milestones</div>
      <div class="milestones-overlay-status">
        <span class="milestones-overlay-status-label" v-i18n>Claimed</span>
        <span class="milestones-overlay-status-value">{{ claimedCount }} / {{ maxMilestones }}</span>
      </div>
      <div class="milestones-overlay-close" v-on:click="$emit('close')">✕</div>
    </div>

    <div class="milestones-overlay-list">
      <div v-for="m in milestones"
           :key="m.name"
           class="milestone-row"
           :class="rowClasses(m)"
           v-on:mouseenter="onRowEnter($event, m)"
           v-on:mouseleave="onRowLeave">
        <!-- Progress chip: current score / threshold (or '—' when claimed).
             Color reflects whether the viewer has met the threshold (green),
             is short (red), already claimed it (green), or lost it to someone
             else (red). -->
        <div class="milestone-row-count" :class="countClass(m)">
          {{ countLabel(m) }}
        </div>

        <!-- Milestone art (cropped to square, framed to match the sci-fi HUD).
             Re-uses the same 140×83 assets the legacy `.ma-name--*` tiles use. -->
        <div class="milestone-row-icon"
             :style="{backgroundImage: `url(assets/ma/${assetName(m.name)}.png)`}"></div>

        <!-- Name + per-player score chips beneath. -->
        <div class="milestone-row-body">
          <div class="milestone-row-name" v-i18n>{{ milestoneShortName(m.name) }}</div>
          <div v-if="m.scores.length > 0" class="milestone-row-scores">
            <span
              v-for="s in sortedScores(m)"
              :key="s.color"
              class="ma-score"
              :class="[
                `player_bg_color_${s.color}`,
                s.claimable ? 'claimable' : 'not-claimable',
                isCurrentLeader(s, m) ? 'score-leader' : '',
              ]"
              :title="playerName(s.color)"
            >{{ s.score }}</span>
          </div>
          <div v-if="m.playerName" class="milestone-row-claimedby">
            <span v-i18n>claimed by</span>
            <i class="board-cube" :class="`board-cube--${m.color}`"></i>
            <span>{{ m.playerName }}</span>
          </div>
        </div>

        <!--
          Right side: claim button. The button is RENDERED whenever the score
          threshold is met (server's `claimable` flag), and the disabled state
          + tooltip explain WHY it can't be clicked right now. This matches
          the action-rework approach in CLAUDE.md — tie the button to the
          server's action-availability logic, not to the radio-button render.
        -->
        <div class="milestone-row-action">
          <button v-if="isConceptuallyClaimable(m)"
                  class="milestone-claim-btn"
                  :class="{'milestone-claim-btn--disabled': claimBlockerReason(m) !== null}"
                  :disabled="claimBlockerReason(m) !== null"
                  :title="$t(claimBlockerReason(m) ?? 'Claim this milestone')"
                  v-on:click.stop="onClaimClick(m)">
            <span class="milestone-claim-btn-label" v-i18n>Claim</span>
            <span class="milestone-claim-btn-cost">
              <span class="milestone-claim-btn-cost-value">{{ milestoneCost }}</span>
              <span class="milestone-claim-btn-cost-mc">M€</span>
            </span>
          </button>
          <div v-else-if="m.playerName" class="milestone-row-claimed-badge" v-i18n>Claimed</div>
        </div>
      </div>
    </div>

    <!-- Single floating tooltip layer. Positioned with `position: fixed` so
         it can escape the dropdown's overflow and sit to the right of the
         hovered row without clipping. -->
    <div v-if="hoveredMilestone !== null"
         class="milestone-floating-tooltip"
         :style="tooltipStyle">
      <div class="milestone-floating-tooltip-name" v-i18n>{{ milestoneShortName(hoveredMilestone.name) }}</div>
      <div class="milestone-floating-tooltip-desc" v-i18n>{{ description(hoveredMilestone) }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ClaimedMilestoneModel, MilestoneScore} from '@/common/models/ClaimedMilestoneModel';
import {Color} from '@/common/Color';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {MILESTONE_COST, MAX_MILESTONES} from '@/common/constants';
import {getMilestone} from '@/client/MilestoneAwardManifest';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

type TooltipPos = {top: number; left: number};

export default defineComponent({
  name: 'MilestonesOverlay',
  props: {
    milestones: {
      type: Array as () => ReadonlyArray<ClaimedMilestoneModel>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    // Viewer's own player color — used to pick out "my count" and to decide
    // whether the claim button is enabled.
    thisPlayerColor: {
      type: String as () => Color,
      required: true,
    },
    // Set of milestone names that the player can claim right now (it's their
    // turn AND the action prompt currently offers each of them). Computed in
    // PlayerHome by walking the waitingFor tree.
    claimableNow: {
      type: Object as () => ReadonlySet<MilestoneName>,
      default: () => new Set(),
    },
    // Viewer's current M€ balance. Used to disambiguate the "button visible
    // but not in claimableNow" case: if the player can't afford the cost,
    // we surface that as the disabled-tooltip reason; otherwise it's a
    // turn/phase issue.
    thisPlayerMegacredits: {
      type: Number,
      required: true,
    },
    // Whether the viewer currently has any active prompt at all
    // (`playerView.waitingFor !== undefined`). When false, the blocker reason
    // is "not your turn"; when true but the milestone still isn't offered,
    // it's a cost / sub-prompt issue.
    viewerActing: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['claim', 'close'],
  data(): {hoveredMilestone: ClaimedMilestoneModel | null; tooltipPos: TooltipPos} {
    return {
      hoveredMilestone: null,
      tooltipPos: {top: 0, left: 0},
    };
  },
  computed: {
    milestoneCost(): number {
      return MILESTONE_COST;
    },
    maxMilestones(): number {
      return MAX_MILESTONES;
    },
    claimedCount(): number {
      return this.milestones.filter((m) => m.playerName).length;
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
  },
  methods: {
    myScore(m: ClaimedMilestoneModel): MilestoneScore | undefined {
      return m.scores.find((s) => s.color === this.thisPlayerColor);
    },
    // Prefer the per-game threshold the server sent (handles Terraformer's
    // 35/26 split under Turmoil); fall back to the static manifest value
    // for older payloads.
    threshold(m: ClaimedMilestoneModel): number | undefined {
      return m.threshold ?? getMilestone(m.name).threshold;
    },
    // What goes into the small left-side count chip.
    //  • Claimed: em-dash.
    //  • Active + known threshold: "score / threshold".
    //  • Active + unknown threshold (special-case milestones): just the score.
    countLabel(m: ClaimedMilestoneModel): string {
      if (m.playerName) return '—';
      const s = this.myScore(m);
      const score = s ? s.score : 0;
      const t = this.threshold(m);
      return t === undefined ? String(score) : `${score} / ${t}`;
    },
    // Colour state for the count chip:
    //  • mine — green: viewer already claimed it.
    //  • theirs — red: another player claimed it.
    //  • ready — green: viewer has reached / exceeded the threshold.
    //  • blocked — red: viewer is short.
    //  • neutral — default cyan (threshold unknown).
    countClass(m: ClaimedMilestoneModel): string {
      if (m.playerName) {
        return m.color === this.thisPlayerColor
          ? 'milestone-row-count--mine'
          : 'milestone-row-count--theirs';
      }
      const t = this.threshold(m);
      if (t === undefined) return 'milestone-row-count--neutral';
      const score = this.myScore(m)?.score ?? 0;
      return score >= t ? 'milestone-row-count--ready' : 'milestone-row-count--blocked';
    },
    rowClasses(m: ClaimedMilestoneModel): Record<string, boolean> {
      return {
        'milestone-row--claimed': !!m.playerName,
        // Highlight the row only when claim is ACTIVELY available — the
        // amber-glow accent is supposed to draw attention to a "you can do
        // this right now" action, not just a score-threshold hint.
        'milestone-row--claimable-by-me': this.claimableNow.has(m.name),
      };
    },
    sortedScores(m: ClaimedMilestoneModel): Array<MilestoneScore> {
      return [...m.scores].sort((a, b) => b.score - a.score);
    },
    // Whether `s` is currently tied for / sole leader on the milestone race.
    // Only meaningful for UNCLAIMED milestones — once someone claims, the
    // race is over and we drop the highlight entirely (the funder cube on
    // the row art already shows who took it).
    isCurrentLeader(s: MilestoneScore, m: ClaimedMilestoneModel): boolean {
      if (m.playerName) return false;
      if (m.scores.length === 0) return false;
      const top = Math.max(...m.scores.map((x) => x.score));
      return s.score === top && s.score > 0;
    },
    // Prefer the per-game description sent by the server (Terraformer varies
    // by Turmoil); fall back to the static manifest description.
    description(m: ClaimedMilestoneModel): string {
      return m.description ?? getMilestone(m.name).description;
    },
    // Strip the numeric suffix some milestones carry (matches Milestone.vue logic).
    milestoneShortName(name: MilestoneName): string {
      return name.replace(/[0-9]+$/, '');
    },
    // Maps milestone name → asset filename. Same transformation `.ma-name--*`
    // uses in player_home.less (lowercase, spaces→dashes, dots removed).
    assetName(name: MilestoneName): string {
      return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    // The milestone is "conceptually claimable" — its score threshold has
    // been met by the viewer and nobody has claimed it yet. The button is
    // RENDERED when this is true (even if the action isn't currently
    // available); the blocker reason below dictates whether it's enabled.
    isConceptuallyClaimable(m: ClaimedMilestoneModel): boolean {
      if (m.playerName) return false;
      return this.myScore(m)?.claimable === true;
    },
    // Returns null when the button should be enabled, otherwise the i18n
    // key for the blocker reason. The action is offered iff its name appears
    // in `claimableNow`; when it doesn't, we differentiate cost vs. turn so
    // the disabled tooltip gives the user a useful hint.
    claimBlockerReason(m: ClaimedMilestoneModel): string | null {
      if (this.claimableNow.has(m.name)) return null;
      if (!this.viewerActing) return 'Not your turn to take any actions';
      // Player has a prompt but milestone isn't offered: the server filters
      // out un-affordable milestones, so cost is the likely cause when the
      // viewer has fewer M€ than the canonical claim cost. (Variant costs
      // from Van Allen / Staged Protests are still served correctly — only
      // the displayed reason might be slightly off in those rare cases.)
      if (this.thisPlayerMegacredits < MILESTONE_COST) return 'Not enough M€';
      // Action menu probably isn't the active prompt right now (mid sub-
      // action, research phase, etc.).
      return 'Not your turn to take any actions';
    },
    onClaimClick(m: ClaimedMilestoneModel): void {
      if (this.claimBlockerReason(m) !== null) return;
      this.$emit('claim', m.name);
    },
    playerName(color: Color): string {
      return this.players.find((p) => p.color === color)?.name ?? color;
    },
    onRowEnter(e: MouseEvent, m: ClaimedMilestoneModel): void {
      const row = e.currentTarget as HTMLElement;
      const rect = row.getBoundingClientRect();
      // Position the tooltip to the right of the row, vertically aligned to
      // its top edge. If it would overflow the right of the viewport, flip
      // it to the LEFT side instead.
      const tooltipWidth = 280;
      const margin = 12;
      let left = rect.right + margin;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = rect.left - margin - tooltipWidth;
      }
      this.tooltipPos = {top: rect.top, left};
      this.hoveredMilestone = m;
    },
    onRowLeave(): void {
      this.hoveredMilestone = null;
    },
  },
});
</script>
