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
      <div v-if="hasAnyCards && !pickActive" class="played-board__viewtoggle" role="tablist" :aria-label="$t('View mode')">
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

    <!-- PICK MODE strip — replaces the filters while the board hosts a card-target
         choice for a modal. Names what's being chosen + a cancel that backs out. -->
    <div v-if="pickActive" class="played-board__pickstrip">
      <span class="played-board__pickstrip-dot" aria-hidden="true"></span>
      <span class="played-board__pickstrip-label">
        <span class="played-board__pickstrip-kicker" v-i18n>Choose a card on your board</span>
        <span class="played-board__pickstrip-title" v-i18n>{{ pickTitleText }}</span>
      </span>
      <button type="button" class="played-board__pickstrip-cancel" @click="$emit('close')">
        <span v-i18n>Cancel</span>
      </button>
    </div>

    <PlayedCardsFilters
      v-if="hasAnyCards && !pickActive"
      :typeChips="typeChips"
      :tagChips="tagChips"
      @toggle-type="toggleGroup"
      @toggle-tag="toggleTag" />

    <div ref="body" class="played-board__body"
         :class="['played-board__body--' + density, {'played-board__body--table': viewMode === 'table'}]"
         :style="bodyStyle">
      <PlayedCardsEmptyState v-if="emptyReason !== undefined" :reason="emptyReason" />
      <div v-else-if="effectiveViewMode === 'cards'" class="played-tableau"
           :class="{'played-tableau--ready': ready, 'played-tableau--picking': pickActive}">
        <!-- Identity RAIL (LEFT) — a compact setup zone for corporation /
             preludes / CEO ONLY. Project sections all go to the main band. -->
        <transition-group v-if="railGroups.length > 0" name="played-group-fade" tag="div" class="played-tableau__identity" @after-leave="scheduleFit">
          <PlayedCardsGroup
            v-for="g in railGroups"
            :key="g.key"
            :group="g"
            variant="identity"
            :player="displayedPlayer"
            :pickMode="pickActive"
            :selectable="pickSelectableSet"
            @open="openCard"
            @pick="onPickCard" />
        </transition-group>

        <!-- Main project band (RIGHT) — Active / Automated / Events as vertical
             columns, widths allocated by card count, scaled to FILL the box
             (full cards when they fit, peek only when there are too many). -->
        <transition-group v-if="mainProjectGroups.length > 0" name="played-group-fade" tag="div" class="played-tableau__projects" @after-leave="scheduleFit">
          <PlayedCardsGroup
            v-for="g in mainProjectGroups"
            :key="g.key"
            :group="g"
            variant="project"
            :plan="sectionPlanMap[g.key]"
            :peek="pickActive ? false : peekEnabled"
            :player="displayedPlayer"
            :pickMode="pickActive"
            :selectable="pickSelectableSet"
            @open="openCard"
            @pick="onPickCard" />
        </transition-group>
      </div>
      <PlayedCardsTable v-else :rows="tableRows" :zoomOpen="zoomCard !== undefined" @open="openCard" />

      <!-- Loading shimmer — only for big tableaus (50+), shown while the fit
           engine settles so the cards don't visibly jump into place on open. -->
      <transition name="played-loading-fade">
        <div v-if="showShimmer" class="played-loading" aria-hidden="true">
          <span class="played-loading__ring"></span>
          <span class="played-loading__label" v-i18n>Arranging cards</span>
        </div>
      </transition>
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
import {playedCardsPickState, resolvePlayedCardsPick} from '@/client/components/playedCards/playedCardsPickState';
import {Message} from '@/common/logs/Message';
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
const RAIL_GAP = 24; // .played-tableau gap between the identity rail + project band
const FIT_SAFETY = 6; // sliver below content so rounding never trips the scrollbar
const MIN_BAND_W = 360; // floor for the project band width estimate
// Sanity bounds for the measured natural card height — a stray measurement
// (mid-transition / hover) must never tank the layout (the Bug-3 root cause).
const NAT_H_MIN = 330;
const NAT_H_MAX = 470;
// Show the "arranging" shimmer (instead of a blank then a card jump) only when
// the (VISIBLE / filtered) tableau is big enough that the fit settle is
// perceptible.
const SHIMMER_THRESHOLD = 50;
// Once the shimmer is shown it stays up at least this long, so it never flashes
// (a sub-frame appear/disappear reads as a glitch). A FILTER toggle always
// shows it for this long (the cards otherwise visibly jump as the layout
// re-plans), regardless of card count.
const SHIMMER_MIN_MS = 300;

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
  // The tableau is hidden (opacity 0, layout kept for measuring) until the
  // first fit settles, then revealed — so the cards never visibly jump into
  // place when the overlay opens. `ready` flips true only once BOTH the fit has
  // settled AND (if the shimmer was shown) it has been up at least SHIMMER_MIN_MS.
  ready: boolean;
  fitSettled: boolean;
  shimmerMinDone: boolean;
  shimmerTimer: number | undefined;
  // Force the shimmer for this reveal cycle regardless of card count — set on a
  // FILTER toggle, so even a small filtered board shows the 300ms loading
  // instead of the cards visibly jumping as the layout re-plans.
  forceShimmer: boolean;
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
      ready: false,
      fitSettled: false,
      shimmerMinDone: true,
      shimmerTimer: undefined,
      forceShimmer: false,
    };
  },
  computed: {
    viewMode(): ViewMode {
      return playedCardsViewState.viewMode;
    },
    // PICK MODE — the board is hosting a >3-candidate card-target choice for the
    // play / action-confirm modal. The filters / view-toggle hide, a cyan strip
    // shows, candidates highlight + the rest dim, and a click resolves the pick.
    pickActive(): boolean {
      return playedCardsPickState.active;
    },
    pickTitle(): string | Message {
      return playedCardsPickState.title;
    },
    pickTitleText(): string {
      const t = this.pickTitle;
      return typeof t === 'string' ? t : t.message;
    },
    pickSelectableSet(): ReadonlySet<CardName> {
      return new Set(playedCardsPickState.selectable);
    },
    // Force the card tableau while picking (the table view can't host a pick).
    effectiveViewMode(): ViewMode {
      return this.pickActive ? 'cards' : this.viewMode;
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
    // VISIBLE (filtered) card count — drives the shimmer + anti-jump decisions,
    // so opening WITH filters applied (fewer cards) skips the shimmer.
    visibleCardCount(): number {
      return this.visibleGroups.reduce((sum, g) => sum + g.cards.length, 0);
    },
    visibleGroups(): ReadonlyArray<PlayedGroup> {
      return filterPlayedGroups(this.nonEmptyGroups, {
        hiddenGroups: playedCardsViewState.hiddenGroups,
        activeTags: playedCardsViewState.activeTags,
      });
    },
    // The left rail is RESERVED for identity only (corp / preludes / CEO) — a
    // compact setup zone. Project sections (incl. Events) ALL go to the main
    // band, where they share the same column layout as Active / Automated.
    railGroups(): ReadonlyArray<PlayedGroup> {
      return this.visibleGroups.filter((g) => g.identity);
    },
    mainProjectGroups(): ReadonlyArray<PlayedGroup> {
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
    // The "arranging cards" shimmer: while the fit settles (not `ready`), in
    // card view, for a big VISIBLE board OR any filter toggle (`forceShimmer`).
    showShimmer(): boolean {
      return this.viewMode === 'cards' && !this.ready &&
        (this.forceShimmer || this.visibleCardCount >= SHIMMER_THRESHOLD);
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
    // Switching the viewed player swaps the whole tableau — re-hide until the
    // new layout settles so the cards don't visibly re-arrange.
    'displayedPlayer.color'() {
      this.beginRevealCycle();
      this.recompute();
    },
    viewMode(mode: ViewMode) {
      if (mode === 'cards') {
        this.beginRevealCycle();
        this.recompute();
      }
    },
    // A filter change (hide a type / pick a tag) re-plans the whole board, which
    // otherwise reflows the cards visibly (a jump). ALWAYS hide + show the
    // 300ms shimmer, then reveal the settled layout — so a filter toggle reads
    // as a clean "arranging" beat, never a scramble.
    visibleGroups() {
      this.beginRevealCycle(true);
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
    // PICK MODE — a candidate card was clicked: resolve the pick (delivers the
    // card back to the initiating modal via the bridge) and close the overlay so
    // the suppressed modal re-appears with the chosen card.
    onPickCard(card: CardModel): void {
      resolvePlayedCardsPick(card.name);
      this.$emit('close');
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
    // SLOT, not the item, so it still reports its full height. CLAMPED to a sane
    // range so a stray measurement (mid-transition / hover-expand) can never
    // corrupt the cache and shrink every later layout (the Bug-3 root cause).
    measureNaturalCardH(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      const item = body?.querySelector('.played-group--project .played-card-item') as HTMLElement | null;
      if (item !== null && item !== undefined && this.cardZoom > 0) {
        const h = item.offsetHeight / this.cardZoom;
        if (h > 80) {
          this.naturalCardH = Math.max(NAT_H_MIN, Math.min(NAT_H_MAX, h));
        }
      }
    },
    // Full re-plan. `fit()` is now SELF-CORRECTING (it re-measures the rail at
    // the settled zoom and re-plans once if needed) and flips `fitSettled` when
    // done — so the reveal happens FAST (a couple of frames), not after a fixed
    // 220ms wait. A separate non-gating deferred re-fit catches late web-font /
    // card-art layout shifts after the reveal.
    recompute(): void {
      if (this.viewMode !== 'cards') {
        return;
      }
      this.scrollToTop();
      this.$nextTick(() => this.fit());
      if (this.deferTimer !== undefined) {
        window.clearTimeout(this.deferTimer);
      }
      this.deferTimer = window.setTimeout(() => this.fit(), 280);
    },
    // Arms a fresh reveal cycle: hide the tableau, then hold the shimmer at
    // least SHIMMER_MIN_MS so it never flashes — whenever `force` is set (a
    // FILTER toggle, so the cards never visibly jump) OR the VISIBLE board is
    // big enough to warrant it. Called on open + player/view switch + every
    // filter toggle.
    beginRevealCycle(force = false): void {
      this.ready = false;
      this.fitSettled = false;
      this.forceShimmer = force;
      if (this.shimmerTimer !== undefined) {
        window.clearTimeout(this.shimmerTimer);
        this.shimmerTimer = undefined;
      }
      if (force || this.visibleCardCount >= SHIMMER_THRESHOLD) {
        this.shimmerMinDone = false;
        this.shimmerTimer = window.setTimeout(() => {
          this.shimmerTimer = undefined;
          this.shimmerMinDone = true;
          this.maybeReveal();
        }, SHIMMER_MIN_MS);
      } else {
        this.shimmerMinDone = true;
      }
    },
    maybeReveal(): void {
      if (this.fitSettled && this.shimmerMinDone) {
        this.ready = true;
      }
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
    fit(pass = 0): void {
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
      const totalAvailW = body.clientWidth - BODY_PAD_H;
      const availH = body.clientHeight - BODY_PAD_V - FIT_SAFETY;
      if (totalAvailW <= 0 || availH <= 0) {
        return; // JSDOM / not laid out yet
      }
      this.measureNaturalCardH();
      // The identity rail is a LEFT column; the project band takes the rest of
      // the WIDTH at the FULL height. Measuring the rail WIDTH (not the band
      // height) means the project height never depends on the identity render.
      const railEl = body.querySelector('.played-tableau__identity') as HTMLElement | null;
      const railW = railEl !== null ? railEl.offsetWidth : 0;
      const availW = Math.max(MIN_BAND_W, totalAvailW - railW - (railW > 0 ? RAIL_GAP : 0));

      const sections = this.mainProjectGroups.map((g) => ({key: g.key, count: g.cards.length}));
      const plan = planProjectBand(sections, availW, availH, this.naturalCardH, {gap: COL_GAP, sectionGap: SECTION_GAP});

      this.cardZoom = plan.zoom;
      this.peekNatural = plan.peekNatural;
      this.peekEnabled = plan.peek;
      this.density = plan.density;
      this.bandSections = plan.sections;
      // Write the vars imperatively too so the verify pass measures synchronously.
      this.setVar('--played-card-zoom', plan.zoom);
      this.setVar('--played-stack-peek-nat', plan.peekNatural);

      this.$nextTick(() => {
        // The rail re-rendered at the NEW zoom — if its width shifted enough
        // (the first pass measured it at the stale/previous zoom, e.g. on open
        // or a player switch), re-plan ONCE with the corrected available width.
        const railW2 = railEl !== null ? railEl.offsetWidth : 0;
        if (pass < 1 && railEl !== null && Math.abs(railW2 - railW) > 24) {
          this.fit(1);
          return;
        }
        this.verifyShrink();
        this.fitSettled = true;
        this.maybeReveal();
      });
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
    // Hidden until the layout settles (+ the shimmer-minimum for big tableaus);
    // recompute() runs an immediate fit + a deferred settle re-fit.
    this.beginRevealCycle();
    this.recompute();
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
    if (this.shimmerTimer !== undefined) {
      window.clearTimeout(this.shimmerTimer);
    }
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
