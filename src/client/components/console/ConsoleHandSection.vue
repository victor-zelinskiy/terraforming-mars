<template>
  <div class="con-hand con-hand--grid" :style="rootStyle">
    <!-- HEADER: title + live counts + the premium tag-filter chips. Button
         hints live ONLY in the footer command bar — never here. -->
    <div class="con-hand__header">
      <div class="con-hand__head-left">
        <span class="con-hand__title" v-i18n>Cards in hand</span>
        <span v-if="countText !== ''" class="con-hand__count">{{ countText }}</span>
        <span v-if="!selectActive && playableCount > 0" class="con-hand__playable">{{ $t('Playable now') }}: <b>{{ playableCount }}</b></span>
      </div>
      <!-- Tag filter (LT/RT cycle, R3 reset — advertised in the footer). The
           active chip is the always-visible source of truth for the filter. -->
      <div v-if="showFilters" class="con-hand__filters" role="group" :aria-label="$t('Tag filter')">
        <div v-for="opt in tagFilters"
             :key="opt.value"
             class="con-hand__filter"
             :class="{'con-hand__filter--active': opt.value === activeTag, 'con-hand__filter--empty': opt.count === 0 && opt.value !== activeTag}">
          <span v-if="opt.value === 'all'" class="con-hand__filter-label" v-i18n>All</span>
          <span v-else class="con-hand__filter-icon" :class="'tag-' + opt.value" aria-hidden="true"></span>
          <span class="con-hand__filter-count">{{ opt.count }}</span>
        </div>
      </div>
      <!-- SELECT mode: the "suitable only" filter chip (LT toggles). Shown only
           for a CONDITIONAL prompt where some hand cards can't be picked; a
           plain "pick any card" prompt (e.g. discard 1) has no non-candidates,
           so no filter is offered. -->
      <div v-if="selectActive && select !== undefined && select.filtered"
           class="con-hand__selectfilter"
           :class="{'con-hand__selectfilter--all': !select.suitableOnly}">
        <span class="con-hand__selectfilter-dot" aria-hidden="true"></span>
        <span class="con-hand__selectfilter-label">{{ $t(select.suitableOnly ? 'Only suitable' : 'All cards') }}</span>
      </div>
    </div>

    <!-- Premium hand SHELF: a smart, virtualized grid. Only the visible rows +
         overscan are rendered, so a big hand pages at 60fps. -->
    <div class="con-hand__shelf">
      <div class="con-hand__grid"
           ref="grid"
           :class="{'con-hand__grid--centered': !plan.scrolls, 'con-hand__grid--scroll': plan.scrolls}"
           @scroll.passive="onScroll">
        <div class="con-hand__pad" :style="padStyle">
          <div class="con-hand__spacer" :style="{height: topSpacerPx + 'px'}" aria-hidden="true"></div>
          <div v-for="row in renderRows"
               :key="row"
               class="con-hand__row"
               :style="rowStyle">
            <div v-for="(entry, ci) in rowEntries(row)"
                 :key="entry.card.name"
                 class="con-hand__slot"
                 :class="{
                   'con-hand__slot--selected': row * plan.cols + ci === index,
                   'con-hand__slot--playable': !saleActive && !selectActive && entry.playable,
                   'con-hand__slot--unplayable': !saleActive && !selectActive && !entry.playable,
                   'con-hand__slot--sale-picked': saleActive && isSaleSelected(entry.card.name),
                   'con-hand__slot--select-picked': selectActive && isSelectPicked(entry.card.name),
                   'con-hand__slot--select-disabled': selectActive && !isSelectable(entry.card.name),
                 }">
              <Card :card="entry.card" :key="entry.card.name" lightweight />
              <span v-if="entry.robot" class="con-hand__robot" v-i18n>Robots</span>
              <!-- State band: sale pick / select pick (✓), a "can't select"
                   marker on a non-candidate, else a COMPACT play blocker chip
                   (the full reason is in the info panel below). -->
              <span v-if="saleActive && isSaleSelected(entry.card.name)" class="con-cards__pickband con-cards__pickband--sale" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              <span v-else-if="selectActive && isSelectPicked(entry.card.name)" class="con-cards__pickband con-cards__pickband--select" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              <span v-else-if="selectActive && !isSelectable(entry.card.name)" class="con-hand__chip" aria-hidden="true">{{ $t('Unavailable') }}</span>
              <span v-else-if="!saleActive && !selectActive && !entry.playable && chipLabel(entry)" class="con-hand__chip" aria-hidden="true">{{ $t(chipLabel(entry) || '') }}</span>
            </div>
          </div>
          <div class="con-hand__spacer" :style="{height: bottomSpacerPx + 'px'}" aria-hidden="true"></div>
        </div>
      </div>

      <!-- Thin premium scrollbar / progress (only when the grid scrolls). -->
      <div v-if="plan.scrolls && entries.length > 0" class="con-hand__scrollbar" aria-hidden="true">
        <div class="con-hand__scrollthumb" :style="thumbStyle"></div>
      </div>

      <!-- Empty state, centred in the glass frame (filter vs truly-empty). -->
      <div v-if="entries.length === 0" class="con-hand__empty">
        <span class="con-hand__empty-glyph" aria-hidden="true">◍</span>
        <span class="con-hand__empty-text">{{ emptyMessage }}</span>
      </div>
    </div>

    <!-- Selected-card INFO PANEL: name + play state + the server's structured
         reason. NO button hints (they live in the footer). -->
    <div v-if="selected !== undefined"
         class="con-cards__verdictbar con-hand__verdictbar"
         :class="{
           'con-hand__verdictbar--ok': !saleActive && !selectActive && selectedPlayable,
           'con-hand__verdictbar--blocked': !saleActive && !selectActive && !selectedPlayable,
           'con-hand__verdictbar--sale': saleActive,
           'con-hand__verdictbar--select': selectActive,
         }">
      <span class="con-cards__verdict-name">{{ $t(selected.name) }}</span>
      <template v-if="selectActive">
        <!-- Picked / pickable / blocked — with the concrete «why not» reason
             for a non-candidate card (the fork's always-explain rule). -->
        <span v-if="isSelectPicked(selected.name)" class="con-cards__verdict con-cards__verdict--picked"><span aria-hidden="true">✓</span> {{ $t('Card selected') }}</span>
        <span v-else-if="isSelectable(selected.name)" class="con-cards__verdict con-cards__verdict--ok">{{ $t('Not selected') }}</span>
        <template v-else>
          <span class="con-cards__verdict con-cards__verdict--blocked"><span aria-hidden="true">✕</span> {{ $t('Unavailable') }}</span>
          <span v-if="focusedSelectReason !== ''" class="con-hand__reason con-hand__reason--bar con-hand__reason--rule">{{ focusedSelectReason }}</span>
        </template>
      </template>
      <template v-else-if="saleActive">
        <span class="con-cards__verdict" :class="isSaleSelected(selected.name) ? 'con-cards__verdict--picked' : ''">{{ $t(isSaleSelected(selected.name) ? 'Card selected' : 'Not selected') }}</span>
      </template>
      <template v-else-if="selectedPlayable">
        <span class="con-cards__verdict con-cards__verdict--ok"><span aria-hidden="true">✓</span> {{ $t('Playable now') }}</span>
      </template>
      <template v-else>
        <span class="con-cards__verdict con-cards__verdict--blocked"><span aria-hidden="true">✕</span> {{ $t('Unplayable now') }}</span>
        <!-- A card with NO server rules-reason but not playable is rules-OK,
             just not your window (opponent's turn / mid-action) — say so, never
             a bare "Нельзя разыграть" nor a misleading "conditions not met". -->
        <span v-if="softBlocked" class="con-hand__reason con-hand__reason--bar con-hand__reason--turn">{{ $t(softReason) }}</span>
        <span v-else v-for="(r, i) in reasons.slice(0, 2)" :key="i" class="con-hand__reason con-hand__reason--bar" :class="'con-hand__reason--' + r.type">{{ reasonLine(r) }}</span>
      </template>
      <!-- Filtered count lives HERE (compact, right-aligned) — never in the
           header, so the header height can't jump when the filter changes. -->
      <span v-if="filteredCountText !== ''" class="con-hand__shown">{{ filteredCountText }}</span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console Hand section — a PREMIUM, VIRTUALIZED SMART GRID (the rework of the
 * legacy horizontal carousel). The pure layout/nav math lives in
 * `consoleHandGrid.ts` (unit-tested); this component owns the DOM concerns:
 * measuring the box (ResizeObserver), WINDOWING the rows (only the visible
 * rows + overscan render, so a big hand stays 60fps), keeping the selected card
 * visible on navigation, and the right-stick free-scroll + lazy edge-nudge.
 *
 * Selection index lives in the router (`consoleState.handIndex`) and is passed
 * back as the `index` prop for rendering; the section MUTATES it directly from
 * `move()` (mirrors `ConsoleBoardSection.move()`), and the shell just delegates.
 *
 * A premium HEADER hosts the title + live counts + the console-native tag
 * filter (LT/RT cycle, R3 reset — the shell owns those inputs; the panel is
 * pure state). PLAYABLE-FIRST sort is applied by the shell; the info panel
 * under the grid carries the play state + the SERVER's structured unplayable
 * reasons (unit-suffixed "Сейчас: …"). Button hints live ONLY in the footer.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {consoleState} from '@/client/console/consoleRouter';
import {planHandGrid, stepHandGrid, shortBlockerLabel, HandGridPlan, HandNavDir} from '@/client/components/console/consoleHandGrid';
import {ConsoleTagFilterOption, HandTagFilter} from '@/client/components/console/consoleHandFilter';

export type ConsoleHandEntry = {
  card: CardModel,
  playable: boolean,
  /** Hosted on Self-Replicating Robots. */
  robot: boolean,
};

/**
 * MANDATORY hand-SELECT mode (server `handSelect` task — discard / reveal /
 * keep / place a card FROM the player's own hand), handed down by the shell.
 * Present ⇔ the section is a picker rather than the normal play/browse hand.
 * The shell owns the accumulation + submit; the section only renders the pick
 * states + the "suitable only" filter chip (LT toggles it in the shell).
 */
export type ConsoleHandSelectMode = {
  active: true,
  /** Names the player may pick (the prompt's candidate cards). */
  selectable: ReadonlyArray<string>,
  /** Currently picked names (multi-select accumulation). */
  selected: ReadonlyArray<string>,
  /** Pre-translated per-card reason for a NON-selectable card. */
  reasons: Record<string, string>,
  /** min===max===1 → A submits directly (no toggle-then-confirm). */
  single: boolean,
  /** The prompt is a CONDITIONAL subset of the hand (there ARE non-pickable
   *  cards) → the "suitable only" toggle is meaningful. */
  filtered: boolean,
  /** The "suitable only" filter is ON (only candidate cards shown). */
  suitableOnly: boolean,
};

/** Rows kept mounted above/below the viewport so a fast page never blanks. */
const OVERSCAN = 2;
/** Top/bottom content inset (px): a card's cost badge + focus glow poke ABOVE
 *  the card box, so the scroll content starts this far below the clip edge
 *  (and rows keep this margin from the viewport top when scrolled to). */
const EDGE_INSET = 20;
/** Right-stick free-scroll px per intent frame (rows are tall). */
const STICK_SCROLL_STEP = 44;
/** Fallback box before the first measure / under JSDOM (rects are 0). */
const FALLBACK_W = 1280;
const FALLBACK_H = 560;

function clampNum(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default defineComponent({
  name: 'ConsoleHandSection',
  components: {Card},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<ConsoleHandEntry>>, required: true},
    index: {type: Number, required: true},
    /** Sell-patents mode: A toggles picks, RT confirms (shell owns the flow). */
    saleActive: {type: Boolean, default: false},
    saleSelected: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
    /** MANDATORY hand-select mode (discard / reveal / place) — undefined when
     *  the section is the normal play/browse hand. */
    select: {type: Object as PropType<ConsoleHandSelectMode | undefined>, default: undefined},
    /** The turn/phase reason (i18n key) for a card that is rules-OK but not
     *  playable right now (opponent's turn / mid-action). Set by the shell. */
    softReason: {type: String, default: 'Not your turn to take any actions'},
    /** Tag-filter options (All + tags present in the hand) built by the shell. */
    tagFilters: {type: Array as PropType<ReadonlyArray<ConsoleTagFilterOption>>, default: () => []},
    /** The active tag filter (`'all'` or one tag) — drives the chip highlight. */
    activeTag: {type: String as PropType<HandTagFilter>, default: 'all'},
  },
  data() {
    return {
      box: {w: 0, h: 0},
      /** Row-gated scroll position that drives the render window. */
      scrollTopPx: 0,
      /** Smooth 0..1 scroll fraction for the scrollbar thumb. */
      scrollFrac: 0,
      lastFirstRow: -1,
      ro: undefined as ResizeObserver | undefined,
      rafScroll: undefined as number | undefined,
      rafMeasure: undefined as number | undefined,
    };
  },
  computed: {
    selected(): CardModel | undefined {
      return this.entries[this.index]?.card;
    },
    selectedPlayable(): boolean {
      return this.entries[this.index]?.playable === true;
    },
    reasons(): ReadonlyArray<UnplayableReason> {
      return this.selected?.unplayableReasons ?? [];
    },
    /** The selected card is blocked only by the window (no server rules-reason),
     *  so the panel shows the soft turn/phase reason instead of a bare block. */
    softBlocked(): boolean {
      return !this.saleActive && !this.selectActive && this.selected !== undefined && !this.selectedPlayable && this.reasons.length === 0;
    },
    // ── mandatory hand SELECT (discard / reveal / place) ──────────────────
    selectActive(): boolean {
      return this.select?.active === true;
    },
    /** The focused card's per-card «why not» reason (non-selectable only). */
    focusedSelectReason(): string {
      const name = this.selected?.name;
      return name !== undefined ? this.selectReason(name) : '';
    },
    // ── header / filter panel ─────────────────────────────────────────────
    showFilters(): boolean {
      // Only worth a filter panel when there's a real tag beyond "All", and
      // never in sale / select mode (sale shows the whole hand; select uses the
      // "suitable only" toggle, not tag filters).
      return !this.saleActive && !this.selectActive && this.tagFilters.length > 1;
    },
    totalCount(): number {
      return this.tagFilters.find((o) => o.value === 'all')?.count ?? this.entries.length;
    },
    playableCount(): number {
      return this.entries.reduce((n, e) => n + (e.playable ? 1 : 0), 0);
    },
    /** The header shows the plain total ONLY when there are no filter chips to
     *  carry it (the "All" chip shows it otherwise). It NEVER shows "Показано X
     *  из Y" — that would widen the header on a filter toggle and wrap the chips
     *  to a second row (the header must stay a stable height); that count lives
     *  compactly in the bottom info bar instead (`filteredCountText`). */
    countText(): string {
      return this.showFilters ? '' : String(this.totalCount);
    },
    /** "Показано 8 из 33" — shown ONLY when a tag filter is active (never in
     *  sale mode, where the whole hand is shown), in the bottom info bar (never
     *  the header, so the header height can't jump). */
    filteredCountText(): string {
      if (this.saleActive) {
        return '';
      }
      // Select mode: "Показано X из Y" only while the "suitable only" filter is
      // hiding non-candidate cards.
      if (this.selectActive) {
        return this.select?.filtered === true && this.select.suitableOnly ?
          translateTextWithParams('Shown ${0} of ${1}', [String(this.entries.length), String(this.totalCount)]) :
          '';
      }
      return this.activeTag !== 'all' ?
        translateTextWithParams('Shown ${0} of ${1}', [String(this.entries.length), String(this.totalCount)]) :
        '';
    },
    emptyMessage(): string {
      return this.activeTag !== 'all' ? translateText('No cards with this tag') : translateText('No cards in hand');
    },
    plan(): HandGridPlan {
      // Reserve EDGE_INSET on every side so cards' badges + focus glow have
      // room and never clip against the shelf edge (the fit/scroll decision
      // and the centred content width both fall inside that inset box).
      const w = (this.box.w > 0 ? this.box.w : FALLBACK_W) - EDGE_INSET * 2;
      const h = (this.box.h > 0 ? this.box.h : FALLBACK_H) - EDGE_INSET * 2;
      return planHandGrid({availW: w, availH: h, count: this.entries.length});
    },
    /** Row indices to render (all when it fits; windowed when it scrolls). The
     *  window is derived even before the first measure (from the fallback box),
     *  so a large hand never mounts every card in one frame on first paint. */
    renderRows(): Array<number> {
      const p = this.plan;
      if (p.rows <= 0) {
        return [];
      }
      if (!p.scrolls) {
        return this.range(0, p.rows - 1);
      }
      const availH = this.box.h > 0 ? this.box.h : FALLBACK_H;
      const contentY = this.scrollTopPx - EDGE_INSET;
      const first = Math.max(0, Math.floor(contentY / p.rowStride) - OVERSCAN);
      const last = Math.min(p.rows - 1, Math.ceil((contentY + availH) / p.rowStride) + OVERSCAN);
      return this.range(first, last);
    },
    rootStyle(): Record<string, string> {
      return {'--con-hand-zoom': String(this.plan.cardZoom)};
    },
    padStyle(): Record<string, string> {
      return this.plan.contentW > 0 ? {width: Math.round(this.plan.contentW) + 'px'} : {};
    },
    rowStyle(): Record<string, string> {
      return {height: this.plan.rowStride + 'px', columnGap: this.plan.gapX + 'px'};
    },
    topSpacerPx(): number {
      const rows = this.renderRows;
      return rows.length === 0 ? 0 : EDGE_INSET + rows[0] * this.plan.rowStride;
    },
    bottomSpacerPx(): number {
      const rows = this.renderRows;
      if (rows.length === 0) {
        return 0;
      }
      return (this.plan.rows - 1 - rows[rows.length - 1]) * this.plan.rowStride + EDGE_INSET;
    },
    thumbStyle(): Record<string, string> {
      const p = this.plan;
      const content = p.rows * p.rowStride + EDGE_INSET * 2;
      const visible = this.box.h > 0 ? this.box.h : FALLBACK_H;
      const hPct = clampNum(8, 100, (visible / Math.max(1, content)) * 100);
      const topPct = (100 - hPct) * this.scrollFrac;
      return {height: hPct + '%', top: topPct + '%'};
    },
  },
  watch: {
    index() {
      void this.$nextTick(() => this.ensureSelectedVisible());
    },
    'entries.length'() {
      // A shrinking hand may leave the index past the end — clamp it.
      if (this.index > this.entries.length - 1) {
        consoleState.handIndex = Math.max(0, this.entries.length - 1);
      }
      void this.$nextTick(() => {
        this.applyScroll();
        this.ensureSelectedVisible();
      });
    },
  },
  methods: {
    range(a: number, b: number): Array<number> {
      const out: Array<number> = [];
      for (let i = a; i <= b; i++) {
        out.push(i);
      }
      return out;
    },
    rowEntries(row: number): ReadonlyArray<ConsoleHandEntry> {
      const start = row * this.plan.cols;
      return this.entries.slice(start, start + this.plan.cols);
    },
    isSaleSelected(name: string): boolean {
      return this.saleSelected.includes(name);
    },
    /** Select mode: is this card a candidate the player may pick? */
    isSelectable(name: string): boolean {
      return this.select?.selectable.includes(name) ?? false;
    },
    /** Select mode: is this card currently picked? */
    isSelectPicked(name: string): boolean {
      return this.select?.selected.includes(name) ?? false;
    },
    /** Select mode: the pre-translated «why not» reason for a non-candidate. */
    selectReason(name: string): string {
      return this.select?.reasons[name] ?? '';
    },
    /** "Требуется X · Сейчас: Y°C" — shared formatter (unit included). */
    reasonLine(r: UnplayableReason): string {
      return unplayableReasonLine(r);
    },
    /** Compact blocker chip label for an unavailable card (english i18n key). */
    chipLabel(entry: ConsoleHandEntry): string | undefined {
      return shortBlockerLabel(entry.card.unplayableReasons ?? []);
    },
    // ── navigation (called by the shell, mirrors ConsoleBoardSection) ──────
    /** D-pad / left-stick: move the selection across the grid, keep it visible. */
    move(dir: HandNavDir): void {
      consoleState.handIndex = stepHandGrid(this.index, dir, this.entries.length, this.plan.cols);
      void this.$nextTick(() => this.ensureSelectedVisible());
    },
    /** Right stick: free vertical scroll; the scroll handler nudges selection. */
    stickScroll(dy: number): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined || !this.plan.scrolls) {
        return;
      }
      grid.scrollBy({top: dy * STICK_SCROLL_STEP, behavior: 'auto'});
    },
    // ── scroll / windowing / measure ──────────────────────────────────────
    onScroll(): void {
      if (this.rafScroll !== undefined) {
        return;
      }
      this.rafScroll = requestAnimationFrame(() => {
        this.rafScroll = undefined;
        this.applyScroll();
      });
    },
    applyScroll(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined) {
        return;
      }
      const p = this.plan;
      const st = grid.scrollTop;
      // Row-gated: only re-render the window when the first visible row changes.
      const firstRow = p.rowStride > 0 ? Math.floor((st - EDGE_INSET) / p.rowStride) : 0;
      if (firstRow !== this.lastFirstRow) {
        this.lastFirstRow = firstRow;
        this.scrollTopPx = st;
      }
      // Smooth indicators (cheap — one style + one text node).
      const maxScroll = Math.max(1, grid.scrollHeight - grid.clientHeight);
      this.scrollFrac = clampNum(0, 1, st / maxScroll);
      // Keep the selection visible while free-scrolling (lazy edge nudge).
      this.reconcileSelection(st);
    },
    reconcileSelection(st: number): void {
      const p = this.plan;
      if (!p.scrolls || p.cols <= 0 || this.box.h <= 0) {
        return;
      }
      const firstFull = Math.ceil((st - EDGE_INSET) / p.rowStride);
      const lastFull = Math.floor((st - EDGE_INSET + this.box.h) / p.rowStride) - 1;
      if (lastFull < firstFull) {
        return;
      }
      const selRow = Math.floor(this.index / p.cols);
      if (selRow < firstFull) {
        this.clampSelectionToRow(firstFull);
      } else if (selRow > lastFull) {
        this.clampSelectionToRow(lastFull);
      }
    },
    clampSelectionToRow(row: number): void {
      const p = this.plan;
      const r = clampNum(0, p.rows - 1, row);
      const col = this.index % p.cols;
      const idx = Math.min(this.entries.length - 1, r * p.cols + col);
      if (idx !== consoleState.handIndex && idx >= 0) {
        consoleState.handIndex = idx;
      }
    },
    ensureSelectedVisible(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      const p = this.plan;
      if (grid === undefined || !p.scrolls || p.cols <= 0) {
        return;
      }
      const row = Math.floor(this.index / p.cols);
      const top = EDGE_INSET + row * p.rowStride;
      const bottom = top + p.slotH;
      const viewTop = grid.scrollTop;
      const viewBottom = viewTop + grid.clientHeight;
      let next = viewTop;
      // Leave an EDGE_INSET buffer so the card's top badge / glow clear the edge.
      if (top - EDGE_INSET < viewTop) {
        next = top - EDGE_INSET;
      } else if (bottom + EDGE_INSET > viewBottom) {
        next = bottom + EDGE_INSET - grid.clientHeight;
      }
      const maxScroll = Math.max(0, grid.scrollHeight - grid.clientHeight);
      next = clampNum(0, maxScroll, next);
      if (Math.abs(next - viewTop) > 0.5) {
        grid.scrollTop = next; // fires @scroll → applyScroll re-windows
      }
    },
    measure(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined) {
        return;
      }
      const w = grid.clientWidth;
      const h = grid.clientHeight;
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
        void this.$nextTick(() => {
          this.applyScroll();
          this.ensureSelectedVisible();
        });
      }
    },
    scheduleMeasure(): void {
      if (this.rafMeasure !== undefined) {
        return;
      }
      this.rafMeasure = requestAnimationFrame(() => {
        this.rafMeasure = undefined;
        this.measure();
      });
    },
  },
  mounted() {
    const grid = this.$refs.grid as HTMLElement | undefined;
    if (grid !== undefined && typeof ResizeObserver !== 'undefined') {
      this.ro = markRaw(new ResizeObserver(() => this.scheduleMeasure()));
      this.ro.observe(grid);
    }
    this.measure();
    void this.$nextTick(() => this.ensureSelectedVisible());
  },
  beforeUnmount() {
    this.ro?.disconnect();
    if (this.rafScroll !== undefined) {
      cancelAnimationFrame(this.rafScroll);
    }
    if (this.rafMeasure !== undefined) {
      cancelAnimationFrame(this.rafMeasure);
    }
  },
});
</script>
