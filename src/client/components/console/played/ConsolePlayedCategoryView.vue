<template>
  <!--
    THE CATEGORY VIEW — the modal half of the «Разыграно» physical transition.
    Mounted for the whole episode (opening → open → closing); the cards that
    fly in/out are the .con-deal-proxy chassis in the fixed flight layer at
    the bottom (the ONLY visible copy of each card while airborne — the grid
    slots below render held geometry until the handoff).

    Layout: ONE card → the near-fullscreen single stage; else the adaptive
    grid planned by the hand's engine (planCategoryView), rows WINDOWED
    (visible + overscan) so a 60-card category never mounts 60 premium faces
    at once. Slots carry [data-zoom-slot] (the SHARED fullscreen-inspect
    origin key — `slotZoomOrigin` resolves it, so X lifts the card OUT of its
    slot into fullscreen and returns it there, exactly like the hand overlay;
    it MUST be `data-zoom-slot`, not a bespoke attribute, or the premium
    physical open/close degrades to the textual rise-from-depth). Geometry
    mirrors categoryTargetRect EXACTLY (centred rows, partial last row
    centred), so the proxies land pixel-true on the real slots.
  -->
  <div class="con-played-cat"
       :class="{
         'con-played-cat--busy': busy,
         'con-played-cat--framed': state.frameOn,
         'con-played-cat--held': state.holdCards,
       }"
       role="dialog"
       :aria-label="$t(title)">
    <div class="con-played-cat__backdrop" aria-hidden="true" @click="requestClose"></div>

    <div class="con-played-cat__panel">
      <div class="con-played-cat__head">
        <span class="con-played-cat__kicker">{{ $t('Played') }}</span>
        <span class="con-played-cat__title" :class="'con-played-cat__title--' + (state.category ?? '')">{{ titleText }}</span>
        <span class="con-played-cat__count">{{ cards.length }}</span>
      </div>

      <!-- SINGLE card — the near-fullscreen stage (no grid chrome). -->
      <div v-if="layout.kind === 'single'" class="con-played-cat__stage" ref="body">
        <div v-if="cards[0] !== undefined"
             class="con-played-cat__slot con-played-cat__slot--single"
             :class="slotClasses(0, cards[0].name)"
             :style="{width: layout.slotW + 'px', height: layout.slotH + 'px'}"
             :data-zoom-slot="cards[0].name"
             @click="onSlotClick(0)">
          <!-- __lift is THE focus-transform target (the tableau's own idiom):
               the card AND its state badges are ONE physical object — a lift
               that moved only the face left the ✓ band floating behind. -->
          <div class="con-played-cat__lift">
            <div class="con-played-cat__face" :style="{zoom: String(layout.zoom)}">
              <!-- The near-fullscreen stage — always the full art tier. -->
              <ConsolePlayedCardLite :name="cards[0].name" />
            </div>
          </div>
        </div>
      </div>

      <!-- GRID — windowed rows over the plan (hand-section discipline). The
           edge inset keeps the focus ring / lift clear of the scroll clip;
           a fitting grid centres vertically (the physical-table air). -->
      <div v-else class="con-played-cat__bodybox" ref="body">
        <div class="con-played-cat__grid"
             :class="{'con-played-cat__grid--centered': !gridPlan.scrolls}"
             ref="grid"
             :style="{padding: insetPx + 'px'}"
             @scroll.passive="onScroll">
          <div class="con-played-cat__pad" ref="pad" :style="{width: gridPlan.contentW + 'px'}">
            <div class="con-played-cat__spacer" :style="{height: topSpacerPx + 'px'}" aria-hidden="true"></div>
            <div v-for="row in renderRows" :key="row" class="con-played-cat__row" :style="{height: gridPlan.rowStride + 'px', columnGap: gridPlan.gapX + 'px'}">
              <div v-for="(card, ci) in rowCards(row)"
                   :key="card.name"
                   class="con-played-cat__slot"
                   :class="slotClasses(row * gridPlan.cols + ci, card.name)"
                   :style="{width: gridPlan.slotW + 'px', height: gridPlan.slotH + 'px'}"
                   :data-zoom-slot="card.name"
                   @click="onSlotClick(row * gridPlan.cols + ci)">
                <div class="con-played-cat__lift">
                  <!-- Faces mount DEFERRED (facesOn): during the open flight
                       the grid is held invisible anyway — only slot geometry
                       is needed (targets are pure plan math). The real faces
                       mount at the frame beat, under the settled proxies, so
                       the open flush never pays for two full card sets. -->
                  <div v-if="facesOn" class="con-played-cat__face" :style="{zoom: String(gridPlan.cardZoom)}">
                    <ConsolePlayedCardLite :name="card.name" :art-tier="catArtTier" />
                  </div>
                </div>
              </div>
            </div>
            <div class="con-played-cat__spacer" :style="{height: bottomSpacerPx + 'px'}" aria-hidden="true"></div>
          </div>
        </div>
        <div v-if="gridPlan.scrolls" class="con-played-cat__scrollbar" aria-hidden="true">
          <div class="con-played-cat__scrollthumb" :style="thumbStyle"></div>
        </div>
      </div>
    </div>

    <!-- The FLIGHT LAYER — one shared flip chassis per airborne card. Above
         the panel, inside the overlay's stacking context (under the command
         bar). Mounted only while flights exist; the director owns every
         transform. -->
    <div v-if="state.flights.length > 0" class="con-played-cat__fly" aria-hidden="true">
      <div v-for="f in state.flights"
           :key="f.id"
           class="con-deal-proxy con-played-cat__proxy"
           :ref="(el) => registerCategoryFlightEl(f.id, el)">
        <div class="con-deal-proxy__flip">
          <div class="con-deal-proxy__face">
            <!-- The proxy lands on a grid slot — same art tier as the grid,
                 so the handoff crossfades over the very same decoded file. -->
            <ConsolePlayedCardLite :name="f.name" :art-tier="catArtTier" />
          </div>
          <div class="con-deal-proxy__back">
            <div class="con-card-back con-card-back--flyer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsolePlayedCategoryView — the category-view modal + the OWNER of the
 * physical open/close transition (the overlay only flips the state):
 *
 *  OPEN  — mounted at phase 'opening' with every card HELD: the grid lays
 *          out invisibly (measurable), the tableau slots hold too, and the
 *          proxies — placed on the REAL tableau rects — are the only visible
 *          cards. One settled measure later the director flies them onto the
 *          plan-derived grid rects (events flip open mid-flight), the frame
 *          assembles (CSS), the proxies dissolve over the real slots.
 *  CLOSE — the mirrored journey home: proxies appear on the CURRENT grid
 *          rects (scroll folded in), the frame fades, the cards fly back to
 *          their live tableau slots (events flip shut onto the pile), and
 *          the last patch releases both holds in one flush — pixel-true.
 *
 *  B mid-open REVERSES the same timeline (handRevealDirector idiom); rapid
 *  re-taps are absorbed by the state machine. Reduced motion: no flights —
 *  the same phases step through synchronously, the modal fades via CSS.
 *
 * Input is delegated by the OVERLAY (handleIntent): d-pad = grid navigation
 * (stepHandGrid — column-preserving, honest partial last row), A/X = the
 * fullscreen inspector (physical lift off the grid slot), B = close, right
 * stick = scroll. Focus index lives in playedCategoryState so it survives
 * remounts.
 *
 * BROWSING ONLY. This surface once doubled as a composer's pick surface; that
 * job moved to the EMBEDDED played-target step, which presents inside the
 * workspace that asked instead of taking the player out to the table.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {openConsoleCardZoom, slotZoomOrigin, ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {zoomProvenanceOver} from '@/client/components/console/played/playedProvenance';
import {stepHandGrid, HandGridPlan} from '@/client/components/console/consoleHandGrid';
import {artTierForWidth, CardArtTier, preloadPremiumCardArt} from '@/client/cards/cardArt';
import {
  planCategoryView, categoryTargetRect, plannedFlightIndices, CategoryViewLayout, FlightRect,
  PLAYED_CATEGORY_LABEL,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, nextCategoryFlightId,
  registerCategoryFlightEl, CategoryFlight,
} from '@/client/console/played/playedCategoryView';
import {translateText} from '@/client/directives/i18n';
import {
  runCategoryOpen, runCategoryClose, reverseCategoryEpisode, finishCategoryInstant,
  dissolveCategoryProxies, resetCategoryDirector,
  CategoryFlightPlan, CATEGORY_FRAME_MS,
} from '@/client/console/played/playedCategoryDirector';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

/** Rows kept mounted above/below the viewport (hand-section discipline). */
const OVERSCAN = 2;
/** Right-stick scroll px per intent frame. */
const STICK_SCROLL_STEP = 44;
/** Edge inset INSIDE the grid clip (logical px, × uiScale): the focus ring,
 *  its glow and the focused lift never cut against the scroll edge. */
const CAT_EDGE_INSET = 22;
/** Fallback body box before the first measure / under JSDOM. */
const FALLBACK_W = 1280;
const FALLBACK_H = 560;

function clampNum(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default defineComponent({
  name: 'ConsolePlayedCategoryView',
  components: {ConsolePlayedCardLite, GamepadGlyph},
  props: {
    /** The open category's cards (tableau order — matches state.names). */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /**
     * The hosting table's BY-NAME provenance lookup (→ the plate the
     * fullscreen shows: seat · zone · N of M). Passed down so the viewer
     * opened from THIS grid reads identically to the table's own
     * single-card shortcut. Undefined → no plate (defensive).
     */
    provenanceByName: {type: Function as PropType<(name: string | undefined) => ConsoleZoomProvenance | undefined>, default: undefined},
  },
  emits: {
    /** The episode fully settled CLOSED — the overlay drops the mount. */
    'settled-closed': () => true,
  },
  data() {
    return {
      state: playedCategoryState,
      registerCategoryFlightEl,
      box: {w: 0, h: 0},
      scrollTopPx: 0,
      scrollFrac: 0,
      lastFirstRow: -1,
      ro: undefined as ResizeObserver | undefined,
      rafScroll: undefined as number | undefined,
      frameTimer: undefined as number | undefined,
      /** Grid faces are mounted (deferred past the open flight — see the
       *  template note). Seeded true for a view that mounts already open. */
      facesOn: playedCategoryState.phase === 'open',
      /** Focused-card full-art prewarm debounce (thumb-tier grids only). */
      prewarmTimer: undefined as number | undefined,
    };
  },
  computed: {
    title(): string {
      const key = this.state.category;
      return key !== undefined ? PLAYED_CATEGORY_LABEL[key] : 'Played';
    },
    /** The header title — the open category's caption. */
    titleText(): string {
      return translateText(this.title);
    },
    busy(): boolean {
      return this.state.phase === 'opening' || this.state.phase === 'closing';
    },
    insetPx(): number {
      return Math.round(CAT_EDGE_INSET * conUiScale());
    },
    layout(): CategoryViewLayout {
      const w = this.box.w > 0 ? this.box.w : FALLBACK_W;
      const h = this.box.h > 0 ? this.box.h : FALLBACK_H;
      // The grid box includes its own edge inset (clip padding) — the plan
      // works the inner content box. The single stage keeps its raw box
      // (its width/height SHARES already reserve the air).
      const inset = this.cards.length > 1 ? this.insetPx * 2 : 0;
      return planCategoryView({availW: w - inset, availH: h - inset, count: this.cards.length, uiScale: conUiScale()});
    },
    /** The grid plan (grid layouts only — a convenience narrow). */
    gridPlan(): HandGridPlan {
      return this.layout.kind === 'grid' ? this.layout.plan : {
        cols: 1, rows: this.cards.length, cardZoom: 1, slotW: 320, slotH: 460,
        rowStride: 476, gapX: 16, gapY: 16, contentW: 320, contentH: 460, scrolls: false, visibleRows: 1,
      };
    },
    renderRows(): Array<number> {
      const p = this.gridPlan;
      if (this.layout.kind !== 'grid' || p.rows <= 0) {
        return [];
      }
      if (!p.scrolls) {
        return this.range(0, p.rows - 1);
      }
      const availH = this.box.h > 0 ? this.box.h : FALLBACK_H;
      const contentY = this.scrollTopPx - this.insetPx;
      const first = Math.max(0, Math.floor(contentY / p.rowStride) - OVERSCAN);
      const last = Math.min(p.rows - 1, Math.ceil((contentY + availH) / p.rowStride) + OVERSCAN);
      return this.range(first, last);
    },
    topSpacerPx(): number {
      const rows = this.renderRows;
      return rows.length === 0 ? 0 : rows[0] * this.gridPlan.rowStride;
    },
    bottomSpacerPx(): number {
      const rows = this.renderRows;
      if (rows.length === 0) {
        return 0;
      }
      return (this.gridPlan.rows - 1 - rows[rows.length - 1]) * this.gridPlan.rowStride;
    },
    thumbStyle(): Record<string, string> {
      const p = this.gridPlan;
      const visible = this.box.h > 0 ? this.box.h : FALLBACK_H;
      const content = p.contentH + this.insetPx * 2;
      const hPct = clampNum(8, 100, (visible / Math.max(1, content)) * 100);
      const topPct = (100 - hPct) * this.scrollFrac;
      return {height: hPct + '%', top: topPct + '%'};
    },
    /** The art tier of the grid faces AND their proxies — one decision, one
     *  decoded file per card (see cardArt.ts ART TIERS). The single-card
     *  stage renders near-fullscreen and stays on 'full' in the template. */
    catArtTier(): CardArtTier {
      if (this.layout.kind !== 'grid') {
        return 'full';
      }
      return artTierForWidth(this.gridPlan.slotW);
    },
  },
  watch: {
    /** A shrinking category (undo / seat data refresh) clamps the focus. */
    'cards.length'(n: number) {
      if (this.state.focusIndex > n - 1) {
        this.state.focusIndex = Math.max(0, n - 1);
      }
    },
    /** Thumb-tier grids prewarm the FOCUSED card's full art (debounced) so
     *  the fullscreen inspector opens onto an already-decoded picture. One
     *  in-flight decode at a time by construction — the debounce collapses
     *  a d-pad sprint into its resting card. */
    'state.focusIndex': {
      immediate: true,
      handler() {
        if (this.prewarmTimer !== undefined) {
          window.clearTimeout(this.prewarmTimer);
        }
        if (this.catArtTier !== 'thumb' || this.state.phase !== 'open') {
          return;
        }
        this.prewarmTimer = window.setTimeout(() => {
          this.prewarmTimer = undefined;
          const focused = this.cards[this.state.focusIndex];
          if (focused !== undefined) {
            preloadPremiumCardArt([focused.name]);
          }
        }, 160);
      },
    },
  },
  mounted() {
    // Observe the ROOT (fixed inset-0 — resizes with the viewport): the
    // measured box element can SWITCH between the grid and the single stage
    // (an undo shrinking the category), so the observer never re-targets.
    const el = this.$el as HTMLElement | undefined;
    if (el !== undefined && typeof ResizeObserver !== 'undefined') {
      this.ro = markRaw(new ResizeObserver(() => this.measure()));
      this.ro.observe(el);
    }
    this.measure();
    // The OPEN flight starts once the grid has laid out (held-invisible).
    void this.beginOpenFlight();
  },
  beforeUnmount() {
    this.ro?.disconnect();
    if (this.rafScroll !== undefined) {
      cancelAnimationFrame(this.rafScroll);
    }
    if (this.prewarmTimer !== undefined) {
      window.clearTimeout(this.prewarmTimer);
      this.prewarmTimer = undefined;
    }
    this.clearFrameTimer();
    resetCategoryDirector();
  },
  methods: {
    range(a: number, b: number): Array<number> {
      const out: Array<number> = [];
      for (let i = a; i <= b; i++) {
        out.push(i);
      }
      return out;
    },
    rowCards(row: number): ReadonlyArray<CardModel> {
      const start = row * this.gridPlan.cols;
      return this.cards.slice(start, start + this.gridPlan.cols);
    },
    /** The layout box: the GRID's content box (its padding is zero, so
     *  clientWidth = the true usable width) or the single-card stage. */
    boxEl(): HTMLElement | undefined {
      return (this.$refs.grid as HTMLElement | undefined) ?? (this.$refs.body as HTMLElement | undefined);
    },
    measure(): void {
      const el = this.boxEl();
      if (el === undefined) {
        return;
      }
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
      }
    },
    clearFrameTimer(): void {
      if (this.frameTimer !== undefined) {
        window.clearTimeout(this.frameTimer);
        this.frameTimer = undefined;
      }
    },
    // ── the OPEN flight (mounted at phase 'opening') ────────────────────
    async beginOpenFlight(): Promise<void> {
      if (this.state.phase !== 'opening') {
        return;
      }
      if (consoleReducedMotionActive()) {
        this.settleOpenInstant();
        return;
      }
      // The proxies mount FIRST (one flush), then a settle frame so the
      // held grid has laid out — every measure lands on real geometry.
      this.spawnOpenFlights();
      await this.$nextTick();
      await this.frame();
      if (this.state.phase !== 'opening') {
        return;
      }
      const plans = this.buildFlightPlans('open');
      if (plans.length === 0) {
        this.settleOpenInstant();
        return;
      }
      runCategoryOpen(plans, (settledAs) => this.onOpenSettled(settledAs));
      // The director has just PAINTED the proxies on the table rects — the
      // table hands its cards over in the same synchronous turn (no frame
      // where a card exists twice or not at all).
      this.state.holdCards = true;
    },
    settleOpenInstant(): void {
      this.state.flights = [];
      this.state.groundedNames = [];
      this.state.holdCards = false;
      this.state.frameOn = true;
      this.facesOn = true;
      this.state.phase = 'open';
    },
    onOpenSettled(settledAs: 'open' | 'closed'): void {
      if (settledAs === 'closed') {
        // B reversed the open mid-flight — the cards are back on the table.
        resetPlayedCategoryView();
        this.$emit('settled-closed');
        return;
      }
      // Landed: the frame assembles around the cards, the DEFERRED grid
      // faces mount during the frame beat, then the real grid takes over
      // under the dissolving proxies.
      this.state.frameOn = true;
      this.facesOn = true;
      this.clearFrameTimer();
      this.frameTimer = window.setTimeout(() => {
        this.frameTimer = undefined;
        // The dissolve GATES on the real faces being flushed + painted (two
        // frames past the tick): on a throttled main thread the face mount
        // can outlive the frame beat, and a dissolve over unpainted slots is
        // a blink. Deterministic ordering, never a race.
        void this.$nextTick()
          .then(() => this.frame())
          .then(() => this.frame())
          .then(() => {
            if (this.state.phase !== 'opening') {
              return;
            }
            dissolveCategoryProxies(() => {
              this.state.flights = [];
            });
            // The real cards paint the instant the dissolve starts underneath.
            this.state.holdCards = false;
            this.state.phase = 'open';
          });
      }, motionMs(CATEGORY_FRAME_MS));
    },
    // ── the CLOSE flight ────────────────────────────────────────────────
    requestClose(): void {
      if (this.state.phase === 'opening') {
        // Mid-open B: reverse the SAME timeline — the cards retrace home.
        if (!reverseCategoryEpisode()) {
          finishCategoryInstant();
        }
        return;
      }
      if (this.state.phase === 'closing') {
        // A second B while closing: snap home.
        finishCategoryInstant();
        return;
      }
      if (this.state.phase !== 'open') {
        return;
      }
      if (consoleReducedMotionActive()) {
        resetPlayedCategoryView();
        this.$emit('settled-closed');
        return;
      }
      // Fresh flights from the CURRENT grid geometry back to the live table —
      // BOUNDED to the scrolled-to window (+ sweep tails): the grounded rest
      // fades back in place on the table when the close settles.
      this.state.phase = 'closing';
      this.state.frameOn = false;
      const closeIndices = plannedFlightIndices(
        this.layout, this.cards.length,
        this.box.h > 0 ? this.box.h : FALLBACK_H,
        this.currentScrollTop());
      const closeFlown = new Set(closeIndices);
      this.state.flights = closeIndices.map((index): CategoryFlight => ({
        id: nextCategoryFlightId(),
        name: this.cards[index].name,
        index,
        faceDown: this.isFaceDown(this.cards[index].name),
      }));
      this.state.groundedNames = this.cards
        .filter((_, i) => !closeFlown.has(i))
        .map((c) => c.name);
      void this.$nextTick().then(() => {
        if (this.state.phase !== 'closing') {
          return;
        }
        const plans = this.buildFlightPlans('close');
        if (plans.length === 0) {
          resetPlayedCategoryView();
          this.$emit('settled-closed');
          return;
        }
        runCategoryClose(plans, (settledAs) => this.onCloseSettled(settledAs));
        // Proxies painted on the grid rects — the grid hides under them in
        // the same turn (the table stays held throughout the return).
        this.state.holdCards = true;
      });
    },
    onCloseSettled(settledAs: 'open' | 'closed'): void {
      if (settledAs === 'open') {
        // B reversed the close — back to the open view (same landing dance).
        this.onOpenSettled('open');
        return;
      }
      // Home: release BOTH holds in one flush — the tableau slots un-hide
      // exactly where the proxies stand, the proxies unmount the same patch.
      resetPlayedCategoryView();
      this.$emit('settled-closed');
    },
    // ── flight geometry (one measured origin + pure plan math) ──────────
    buildFlightPlans(dir: 'open' | 'close'): Array<CategoryFlightPlan> {
      const layout = this.layout;
      const origin = this.contentOrigin();
      const clip = this.clipRect();
      if (origin === undefined || clip === undefined) {
        return [];
      }
      const scrollTop = dir === 'close' ? this.currentScrollTop() : 0;
      // The real clipping container is the GRID (overflow-y: auto) — its
      // border box is the honest edge the bottom/top row renders against.
      // A partially-crossing VISIBLE landing hands that overflow down as
      // `targetClip` so the proxy lands as clipped as the real slot.
      const gridEl = this.$refs.grid as HTMLElement | undefined;
      const gridClip = layout.kind === 'grid' && gridEl !== undefined && typeof gridEl.getBoundingClientRect === 'function' ?
        gridEl.getBoundingClientRect() : undefined;
      const flights = this.state.flights;
      if (flights.length === 0 || flights.length > this.cards.length) {
        return [];
      }
      const out: Array<CategoryFlightPlan> = [];
      for (const f of flights) {
        if (this.cards[f.index]?.name !== f.name) {
          continue; // the category shifted under the episode (undo)
        }
        const source = this.tableauRect(f.name, f.index);
        if (source === undefined) {
          continue;
        }
        const t = categoryTargetRect(layout, f.index, this.cards.length, origin);
        const target: FlightRect = {x: t.x, y: t.y - scrollTop, w: t.w, h: t.h};
        const targetVisible = target.y + target.h > clip.top - 4 && target.y < clip.bottom + 4;
        let targetClip: {top: number, bottom: number} | undefined;
        if (targetVisible && gridClip !== undefined && gridClip.width > 4) {
          const top = Math.max(0, gridClip.top - target.y);
          const bottom = Math.max(0, target.y + target.h - gridClip.bottom);
          if (top > 0.5 || bottom > 0.5) {
            targetClip = {top, bottom};
          }
        }
        out.push({flight: f, source, target, targetVisible, targetClip});
      }
      return out;
    },
    /** Spawn the open-direction flight entries (the layer mounts them) —
     *  BOUNDED to the top window the view opens at (+ the sweep tail); the
     *  grounded rest dissolves in place on the table. */
    spawnOpenFlights(): ReadonlyArray<CategoryFlight> {
      if (this.state.flights.length > 0) {
        return this.state.flights;
      }
      const indices = plannedFlightIndices(
        this.layout, this.cards.length,
        this.box.h > 0 ? this.box.h : FALLBACK_H,
        0 /* the view always opens at the top */);
      const flown = new Set(indices);
      this.state.flights = indices.map((index): CategoryFlight => ({
        id: nextCategoryFlightId(),
        name: this.cards[index].name,
        index,
        faceDown: this.isFaceDown(this.cards[index].name),
      }));
      this.state.groundedNames = this.cards
        .filter((_, i) => !flown.has(i))
        .map((c) => c.name);
      return this.state.flights;
    },
    /** The grid content origin (proxy landings are derived off it purely). */
    contentOrigin(): {x: number, y: number, w: number, h?: number} | undefined {
      const el = (this.layout.kind === 'single' ? this.$refs.body : this.$refs.pad) as HTMLElement | undefined;
      if (el === undefined || typeof el.getBoundingClientRect !== 'function') {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 4) {
        return undefined;
      }
      // For the scrolled grid the pad's rect already folds scrollTop in —
      // targets are computed in unscrolled space, so add it back here. The
      // single stage passes its height so the lone card centres vertically.
      const scrollBack = this.layout.kind === 'grid' ? this.currentScrollTop() : 0;
      return {x: r.left, y: r.top + scrollBack, w: r.width, h: this.layout.kind === 'single' ? r.height : undefined};
    },
    clipRect(): {top: number, bottom: number} | undefined {
      const el = this.$refs.body as HTMLElement | undefined;
      if (el === undefined || typeof el.getBoundingClientRect !== 'function') {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {top: r.top, bottom: r.bottom};
    },
    currentScrollTop(): number {
      return (this.$refs.grid as HTMLElement | undefined)?.scrollTop ?? 0;
    },
    /**
     * A card's REAL tableau rect: its slot card box, or — for the face-down
     * events pile — the shared backstack rect with a small per-index offset
     * (the physical stack). Global query: the tableau stays mounted below.
     */
    tableauRect(name: string, index: number): FlightRect | undefined {
      if (typeof document === 'undefined') {
        return undefined;
      }
      void index;
      if (this.isFaceDown(name)) {
        // A FACE-DOWN card lives in the shared events pile — its physical spot
        // is the backstack with a small per-card stack offset.
        const pile = document.querySelector<HTMLElement>('.con-played .con-played__family--event .con-played__backstack');
        if (pile === null) {
          return undefined;
        }
        const r = pile.getBoundingClientRect();
        if (r.width < 4) {
          return undefined;
        }
        const rank = this.faceDownRank(name);
        const dx = (rank % 2 === 0 ? -1 : 1) * Math.min(rank, 3) * 2;
        const dy = Math.min(rank, 3) * 2;
        return {x: r.left + dx, y: r.top + dy, w: r.width, h: r.height};
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      const el = document.querySelector<HTMLElement>(`.con-played [data-played-key="${esc}"] .con-played__face :is(.card-container, .pcard)`);
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
    },
    frame(): Promise<void> {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 16);
        }
      });
    },
    // ── input (delegated by the overlay) ────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        this.stickScroll(intent.dy);
        return;
      }
      if (this.busy) {
        // Mid-flight: B reverses/snaps; everything else waits out the beat.
        if (intent.kind === 'press' && consoleActionOf(intent) === 'back') {
          this.requestClose();
        }
        return;
      }
      if (intent.kind === 'nav') {
        if (this.layout.kind === 'grid') {
          this.state.focusIndex = stepHandGrid(this.state.focusIndex, intent.dir, this.cards.length, this.gridPlan.cols);
          void this.$nextTick(() => this.ensureFocusVisible());
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'inspect':
        // X = the fullscreen inspector. (A is deliberately quiet: this is a
        // BROWSING surface — nothing here is chosen.)
        this.inspectFocused();
        break;
      case 'back':
        this.requestClose();
        break;
      default:
        break;
      }
    },
    slotClasses(index: number, _name: string): Record<string, boolean> {
      return {
        'con-played-cat__slot--focused': this.state.phase === 'open' && index === this.state.focusIndex,
      };
    },
    /** The card lies FACE DOWN on the table — the events category. */
    isFaceDown(_name: string): boolean {
      return this.state.category === 'events';
    },
    /** The card's rank within the face-down subset (the pile stack offset). */
    faceDownRank(name: string): number {
      let rank = 0;
      for (const c of this.cards) {
        if (c.name === name) {
          return rank;
        }
        if (this.isFaceDown(c.name)) {
          rank++;
        }
      }
      return rank;
    },
    onSlotClick(index: number): void {
      if (this.busy) {
        return;
      }
      if (this.state.focusIndex === index) {
        // Mouse parity: the second click is the pad's X (inspect).
        this.inspectFocused();
      } else {
        this.state.focusIndex = index;
      }
    },
    /** A / X: the fullscreen inspector over the category list — a PHYSICAL
     *  lift out of the focused grid slot (browse keeps the grid in lockstep). */
    inspectFocused(): void {
      if (this.busy || this.cards.length === 0) {
        return;
      }
      const list = [...this.cards];
      const index = clampNum(0, list.length - 1, this.state.focusIndex);
      const origin = slotZoomOrigin(
        () => this.$el as HTMLElement,
        (i) => list[i]?.name ?? '',
        (i) => {
          this.state.focusIndex = i;
          void this.$nextTick(() => this.ensureFocusVisible());
        },
      );
      // The provenance plate rides the browse: the host's by-name lookup is
      // wrapped into THIS list's index space, so LB/RB across the zone keeps
      // the plate (and «N из M») honest.
      const byName = this.provenanceByName;
      openConsoleCardZoom(list, index, undefined, undefined, {
        origin,
        provenance: byName === undefined ? undefined : zoomProvenanceOver(byName, list),
      });
    },
    ensureFocusVisible(): void {
      if (this.layout.kind !== 'grid' || !this.gridPlan.scrolls) {
        return;
      }
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined) {
        return;
      }
      const p = this.gridPlan;
      const inset = this.insetPx;
      const row = Math.floor(this.state.focusIndex / p.cols);
      const top = inset + row * p.rowStride;
      const bottom = top + p.slotH;
      const viewTop = grid.scrollTop;
      const viewBottom = viewTop + grid.clientHeight;
      let next = viewTop;
      // Keep the edge-inset buffer so the ring/glow clear the clip edge.
      if (top - inset < viewTop) {
        next = top - inset;
      } else if (bottom + inset > viewBottom) {
        next = bottom + inset - grid.clientHeight;
      }
      const maxScroll = Math.max(0, grid.scrollHeight - grid.clientHeight);
      grid.scrollTop = clampNum(0, maxScroll, next);
    },
    stickScroll(dy: number): void {
      if (Math.abs(dy) < 0.05 || this.busy) {
        return;
      }
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (grid === undefined || this.layout.kind !== 'grid' || !this.gridPlan.scrolls) {
        return;
      }
      grid.scrollBy({top: dy * STICK_SCROLL_STEP * conUiScale(), behavior: 'auto'});
    },
    onScroll(): void {
      if (this.rafScroll !== undefined) {
        return;
      }
      this.rafScroll = requestAnimationFrame(() => {
        this.rafScroll = undefined;
        const grid = this.$refs.grid as HTMLElement | undefined;
        if (grid === undefined) {
          return;
        }
        const p = this.gridPlan;
        const st = grid.scrollTop;
        const firstRow = p.rowStride > 0 ? Math.floor(st / p.rowStride) : 0;
        if (firstRow !== this.lastFirstRow) {
          this.lastFirstRow = firstRow;
          this.scrollTopPx = st;
        }
        const maxScroll = Math.max(1, grid.scrollHeight - grid.clientHeight);
        this.scrollFrac = clampNum(0, 1, st / maxScroll);
      });
    },
  },
});
</script>
