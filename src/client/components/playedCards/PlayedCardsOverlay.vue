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
                @click="viewMode = 'cards'">
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><rect x="0.5" y="1.5" width="5" height="9" rx="1"/><rect x="6" y="0.5" width="5" height="10" rx="1"/><rect x="11" y="1.5" width="2.5" height="9" rx="1" opacity="0.6"/></svg>
          <span v-i18n>Cards</span>
        </button>
        <button type="button" class="played-board__viewbtn"
                :class="{'played-board__viewbtn--active': viewMode === 'table'}"
                :aria-pressed="viewMode === 'table'"
                @click="viewMode = 'table'">
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><rect x="0" y="1" width="3" height="2.4" rx="0.6"/><rect x="4.5" y="1" width="9.5" height="2.4" rx="0.6"/><rect x="0" y="5" width="3" height="2.4" rx="0.6"/><rect x="4.5" y="5" width="9.5" height="2.4" rx="0.6"/><rect x="0" y="9" width="3" height="2.4" rx="0.6"/><rect x="4.5" y="9" width="9.5" height="2.4" rx="0.6"/></svg>
          <span v-i18n>Table</span>
        </button>
      </div>

      <button type="button" class="played-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <PlayedCardsFilters v-if="hasAnyCards" :chips="chips" @toggle="toggleGroup" />

    <div ref="body" class="played-board__body"
         :class="{'played-board__body--stacked': stacked && viewMode === 'cards', 'played-board__body--table': viewMode === 'table'}"
         :style="{'--played-visible-groups': visibleGroups.length}">
      <PlayedCardsEmptyState v-if="emptyReason !== undefined" :reason="emptyReason" />
      <transition-group v-else-if="viewMode === 'cards'" name="played-group-fade" tag="div" class="played-board__groups" @after-leave="recompute">
        <PlayedCardsGroup
          v-for="g in visibleGroups"
          :key="g.key"
          :group="g"
          :mode="modeFor(g)"
          :columns="columns"
          :player="displayedPlayer"
          @open="openCard" />
      </transition-group>
      <PlayedCardsTable v-else :rows="tableRows" :zoomOpen="zoomCard !== undefined" @open="openCard" />
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard" ref="zoomModal" :card="zoomCard" @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {buildPlayedGroups, PlayedGroup, PlayedGroupKey} from '@/client/components/playedCards/playedCardGroups';
import PlayedCardsFilters, {PlayedFilterChip} from '@/client/components/playedCards/PlayedCardsFilters.vue';
import PlayedCardsGroup from '@/client/components/playedCards/PlayedCardsGroup.vue';
import PlayedCardsTable, {PlayedTableRow} from '@/client/components/playedCards/PlayedCardsTable.vue';
import PlayedCardsEmptyState from '@/client/components/playedCards/PlayedCardsEmptyState.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type LayoutMode = 'expanded' | 'stacked';
type ViewMode = 'cards' | 'table';

// Card scale bounds. The engine scales cards DOWN from MAX only as far as
// needed to fit the available height; only if even MIN doesn't fit does it
// switch to vertical stacks, and only if those don't fit does it scroll.
const MAX_ZOOM = 0.6;
const MIN_ZOOM = 0.34;
// Column-stack card footprint (300px natural × zoom + gap).
const STACK_GAP = 16;
// Padding inside the scroll body (keep in sync with the LESS:
// `padding: 14px 22px 22px`). Horizontal = 22+22, vertical = 14+22.
const BODY_PAD = 44;
const BODY_PAD_V = 36;
// Leave a sliver below the content so sub-pixel rounding never trips the
// scrollbar when the layout "just fits".
const FIT_SAFETY = 4;

type DataModel = {
  disabledKeys: Array<PlayedGroupKey>;
  contentWidth: number;
  // Continuous project-card zoom chosen by the fit engine (identity cards
  // get a fixed bump on top, in CSS). Drives `--played-card-zoom`.
  cardZoom: number;
  // True once grid mode can't fit even at MIN_ZOOM → vertical stacks.
  stacked: boolean;
  zoomCard: CardModel | undefined;
  resizeObserver: ResizeObserver | undefined;
  deferTimer: number | undefined;
  // 'cards' = immersive board (default), 'table' = analytic data list.
  // Persists across filter changes; filters apply to both.
  viewMode: ViewMode;
};

/**
 * Premium "played cards board" overlay. Shows the CURRENTLY-VIEWED
 * player's tableau (`displayedPlayer` — follows the player-view switch),
 * grouped by card type, with premium filter chips.
 *
 * HEIGHT-AWARE adaptive engine (`fit`): the board fills the available
 * area. Cards start at MAX_ZOOM and are scaled down (measuring real
 * content height each step) only as far as needed to fit the visible
 * height; if MIN_ZOOM still overflows, project groups collapse into
 * vertical stacks; only if THOSE overflow (very large collections) does
 * the body scroll. So a few / medium cards never scroll — they just sit
 * large and roomy. Single click on any card opens the fullscreen viewer.
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
      disabledKeys: [],
      contentWidth: 1200,
      cardZoom: MAX_ZOOM,
      stacked: false,
      zoomCard: undefined,
      resizeObserver: undefined,
      deferTimer: undefined,
      viewMode: 'cards',
    };
  },
  computed: {
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
    visibleGroups(): ReadonlyArray<PlayedGroup> {
      return this.nonEmptyGroups.filter((g) => !this.disabledKeys.includes(g.key));
    },
    columns(): number {
      const w = this.contentWidth - BODY_PAD;
      const colW = 300 * this.cardZoom + STACK_GAP;
      return Math.max(2, Math.floor(w / colW));
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
    chips(): ReadonlyArray<PlayedFilterChip> {
      return this.nonEmptyGroups.map((g) => ({
        key: g.key,
        label: g.label,
        accent: g.accent,
        count: g.cards.length,
        enabled: !this.disabledKeys.includes(g.key),
      }));
    },
    // Flat rows for the table view, respecting the same filters. `order`
    // is the global play order (tableau index, oldest = 1). The table
    // sorts by it by default.
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
    // Switching the viewed player swaps the whole board — recompute the fit
    // for the new tableau.
    'displayedPlayer.color'() {
      this.recompute();
    },
    // The card-board fit is skipped while in table view; re-fit when
    // returning to cards.
    viewMode(mode: ViewMode) {
      if (mode === 'cards') {
        this.recompute();
      }
    },
  },
  methods: {
    modeFor(group: PlayedGroup): LayoutMode {
      // Identity cards (corp / preludes / CEO) are always shown full.
      return group.identity ? 'expanded' : (this.stacked ? 'stacked' : 'expanded');
    },
    toggleGroup(key: PlayedGroupKey): void {
      const idx = this.disabledKeys.indexOf(key);
      if (idx === -1) {
        this.disabledKeys.push(key);
      } else {
        this.disabledKeys.splice(idx, 1);
      }
      this.recompute();
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
    // Re-run the fit after any change to the visible set / size. Resets to
    // the roomiest state first, then fits.
    recompute(): void {
      this.stacked = false;
      this.cardZoom = MAX_ZOOM;
      this.scrollToTop();
      this.$nextTick(this.fit);
    },
    applyZoom(z: number): void {
      const body = this.$refs.body as HTMLElement | undefined;
      body?.style.setProperty('--played-card-zoom', String(z));
    },
    fit(): void {
      // The height-fit engine only governs the card-board; the table view
      // has its own scroll.
      if (this.viewMode !== 'cards') {
        return;
      }
      const body = this.$refs.body as HTMLElement | undefined;
      if (body === undefined) {
        return;
      }
      const groups = body.querySelector('.played-board__groups') as HTMLElement | null;
      if (groups === null) {
        return;
      }
      this.contentWidth = body.clientWidth;
      // `clientHeight` includes the body's vertical padding; the groups
      // content must fit inside the padding box.
      const availH = body.clientHeight - BODY_PAD_V - FIT_SAFETY;

      // 1) Grid mode: shrink the card zoom (measuring real content height)
      //    until it fits the available height, or we hit MIN_ZOOM.
      let z = MAX_ZOOM;
      this.applyZoom(z);
      void groups.offsetHeight;
      let contentH = groups.scrollHeight;
      let iter = 0;
      while (contentH > availH && z > MIN_ZOOM && iter < 10) {
        // Grid height scales roughly with zoom² (smaller cards → more per
        // row → fewer rows), so a sqrt step converges quickly; clamp the
        // step so we never overshoot below MIN.
        const ratio = Math.max(0.6, Math.min(0.95, Math.sqrt(availH / contentH)));
        z = Math.max(MIN_ZOOM, z * ratio);
        this.applyZoom(z);
        void groups.offsetHeight;
        contentH = groups.scrollHeight;
        iter++;
      }
      if (contentH <= availH) {
        this.stacked = false;
        this.cardZoom = z;
        return;
      }

      // 2) Still overflows at MIN_ZOOM → vertical stacks (much shorter).
      //    Re-measure after the stacked DOM renders; if it STILL overflows
      //    (very large collection) the body's `overflow-y: auto` scrolls —
      //    the intended last-resort fallback.
      this.cardZoom = MIN_ZOOM;
      this.stacked = true;
      this.applyZoom(MIN_ZOOM);
      this.$nextTick(() => {
        const b = this.$refs.body as HTMLElement | undefined;
        if (b !== undefined) {
          this.contentWidth = b.clientWidth;
          this.applyZoom(MIN_ZOOM);
        }
      });
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
    // One deferred re-fit catches any late layout shift (web-font / card
    // art load) that could otherwise leave a hair of overflow → scrollbar.
    this.deferTimer = window.setTimeout(() => this.recompute(), 220);
    const body = this.$refs.body as HTMLElement | undefined;
    if (body !== undefined && typeof ResizeObserver !== 'undefined') {
      // Only re-fit on real body-size changes (viewport / journal toggle),
      // not on our own zoom writes (those don't change the body's size).
      this.resizeObserver = new ResizeObserver(() => this.recompute());
      this.resizeObserver.observe(body);
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
