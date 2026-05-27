<template>
  <div class="vp-overlay">
    <!-- Header row: player identity on the left, total VP capsule on the right. -->
    <div class="vp-overlay-header">
      <div class="vp-overlay-player">
        <div class="vp-overlay-player-cube" :class="'player_bg_color_' + displayedPlayer.color"></div>
        <div class="vp-overlay-player-name">{{ displayedPlayer.name }}</div>
      </div>
      <div class="vp-overlay-total">
        <div class="vp-overlay-total-label" v-i18n>Victory points</div>
        <div class="vp-overlay-total-value">{{ totalDisplay }}</div>
      </div>
    </div>

    <template v-if="!hidden">
      <!-- Summary tiles: one per VP source. Each shows source icon, value, label. -->
      <div class="vp-overlay-summary">
        <div class="vp-tile">
          <div class="vp-tile-icon vp-icon-tr"></div>
          <div class="vp-tile-value">{{ breakdown.terraformRating }}</div>
          <div class="vp-tile-label" v-i18n>TR</div>
        </div>
        <div class="vp-tile">
          <div class="vp-tile-icon vp-icon-ma">M</div>
          <div class="vp-tile-value">{{ breakdown.milestones }}</div>
          <div class="vp-tile-label" v-i18n>Milestones</div>
        </div>
        <div class="vp-tile">
          <div class="vp-tile-icon vp-icon-ma">A</div>
          <div class="vp-tile-value">{{ breakdown.awards }}</div>
          <div class="vp-tile-label" v-i18n>Awards</div>
        </div>
        <div class="vp-tile">
          <div class="vp-tile-icon vp-icon-forest"></div>
          <div class="vp-tile-value">{{ breakdown.greenery }}</div>
          <div class="vp-tile-label" v-i18n>Greenery</div>
        </div>
        <div class="vp-tile">
          <div class="vp-tile-icon vp-icon-city"></div>
          <div class="vp-tile-value">{{ breakdown.city }}</div>
          <div class="vp-tile-label" v-i18n>City</div>
        </div>
        <div class="vp-tile">
          <div class="vp-tile-icon vp-icon-cards"></div>
          <div class="vp-tile-value">{{ positiveCardVP }}</div>
          <div class="vp-tile-label" v-i18n>Cards</div>
        </div>
        <div v-if="game.moon !== undefined" class="vp-tile">
          <div class="vp-tile-icon vp-icon-moon"></div>
          <div class="vp-tile-value">{{ moonTotal }}</div>
          <div class="vp-tile-label" v-i18n>Moon</div>
        </div>
        <div v-if="game.pathfinders !== undefined" class="vp-tile">
          <div class="vp-tile-icon vp-icon-track">&#x25CB;</div>
          <div class="vp-tile-value">{{ breakdown.planetaryTracks }}</div>
          <div class="vp-tile-label" v-i18n>Tracks</div>
        </div>
        <div v-if="game.gameOptions.escapeVelocity && breakdown.escapeVelocity !== 0" class="vp-tile vp-tile--penalty">
          <div class="vp-tile-icon vp-icon-ev">&#x23F3;</div>
          <div class="vp-tile-value">{{ breakdown.escapeVelocity }}</div>
          <div class="vp-tile-label" v-i18n>Escape Velocity</div>
        </div>
        <div v-if="breakdown.negativeVP !== 0" class="vp-tile vp-tile--penalty">
          <div class="vp-tile-icon vp-icon-penalty">&minus;</div>
          <div class="vp-tile-value">{{ breakdown.negativeVP }}</div>
          <div class="vp-tile-label" v-i18n>Penalty</div>
        </div>
      </div>

      <!-- Detail columns: cards on the left, milestones/awards/tracks on the right. -->
      <div class="vp-overlay-details">
        <div class="vp-detail-section" v-if="breakdown.detailsCards.length > 0">
          <div class="vp-detail-title" v-i18n>From cards</div>
          <div class="vp-detail-list">
            <div v-for="d in breakdown.detailsCards" :key="d.cardName" class="vp-detail-row">
              <div class="vp-detail-vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</div>
              <div class="vp-detail-text" v-i18n>{{ d.cardName }}</div>
            </div>
          </div>
        </div>

        <div class="vp-detail-section"
             v-if="breakdown.detailsMilestones.length > 0 || breakdown.detailsAwards.length > 0 || breakdown.detailsPlanetaryTracks.length > 0">
          <div class="vp-detail-title" v-i18n>Milestones, awards & tracks</div>
          <div class="vp-detail-list">
            <div v-for="d in breakdown.detailsMilestones"
                 :key="'m-' + d.message"
                 class="vp-detail-row vp-detail-row--hoverable"
                 v-on:mouseenter="onRowEnter($event, milestoneTooltipFor(d))"
                 v-on:mouseleave="onRowLeave">
              <div class="vp-detail-vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</div>
              <div class="vp-detail-text">{{ translateMilestoneDetails(d) }}</div>
            </div>
            <div v-for="d in breakdown.detailsAwards"
                 :key="'a-' + d.message"
                 class="vp-detail-row vp-detail-row--hoverable"
                 v-on:mouseenter="onRowEnter($event, awardTooltipFor(d))"
                 v-on:mouseleave="onRowLeave">
              <div class="vp-detail-vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</div>
              <div class="vp-detail-text">{{ translateAwardDetails(d) }}</div>
            </div>
            <div v-for="d in breakdown.detailsPlanetaryTracks" :key="'t-' + d.tag" class="vp-detail-row">
              <div class="vp-detail-vp" :class="vpSignClass(d.points)">{{ formatVp(d.points) }}</div>
              <div class="vp-detail-text">{{ planetaryTrackText(d.tag) }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="vp-overlay-hidden">
      <div class="vp-overlay-hidden-icon">?</div>
      <div class="vp-overlay-hidden-text" v-i18n>
        Detailed victory points for other players are hidden during the game.
        Enable "Show other players' VP" in the game options, or wait until the game ends.
      </div>
    </div>

    <!-- Floating hover tooltip for milestone / award rows. Same visual style
         as the milestones overlay tooltip. Teleported to <body> so the
         vp-detail-section's overflow doesn't clip it. -->
    <Teleport to="body">
      <div v-if="hoveredTooltip !== null"
           class="milestone-floating-tooltip"
           :style="tooltipStyle">
        <div class="milestone-floating-tooltip-name" v-i18n>{{ hoveredTooltip.name }}</div>
        <div class="milestone-floating-tooltip-desc" v-i18n>{{ hoveredTooltip.description }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {MADetail, VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Tag} from '@/common/cards/Tag';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {AwardName} from '@/common/ma/AwardName';
import {$t, translateTextWithParams, translateMessage} from '@/client/directives/i18n';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';

type TooltipContent = {name: string; description: string};
type TooltipPos = {top: number; left: number};

export default defineComponent({
  name: 'VictoryPointsOverlay',
  props: {
    displayedPlayer: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    game: {
      type: Object as () => GameModel,
      required: true,
    },
    thisPlayerColor: {
      type: String as () => Color,
      required: true,
    },
  },
  data(): {hoveredTooltip: TooltipContent | null; tooltipPos: TooltipPos} {
    return {
      hoveredTooltip: null,
      tooltipPos: {top: 0, left: 0},
    };
  },
  computed: {
    breakdown(): VictoryPointsBreakdown {
      return this.displayedPlayer.victoryPointsBreakdown;
    },
    // Mirrors the visibility logic of `displayedVictoryPoints` in PlayerHome.
    // The server already zeroes-out breakdown fields when the viewing player
    // isn't allowed to see them, but we also hide the detail panes (which
    // would otherwise render an empty/misleading view).
    hidden(): boolean {
      return !this.game.gameOptions.showOtherPlayersVP &&
        this.displayedPlayer.color !== this.thisPlayerColor;
    },
    totalDisplay(): number | string {
      return this.hidden ? '?' : this.breakdown.total;
    },
    moonTotal(): number {
      return this.breakdown.moonHabitats + this.breakdown.moonMines + this.breakdown.moonRoads;
    },
    // Card-based VP split into positive / negative parts so the two
    // summary tiles ("Cards" / "Penalty") add up cleanly to the total
    // instead of visually overlapping. Server reports the *combined*
    // value in `breakdown.victoryPoints` and the *negative-only* slice
    // in `breakdown.negativeVP`; positive = combined − negative.
    //
    // Example: a card gives -1, server reports
    //   victoryPoints = -1, negativeVP = -1
    //   positiveCardVP = -1 - (-1) = 0  → Cards tile = 0
    //   negativeVP                = -1  → Penalty tile = -1
    // and the math reads naturally instead of "Cards -1 + Penalty -1 = -2"
    // confusion (when the actual total counts the -1 only once).
    positiveCardVP(): number {
      return this.breakdown.victoryPoints - this.breakdown.negativeVP;
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
  },
  methods: {
    // Sign-aware VP formatter for the per-row badges. Positive numbers get
    // a "+" prefix to make them feel like a bonus; negative numbers print
    // as-is (JS gives them a "-" already, so "+-1" is what we used to
    // show — visually jarring). Zero just prints "0".
    formatVp(n: number): string {
      if (n > 0) return `+${n}`;
      return String(n);
    },
    vpSignClass(n: number): string {
      if (n < 0) return 'vp-detail-vp--negative';
      return '';
    },
    translateMilestoneDetails(data: MADetail): string {
      const args = (data.messageArgs || []).map($t);
      return translateTextWithParams(data.message, args);
    },
    // Single-string translation so the word order around the tag name can flip
    // in non-English locales (e.g. Russian: "Лидерство по шкале ${0}").
    planetaryTrackText(tag: Tag): string {
      return translateTextWithParams('Most tags on the ${0} track', [$t(tag)]);
    },
    translateAwardDetails(data: MADetail): string {
      if (!data.messageArgs || data.messageArgs.length < 3) {
        return this.translateMilestoneDetails(data);
      }
      const message: Message = {
        message: data.message,
        data: [
          {type: LogMessageDataType.STRING, value: data.messageArgs[0]},
          {type: LogMessageDataType.AWARD, value: data.messageArgs[1] as AwardName},
          {type: LogMessageDataType.PLAYER, value: data.messageArgs[2] as Color},
        ],
      };
      return translateMessage(message);
    },
    // Tooltip content builders. The milestone/award name lives in messageArgs:
    //   • milestones: messageArgs = [milestoneName]
    //   • awards:     messageArgs = [place, awardName, fundedByPlayerName]
    // (See VictoryPointsBreakdownBuilder / calculateVictoryPoints.ts.)
    milestoneTooltipFor(d: MADetail): TooltipContent | null {
      const name = d.messageArgs?.[0];
      if (!name) return null;
      const data = getMilestone(name as MilestoneName);
      if (!data) return null;
      return {
        name: name.replace(/[0-9]+$/, ''),
        description: data.description,
      };
    },
    awardTooltipFor(d: MADetail): TooltipContent | null {
      const name = d.messageArgs?.[1];
      if (!name) return null;
      const data = getAward(name as AwardName);
      if (!data) return null;
      return {
        name: name.replace(/[0-9]+$/, ''),
        description: data.description,
      };
    },
    onRowEnter(e: MouseEvent, tooltip: TooltipContent | null): void {
      if (tooltip === null) return;
      const row = e.currentTarget as HTMLElement;
      const rect = row.getBoundingClientRect();
      const tooltipWidth = 280;
      const tooltipMaxHeight = 220;
      const margin = 10;
      // Three-tier preferred placement: right → left → below-cursor.
      let top = rect.top;
      let left = rect.right + margin;
      const fitsRight = (rect.right + margin + tooltipWidth) <= (window.innerWidth - margin);
      if (!fitsRight) {
        const leftSide = rect.left - margin - tooltipWidth;
        if (leftSide >= margin) {
          left = leftSide;
        } else {
          // Wide rows (VP overlay spans the play area) leave no room on
          // either side — fall back to BELOW the row, anchored to the
          // cursor horizontally.
          top = rect.bottom + margin;
          left = e.clientX;
        }
      }
      // Final safety clamp — no matter which branch we took, guarantee the
      // tooltip lands fully inside the viewport. Catches edge cases where
      // intermediate math produced negative coordinates.
      const maxLeft = window.innerWidth - tooltipWidth - margin;
      const maxTop = window.innerHeight - tooltipMaxHeight - margin;
      this.tooltipPos = {
        top: Math.max(margin, Math.min(top, maxTop)),
        left: Math.max(margin, Math.min(left, maxLeft)),
      };
      this.hoveredTooltip = tooltip;
    },
    onRowLeave(): void {
      this.hoveredTooltip = null;
    },
  },
});
</script>
