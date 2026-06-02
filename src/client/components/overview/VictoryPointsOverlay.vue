<template>
  <!--
    Premium victory-points "score report". Self-contained overlay (its own
    glass frame + corner ticks + header + close button), mirroring the
    Journal / Played-cards premium overlays. Mounted directly by PlayerHome
    with @close (NOT wrapped in the legacy .bar-overlay chrome).

    Three reading levels:
      1. hero — the grand total (large, soft glow) + a composition bar.
      2. breakdown — one accent-coded row per VP source, values aligned.
      3. sources — card chips (with hover preview / zoom) + milestone /
         award / track detail rows (with hover tooltip).

    Data + scoring are untouched: everything reads from
    `displayedPlayer.victoryPointsBreakdown`.
  -->
  <div class="vp-board-overlay" role="region" :aria-label="$t('Victory points')">
    <span class="vp-board-overlay__corner vp-board-overlay__corner--tl" aria-hidden="true"></span>
    <span class="vp-board-overlay__corner vp-board-overlay__corner--tr" aria-hidden="true"></span>
    <span class="vp-board-overlay__corner vp-board-overlay__corner--bl" aria-hidden="true"></span>
    <span class="vp-board-overlay__corner vp-board-overlay__corner--br" aria-hidden="true"></span>

    <header class="vp-board__header">
      <div class="vp-board__context">
        <span class="vp-board__glyph" aria-hidden="true"></span>
        <h2 class="vp-board__title" v-i18n>Victory points</h2>
        <span v-if="viewingOther" class="vp-board__viewing" v-i18n>Viewing</span>
        <span class="vp-board__player"
              :class="'player_translucent_bg_color_' + displayedPlayer.color">
          <span class="vp-board__player-dot" :class="'player_bg_color_' + displayedPlayer.color" aria-hidden="true"></span>
          {{ displayedPlayer.name }}
        </span>
      </div>
      <button type="button" class="vp-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <div class="vp-board__body">
      <!-- Hidden: other players' detailed VP isn't visible mid-game. -->
      <div v-if="hidden" class="vp-hidden">
        <div class="vp-hidden__icon" aria-hidden="true">?</div>
        <div class="vp-hidden__text" v-i18n>
          Detailed victory points for other players are hidden during the game.
          Enable "Show other players' VP" in the game options, or wait until the game ends.
        </div>
      </div>

      <div v-else class="vp-dashboard">
        <!-- ── Hero band: the grand total + composition bar ───────────── -->
        <div class="vp-hero">
          <div class="vp-hero__figure">
            <div class="vp-hero__label" v-i18n>Total</div>
            <div class="vp-hero__value" :class="{'vp-hero__value--negative': breakdown.total < 0}">{{ displayedTotal }}</div>
            <div class="vp-hero__unit" v-i18n>VP</div>
          </div>
          <div class="vp-hero__composition" v-if="compositionSegments.length > 0">
            <div class="vp-hero__bar" role="img" :aria-label="$t('Victory points')">
              <span v-for="seg in compositionSegments" :key="seg.key"
                    class="vp-hero__seg" :class="'vp-accent--' + seg.accent"
                    :style="{flexGrow: seg.value}"></span>
            </div>
          </div>
        </div>

        <!-- ── Columns: breakdown (left) + sources (right) ────────────── -->
        <div class="vp-columns" :class="{'vp-columns--solo': !hasSources}">
          <section class="vp-breakdown">
            <ul class="vp-breakdown__list">
              <li v-for="(cat, i) in categories" :key="cat.key"
                  class="vp-cat"
                  :class="['vp-accent--' + cat.accent, {'vp-cat--zero': cat.value === 0, 'vp-cat--penalty': cat.penalty}]"
                  :style="staggerStyle(i)">
                <span class="vp-cat__icon" :class="cat.iconClass" aria-hidden="true">{{ cat.iconGlyph }}</span>
                <span class="vp-cat__name" v-i18n>{{ cat.label }}</span>
                <span class="vp-cat__value" :class="vpSignClass(cat.value)">{{ formatVp(cat.value) }}</span>
              </li>
            </ul>
          </section>

          <section class="vp-sources" v-if="hasSources">
            <div class="vp-source" v-if="breakdown.detailsCards.length > 0">
              <h3 class="vp-section-title" v-i18n>From cards</h3>
              <div class="vp-source__list">
                <div v-for="(d, i) in breakdown.detailsCards" :key="'c-' + d.cardName + '-' + i"
                     class="vp-source-row" :style="staggerStyle(i)">
                  <span class="vp-source-row__main">
                    <JournalCardChip v-if="isCard(d.cardName)" :name="asCardName(d.cardName)" />
                    <span v-else class="vp-source-chip vp-source-chip--system">
                      <span class="vp-source-chip__dot" aria-hidden="true"></span>
                      <span class="vp-source-chip__label" v-i18n>{{ d.cardName }}</span>
                    </span>
                  </span>
                  <span class="vp-source-row__vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</span>
                </div>
              </div>
            </div>

            <div class="vp-source" v-if="hasMaTracks">
              <h3 class="vp-section-title" v-i18n>Milestones, awards &amp; tracks</h3>
              <div class="vp-source__list">
                <div v-for="d in breakdown.detailsMilestones"
                     :key="'m-' + d.message + (d.messageArgs ? d.messageArgs.join() : '')"
                     class="vp-source-row vp-source-row--hoverable"
                     v-on:mouseenter="onRowEnter($event, milestoneTooltipFor(d))"
                     v-on:mouseleave="onRowLeave">
                  <span class="vp-source-row__main">
                    <span class="vp-source-chip vp-source-chip--milestone">
                      <span class="vp-source-chip__dot" aria-hidden="true"></span>
                      <span class="vp-source-chip__label">{{ translateMilestoneDetails(d) }}</span>
                    </span>
                  </span>
                  <span class="vp-source-row__vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</span>
                </div>
                <div v-for="d in breakdown.detailsAwards"
                     :key="'a-' + d.message + (d.messageArgs ? d.messageArgs.join() : '')"
                     class="vp-source-row vp-source-row--hoverable"
                     v-on:mouseenter="onRowEnter($event, awardTooltipFor(d))"
                     v-on:mouseleave="onRowLeave">
                  <span class="vp-source-row__main">
                    <span class="vp-source-chip vp-source-chip--award">
                      <span class="vp-source-chip__dot" aria-hidden="true"></span>
                      <span class="vp-source-chip__label">{{ translateAwardDetails(d) }}</span>
                    </span>
                  </span>
                  <span class="vp-source-row__vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</span>
                </div>
                <div v-for="d in breakdown.detailsPlanetaryTracks" :key="'t-' + d.tag" class="vp-source-row">
                  <span class="vp-source-row__main">
                    <span class="vp-source-chip vp-source-chip--track">
                      <span class="vp-source-chip__dot" aria-hidden="true"></span>
                      <span class="vp-source-chip__label">{{ planetaryTrackText(d.tag) }}</span>
                    </span>
                  </span>
                  <span class="vp-source-row__vp" :class="vpSignClass(d.points)">{{ formatVp(d.points) }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Floating hover tooltip for milestone / award rows. Shared visual
         style with the milestones overlay tooltip; teleported to <body> so
         the source list's overflow doesn't clip it. -->
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
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {AwardName} from '@/common/ma/AwardName';
import {$t, translateTextWithParams, translateMessage} from '@/client/directives/i18n';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';

type TooltipContent = {name: string; description: string};
type TooltipPos = {top: number; left: number};

// One row of the breakdown list / one segment of the composition bar.
type Category = {
  key: string;
  accent: string;
  label: string;
  value: number;
  iconClass: string;
  iconGlyph?: string;
  penalty?: boolean;
};

// Count-up duration for the hero total (ms).
const COUNT_UP_MS = 650;

// Module-level so the hero count-up plays only the FIRST time a given
// (player, total) is shown. PlayerHome remounts on every server poll
// (App.vue `:key="playerkey"`), which would otherwise re-count the number
// distractingly during opponent turns. A genuinely new value (player switch
// or score change) re-animates.
let lastAnimatedKey: string | undefined;

export default defineComponent({
  name: 'VictoryPointsOverlay',
  components: {JournalCardChip},
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
  emits: ['close'],
  data(): {
    hoveredTooltip: TooltipContent | null;
    tooltipPos: TooltipPos;
    displayedTotal: number;
    rafId: number | undefined;
    } {
    return {
      hoveredTooltip: null,
      tooltipPos: {top: 0, left: 0},
      displayedTotal: 0,
      rafId: undefined,
    };
  },
  computed: {
    breakdown(): VictoryPointsBreakdown {
      return this.displayedPlayer.victoryPointsBreakdown;
    },
    // Mirrors the visibility logic of `displayedVictoryPoints` in PlayerHome.
    // The server already zeroes-out breakdown fields when the viewing player
    // isn't allowed to see them; we also hide the detail panes (which would
    // otherwise render an empty / misleading view).
    hidden(): boolean {
      return !this.game.gameOptions.showOtherPlayersVP &&
        this.displayedPlayer.color !== this.thisPlayerColor;
    },
    viewingOther(): boolean {
      return this.displayedPlayer.color !== this.thisPlayerColor;
    },
    moonTotal(): number {
      return this.breakdown.moonHabitats + this.breakdown.moonMines + this.breakdown.moonRoads;
    },
    // Card-based VP split into positive / negative parts so the "Cards"
    // category and the "Penalty" category add up cleanly to the total
    // instead of visually overlapping. Server reports the *combined* value
    // in `breakdown.victoryPoints` and the *negative-only* slice in
    // `breakdown.negativeVP`; positive = combined − negative.
    positiveCardVP(): number {
      return this.breakdown.victoryPoints - this.breakdown.negativeVP;
    },
    // The ordered breakdown rows. Core six are always shown (dimmed at 0);
    // expansion / penalty rows appear only when relevant.
    categories(): Array<Category> {
      const b = this.breakdown;
      const cats: Array<Category> = [
        {key: 'tr', accent: 'tr', label: 'TR', value: b.terraformRating, iconClass: 'vp-icon-tr'},
        {key: 'milestones', accent: 'milestones', label: 'Milestones', value: b.milestones, iconClass: 'vp-icon-ma', iconGlyph: 'M'},
        {key: 'awards', accent: 'awards', label: 'Awards', value: b.awards, iconClass: 'vp-icon-ma vp-icon-ma--award', iconGlyph: 'A'},
        {key: 'greenery', accent: 'greenery', label: 'Greenery', value: b.greenery, iconClass: 'vp-icon-forest'},
        {key: 'city', accent: 'city', label: 'City', value: b.city, iconClass: 'vp-icon-city'},
        {key: 'cards', accent: 'cards', label: 'Cards', value: this.positiveCardVP, iconClass: 'vp-icon-cards'},
      ];
      if (this.game.moon !== undefined) {
        cats.push({key: 'moon', accent: 'moon', label: 'Moon', value: this.moonTotal, iconClass: 'vp-icon-moon'});
      }
      if (this.game.pathfinders !== undefined) {
        cats.push({key: 'tracks', accent: 'tracks', label: 'Tracks', value: b.planetaryTracks, iconClass: 'vp-icon-track', iconGlyph: '○'});
      }
      if (this.game.gameOptions.escapeVelocity && b.escapeVelocity !== 0) {
        cats.push({key: 'ev', accent: 'penalty', label: 'Escape Velocity', value: b.escapeVelocity, iconClass: 'vp-icon-ev', iconGlyph: '⏳', penalty: true});
      }
      if (b.negativeVP !== 0) {
        cats.push({key: 'penalty', accent: 'penalty', label: 'Penalty', value: b.negativeVP, iconClass: 'vp-icon-penalty', iconGlyph: '−', penalty: true});
      }
      return cats;
    },
    // Positive categories only — the composition bar shows "where the points
    // come from". `flex-grow` is the raw value so segment widths are exactly
    // proportional with no manual percentage math.
    compositionSegments(): Array<{key: string; accent: string; value: number}> {
      return this.categories
        .filter((c) => c.value > 0)
        .map((c) => ({key: c.key, accent: c.accent, value: c.value}));
    },
    hasMaTracks(): boolean {
      return this.breakdown.detailsMilestones.length > 0 ||
        this.breakdown.detailsAwards.length > 0 ||
        this.breakdown.detailsPlanetaryTracks.length > 0;
    },
    hasSources(): boolean {
      return this.breakdown.detailsCards.length > 0 || this.hasMaTracks;
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
    // Changes whenever the viewed player, total, or hidden-state changes —
    // the watch trigger that re-runs the hero count-up (see watch.heroKey).
    heroKey(): string {
      return `${this.displayedPlayer.color}:${this.hidden ? 'hidden' : this.breakdown.total}`;
    },
  },
  watch: {
    // Switching the viewed player is a CLIENT-side change: no server poll, so
    // PlayerHome doesn't remount and mounted() won't re-fire. The hero total
    // is a data field (set in animateTotal), so without this it would keep
    // showing the previously-viewed player's score while the rest of the
    // overlay (reactive off `breakdown`) updates. Re-run on any real change.
    heroKey(): void {
      this.animateTotal();
    },
  },
  methods: {
    // Sign-aware VP formatter. Positive numbers get a "+" so they read as a
    // bonus; negatives print their own "-"; zero prints "0".
    formatVp(n: number): string {
      if (n > 0) {
        return `+${n}`;
      }
      return String(n);
    },
    vpSignClass(n: number): string {
      if (n < 0) {
        return 'vp-value--negative';
      }
      if (n > 0) {
        return 'vp-value--positive';
      }
      return 'vp-value--zero';
    },
    // True when the detail entry names a real card (so we can render the
    // premium card chip with hover-preview + zoom). Non-card sources
    // (Turmoil Points, Colony VP, Underworld bribe, …) get a plain chip.
    isCard(name: string): boolean {
      return getCard(name as CardName) !== undefined;
    },
    // The breakdown reports card sources as plain strings; real cards are
    // re-typed for the (CardName-typed) JournalCardChip prop. `isCard`
    // gates this so only genuine cards reach the chip.
    asCardName(name: string): CardName {
      return name as CardName;
    },
    staggerStyle(i: number): Record<string, string> {
      return {animationDelay: `${i * 0.035}s`};
    },
    translateMilestoneDetails(data: MADetail): string {
      const args = (data.messageArgs || []).map($t);
      return translateTextWithParams(data.message, args);
    },
    // Single-string translation so the word order around the tag name can
    // flip in non-English locales (e.g. Russian: "Лидерство по шкале ${0}").
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
    // Tooltip content builders. The milestone / award name lives in
    // messageArgs:
    //   • milestones: messageArgs = [milestoneName]
    //   • awards:     messageArgs = [place, awardName, fundedByPlayerName]
    milestoneTooltipFor(d: MADetail): TooltipContent | null {
      const name = d.messageArgs?.[0];
      if (!name) {
        return null;
      }
      const data = getMilestone(name as MilestoneName);
      if (!data) {
        return null;
      }
      return {
        name: name.replace(/[0-9]+$/, ''),
        description: data.description,
      };
    },
    awardTooltipFor(d: MADetail): TooltipContent | null {
      const name = d.messageArgs?.[1];
      if (!name) {
        return null;
      }
      const data = getAward(name as AwardName);
      if (!data) {
        return null;
      }
      return {
        name: name.replace(/[0-9]+$/, ''),
        description: data.description,
      };
    },
    onRowEnter(e: MouseEvent, tooltip: TooltipContent | null): void {
      if (tooltip === null) {
        return;
      }
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
          top = rect.bottom + margin;
          left = e.clientX;
        }
      }
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
    // Count the hero total up from 0 on open (easeOutCubic). Snaps instantly
    // when reduced-motion is requested or the value is hidden.
    animateTotal(): void {
      // Cancel any in-flight count-up so a rapid re-trigger (e.g. switching
      // the viewed player mid-animation) doesn't leave two RAF loops fighting
      // over `displayedTotal`.
      if (this.rafId !== undefined) {
        cancelAnimationFrame(this.rafId);
        this.rafId = undefined;
      }
      const target = this.hidden ? 0 : this.breakdown.total;
      const key = `${this.displayedPlayer.color}:${target}`;
      // Snap (no count-up) when hidden, reduced-motion, or this exact value
      // was already animated on a prior mount of the same overlay session.
      if (this.hidden || prefersReducedMotion() || lastAnimatedKey === key) {
        this.displayedTotal = target;
        lastAnimatedKey = key;
        return;
      }
      lastAnimatedKey = key;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / COUNT_UP_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        this.displayedTotal = Math.round(target * eased);
        if (t < 1) {
          this.rafId = requestAnimationFrame(step);
        } else {
          this.displayedTotal = target;
          this.rafId = undefined;
        }
      };
      this.rafId = requestAnimationFrame(step);
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') {
        return;
      }
      // Let an open fullscreen card (native <dialog> from a card chip's
      // CardZoomModal) take Escape first.
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      this.$emit('close');
    },
  },
  mounted(): void {
    this.animateTotal();
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
