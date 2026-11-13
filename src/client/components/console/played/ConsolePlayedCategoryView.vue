<template>
  <div ref="root" class="con-played-cat"
       :class="{
         'con-played-cat--busy': busy,
         'con-played-cat--framed': state.frameOn,
         'con-played-cat--held': state.holdCards,
         'con-played-cat--unfolded': unfolded,
         'con-played-cat--closing': state.phase === 'closing',
       }"
       :style="rootStyle"
       role="dialog"
       :aria-label="$t(title)">
    <div class="con-played-cat__backdrop" aria-hidden="true" @click="requestClose"></div>

    <!-- No head of its own: an embedded surface never titles itself — the open category is the HOST's crumb stage
         (РАЗЫГРАНО › ‹участник› › АКТИВНЫЕ, or the Information Workspace's РАЗЫГРАНО · АКТИВНЫЕ). -->
    <div class="con-played-cat__panel">

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
              <ConsolePlayedCardLite :name="cards[0].name" :card="publicFaceModel(cards[0])" />
            </div>
          </div>
        </div>
      </div>

      <!-- THE PAGED ALBUM — strict pages on one transform strip (the hand album's law): the page on screen is DERIVED
           from the focused card, LB/RB turn it, the spine states how many pages there are and which one stands. -->
      <div v-else-if="layout.kind === 'album'" class="con-played-cat__albumbox" ref="body"
           :data-cat-pages="album.pageCount" :data-cat-page="activePage" @wheel.prevent="onWheel">
        <div class="con-played-cat__album" ref="album">
          <div class="con-played-cat__strip" :class="{'con-played-cat__strip--live': stripLive}" :style="{transform: `translateX(${-activePage * album.stride}px)`}">
            <div v-for="p in renderPages" :key="'catpage' + p" class="con-played-cat__page" :data-cat-page-index="p"
                 :style="{left: p * album.stride + 'px', width: box.w + 'px', height: (box.h - album.spineH) + 'px'}">
              <div v-for="i in pageIndices(p)" :key="cards[i].name"
                   class="con-played-cat__slot con-played-cat__slot--album"
                   :class="slotClasses(i, cards[i].name)"
                   :style="albumSlotStyle(i)"
                   :data-zoom-slot="cards[i].name"
                   @click="onSlotClick(i)">
                <div class="con-played-cat__lift">
                  <div v-if="facesOn" class="con-played-cat__face" :style="{zoom: String(album.zoom)}">
                    <ConsolePlayedCardLite :name="cards[i].name" :card="publicFaceModel(cards[i])" :art-tier="catArtTier" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- THE PAGE EDGES — «there is a page that way»: both always render, an unavailable one is a ghost. -->
          <button v-for="side in ['left', 'right']" :key="side" type="button" tabindex="-1"
                  class="con-played-cat__pgedge"
                  :class="[`con-played-cat__pgedge--${side}`, {'con-played-cat__pgedge--off': side === 'left' ? activePage === 0 : activePage >= album.pageCount - 1}]"
                  :style="{width: edgePx + 'px'}"
                  aria-hidden="true"
                  @click="turnPage(side === 'left' ? -1 : 1)">
            <span class="con-played-cat__pgedge-chev">{{ side === 'left' ? '‹' : '›' }}</span>
          </button>
        </div>
        <!-- THE SPINE — the page count stated where the eye already is: the bumpers that turn it, «N / M», a dot per page,
             the range of the zone this page shows («1–10 из 24»). -->
        <div class="con-played-cat__spine" :style="{height: album.spineH + 'px'}" data-cat-spine>
          <GamepadGlyph control="bumperL" class="con-played-cat__spine-glyph" :class="{'con-played-cat__spine-glyph--off': activePage === 0}" />
          <span class="con-played-cat__spine-page"><b>{{ activePage + 1 }}</b> / {{ album.pageCount }}</span>
          <span class="con-played-cat__spine-dots" aria-hidden="true">
            <span v-for="p in album.pageCount" :key="'dot' + p" class="con-played-cat__spine-dot" :class="{'con-played-cat__spine-dot--on': p - 1 === activePage}"></span>
          </span>
          <span class="con-played-cat__spine-range">{{ pageRangeText }}</span>
          <GamepadGlyph control="bumperR" class="con-played-cat__spine-glyph" :class="{'con-played-cat__spine-glyph--off': activePage >= album.pageCount - 1}" />
        </div>
      </div>

      <!-- GRID — windowed rows over the plan (hand-section discipline). The
           edge inset keeps the focus ring / lift clear of the scroll clip;
           a fitting grid centres vertically (the physical-table air). -->
      <div v-else class="con-played-cat__bodybox" ref="body" :style="bodyAirStyle">
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
                    <ConsolePlayedCardLite :name="card.name" :card="publicFaceModel(card)" :art-tier="catArtTier" />
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
            <ConsolePlayedCardLite :name="f.name" :card="publicFaceModelOf(f.name)" :art-tier="catArtTier" />
          </div>
          <div class="con-deal-proxy__back">
            <div class="con-card-back con-card-back--flyer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE CATEGORY VIEW — the modal half of the «Разыграно» physical transition.
 * Mounted for the whole episode (opening → open → closing); the cards that
 * fly in/out are the .con-deal-proxy chassis in the fixed flight layer at
 * the bottom (the ONLY visible copy of each card while airborne — the grid
 * slots below render held geometry until the handoff).
 *
 * Layout: ONE card → the near-fullscreen single stage; a zone that stands
 * on one readable screen → the adaptive grid planned by the hand's engine
 * (planCategoryView); a zone too big for that → the PAGED ALBUM (the owner,
 * 2026-10-19): strict pages of at least two rows on one transform strip,
 * LB/RB turn them, ◀/▶ off a page's edge continue onto the next, the page
 * count is STATED (the spine under the pages, the edge chevrons) — never a
 * scroll. Only the page on screen and its neighbours mount faces. Slots
 * carry [data-zoom-slot] (the SHARED fullscreen-inspect
 * origin key — `slotZoomOrigin` resolves it, so X lifts the card OUT of its
 * slot into fullscreen and returns it there, exactly like the hand overlay;
 * it MUST be `data-zoom-slot`, not a bespoke attribute, or the premium
 * physical open/close degrades to the textual rise-from-depth). Geometry
 * mirrors categoryTargetRect EXACTLY (centred rows, partial last row
 * centred), so the proxies land pixel-true on the real slots.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

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
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {albumSpecFor} from '@/client/components/console/consoleHandAlbum';
import {consolePlayedUi} from '@/client/console/consolePlayedUi';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {openConsoleCardZoom, slotZoomOrigin, ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {zoomProvenanceOver} from '@/client/components/console/played/playedProvenance';
import {stepHandGrid, HandGridPlan} from '@/client/components/console/consoleHandGrid';
import {artTierForWidth, CardArtTier, preloadPremiumCardArt} from '@/client/cards/cardArt';
import {
  planCategoryView, planCategoryAlbum, categoryTargetRect, plannedFlightIndices, CategoryViewLayout, CategoryAlbumPlan, FlightRect,
  PLAYED_CATEGORY_LABEL, CAT_ALBUM_EDGE, albumPageOf, albumPageIndices, stepCategoryAlbum, turnCategoryAlbum,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, nextCategoryFlightId,
  registerCategoryFlightEl, CategoryFlight,
} from '@/client/console/played/playedCategoryView';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {
  runCategoryOpen, runCategoryClose, reverseCategoryEpisode, finishCategoryInstant, startHeldCategoryEpisode,
  dissolveCategoryProxies, resetCategoryDirector,
  CategoryFlightPlan, CATEGORY_FRAME_MS,
} from '@/client/console/played/playedCategoryDirector';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {publicFaceModel} from '@/client/components/premiumCard/premiumFleetDock';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {whenPainted} from '@/client/console/session/sessionWaits';
import {useFlowScope} from '@/client/console/session/useFlowScope';

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

/** The flight waits for the floor's real start at most this long (wall clock) — a backstop that STARTS, never resolves. */
const FLOOR_START_WAIT_MS = 600;

/** The open / close flight takes every press but B on purpose (B reverses / snaps it) — said on the ledger. */
const CATEGORY_FLIGHT_ABSORBER = 'played-category-flight';

/**
 * The grid body's air around its clip (rem — top, sides, bottom). Inline on `__bodybox`, read by the plan: the GRID
 * stands in the body's box MINUS this air, the album and the single stage in the whole box. One source, so the plan
 * knows the grid's room while the album is the one on screen (PL-1416 — a box measured off whichever element was
 * mounted flipped the layout grid ↔ album under the open flight).
 */
const BODY_AIR_REM = {top: 1, side: 1.2, bottom: 1.2};

/** The focused card's lift (rem) — `__slot--lifted` in console_played.less; its proxy lands ON that pose. */
const FOCUS_LIFT_REM = 0.35;

/** Right-stick page flick (the album): the axis magnitude that turns a page, and the hold cadence. */
const FLICK_THRESHOLD = 0.5;
const FLICK_REPEAT_MS = 280;

/** Mouse wheel over the album: notches accumulate into one page turn. */
const WHEEL_NOTCH = 120;
const WHEEL_DECAY_MS = 260;

function clampNum(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

defineOptions({name: 'ConsolePlayedCategoryView'});
const props = defineProps({
  /** The open category's cards (tableau order — matches state.names). */
  cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
  /**
   * The hosting table's BY-NAME provenance lookup (→ the plate the
   * fullscreen shows: seat · zone · N of M). Passed down so the viewer
   * opened from THIS grid reads identically to the table's own
   * single-card shortcut. Undefined → no plate (defensive).
   */
  provenanceByName: {type: Function as PropType<(name: string | undefined) => ConsoleZoomProvenance | undefined>, default: undefined},
  /**
   * The table's PACKET place for a card whose page is not mounted (the album keeps the active page and its
   * neighbours): just past the album's edge on the card's side — the card flies in from the next page and flies
   * back out to it. Undefined → such a card simply appears in the grid (the hold still covers it).
   */
  offPageRect: {type: Function as PropType<(name: string) => FlightRect | undefined>, default: undefined},
  /** The table's shelf face (APPLIED zoom, PL-619): the grid never lays a lifted card out smaller than its shelf. */
  faceFloorZoom: {type: Number, default: undefined},
  /** The host table BODY's insets inside the table root (PL-626) — the view never covers the crumb or the satellite lane. */
  boxInset: {type: Object as PropType<Record<string, string>>, default: undefined},
});
const emit = defineEmits({
  /** The episode fully settled CLOSED — the overlay drops the mount. */
  'settled-closed': () => true,
});

const flow = useFlowScope('played-category-view');
const body = useTemplateRef<HTMLElement>('body');
const grid = useTemplateRef<HTMLElement>('grid');
const albumEl = useTemplateRef<HTMLElement>('album');
const pad = useTemplateRef<HTMLElement>('pad');
const root = useTemplateRef<HTMLElement>('root');
const state = playedCategoryState;
/** The BODY's box — the one element all three layouts stand in (the `body` ref, flex: 1 of the panel): it never
 *  depends on which layout is mounted, so the plan cannot feed back into its own measure. */
const outer = ref({w: 0, h: 0});
/** px per root rem (the console's ui scale rides the root font size). */
const remPx = ref(20);
const scrollTopPx = ref(0);
const scrollFrac = ref(0);
const lastFirstRow = ref(-1);
let ro: ResizeObserver | undefined;
/** A scroll read is scheduled for the next frame (its cancel) — `undefined` when none stands. */
let cancelScrollRead: (() => void) | undefined;
let cancelFrameBeat = (() => {}) as () => void;
/** Grid faces are mounted (deferred past the open flight — see the
 *  template note). Seeded true for a view that mounts already open. */
const facesOn = ref(playedCategoryState.phase === 'open');
/**
 * THE FLOOR UNFOLDS out of the opened stack (`console_played.less` § the category's floor): the stack's rect as
 * insets of this view (`--con-cat-from-*`), and whether the floor stands open. Set the frame the director has
 * painted the proxies — the floor opens IN PARALLEL with the lift, never after the landing. A view that mounts
 * already open (a restore) starts unfolded.
 */
const unfolded = ref(playedCategoryState.phase === 'open');
const fromInset = ref<Record<string, string>>({});
/** Focused-card full-art prewarm debounce (thumb-tier grids only). */
let cancelPrewarm = (() => {}) as () => void;
/** The album's strip slides only once the view stands (a fresh mount lands on its page, never slides there). */
const stripLive = ref(false);
const lastFlickAt = ref(0);
const wheelAcc = ref(0);
const wheelAt = ref(0);
let absorbOff: (() => void) | undefined;

/** The host's measured inset + where the floor unfolds FROM (the opened stack). */
const rootStyle = computed((): Record<string, string> => {
  return {...(props.boxInset ?? {}), ...fromInset.value};
});
const title = computed((): string => {
  const key = state.category;
  return key !== undefined ? PLAYED_CATEGORY_LABEL[key] : 'Played';
});
const busy = computed((): boolean => {
  return state.phase === 'opening' || state.phase === 'closing';
});
const insetPx = computed((): number => {
  return Math.round(CAT_EDGE_INSET * conUiScale());
});
/** The body's whole box (the album's and the single stage's room). */
const outerBox = computed((): {w: number, h: number} => {
  return {w: outer.value.w > 0 ? outer.value.w : FALLBACK_W, h: outer.value.h > 0 ? outer.value.h : FALLBACK_H};
});
/** The grid's room: the body's box minus its air — DERIVED, so it is known whichever layout is on screen. */
const gridBox = computed((): {w: number, h: number} => {
  const o = outerBox.value;
  return {
    w: Math.max(1, o.w - BODY_AIR_REM.side * 2 * remPx.value),
    h: Math.max(1, o.h - (BODY_AIR_REM.top + BODY_AIR_REM.bottom) * remPx.value),
  };
});
/** The box of the layout on screen — the grid's room for a grid, the body's whole box otherwise. */
const box = computed((): {w: number, h: number} => {
  return layout.value.kind === 'grid' ? gridBox.value : outerBox.value;
});
const bodyAirStyle = computed((): Record<string, string> => {
  const r = remPx.value;
  return {padding: `${BODY_AIR_REM.top * r}px ${BODY_AIR_REM.side * r}px ${BODY_AIR_REM.bottom * r}px`};
});
const layout = computed((): CategoryViewLayout => {
  const o = outerBox.value;
  const spec = albumSpecFor(consoleLayoutState.profile, albumLayoutState.layout);
  if (props.cards.length <= 1) {
    // The single stage keeps its raw box (its width/height SHARES already reserve the air).
    return planCategoryView({availW: o.w, availH: o.h, count: props.cards.length, uiScale: conUiScale(), faceFloorZoom: props.faceFloorZoom, albumSpec: spec});
  }
  // A grid is judged in the room it WOULD stand in — the grid's box minus its own edge inset (clip padding) —
  // whatever stands on screen now: the decision never reads its own result back.
  const g = gridBox.value;
  const inset = insetPx.value * 2;
  const layout = planCategoryView({
    availW: g.w - inset, availH: g.h - inset, count: props.cards.length, uiScale: conUiScale(), faceFloorZoom: props.faceFloorZoom, albumSpec: spec,
  });
  // The album stands in the WHOLE body (its edge lanes are its own inset — the grid's clip padding is not).
  return layout.kind === 'album' ?
    {kind: 'album', album: planCategoryAlbum({availW: o.w, availH: o.h, count: props.cards.length, spec, uiScale: conUiScale()})} :
    layout;
});
/** The album plan (album layouts only — a convenience narrow). */
const album = computed((): CategoryAlbumPlan => {
  return layout.value.kind === 'album' ? layout.value.album : {
    cols: 1, rows: 1, perPage: Math.max(1, props.cards.length), pageCount: 1, zoom: 1, slotW: 320, slotH: 460,
    gapX: 0, gapY: 0, pageW: 320, pageH: 460, padX: 0, padTop: 0, stride: 0, spineH: 0,
  };
});
/** The album's page on screen — DERIVED from the focused card (no second page state exists). */
const activePage = computed((): number => {
  return layout.value.kind === 'album' ? albumPageOf(album.value, state.focusIndex) : 0;
});
const pageCount = computed((): number => {
  return layout.value.kind === 'album' ? album.value.pageCount : 1;
});
/** The mounted pages: the one on screen and its neighbours (a slide never lands on an unmounted page). */
const renderPages = computed((): Array<number> => {
  const out: Array<number> = [];
  for (let p = activePage.value - 1; p <= activePage.value + 1; p++) {
    if (p >= 0 && p < pageCount.value) {
      out.push(p);
    }
  }
  return out;
});
const edgePx = computed((): number => {
  return Math.round(CAT_ALBUM_EDGE * conUiScale());
});
/** «1–10 из 24» — the range of the zone the page on screen shows. */
const pageRangeText = computed((): string => {
  const indices = albumPageIndices(album.value, props.cards.length, activePage.value);
  if (indices.length === 0) {
    return '';
  }
  return translateTextWithParams('${0} of ${1}', [`${indices[0] + 1}–${indices[indices.length - 1] + 1}`, String(props.cards.length)]);
});
/** The grid plan (grid layouts only — a convenience narrow). */
const gridPlan = computed((): HandGridPlan => {
  return layout.value.kind === 'grid' ? layout.value.plan : {
    cols: 1, rows: props.cards.length, cardZoom: 1, slotW: 320, slotH: 460,
    rowStride: 476, gapX: 16, gapY: 16, contentW: 320, contentH: 460, scrolls: false, visibleRows: 1,
  };
});
const renderRows = computed((): Array<number> => {
  const p = gridPlan.value;
  if (layout.value.kind !== 'grid' || p.rows <= 0) {
    return [];
  }
  if (!p.scrolls) {
    return range(0, p.rows - 1);
  }
  const availH = box.value.h > 0 ? box.value.h : FALLBACK_H;
  const contentY = scrollTopPx.value - insetPx.value;
  const first = Math.max(0, Math.floor(contentY / p.rowStride) - OVERSCAN);
  const last = Math.min(p.rows - 1, Math.ceil((contentY + availH) / p.rowStride) + OVERSCAN);
  return range(first, last);
});
const topSpacerPx = computed((): number => {
  const rows = renderRows.value;
  return rows.length === 0 ? 0 : rows[0] * gridPlan.value.rowStride;
});
const bottomSpacerPx = computed((): number => {
  const rows = renderRows.value;
  if (rows.length === 0) {
    return 0;
  }
  return (gridPlan.value.rows - 1 - rows[rows.length - 1]) * gridPlan.value.rowStride;
});
const thumbStyle = computed((): Record<string, string> => {
  const p = gridPlan.value;
  const visible = box.value.h > 0 ? box.value.h : FALLBACK_H;
  const content = p.contentH + insetPx.value * 2;
  const hPct = clampNum(8, 100, (visible / Math.max(1, content)) * 100);
  const topPct = (100 - hPct) * scrollFrac.value;
  return {height: hPct + '%', top: topPct + '%'};
});
/** The art tier of the grid faces AND their proxies — one decision, one
 *  decoded file per card (see cardArt.ts ART TIERS). The single-card
 *  stage renders near-fullscreen and stays on 'full' in the template. */
const catArtTier = computed((): CardArtTier => {
  if (layout.value.kind === 'album') {
    return artTierForWidth(album.value.slotW);
  }
  if (layout.value.kind !== 'grid') {
    return 'full';
  }
  return artTierForWidth(gridPlan.value.slotW);
});

/** A flight proxy wears what its slot wears (the copies are identical — the docked fleet included). */
function publicFaceModelOf(name: string): CardModel | undefined {
  return publicFaceModel(props.cards.find((card) => card.name === name));
}
function range(a: number, b: number): Array<number> {
  const out: Array<number> = [];
  for (let i = a; i <= b; i++) {
    out.push(i);
  }
  return out;
}
function rowCards(row: number): ReadonlyArray<CardModel> {
  const start = row * gridPlan.value.cols;
  return props.cards.slice(start, start + gridPlan.value.cols);
}
/**
 * The body's box — the `body` ref is the stage, the album box or the grid's body box, each `flex: 1` of the panel, so
 * the SAME box whichever is mounted (offset size: a transform never shrinks the plan). Never the grid itself: its
 * box is the body's minus the air, and a plan measured off its own element flipped grid ↔ album under the flight.
 */
function measure(): void {
  if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (rem > 0 && rem !== remPx.value) {
      remPx.value = rem;
    }
  }
  const el = body.value ?? undefined;
  if (el === undefined) {
    return;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w !== outer.value.w || h !== outer.value.h) {
    outer.value = {w, h};
  }
}
function clearFrameTimer(): void {
  cancelFrameBeat();
}
/**
 * The opened stack's rect as insets of this view — the floor's starting clip. Read off the table's own stack
 * (`[data-played-cat]`, the element the cursor stood on); no stack (a restore, a vanished zone) → the floor
 * opens from its own centre line, still a phrase.
 */
function measureUnfoldOrigin(): void {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || typeof rootNow.getBoundingClientRect !== 'function') {
    return;
  }
  const view = rootNow.getBoundingClientRect();
  const host = rootNow.closest('.con-played');
  const key = state.category;
  const esc = key === undefined ? '' : typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key;
  const stack = esc !== '' ? host?.querySelector<HTMLElement>(`[data-played-cat="${esc}"]`) : null;
  const r = stack?.getBoundingClientRect();
  const px = (v: number) => `${Math.max(0, Math.round(v))}px`;
  if (r === undefined || r.width < 2 || r.height < 2 || view.width < 2) {
    fromInset.value = {'--con-cat-from-t': '50%', '--con-cat-from-b': '50%', '--con-cat-from-l': '0px', '--con-cat-from-r': '0px'};
    return;
  }
  fromInset.value = {
    '--con-cat-from-t': px(r.top - view.top),
    '--con-cat-from-l': px(r.left - view.left),
    '--con-cat-from-r': px(view.right - r.right),
    '--con-cat-from-b': px(view.bottom - r.bottom),
  };
}
/**
 * Open the floor on the NEXT frame — the closed clip must paint once for the transition to have a `from` — and
 * call `started` once the floor's fade has REALLY started (its transition's `ready`: the compositor's start time,
 * which on a software renderer lags the class by the panel's raster). Bounded: a floor with no transition (reduced
 * motion) starts at once, one whose start never resolves after `FLOOR_START_WAIT_MS`.
 */
function unfoldFloor(started?: () => void): void {
  measureUnfoldOrigin();
  void frame().then(() => {
    if (state.phase !== 'opening' && state.phase !== 'open') {
      started?.();
      return;
    }
    unfolded.value = true;
    if (started !== undefined) {
      void nextTick().then(() => whenFloorStarts(started));
    }
  });
}
function whenFloorStarts(started: () => void): void {
  const panel = root.value?.querySelector?.<HTMLElement>('.con-played-cat__panel');
  const anims = panel !== undefined && panel !== null && typeof panel.getAnimations === 'function' ? panel.getAnimations() : [];
  const fade = anims.find((a) => (a as CSSTransition).transitionProperty === 'opacity') ?? anims[0];
  if (fade === undefined) {
    started();
    return;
  }
  let done = false;
  const go = (): void => {
    if (!done) {
      done = true;
      disarm();
      started();
    }
  };
  // A RELEASE: the held lift waits for `started` — it comes at the backstop, or when the view leaves.
  const disarm = flow.guarantee(FLOOR_START_WAIT_MS, 'the floor\'s real start (the held lift goes)', go);
  fade.ready.then(go, go);
}
// ── the OPEN flight (mounted at phase 'opening') ────────────────────
async function beginOpenFlight(): Promise<void> {
  if (state.phase !== 'opening') {
    return;
  }
  if (consoleReducedMotionActive()) {
    settleOpenInstant();
    return;
  }
  // The proxies mount FIRST (one flush), then a settle frame so the
  // held grid has laid out — every measure lands on real geometry.
  spawnOpenFlights();
  await nextTick();
  await frame();
  if (state.phase !== 'opening') {
    return;
  }
  const plans = buildFlightPlans('open');
  if (plans.length === 0) {
    settleOpenInstant();
    return;
  }
  runCategoryOpen(plans, (settledAs) => onOpenSettled(settledAs), {held: true});
  // The director has just PAINTED the proxies on the table rects — the
  // table hands its cards over in the same synchronous turn (no frame
  // where a card exists twice or not at all).
  state.holdCards = true;
  // …and the floor starts unfolding out of the stack WITH the lift — the lift takes the floor's REAL start
  // (`startHeldCategoryEpisode`), so the cards never land before the floor is there, on any frame.
  unfoldFloor(() => startHeldCategoryEpisode());
}
function settleOpenInstant(): void {
  unfolded.value = true;
  state.flights = [];
  state.groundedNames = [];
  state.holdCards = false;
  state.frameOn = true;
  facesOn.value = true;
  state.phase = 'open';
}
function onOpenSettled(settledAs: 'open' | 'closed'): void {
  if (settledAs === 'closed') {
    // B reversed the open mid-flight — the cards are back on the table.
    unfolded.value = false;
    resetPlayedCategoryView();
    emit('settled-closed');
    return;
  }
  // Landed: the frame assembles around the cards, the DEFERRED grid
  // faces mount during the frame beat, then the real grid takes over
  // under the dissolving proxies.
  state.frameOn = true;
  facesOn.value = true;
  clearFrameTimer();
  cancelFrameBeat = flow.after(motionMs(CATEGORY_FRAME_MS), 'the frame assembles around the landed cards', () => {
    // The dissolve GATES on the real faces being flushed + painted (two
    // frames past the tick): on a throttled main thread the face mount
    // can outlive the frame beat, and a dissolve over unpainted slots is
    // a blink. Deterministic ordering, never a race.
    void nextTick()
      .then(() => frame())
      .then(() => frame())
      .then(() => {
        if (state.phase !== 'opening') {
          return;
        }
        // SHOW, THEN REMOVE (animations.md law 9): the real cards are let out from under the hold FIRST, and the
        // proxies start to dissolve only once a frame has PAINTED them standing under the proxies. Started in one
        // turn, the dissolve ran on GSAP's clock while the cards waited for Vue's patch and the compositor: one
        // starved 4K frame (≥ the 180 ms dissolve) took the proxies away before the cards' first painted frame —
        // the category landed on an empty grid that filled a frame later.
        const handed = state.flights;
        state.holdCards = false;
        state.phase = 'open';
        void nextTick()
          .then(() => frame())
          .then(() => frame())
          .then(() => {
            if (state.flights !== handed) {
              return; // a close (or a teardown) took the proxies over
            }
            dissolveCategoryProxies(() => {
              if (state.flights === handed) {
                state.flights = [];
              }
            });
          });
      });
  });
}
// ── the CLOSE flight ────────────────────────────────────────────────
function requestClose(): void {
  if (state.phase === 'opening') {
    // Mid-open B: reverse the SAME timeline — the cards retrace home.
    if (!reverseCategoryEpisode()) {
      finishCategoryInstant();
    }
    return;
  }
  if (state.phase === 'closing') {
    // A second B while closing: snap home.
    finishCategoryInstant();
    return;
  }
  if (state.phase !== 'open') {
    return;
  }
  if (consoleReducedMotionActive()) {
    resetPlayedCategoryView();
    emit('settled-closed');
    return;
  }
  // Fresh flights from the CURRENT grid geometry back to the live table —
  // BOUNDED to the scrolled-to window (+ sweep tails): the grounded rest
  // fades back in place on the table when the close settles.
  state.phase = 'closing';
  state.frameOn = false;
  // The floor folds back INTO the stack with the cards' return (the same phrase backwards).
  measureUnfoldOrigin();
  unfolded.value = false;
  const closeIndices = plannedFlightIndices(
    layout.value, props.cards.length,
    box.value.h > 0 ? box.value.h : FALLBACK_H,
    currentScrollTop(), activePage.value);
  const closeFlown = new Set(closeIndices);
  state.flights = closeIndices.map((index): CategoryFlight => ({
    id: nextCategoryFlightId(),
    name: props.cards[index].name,
    index,
    faceDown: isFaceDown(props.cards[index].name),
  }));
  state.groundedNames = props.cards
    .filter((_, i) => !closeFlown.has(i))
    .map((c) => c.name);
  void nextTick().then(() => {
    if (state.phase !== 'closing') {
      return;
    }
    const plans = buildFlightPlans('close');
    if (plans.length === 0) {
      resetPlayedCategoryView();
      emit('settled-closed');
      return;
    }
    runCategoryClose(plans, (settledAs) => onCloseSettled(settledAs));
    // Proxies painted on the grid rects — the grid hides under them in
    // the same turn (the table stays held throughout the return).
    state.holdCards = true;
  });
}
function onCloseSettled(settledAs: 'open' | 'closed'): void {
  if (settledAs === 'open') {
    // B reversed the close — back to the open view (same landing dance).
    unfolded.value = true;
    onOpenSettled('open');
    return;
  }
  // Home: release BOTH holds in one flush — the tableau slots un-hide
  // exactly where the proxies stand, the proxies unmount the same patch.
  resetPlayedCategoryView();
  emit('settled-closed');
}
// ── flight geometry (one measured origin + pure plan math) ──────────
function buildFlightPlans(dir: 'open' | 'close'): Array<CategoryFlightPlan> {
  const layoutNow = layout.value;
  const origin = contentOrigin();
  const clip = clipRect();
  if (origin === undefined || clip === undefined) {
    return [];
  }
  const scrollTop = dir === 'close' ? currentScrollTop() : 0;
  // The real clipping container is the GRID (overflow-y: auto) — its
  // border box is the honest edge the bottom/top row renders against.
  // A partially-crossing VISIBLE landing hands that overflow down as
  // `targetClip` so the proxy lands as clipped as the real slot.
  const gridEl = grid.value ?? undefined;
  const gridClip = layoutNow.kind === 'grid' && gridEl !== undefined && typeof gridEl.getBoundingClientRect === 'function' ?
    gridEl.getBoundingClientRect() : undefined;
  const flights = state.flights;
  if (flights.length === 0 || flights.length > props.cards.length) {
    return [];
  }
  const out: Array<CategoryFlightPlan> = [];
  for (const f of flights) {
    if (props.cards[f.index]?.name !== f.name) {
      continue; // the category shifted under the episode (undo)
    }
    const source = tableauRect(f.name, f.index);
    if (source === undefined) {
      continue;
    }
    const t = categoryTargetRect(layoutNow, f.index, props.cards.length, origin);
    // The focused card stands LIFTED (`__slot--lifted`, from the opening on — under the hold): its proxy lands on
    // that pose and leaves from it, so the handoff never shows the card stepping up (or down) after the dissolve.
    const lift = f.index === state.focusIndex ? FOCUS_LIFT_REM * remPx.value : 0;
    const target: FlightRect = {x: t.x, y: t.y - scrollTop - lift, w: t.w, h: t.h};
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
}
/** Spawn the open-direction flight entries (the layer mounts them) —
 *  BOUNDED to the top window the view opens at (+ the sweep tail); the
 *  grounded rest dissolves in place on the table. */
function spawnOpenFlights(): ReadonlyArray<CategoryFlight> {
  if (state.flights.length > 0) {
    return state.flights;
  }
  const indices = plannedFlightIndices(
    layout.value, props.cards.length,
    box.value.h > 0 ? box.value.h : FALLBACK_H,
    0 /* the view always opens at the top */, activePage.value);
  const flown = new Set(indices);
  state.flights = indices.map((index): CategoryFlight => ({
    id: nextCategoryFlightId(),
    name: props.cards[index].name,
    index,
    faceDown: isFaceDown(props.cards[index].name),
  }));
  state.groundedNames = props.cards
    .filter((_, i) => !flown.has(i))
    .map((c) => c.name);
  return state.flights;
}
/** The grid content origin (proxy landings are derived off it purely). */
function contentOrigin(): {x: number, y: number, w: number, h?: number} | undefined {
  const el = (layout.value.kind === 'single' ? body.value : layout.value.kind === 'album' ? albumEl.value : pad.value) ?? undefined;
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
  const scrollBack = layout.value.kind === 'grid' ? currentScrollTop() : 0;
  return {x: r.left, y: r.top + scrollBack, w: r.width, h: layout.value.kind === 'single' ? r.height : undefined};
}
function clipRect(): {top: number, bottom: number} | undefined {
  const el = (layout.value.kind === 'album' ? albumEl.value : body.value) ?? undefined;
  if (el === undefined || typeof el.getBoundingClientRect !== 'function') {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return {top: r.top, bottom: r.bottom};
}
function currentScrollTop(): number {
  return grid.value?.scrollTop ?? 0;
}
/**
 * A card's REAL tableau rect: its slot card box, or — for the face-down
 * events pile — the shared backstack rect with a small per-index offset
 * (the physical stack). Global query: the tableau stays mounted below.
 */
function tableauRect(name: string, index: number): FlightRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  void index;
  if (isFaceDown(name)) {
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
    const rank = faceDownRank(name);
    const dx = (rank % 2 === 0 ? -1 : 1) * Math.min(rank, 3) * 2;
    const dy = Math.min(rank, 3) * 2;
    return {x: r.left + dx, y: r.top + dy, w: r.width, h: r.height};
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  const el = document.querySelector<HTMLElement>(`.con-played [data-played-key="${esc}"] .con-played__face :is(.card-container, .pcard)`);
  if (el === null) {
    // A card on a page the album has not mounted: its packet place beyond the edge (the table says where).
    return props.offPageRect?.(name);
  }
  const r = el.getBoundingClientRect();
  return r.width > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : props.offPageRect?.(name);
}
/**
 * One PAINTED frame — a wait of the view's own scope (over at once when the view leaves). The bound only lets the
 * flow go on in a window that does not paint; it is wide on purpose: this frame is the paint GATE of the open
 * flight's handoff (law 9), and a tight bound would let a timer win over a starved frame — the very frame it gates.
 */
function frame(): Promise<void> {
  return whenPainted(1, 400, flow);
}
// ── input (delegated by the overlay) ────────────────────────────────
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'scroll') {
    if (layout.value.kind === 'album') {
      stickFlick(intent.dy, intent.dx);
      return;
    }
    stickScroll(intent.dy);
    return;
  }
  if (busy.value) {
    // Mid-flight: B reverses/snaps; everything else waits out the beat.
    if (intent.kind === 'press' && consoleActionOf(intent) === 'back') {
      requestClose();
    } else {
      noteInputAbsorbed(CATEGORY_FLIGHT_ABSORBER);
    }
    return;
  }
  if (intent.kind === 'nav') {
    if (layout.value.kind === 'album') {
      state.focusIndex = stepCategoryAlbum(album.value, state.focusIndex, intent.dir, props.cards.length);
      return;
    }
    if (layout.value.kind === 'grid') {
      state.focusIndex = stepHandGrid(state.focusIndex, intent.dir, props.cards.length, gridPlan.value.cols);
      void nextTick(() => ensureFocusVisible());
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
    inspectFocused();
    break;
  case 'back':
    requestClose();
    break;
  // LB / RB turn the album's pages — inside a category the seat is NOT switched (the owner, 2026-10-19: close the
  // category to change the player); a zone of one page leaves them quiet.
  case 'prevSection':
    turnPage(-1);
    break;
  case 'nextSection':
    turnPage(1);
    break;
  default:
    break;
  }
}
/** One page toward `dir` (LB/RB, an edge, a flick, the wheel): the focus keeps its slot on the new page. */
function turnPage(dir: 1 | -1): void {
  if (busy.value || layout.value.kind !== 'album') {
    return;
  }
  state.focusIndex = turnCategoryAlbum(album.value, state.focusIndex, dir, props.cards.length);
}
/** Right stick on the album — a firm push turns one page toward it; holding it pages at a controlled cadence. */
function stickFlick(dy: number, dx = 0): void {
  const v = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  if (Math.abs(v) < FLICK_THRESHOLD) {
    return;
  }
  const now = Date.now();
  if (now - lastFlickAt.value < FLICK_REPEAT_MS) {
    return;
  }
  lastFlickAt.value = now;
  turnPage(v > 0 ? 1 : -1);
}
function onWheel(e: WheelEvent): void {
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const now = Date.now();
  if (now - wheelAt.value > WHEEL_DECAY_MS) {
    wheelAcc.value = 0;
  }
  wheelAt.value = now;
  wheelAcc.value += d;
  if (Math.abs(wheelAcc.value) >= WHEEL_NOTCH) {
    turnPage(wheelAcc.value > 0 ? 1 : -1);
    wheelAcc.value = 0;
  }
}
/**
 * The neighbour pages' art, WARMED: their faces are mounted for the slide but stand beyond the album's clip, and
 * the art `<img>` is `loading="lazy"` — un-warmed, a turned page showed its faces with empty art boxes for the
 * first frames at 4K. The tier is the one the page paints.
 */
function warmNeighbourPages(page: number): void {
  if (layout.value.kind !== 'album') {
    return;
  }
  const names = [page - 1, page + 1]
    .filter((p) => p >= 0 && p < album.value.pageCount)
    .flatMap((p) => albumPageIndices(album.value, props.cards.length, p).map((i) => props.cards[i].name));
  if (names.length > 0) {
    preloadPremiumCardArt(names, [catArtTier.value]);
  }
}
/** The card indices of one album page. */
function pageIndices(page: number): Array<number> {
  return albumPageIndices(album.value, props.cards.length, page);
}
/** An album slot's place on its page — the SAME arithmetic the flights land on (`categoryTargetRect`). */
function albumSlotStyle(index: number): Record<string, string> {
  const r = categoryTargetRect(layout.value, index, props.cards.length, {x: 0, y: 0, w: box.value.w});
  return {left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px'};
}
function slotClasses(index: number, _name: string): Record<string, boolean> {
  const focused = index === state.focusIndex;
  return {
    'con-played-cat__slot--focused': state.phase === 'open' && focused,
    // The lift stands for the WHOLE episode (under the hold while the proxies fly): the card is lifted before it
    // paints and lowers only after it is hidden — its proxy carries the same pose (`buildFlightPlans`).
    'con-played-cat__slot--lifted': state.phase !== 'closed' && focused,
  };
}
/** The card lies FACE DOWN on the table — the events category. */
function isFaceDown(_name: string): boolean {
  return state.category === 'events';
}
/** The card's rank within the face-down subset (the pile stack offset). */
function faceDownRank(name: string): number {
  let rank = 0;
  for (const c of props.cards) {
    if (c.name === name) {
      return rank;
    }
    if (isFaceDown(c.name)) {
      rank++;
    }
  }
  return rank;
}
function onSlotClick(index: number): void {
  if (busy.value) {
    return;
  }
  if (state.focusIndex === index) {
    // Mouse parity: the second click is the pad's X (inspect).
    inspectFocused();
  } else {
    state.focusIndex = index;
  }
}
/** A / X: the fullscreen inspector over the category list — a PHYSICAL
 *  lift out of the focused grid slot (browse keeps the grid in lockstep). */
function inspectFocused(): void {
  if (busy.value || props.cards.length === 0) {
    return;
  }
  const list = [...props.cards];
  const index = clampNum(0, list.length - 1, state.focusIndex);
  const origin = slotZoomOrigin(
    // The viewer outlives this view: once it has left, the root ref is `null` and the origin's own guard answers
    // «no slot» (the textual entrance).
    () => root.value,
    (i) => list[i]?.name ?? '',
    (i) => {
      state.focusIndex = i;
      void nextTick(() => ensureFocusVisible());
    },
  );
  // The provenance plate rides the browse: the host's by-name lookup is
  // wrapped into THIS list's index space, so LB/RB across the zone keeps
  // the plate (and «N из M») honest.
  const byName = props.provenanceByName;
  openConsoleCardZoom(list, index, undefined, undefined, {
    origin,
    provenance: byName === undefined ? undefined : zoomProvenanceOver(byName, list),
  });
}
function ensureFocusVisible(): void {
  if (layout.value.kind !== 'grid' || !gridPlan.value.scrolls) {
    return;
  }
  const gridNow = grid.value ?? undefined;
  if (gridNow === undefined) {
    return;
  }
  const p = gridPlan.value;
  const inset = insetPx.value;
  const row = Math.floor(state.focusIndex / p.cols);
  const top = inset + row * p.rowStride;
  const bottom = top + p.slotH;
  const viewTop = gridNow.scrollTop;
  const viewBottom = viewTop + gridNow.clientHeight;
  let next = viewTop;
  // Keep the edge-inset buffer so the ring/glow clear the clip edge.
  if (top - inset < viewTop) {
    next = top - inset;
  } else if (bottom + inset > viewBottom) {
    next = bottom + inset - gridNow.clientHeight;
  }
  const maxScroll = Math.max(0, gridNow.scrollHeight - gridNow.clientHeight);
  gridNow.scrollTop = clampNum(0, maxScroll, next);
}
function stickScroll(dy: number): void {
  if (Math.abs(dy) < 0.05 || busy.value) {
    return;
  }
  const gridNow = grid.value ?? undefined;
  if (gridNow === undefined || layout.value.kind !== 'grid' || !gridPlan.value.scrolls) {
    return;
  }
  gridNow.scrollBy({top: dy * STICK_SCROLL_STEP * conUiScale(), behavior: 'auto'});
}
function onScroll(): void {
  if (cancelScrollRead !== undefined) {
    return;
  }
  cancelScrollRead = flow.afterFrame('the grid\'s scroll is read (coalesced)', () => {
    cancelScrollRead = undefined;
    const gridNow = grid.value ?? undefined;
    if (gridNow === undefined) {
      return;
    }
    const p = gridPlan.value;
    const st = gridNow.scrollTop;
    const firstRow = p.rowStride > 0 ? Math.floor(st / p.rowStride) : 0;
    if (firstRow !== lastFirstRow.value) {
      lastFirstRow.value = firstRow;
      scrollTopPx.value = st;
    }
    const maxScroll = Math.max(1, gridNow.scrollHeight - gridNow.clientHeight);
    scrollFrac.value = clampNum(0, 1, st / maxScroll);
  });
}

/** The bar's mirror: the album's page and how many there are (LB/RB «Листать» only while there is a second). */
watch(() => activePage.value, (p: number) => {
  consolePlayedUi.page = p;
  warmNeighbourPages(p);
}, {immediate: true});
watch(() => pageCount.value, (n: number) => {
  consolePlayedUi.pageCount = n;
}, {immediate: true});
/** A shrinking category (undo / seat data refresh) clamps the focus. */
watch(() => props.cards.length, (n: number) => {
  if (state.focusIndex > n - 1) {
    state.focusIndex = Math.max(0, n - 1);
  }
});
/** Thumb-tier grids prewarm the FOCUSED card's full art (debounced) so
 *  the fullscreen inspector opens onto an already-decoded picture. One
 *  in-flight decode at a time by construction — the debounce collapses
 *  a d-pad sprint into its resting card. */
watch(() => state.focusIndex, () => {
  cancelPrewarm();
  if (catArtTier.value !== 'thumb' || state.phase !== 'open') {
    return;
  }
  cancelPrewarm = flow.after(160, 'the focused card\'s art prewarm (debounced)', () => {
    const focused = props.cards[state.focusIndex];
    if (focused !== undefined) {
      preloadPremiumCardArt([focused.name]);
    }
  });
}, {immediate: true});

onMounted(() => {
  // Observe the ROOT (fixed inset-0 — resizes with the viewport): the
  // measured box element can SWITCH between the grid and the single stage
  // (an undo shrinking the category), so the observer never re-targets.
  const el = root.value ?? undefined;
  if (el !== undefined && typeof ResizeObserver !== 'undefined') {
    ro = markRaw(new ResizeObserver(() => measure()));
    ro.observe(el);
  }
  measure();
  // THE FLIGHT'S SWALLOW IS DECLARED (animations.md § SLOW FRAME, law 5): X / the d-pad / LB·RB pressed while the
  // cards are in the air wait out the beat — a press it took is pressed again once the view stands.
  absorbOff = registerInputAbsorber(CATEGORY_FLIGHT_ABSORBER, () => busy.value, {scope: 'all'});
  // The OPEN flight starts once the grid has laid out (held-invisible).
  void beginOpenFlight();
  // The album's strip arms its slide once the view stands on its page.
  void nextTick().then(() => frame()).then(() => {
    stripLive.value = true;
  });
});
onBeforeUnmount(() => {
  absorbOff?.();
  consolePlayedUi.page = 0;
  consolePlayedUi.pageCount = 1;
  ro?.disconnect();
  clearFrameTimer();
  resetCategoryDirector();
});
defineExpose({handleIntent});
</script>
