<template>
  <!--
    Premium victory-points "score report". Self-contained overlay (its own
    glass frame + corner ticks + header + close button), mirroring the
    Journal / Played-cards premium overlays.

    Reading levels:
      1. hero    — the grand total (large, soft glow).
      2. scales  — the breakdown BARS (TR / cards / cities+greenery /
                   milestones+awards, plus expansion bars). All share one
                   px-per-VP scale so their lengths read as "what carried the
                   game"; each bar splits into colour SEGMENTS.
      3. detail  — per-bar legend+detail cards (TR by reason, cities/greenery,
                   milestones/awards/tracks) + the multi-column "from cards"
                   list grouped by VP family, penalties last.

    Scoring stays on the server; this reads `displayedPlayer.victoryPointsBreakdown`
    (now carrying TR-by-reason + per-card `kind`) and lays it out via the pure
    `victoryPointsModel` builder.
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
      <div class="vp-board__tools">
        <!-- LOCAL privacy toggle: hide MY VP on passive surfaces (button / panel),
             never inside this overlay. Only for a real player (not a spectator). -->
        <button v-if="canPrivacy" type="button" class="vp-board__privacy"
                :class="{'vp-board__privacy--on': privateOn}"
                :aria-pressed="privateOn"
                :title="privateOn ? $t('Your VP are hidden on the panel and the score button. They stay visible inside this overlay.') : $t('Hide your VP on the panel and the score button')"
                @click="togglePrivacy">
          <svg class="vp-board__privacy-eye" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
            <path d="M1 8s4-6 11-6 11 6 11 6-4 6-11 6S1 8 1 8z" fill="none" />
            <circle cx="12" cy="8" r="2.4" />
            <line v-if="privateOn" x1="3" y1="2.5" x2="21" y2="13.5" />
          </svg>
          <span class="vp-board__privacy-label" v-i18n>{{ privateOn ? 'Score hidden' : 'Private score' }}</span>
        </button>
        <button type="button" class="vp-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
      </div>
    </header>

    <div class="vp-board__body">
      <!-- Hidden-VP mode, game still running: a premium secure lock in place of
           the score report (other players' VP are revealed at final scoring). -->
      <HiddenVictoryPointsLock v-if="locked" @close="$emit('close')" />

      <div v-else class="vp-dashboard">
        <!-- ── Hero band: the grand total ─────────────────────────────── -->
        <div class="vp-hero">
          <div class="vp-hero__figure">
            <div class="vp-hero__label" v-i18n>Total</div>
            <div class="vp-hero__value" :class="{'vp-hero__value--negative': breakdown.total < 0}">{{ displayedTotal }}</div>
            <div class="vp-hero__unit" v-i18n>VP</div>
          </div>
        </div>

        <!-- ── Scales: the breakdown bars (shared px-per-VP scale) ─────── -->
        <section class="vp-scales" :aria-label="$t('Victory points')">
          <div v-for="scale in model.scales" :key="scale.key"
               class="vp-scale" :class="{'vp-scale--zero': scale.positiveTotal === 0 && scale.penaltyTotal === 0}">
            <div class="vp-scale__head">
              <span class="vp-scale__name" v-i18n>{{ scale.label }}</span>
              <span class="vp-scale__value" :class="vpSignClass(scale.total)">{{ formatVp(scale.total) }}</span>
            </div>
            <div class="vp-scale__bar">
              <template v-for="seg in scale.segments">
                <span v-if="seg.value > 0" :key="seg.key"
                      class="vp-scale__seg" :class="['vp-accent--' + seg.accent, {'vp-scale__seg--active': hoverKey === seg.key, 'vp-scale__seg--dim': hoverKey !== null && hoverKey !== seg.key}]"
                      :style="{width: segWidth(seg.value)}"
                      v-on:mouseenter="hoverKey = seg.key" v-on:mouseleave="hoverKey = null"></span>
              </template>
              <span v-for="seg in penaltySegments(scale)" :key="seg.key"
                    class="vp-scale__seg vp-scale__seg--penalty"
                    :class="{'vp-scale__seg--active': hoverKey === seg.key, 'vp-scale__seg--dim': hoverKey !== null && hoverKey !== seg.key}"
                    :style="{width: segWidth(seg.value)}"
                    v-on:mouseenter="hoverKey = seg.key" v-on:mouseleave="hoverKey = null"></span>
            </div>
          </div>
        </section>

        <!-- ── Detail grid: legend+detail cards + the from-cards list ──── -->
        <div class="vp-detail-grid">
          <div class="vp-detail-col">
            <!-- Terraform rating by reason -->
            <div class="vp-detail-card" v-if="trSegments.length > 0">
              <h3 class="vp-section-title" v-i18n>Terraform rating</h3>
              <ul class="vp-legend">
                <li v-for="seg in trSegments" :key="seg.key"
                    class="vp-legend__row" :class="legendRowClass(seg.key)"
                    v-on:mouseenter="hoverKey = seg.key" v-on:mouseleave="hoverKey = null">
                  <span class="vp-legend__dot" :class="'vp-accent--' + seg.accent" aria-hidden="true"></span>
                  <span class="vp-legend__label" v-i18n>{{ seg.label }}</span>
                  <span class="vp-legend__value" :class="vpSignClass(seg.value)">{{ formatVp(seg.value) }}</span>
                </li>
              </ul>
            </div>

            <!-- Cities & greenery -->
            <div class="vp-detail-card" v-if="boardSegments.length > 0">
              <h3 class="vp-section-title" v-i18n>Cities &amp; greenery</h3>
              <ul class="vp-legend">
                <li v-for="seg in boardSegments" :key="seg.key"
                    class="vp-legend__row" :class="legendRowClass(seg.key)"
                    v-on:mouseenter="hoverKey = seg.key" v-on:mouseleave="hoverKey = null">
                  <span class="vp-legend__dot" :class="'vp-accent--' + seg.accent" aria-hidden="true"></span>
                  <span class="vp-legend__label" v-i18n>{{ seg.label }}</span>
                  <span class="vp-legend__value" :class="vpSignClass(seg.value)">{{ formatVp(seg.value) }}</span>
                </li>
              </ul>
            </div>

            <!-- Milestones, awards & tracks (individual rows w/ tooltips) -->
            <div class="vp-detail-card" v-if="hasMaTracks">
              <h3 class="vp-section-title" v-i18n>Milestones, awards &amp; tracks</h3>
              <div class="vp-ma-list">
                <div v-for="d in breakdown.detailsMilestones"
                     :key="'m-' + d.message + (d.messageArgs ? d.messageArgs.join() : '')"
                     class="vp-ma-row vp-ma-row--hoverable"
                     :class="maRowClass('mca.milestones')"
                     v-on:mouseenter="onMaRowEnter($event, milestoneTooltipFor(d), 'mca.milestones')"
                     v-on:mouseleave="onMaRowLeave">
                  <span class="vp-source-chip vp-source-chip--milestone">
                    <span class="vp-source-chip__dot" aria-hidden="true"></span>
                    <span class="vp-source-chip__label">{{ translateMilestoneDetails(d) }}</span>
                  </span>
                  <span class="vp-ma-row__vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</span>
                </div>
                <div v-for="d in breakdown.detailsAwards"
                     :key="'a-' + d.message + (d.messageArgs ? d.messageArgs.join() : '')"
                     class="vp-ma-row vp-ma-row--hoverable"
                     :class="maRowClass('mca.awards')"
                     v-on:mouseenter="onMaRowEnter($event, awardTooltipFor(d), 'mca.awards')"
                     v-on:mouseleave="onMaRowLeave">
                  <span class="vp-source-chip vp-source-chip--award">
                    <span class="vp-source-chip__dot" aria-hidden="true"></span>
                    <span class="vp-source-chip__label">{{ translateAwardDetails(d) }}</span>
                  </span>
                  <span class="vp-ma-row__vp" :class="vpSignClass(d.victoryPoint)">{{ formatVp(d.victoryPoint) }}</span>
                </div>
                <div v-for="d in breakdown.detailsPlanetaryTracks" :key="'t-' + d.tag"
                     class="vp-ma-row" :class="maRowClass('tracks.all')"
                     v-on:mouseenter="hoverKey = 'tracks.all'" v-on:mouseleave="hoverKey = null">
                  <span class="vp-source-chip vp-source-chip--track">
                    <span class="vp-source-chip__dot" aria-hidden="true"></span>
                    <span class="vp-source-chip__label">{{ planetaryTrackText(d.tag) }}</span>
                  </span>
                  <span class="vp-ma-row__vp" :class="vpSignClass(d.points)">{{ formatVp(d.points) }}</span>
                </div>
                <!-- Delta Project ("Гидросеть") end-game VP — the finish stage reached
                     (Hydronetwork Architect / Engineering Contribution). Shares the
                     'mca.delta' family so it cross-highlights with its bar segment. -->
                <div v-if="deltaStageName !== undefined"
                     class="vp-ma-row" :class="maRowClass('mca.delta')"
                     v-on:mouseenter="hoverKey = 'mca.delta'" v-on:mouseleave="hoverKey = null">
                  <span class="vp-source-chip vp-source-chip--delta">
                    <span class="vp-source-chip__dot" aria-hidden="true"></span>
                    <span class="vp-source-chip__label" v-i18n>{{ deltaStageName }}</span>
                  </span>
                  <span class="vp-ma-row__vp" :class="vpSignClass(breakdown.deltaProject)">{{ formatVp(breakdown.deltaProject) }}</span>
                </div>
              </div>
            </div>

            <!-- Moon -->
            <div class="vp-detail-card" v-if="moonSegments.length > 0">
              <h3 class="vp-section-title" v-i18n>Moon</h3>
              <ul class="vp-legend">
                <li v-for="seg in moonSegments" :key="seg.key"
                    class="vp-legend__row" :class="legendRowClass(seg.key)"
                    v-on:mouseenter="hoverKey = seg.key" v-on:mouseleave="hoverKey = null">
                  <span class="vp-legend__dot" :class="'vp-accent--' + seg.accent" aria-hidden="true"></span>
                  <span class="vp-legend__label" v-i18n>{{ seg.label }}</span>
                  <span class="vp-legend__value" :class="vpSignClass(seg.value)">{{ formatVp(seg.value) }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- From cards: the multi-column grouped list (penalties last) ── -->
          <div class="vp-detail-col vp-detail-col--cards">
            <div class="vp-detail-card vp-detail-card--cards">
              <h3 class="vp-section-title" v-i18n>From cards</h3>

              <div v-if="model.cardGroups.length === 0" class="vp-cards-empty" v-i18n>No victory points from cards.</div>

              <div v-else class="vp-card-groups">
                <div v-for="group in model.cardGroups" :key="group.kind"
                     class="vp-card-group" :class="['vp-card-group--' + group.kind, cardGroupClass(group.kind)]"
                     v-on:mouseenter="hoverKey = 'cards.' + group.kind" v-on:mouseleave="hoverKey = null">
                  <div class="vp-card-group__head">
                    <span class="vp-legend__dot" :class="'vp-accent--' + group.accent" aria-hidden="true"></span>
                    <span class="vp-card-group__label" v-i18n>{{ group.label }}</span>
                    <span class="vp-card-group__count">{{ group.rows.length }}</span>
                    <span class="vp-card-group__total" :class="vpSignClass(group.total)">{{ formatVp(group.total) }}</span>
                  </div>
                  <div class="vp-card-group__rows">
                    <div v-for="(row, i) in group.rows" :key="row.cardName + '-' + i"
                         class="vp-card-row" :class="{'vp-card-row--emphasized': row.emphasized}">
                      <span class="vp-card-row__main">
                        <JournalCardChip v-if="isCard(row.cardName)" :name="asCardName(row.cardName)" />
                        <span v-else class="vp-source-chip vp-source-chip--system">
                          <span class="vp-source-chip__dot" aria-hidden="true"></span>
                          <span class="vp-source-chip__label" v-i18n>{{ row.cardName }}</span>
                        </span>
                      </span>
                      <span class="vp-card-row__vp" :class="vpSignClass(row.victoryPoint)">{{ formatVp(row.victoryPoint) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating hover tooltip for milestone / award rows. -->
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
import {Phase} from '@/common/Phase';
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
import {buildVictoryPointsModel, VictoryPointsModel, VPScale, VPSegment} from '@/client/components/overview/victoryPointsModel';
import {DELTA_STAGE_NAMES} from '@/common/delta/deltaStages';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import HiddenVictoryPointsLock from '@/client/components/overview/HiddenVictoryPointsLock.vue';
import {privateScoreState, togglePrivateScore} from '@/client/components/overview/privateScoreState';

type TooltipContent = {name: string; description: string};
type TooltipPos = {top: number; left: number};

// Count-up duration for the hero total (ms).
const COUNT_UP_MS = 650;

// Module-level so the hero count-up plays only the FIRST time a given
// (player, total) is shown. PlayerHome remounts on every server poll
// (App.vue `:key="playerkey"`), which would otherwise re-count the number
// distractingly during opponent turns.
let lastAnimatedKey: string | undefined;

export default defineComponent({
  name: 'VictoryPointsOverlay',
  components: {JournalCardChip, HiddenVictoryPointsLock},
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
    hoverKey: string | null;
    } {
    return {
      hoveredTooltip: null,
      tooltipPos: {top: 0, left: 0},
      displayedTotal: 0,
      rafId: undefined,
      hoverKey: null,
    };
  },
  computed: {
    breakdown(): VictoryPointsBreakdown {
      return this.displayedPlayer.victoryPointsBreakdown;
    },
    hidden(): boolean {
      return !this.game.gameOptions.showOtherPlayersVP &&
        this.displayedPlayer.color !== this.thisPlayerColor;
    },
    gameEnded(): boolean {
      return this.game.phase === Phase.END;
    },
    // Local "private score" toggle — only offered to a real player (a spectator
    // has no own VP to hide).
    privateOn(): boolean {
      return privateScoreState.enabled;
    },
    canPrivacy(): boolean {
      // This overlay is only ever opened from a player's own screen (PlayerHome),
      // so the viewer always has an own player; a spectator never reaches it.
      return this.thisPlayerColor !== undefined;
    },
    // The score report is sealed only WHILE the game runs — once it ends the
    // server sends every player's VP and the report shows normally.
    locked(): boolean {
      return this.hidden && !this.gameEnded;
    },
    viewingOther(): boolean {
      return this.displayedPlayer.color !== this.thisPlayerColor;
    },
    model(): VictoryPointsModel {
      return buildVictoryPointsModel(this.breakdown, {
        hasMoon: this.game.moon !== undefined,
        hasPathfinders: this.game.pathfinders !== undefined,
        hasEscapeVelocity: this.game.gameOptions.escapeVelocity !== undefined,
      });
    },
    trSegments(): Array<VPSegment> {
      return this.scaleSegments('tr');
    },
    boardSegments(): Array<VPSegment> {
      return this.scaleSegments('board');
    },
    moonSegments(): Array<VPSegment> {
      return this.scaleSegments('moon');
    },
    hasMaTracks(): boolean {
      return this.breakdown.detailsMilestones.length > 0 ||
        this.breakdown.detailsAwards.length > 0 ||
        this.breakdown.detailsPlanetaryTracks.length > 0 ||
        this.breakdown.deltaProject !== 0;
    },
    // The Delta Project ("Гидросеть") finish stage reached, derived from its
    // end-game VP (pos 11 = 5 VP = Architect; pos 10 = 2 VP = Contribution).
    // undefined when no Delta VP was scored (no row shown).
    deltaStageName(): string | undefined {
      const vp = this.breakdown.deltaProject;
      if (vp === 0) {
        return undefined;
      }
      return vp >= 5 ? DELTA_STAGE_NAMES[11] : DELTA_STAGE_NAMES[10];
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
    heroKey(): string {
      return `${this.displayedPlayer.color}:${this.locked ? 'hidden' : this.breakdown.total}`;
    },
  },
  watch: {
    heroKey(): void {
      this.animateTotal();
    },
  },
  methods: {
    togglePrivacy(): void {
      togglePrivateScore();
    },
    scaleSegments(key: string): Array<VPSegment> {
      return this.model.scales.find((s) => s.key === key)?.segments ?? [];
    },
    penaltySegments(scale: VPScale): Array<VPSegment> {
      return scale.segments.filter((s) => s.value < 0);
    },
    // Bar segment width as a % of the track, on the shared px-per-VP scale.
    segWidth(value: number): string {
      const max = this.model.maxScalePositive;
      if (max <= 0) {
        return '0%';
      }
      return `${(Math.abs(value) / max) * 100}%`;
    },
    legendRowClass(key: string): Record<string, boolean> {
      return {
        'vp-legend__row--active': this.hoverKey === key,
        'vp-legend__row--dim': this.hoverKey !== null && this.hoverKey !== key,
      };
    },
    // Cross-link the "from cards" groups with their bar segment (key
    // `cards.<kind>`): hovering ANY source highlights the matching pair and
    // dims everything else uniformly across the whole report.
    cardGroupClass(kind: string): Record<string, boolean> {
      const key = 'cards.' + kind;
      return {
        'vp-card-group--active': this.hoverKey === key,
        'vp-card-group--faded': this.hoverKey !== null && this.hoverKey !== key,
      };
    },
    // Milestone / award / track rows share the dim+active system. They map to
    // their bar segment's family key (`mca.milestones` / `mca.awards` /
    // `tracks.all`) so the matching bar segment lights up too.
    maRowClass(key: string): Record<string, boolean> {
      return {
        'vp-ma-row--active': this.hoverKey === key,
        'vp-ma-row--dim': this.hoverKey !== null && this.hoverKey !== key,
      };
    },
    onMaRowEnter(e: MouseEvent, tooltip: TooltipContent | null, key: string): void {
      this.hoverKey = key;
      this.onRowEnter(e, tooltip);
    },
    onMaRowLeave(): void {
      this.hoverKey = null;
      this.onRowLeave();
    },
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
    isCard(name: string): boolean {
      return getCard(name as CardName) !== undefined;
    },
    asCardName(name: string): CardName {
      return name as CardName;
    },
    translateMilestoneDetails(data: MADetail): string {
      const args = (data.messageArgs || []).map($t);
      return translateTextWithParams(data.message, args);
    },
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
    animateTotal(): void {
      if (this.rafId !== undefined) {
        cancelAnimationFrame(this.rafId);
        this.rafId = undefined;
      }
      const target = this.locked ? 0 : this.breakdown.total;
      const key = `${this.displayedPlayer.color}:${target}`;
      // Snap (no count-up) when locked, reduced-motion, already-animated, or in
      // a non-browser context (SSR / JSDOM tests where rAF is absent).
      if (this.locked || prefersReducedMotion() || lastAnimatedKey === key || typeof requestAnimationFrame === 'undefined') {
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
