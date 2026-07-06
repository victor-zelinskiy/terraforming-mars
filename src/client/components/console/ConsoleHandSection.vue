<template>
  <div class="con-hand con-hand--grid" :style="rootStyle">
    <!-- Premium hand SHELF: a smart, virtualized grid (the old horizontal
         carousel is gone). Only the visible rows + overscan are rendered, so a
         big hand pages at 60fps; a small hand centres with no scrollbar. -->
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
                   'con-hand__slot--playable': !saleActive && entry.playable,
                   'con-hand__slot--unplayable': !saleActive && !entry.playable,
                   'con-hand__slot--sale-picked': saleActive && isSaleSelected(entry.card.name),
                 }">
              <Card :card="entry.card" :key="entry.card.name" lightweight />
              <span v-if="entry.robot" class="con-hand__robot" v-i18n>Robots</span>
              <!-- Sale pick band, else a COMPACT blocker chip on an
                   unavailable card (the full reason is in the panel below). -->
              <span v-if="saleActive && isSaleSelected(entry.card.name)" class="con-cards__pickband con-cards__pickband--sale" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              <span v-else-if="!saleActive && !entry.playable && chipLabel(entry)" class="con-hand__chip" aria-hidden="true">{{ $t(chipLabel(entry) || '') }}</span>
            </div>
          </div>
          <div class="con-hand__spacer" :style="{height: bottomSpacerPx + 'px'}" aria-hidden="true"></div>
        </div>
      </div>

      <!-- Thin premium scrollbar / progress (only when the grid scrolls). -->
      <div v-if="plan.scrolls" class="con-hand__scrollbar" aria-hidden="true">
        <div class="con-hand__scrollthumb" :style="thumbStyle"></div>
      </div>
    </div>

    <!-- Selected-card INFO PANEL: name + play state + the server's structured
         reason (unit-suffixed "Сейчас: …") + the X = fullscreen read hint. -->
    <div v-if="selected !== undefined"
         class="con-cards__verdictbar con-hand__verdictbar"
         :class="{
           'con-hand__verdictbar--ok': !saleActive && selectedPlayable,
           'con-hand__verdictbar--blocked': !saleActive && !selectedPlayable,
           'con-hand__verdictbar--sale': saleActive,
         }">
      <span class="con-cards__verdict-name">{{ $t(selected.name) }}</span>
      <template v-if="saleActive">
        <span class="con-cards__verdict" :class="isSaleSelected(selected.name) ? 'con-cards__verdict--picked' : 'con-cards__verdict--ok'">
          <GamepadGlyph control="confirm" />
          <span>{{ $t(isSaleSelected(selected.name) ? 'Deselect' : 'Select') }}</span>
        </span>
        <span class="con-cards__verdict con-cards__verdict--go" :class="{'con-cards__verdict--off': saleSelected.length === 0}">
          <GamepadGlyph control="triggerR" />
          <span>{{ $t('Sell') }}: <b>{{ saleSelected.length }}</b> (+{{ saleSelected.length }} M€)</span>
        </span>
      </template>
      <template v-else-if="selectedPlayable">
        <span class="con-cards__verdict con-cards__verdict--ok">
          <GamepadGlyph control="confirm" /><span>{{ $t('Play now') }}</span>
        </span>
      </template>
      <template v-else>
        <span class="con-cards__verdict con-cards__verdict--blocked">
          <span aria-hidden="true">✕</span><span>{{ $t('Unplayable now') }}</span>
        </span>
        <!-- A card with NO server rules-reason but not playable is rules-OK,
             just not your window (opponent's turn / mid-action) — say so, never
             a bare "Нельзя разыграть" nor a misleading "conditions not met". -->
        <span v-if="softBlocked" class="con-hand__reason con-hand__reason--bar con-hand__reason--turn">{{ $t(softReason) }}</span>
        <span v-else v-for="(r, i) in reasons.slice(0, 2)" :key="i" class="con-hand__reason con-hand__reason--bar" :class="'con-hand__reason--' + r.type">{{ reasonLine(r) }}</span>
      </template>
      <span class="con-cards__verdict con-cards__verdict--zoom">
        <GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span>
      </span>
    </div>

    <div class="con-hand__strip-hints" aria-hidden="true">
      <span class="con-hand__strip-hint"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
      <span class="con-hand__strip-hint"><GamepadGlyph control="triggerR" /><span>{{ $t('Next playable') }}</span></span>
      <span v-if="plan.scrolls" class="con-hand__strip-hint"><GamepadGlyph control="stickR" /><span>{{ $t('Scroll') }}</span></span>
      <span v-if="plan.scrolls && entries.length > 0" class="con-hand__rowind">{{ rowIndicator }}</span>
      <span class="con-hand__counter">{{ entries.length === 0 ? 0 : index + 1 }} / {{ entries.length }}</span>
    </div>
    <div v-if="entries.length === 0" class="con-inspector__empty">{{ $t('No cards in hand') }}</div>
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
 * `move()`/`nextPlayable()` (mirrors `ConsoleBoardSection.move()`), and the
 * shell just delegates to those methods.
 *
 * PLAYABLE-FIRST sort is applied by the shell; the info panel under the grid
 * carries the play state + the SERVER's structured unplayable reasons (with the
 * unit-suffixed "Сейчас: …") so the player never needs a hover.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateTextWithParams} from '@/client/directives/i18n';
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {consoleState} from '@/client/console/consoleRouter';
import {planHandGrid, stepHandGrid, shortBlockerLabel, HandGridPlan, HandNavDir} from '@/client/components/console/consoleHandGrid';

export type ConsoleHandEntry = {
  card: CardModel,
  playable: boolean,
  /** Hosted on Self-Replicating Robots. */
  robot: boolean,
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
  components: {Card, GamepadGlyph},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<ConsoleHandEntry>>, required: true},
    index: {type: Number, required: true},
    /** Sell-patents mode: A toggles picks, RT confirms (shell owns the flow). */
    saleActive: {type: Boolean, default: false},
    saleSelected: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
    /** The turn/phase reason (i18n key) for a card that is rules-OK but not
     *  playable right now (opponent's turn / mid-action). Set by the shell. */
    softReason: {type: String, default: 'Not your turn to take any actions'},
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
      return !this.saleActive && this.selected !== undefined && !this.selectedPlayable && this.reasons.length === 0;
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
    rowIndicator(): string {
      const p = this.plan;
      const selRow = p.cols > 0 ? Math.floor(this.index / p.cols) + 1 : 1;
      return translateTextWithParams('Row ${0} / ${1}', [String(selRow), String(p.rows)]);
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
    /** RT: jump to the next playable card (cyclic) and scroll to it. */
    nextPlayable(): void {
      const n = this.entries.length;
      for (let step = 1; step <= n; step++) {
        const i = (this.index + step) % n;
        if (this.entries[i]?.playable) {
          consoleState.handIndex = i;
          void this.$nextTick(() => this.ensureSelectedVisible());
          return;
        }
      }
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
