<template>
  <div class="played-board-overlay" role="region" :aria-label="$t('Played cards')">
    <span class="played-board-overlay__corner played-board-overlay__corner--tl" aria-hidden="true"></span>
    <span class="played-board-overlay__corner played-board-overlay__corner--tr" aria-hidden="true"></span>
    <span class="played-board-overlay__corner played-board-overlay__corner--bl" aria-hidden="true"></span>
    <span class="played-board-overlay__corner played-board-overlay__corner--br" aria-hidden="true"></span>

    <header class="played-board__header">
      <div class="played-board__context">
        <span class="played-board__glyph" aria-hidden="true"></span>
        <h2 class="played-board__title" v-i18n>Played cards</h2>
        <span class="played-board__player"
              :class="'player_translucent_bg_color_' + displayedPlayer.color">
          <span class="played-board__player-dot" :class="'player_bg_color_' + displayedPlayer.color" aria-hidden="true"></span>
          {{ displayedPlayer.name }}
        </span>
        <span v-if="hasAnyCards" class="played-board__total">{{ totalCount }}</span>
      </div>

      <!-- View-mode segmented control: КАРТЫ (board) / ТАБЛИЦА (data list).
           Cards is the immersive default; table is the analytic view. -->
      <div v-if="hasAnyCards" class="played-board__viewtoggle" role="tablist" :aria-label="$t('View mode')">
        <button type="button" class="played-board__viewbtn"
                :class="{'played-board__viewbtn--active': viewMode === 'cards'}"
                :aria-pressed="viewMode === 'cards'"
                @click="setViewMode('cards')">
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><rect x="0.5" y="1.5" width="5" height="9" rx="1"/><rect x="6" y="0.5" width="5" height="10" rx="1"/><rect x="11" y="1.5" width="2.5" height="9" rx="1" opacity="0.6"/></svg>
          <span v-i18n>Cards</span>
        </button>
        <button type="button" class="played-board__viewbtn"
                :class="{'played-board__viewbtn--active': viewMode === 'table'}"
                :aria-pressed="viewMode === 'table'"
                @click="setViewMode('table')">
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><rect x="0" y="1" width="3" height="2.4" rx="0.6"/><rect x="4.5" y="1" width="9.5" height="2.4" rx="0.6"/><rect x="0" y="5" width="3" height="2.4" rx="0.6"/><rect x="4.5" y="5" width="9.5" height="2.4" rx="0.6"/><rect x="0" y="9" width="3" height="2.4" rx="0.6"/><rect x="4.5" y="9" width="9.5" height="2.4" rx="0.6"/></svg>
          <span v-i18n>Table</span>
        </button>
      </div>

      <button type="button" class="played-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <PlayedCardsFilters
      v-if="hasAnyCards"
      :typeChips="typeChips"
      :tagChips="tagChips"
      @toggle-type="toggleGroup"
      @toggle-tag="toggleTag" />

    <div ref="body" class="played-board__body"
         :class="{'played-board__body--table': viewMode === 'table'}"
         :style="{'--played-card-zoom': cardZoom}">
      <PlayedCardsEmptyState v-if="emptyReason !== undefined" :reason="emptyReason" />
      <div v-else-if="viewMode === 'cards'" class="played-tableau">
        <!-- Identity band — corporation / preludes / CEO, the cards that
             define WHO the player is. Compact wrapping rows, full cards. -->
        <transition-group v-if="identityGroups.length > 0" name="played-group-fade" tag="div" class="played-tableau__identity" @after-leave="scheduleFit">
          <PlayedCardsGroup
            v-for="g in identityGroups"
            :key="g.key"
            :group="g"
            variant="identity"
            :player="displayedPlayer"
            @open="openCard" />
        </transition-group>

        <!-- Project band — Active / Automated / Events. The main tableau: each
             type-section is a grid (few cards) or vertical peek-stack columns
             (many cards). Sections flex-wrap to fill the width. -->
        <transition-group v-if="projectGroups.length > 0" name="played-group-fade" tag="div" class="played-tableau__projects" @after-leave="scheduleFit">
          <PlayedCardsGroup
            v-for="g in projectGroups"
            :key="g.key"
            :group="g"
            variant="project"
            :plan="sectionPlans[g.key]"
            :player="displayedPlayer"
            @open="openCard" />
        </transition-group>
      </div>
      <PlayedCardsTable v-else :rows="tableRows" :zoomOpen="zoomCard !== undefined" @open="openCard" />
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard" ref="zoomModal" :card="zoomCard" @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, markRaw, nextTick, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {
  buildPlayedGroups,
  buildPlayedTagChips,
  buildPlayedTypeChips,
  filterPlayedGroups,
  PlayedGroup,
  PlayedGroupKey,
  PlayedTagChip,
  PlayedTypeChip,
} from '@/client/components/playedCards/playedCardGroups';
import {planTableau, TableauSectionPlan} from '@/client/components/playedCards/playedTableauFit';
import {playedCardsViewState, PlayedViewMode} from '@/client/components/playedCards/playedCardsViewState';
import PlayedCardsFilters from '@/client/components/playedCards/PlayedCardsFilters.vue';
import PlayedCardsGroup from '@/client/components/playedCards/PlayedCardsGroup.vue';
import PlayedCardsTable, {PlayedTableRow} from '@/client/components/playedCards/PlayedCardsTable.vue';
import PlayedCardsEmptyState from '@/client/components/playedCards/PlayedCardsEmptyState.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type ViewMode = PlayedViewMode;

// Card scale bounds. The engine scales cards DOWN from the per-count estimate
// only as far as needed to fit the available height; vertical scroll is the
// genuine last resort (only when even MIN_ZOOM overflows).
const MAX_ZOOM = 0.62;
const MIN_ZOOM = 0.34;
// Natural card-container width (cards.less `.card-container { width: 300px }`).
const NAT_W = 300;
// Gap between project columns / grid cards (keep in sync with the LESS
// `.played-group__columns` / `__grid` gap — feeds the column-fit math).
const COL_GAP = 14;
// Padding inside the scroll body (keep in sync with LESS `padding: 16px 22px`).
const BODY_PAD_H = 44;
const BODY_PAD_V = 38;
// Leave a sliver below the content so sub-pixel rounding never trips the
// scrollbar when the layout "just fits".
const FIT_SAFETY = 4;

type DataModel = {
  // Width of the scroll body (drives the column-fit plan reactively).
  contentWidth: number;
  // Card scale used to COMPUTE the column distribution (stable across the
  // height-shrink loop, so the columns don't re-flow while the zoom settles).
  planZoom: number;
  // Visual card scale the height-shrink loop drives down to fit (the CSS
  // `--played-card-zoom`). Starts == planZoom, only ever <= it.
  cardZoom: number;
  zoomCard: CardModel | undefined;
  resizeObserver: ResizeObserver | undefined;
  deferTimer: number | undefined;
  fitScheduled: boolean;
};

/**
 * Premium "played cards board" overlay. Shows the CURRENTLY-VIEWED player's
 * tableau (`displayedPlayer`), grouped by card type, as a board-game-like
 * tableau:
 *  - IDENTITY band (corporation / preludes / CEO): compact wrapping rows of
 *    full cards — never a wasted full-width row, clean at 1-3 corps / 2-5
 *    preludes.
 *  - PROJECT band (Active / Automated / Events): the main area. Each section
 *    is a roomy full-card grid when it holds a few cards, or vertical
 *    PEEK-STACK columns when it holds many — so the tableau reads like fanned
 *    piles and uses the width before ever scrolling.
 *
 * Adaptive engine: the column distribution per project section is a pure
 * function of the card counts + width (`playedTableauFit`); the card SCALE is
 * then shrunk by a DOM-measuring loop only as far as needed to fit the height.
 * Filters (type groups + tags), the view mode, and the player's choices
 * persist across close/reopen via `playedCardsViewState` (module state).
 */
export default defineComponent({
  name: 'PlayedCardsOverlay',
  components: {PlayedCardsFilters, PlayedCardsGroup, PlayedCardsTable, PlayedCardsEmptyState, CardZoomModal},
  props: {
    displayedPlayer: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    viewerColor: {
      type: String as () => Color,
      required: true,
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      contentWidth: 1200,
      planZoom: MAX_ZOOM,
      cardZoom: MAX_ZOOM,
      zoomCard: undefined,
      resizeObserver: undefined,
      deferTimer: undefined,
      fitScheduled: false,
    };
  },
  computed: {
    viewMode(): ViewMode {
      return playedCardsViewState.viewMode;
    },
    allGroups(): ReadonlyArray<PlayedGroup> {
      return buildPlayedGroups(this.displayedPlayer.tableau);
    },
    nonEmptyGroups(): ReadonlyArray<PlayedGroup> {
      return this.allGroups.filter((g) => g.cards.length > 0);
    },
    hasAnyCards(): boolean {
      return this.nonEmptyGroups.length > 0;
    },
    totalCount(): number {
      return this.nonEmptyGroups.reduce((sum, g) => sum + g.cards.length, 0);
    },
    // The non-empty groups after BOTH filter dimensions (hidden types + tag
    // narrowing) — each carries only its still-visible cards, in play order.
    visibleGroups(): ReadonlyArray<PlayedGroup> {
      return filterPlayedGroups(this.nonEmptyGroups, {
        hiddenGroups: playedCardsViewState.hiddenGroups,
        activeTags: playedCardsViewState.activeTags,
      });
    },
    identityGroups(): ReadonlyArray<PlayedGroup> {
      return this.visibleGroups.filter((g) => g.identity);
    },
    projectGroups(): ReadonlyArray<PlayedGroup> {
      return this.visibleGroups.filter((g) => !g.identity);
    },
    // The column/grid plan per project section — a pure function of the
    // filtered counts + the measured width + the planning zoom. Kept reactive
    // (not imperatively written) so it re-derives on a filter / resize change.
    sectionPlans(): Record<string, TableauSectionPlan> {
      const w = this.contentWidth - BODY_PAD_H;
      const cardW = NAT_W * this.planZoom;
      const plans = planTableau(
        this.projectGroups.map((g) => ({key: g.key, count: g.cards.length})),
        w,
        cardW,
        COL_GAP,
      );
      const out: Record<string, TableauSectionPlan> = {};
      for (const p of plans) {
        out[p.key] = p;
      }
      return out;
    },
    emptyReason(): 'none' | 'filtered' | undefined {
      if (!this.hasAnyCards) {
        return 'none';
      }
      if (this.visibleGroups.length === 0) {
        return 'filtered';
      }
      return undefined;
    },
    typeChips(): ReadonlyArray<PlayedTypeChip> {
      return buildPlayedTypeChips(this.nonEmptyGroups, {
        hiddenGroups: playedCardsViewState.hiddenGroups,
        activeTags: playedCardsViewState.activeTags,
      });
    },
    tagChips(): ReadonlyArray<PlayedTagChip> {
      return buildPlayedTagChips(this.nonEmptyGroups, {
        hiddenGroups: playedCardsViewState.hiddenGroups,
        activeTags: playedCardsViewState.activeTags,
      });
    },
    // Flat rows for the table view, respecting both filter dimensions. `order`
    // is the global play order (tableau index, oldest = 1).
    tableRows(): ReadonlyArray<PlayedTableRow> {
      const orderMap = new Map<CardName, number>();
      this.displayedPlayer.tableau.forEach((c, i) => orderMap.set(c.name, i + 1));
      const rows: Array<PlayedTableRow> = [];
      for (const g of this.visibleGroups) {
        for (const card of g.cards) {
          rows.push({card, accent: g.accent, typeLabel: g.label, order: orderMap.get(card.name) ?? 0});
        }
      }
      return rows;
    },
  },
  watch: {
    // Switching the viewed player swaps the whole board — recompute the fit.
    'displayedPlayer.color'() {
      this.recompute();
    },
    // The card-board fit is skipped in table view; re-fit when returning.
    viewMode(mode: ViewMode) {
      if (mode === 'cards') {
        this.recompute();
      }
    },
    // A filter change (hide a type / pick a tag) changes the visible set — a
    // FULL re-plan (so filtering down to a few cards re-grows them toward
    // roomy, and the column counts track the new counts). The `@after-leave`
    // hooks also nudge a re-fit once the leave animation finishes.
    visibleGroups() {
      this.recompute();
    },
  },
  methods: {
    setViewMode(mode: ViewMode): void {
      playedCardsViewState.viewMode = mode;
    },
    toggleGroup(key: PlayedGroupKey): void {
      const arr = playedCardsViewState.hiddenGroups;
      const idx = arr.indexOf(key);
      if (idx === -1) {
        arr.push(key);
      } else {
        arr.splice(idx, 1);
      }
    },
    // Single-select tag narrowing (mirrors the hand overlay): pick a tag to
    // narrow to it, click it again to clear.
    toggleTag(tag: Tag): void {
      playedCardsViewState.activeTags = playedCardsViewState.activeTags.includes(tag) ? [] : [tag];
    },
    openCard(card: CardModel): void {
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs as {zoomModal?: {show: () => void}}).zoomModal?.show();
      });
    },
    scrollToTop(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      if (body !== undefined) {
        body.scrollTop = 0;
      }
    },
    applyZoom(z: number): void {
      const body = this.$refs.body as HTMLElement | undefined;
      body?.style.setProperty('--played-card-zoom', String(z));
    },
    // Full re-plan + re-fit: reset to the per-count estimate, then shrink to
    // fit the height. Used on mount / player switch / view-mode return.
    recompute(): void {
      if (this.viewMode !== 'cards') {
        return;
      }
      const body = this.$refs.body as HTMLElement | undefined;
      if (body !== undefined) {
        this.contentWidth = body.clientWidth;
      }
      const projectCount = this.projectGroups.reduce((n, g) => n + g.cards.length, 0);
      this.planZoom = this.baseZoom(projectCount);
      this.cardZoom = this.planZoom;
      this.scrollToTop();
      // The plan + zoom changed → let Vue lay out the new columns, then shrink.
      this.$nextTick(this.shrinkToFit);
    },
    // rAF-coalesced lighter re-fit (resize bursts / filter reflow): re-measure
    // width + shrink, without resetting the planning zoom (avoids a column
    // re-flow on every frame).
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        if (this.viewMode !== 'cards') {
          return;
        }
        const body = this.$refs.body as HTMLElement | undefined;
        if (body !== undefined) {
          this.contentWidth = body.clientWidth;
        }
        // Reset the visual zoom up to the plan zoom before shrinking, so a
        // filter that REMOVED cards can grow back toward roomy.
        this.cardZoom = this.planZoom;
        this.$nextTick(this.shrinkToFit);
      });
    },
    // Per-count starting scale: few cards big & roomy, many cards compact.
    // Smoothly interpolated so similar counts don't jump scale.
    baseZoom(projectCount: number): number {
      if (projectCount <= 8) {
        return MAX_ZOOM;
      }
      if (projectCount >= 70) {
        return 0.40;
      }
      const t = (projectCount - 8) / (70 - 8);
      return MAX_ZOOM + t * (0.40 - MAX_ZOOM);
    },
    // Shrink the VISUAL card zoom (CSS var only — columns stay fixed) until the
    // tableau content fits the available height, or we hit MIN_ZOOM (then the
    // body scrolls, the genuine last resort). Measures the real rendered
    // height each step; a sqrt step converges in a couple of iterations.
    shrinkToFit(): void {
      if (this.viewMode !== 'cards') {
        return;
      }
      const body = this.$refs.body as HTMLElement | undefined;
      if (body === undefined) {
        return;
      }
      const tableau = body.querySelector('.played-tableau') as HTMLElement | null;
      if (tableau === null) {
        return;
      }
      const availH = body.clientHeight - BODY_PAD_V - FIT_SAFETY;
      if (availH <= 0) {
        return; // JSDOM / not laid out yet
      }
      let z = this.cardZoom;
      this.applyZoom(z);
      void tableau.offsetHeight;
      let contentH = tableau.scrollHeight;
      let iter = 0;
      while (contentH > availH && z > MIN_ZOOM && iter < 8) {
        const ratio = Math.max(0.6, Math.min(0.96, Math.sqrt(availH / contentH)));
        z = Math.max(MIN_ZOOM, z * ratio);
        this.applyZoom(z);
        void tableau.offsetHeight;
        contentH = tableau.scrollHeight;
        iter++;
      }
      this.cardZoom = z;
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') {
        return;
      }
      // Let an open fullscreen card (native <dialog>) take Escape first.
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      this.$emit('close');
    },
  },
  mounted(): void {
    this.recompute();
    // One deferred re-fit catches any late layout shift (web-font / card art
    // load) that could otherwise leave a hair of overflow → scrollbar.
    this.deferTimer = window.setTimeout(() => this.recompute(), 240);
    const body = this.$refs.body as HTMLElement | undefined;
    if (body !== undefined && typeof ResizeObserver !== 'undefined') {
      // Only re-fit on real body-size changes (viewport / journal toggle),
      // not on our own zoom writes (those don't change the body's size).
      const ro = new ResizeObserver(() => this.scheduleFit());
      ro.observe(body);
      this.resizeObserver = markRaw(ro);
    }
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    if (this.resizeObserver !== undefined) {
      this.resizeObserver.disconnect();
    }
    if (this.deferTimer !== undefined) {
      window.clearTimeout(this.deferTimer);
    }
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
