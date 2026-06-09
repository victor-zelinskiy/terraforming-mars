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

      <!-- View-mode segmented control: КАРТЫ (board) / ТАБЛИЦА (data list). -->
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
         :class="['played-board__body--' + density, {'played-board__body--table': viewMode === 'table'}]"
         :style="bodyStyle">
      <PlayedCardsEmptyState v-if="emptyReason !== undefined" :reason="emptyReason" />
      <div v-else-if="viewMode === 'cards'" class="played-tableau">
        <!-- Identity band — corporation / preludes / CEO. Compact wrapping
             rows of full cards (a "setup zone", never the dominant area). -->
        <transition-group v-if="identityGroups.length > 0" name="played-group-fade" tag="div" class="played-tableau__identity" @after-leave="scheduleFit">
          <PlayedCardsGroup
            v-for="g in identityGroups"
            :key="g.key"
            :group="g"
            variant="identity"
            :player="displayedPlayer"
            @open="openCard" />
        </transition-group>

        <!-- Project band — Active / Automated / Events. The main area: each
             type-section is vertical peek-stack columns, widths allocated by
             card count, scaled to fill the available box. -->
        <transition-group v-if="projectGroups.length > 0" name="played-group-fade" tag="div" class="played-tableau__projects" @after-leave="scheduleFit">
          <PlayedCardsGroup
            v-for="g in projectGroups"
            :key="g.key"
            :group="g"
            variant="project"
            :plan="sectionPlanMap[g.key]"
            :peek="peekEnabled"
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
import {Density, FIT, planProjectBand, ProjectSectionPlan} from '@/client/components/playedCards/playedTableauFit';
import {playedCardsViewState, PlayedViewMode} from '@/client/components/playedCards/playedCardsViewState';
import PlayedCardsFilters from '@/client/components/playedCards/PlayedCardsFilters.vue';
import PlayedCardsGroup from '@/client/components/playedCards/PlayedCardsGroup.vue';
import PlayedCardsTable, {PlayedTableRow} from '@/client/components/playedCards/PlayedCardsTable.vue';
import PlayedCardsEmptyState from '@/client/components/playedCards/PlayedCardsEmptyState.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type ViewMode = PlayedViewMode;

// Layout constants — MUST stay in sync with played_cards.less.
const MIN_ZOOM = FIT.minZoom;
const COL_GAP = FIT.gap; // .played-group__columns gap
const SECTION_GAP = FIT.sectionGap; // .played-tableau__projects column-gap
const BODY_PAD_H = 44; // 22 + 22
const BODY_PAD_V = 38; // 16 + 22
const BAND_GAP = 18; // .played-tableau row gap between identity + project bands
const FIT_SAFETY = 6; // sliver below content so rounding never trips the scrollbar
const MIN_BAND_H = 220; // floor for the project band height estimate

type DataModel = {
  // Visual card scale (`--played-card-zoom`) — the fit engine grows it to fill
  // the box, then shrinks only if the real render overflows.
  cardZoom: number;
  // Natural px a peeked card shows (slot height = peekNatural * cardZoom).
  peekNatural: number;
  // false → cards render FULL (no peek, no clipping).
  peekEnabled: boolean;
  density: Density;
  // Per-section column/chunk plan (set imperatively by the fit engine).
  bandSections: ReadonlyArray<ProjectSectionPlan>;
  // Measured real natural card height (offsetHeight / zoom) — keeps the
  // area-fill accurate regardless of expansion / fonts.
  naturalCardH: number;
  zoomCard: CardModel | undefined;
  resizeObserver: ResizeObserver | undefined;
  deferTimer: number | undefined;
  fitScheduled: boolean;
};

/**
 * Premium "played cards board" overlay — a board-game-like tableau of the
 * CURRENTLY-VIEWED player's cards (`displayedPlayer`), in two bands: a compact
 * IDENTITY setup zone (corp / preludes / CEO) and the main PROJECT band
 * (Active / Automated / Events) as vertical peek-stack columns.
 *
 * The layout is an area-FILLING engine: `playedTableauFit.planProjectBand`
 * searches the column count that lets the cards be as LARGE as possible while
 * fitting both width and height (so it GROWS into empty space on wide screens,
 * not just shrinks), allocates column widths by card count (heavy groups
 * breathe), and picks a peek height that fills the leftover height while always
 * showing each card's title (no top clipping). A measured shrink is the safety
 * net; vertical scroll is the genuine last resort. Filters + view mode persist
 * via `playedCardsViewState`.
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
      cardZoom: 0.55,
      peekNatural: 200,
      peekEnabled: true,
      density: 'balanced',
      bandSections: [],
      naturalCardH: FIT.cardNaturalH,
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
    bodyStyle(): Record<string, string> {
      return {
        '--played-card-zoom': String(this.cardZoom),
        '--played-stack-peek-nat': String(this.peekNatural),
      };
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
    sectionPlanMap(): Record<string, ProjectSectionPlan> {
      const out: Record<string, ProjectSectionPlan> = {};
      for (const s of this.bandSections) {
        out[s.key] = s;
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
    'displayedPlayer.color'() {
      this.recompute();
    },
    viewMode(mode: ViewMode) {
      if (mode === 'cards') {
        this.recompute();
      }
    },
    // A filter change (hide a type / pick a tag) changes the visible set — re-plan.
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
    setVar(name: string, value: number): void {
      const body = this.$refs.body as HTMLElement | undefined;
      body?.style.setProperty(name, String(value));
    },
    // Measure the real natural PROJECT card height (offsetHeight / current zoom)
    // so the area-fill math is accurate (independent of the estimate / fonts).
    // MUST be a project card — identity cards carry a zoom BUMP, so dividing
    // their height by `cardZoom` would be wrong. A peeked item is clipped by its
    // SLOT, not the item, so it still reports its full height.
    measureNaturalCardH(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      const item = body?.querySelector('.played-group--project .played-card-item') as HTMLElement | null;
      if (item !== null && item !== undefined && this.cardZoom > 0) {
        const h = item.offsetHeight / this.cardZoom;
        if (h > 80) {
          this.naturalCardH = h;
        }
      }
    },
    // Full re-plan: measure the box + the real card / identity height, run the
    // area-fill planner, apply, then a measured shrink safety net.
    recompute(): void {
      if (this.viewMode !== 'cards') {
        return;
      }
      this.scrollToTop();
      this.$nextTick(this.fit);
    },
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        this.fit();
      });
    },
    fit(): void {
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
      const availW = body.clientWidth - BODY_PAD_H;
      const totalAvailH = body.clientHeight - BODY_PAD_V - FIT_SAFETY;
      if (availW <= 0 || totalAvailH <= 0) {
        return; // JSDOM / not laid out yet
      }
      this.measureNaturalCardH();
      const identityEl = body.querySelector('.played-tableau__identity') as HTMLElement | null;
      const identityH = identityEl !== null ? identityEl.offsetHeight : 0;
      const projAvailH = Math.max(MIN_BAND_H, totalAvailH - identityH - (identityH > 0 ? BAND_GAP : 0));

      const sections = this.projectGroups.map((g) => ({key: g.key, count: g.cards.length}));
      const plan = planProjectBand(sections, availW, projAvailH, this.naturalCardH, {gap: COL_GAP, sectionGap: SECTION_GAP});

      this.cardZoom = plan.zoom;
      this.peekNatural = plan.peekNatural;
      this.peekEnabled = plan.peek;
      this.density = plan.density;
      this.bandSections = plan.sections;
      // Write the vars imperatively too so the verify pass measures synchronously.
      this.setVar('--played-card-zoom', plan.zoom);
      this.setVar('--played-stack-peek-nat', plan.peekNatural);

      this.$nextTick(this.verifyShrink);
    },
    // Safety net: if the real render still overflows the body height (estimate
    // error / identity grew with the new zoom), shrink the zoom — the peek
    // follows it via the CSS var, so the whole band scales down together.
    verifyShrink(): void {
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
        return;
      }
      let z = this.cardZoom;
      this.setVar('--played-card-zoom', z);
      void tableau.offsetHeight;
      let contentH = tableau.scrollHeight;
      let iter = 0;
      while (contentH > availH && z > MIN_ZOOM && iter < 8) {
        const ratio = Math.max(0.7, Math.min(0.97, Math.sqrt(availH / contentH)));
        z = Math.max(MIN_ZOOM, z * ratio);
        this.setVar('--played-card-zoom', z);
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
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      this.$emit('close');
    },
  },
  mounted(): void {
    this.recompute();
    // Deferred re-fit catches late layout shift (web-font / card-art load).
    this.deferTimer = window.setTimeout(() => this.recompute(), 240);
    const body = this.$refs.body as HTMLElement | undefined;
    if (body !== undefined && typeof ResizeObserver !== 'undefined') {
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
