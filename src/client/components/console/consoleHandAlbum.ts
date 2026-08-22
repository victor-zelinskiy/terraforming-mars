/*
 * consoleHandAlbum — PURE, DOM-free ALBUM layout + navigation math for the
 * console hand workspace (the rework of the vertically-scrolling smart grid).
 *
 * THE MODEL. The hand is a horizontal ribbon of strict PAGES:
 *
 *      previous page packets  ←  ACTIVE PAGE  →  next page packets
 *
 * Only the active page is inside the card stage; every other page is a
 * compact face-down PACKET parked just beyond the stage edge (the reveal
 * transition flies them there and back — `packetRect`). The page GRID is a
 * property of the LAYOUT PROFILE, never of the hand size:
 *
 *      tv / standard / large →  5 × 2  (10 cards per page)
 *      handheld (Steam Deck) →  4 × 1  ( 4 cards per page)
 *
 * CARD SIZE IS STABLE. The zoom solves from the stage box + the profile grid
 * + the card's natural aspect alone — `count` only decides how many pages
 * exist. One card, four cards and ten cards on a TV are the same geometry;
 * a page never stretches to fill and never shrinks to fit «one more row».
 *
 * The section renders the active page (± its neighbours) and feeds measured
 * box dimensions here; scale is applied via CSS `zoom` like every dense
 * card surface in the console (the layout box scales with it, so slot maths
 * and measured rects live in one space).
 *
 * NAVIGATION IS DETERMINISTIC. Left/right walk the flat hand order (crossing
 * a page edge turns the page — the order simply continues); up/down move by
 * a row WITHIN the page, preserving the column, clamping into a partial
 * last row; nothing wraps, every edge is felt. `pageJumpIndex` is the
 * explicit page-turn command: same relative slot on the neighbouring page.
 *
 * Mirrors the sibling pure planners (consoleHandGrid — still the engine of
 * the «Разыграно» category view and the deck pick — playedTableauFit,
 * cardSelectionFit): unit-tested, no DOM, uiScale-aware.
 */

import {CARD_NATURAL_W, CARD_NATURAL_H} from '@/client/components/console/consoleHandGrid';
import type {ConsoleLayoutProfile} from '@/client/console/consoleLayoutProfile';
import type {ConsoleAlbumLayout} from '@/client/console/consoleAlbumLayout';

export type HandNavDir = 'left' | 'right' | 'up' | 'down';

/** The page grid of a layout profile (columns × rows = the page CAPACITY). */
export type AlbumSpec = {
  cols: number,
  rows: number,
};

/**
 * The profile → page-grid table. The handheld gets ONE generous row of four
 * (three page too often, five unreadably small on a 7-inch panel); every
 * couch/desk profile shares the 5 × 2 spread — the tv profile's uiScale
 * already maps the same logical composition onto the physical panel, so the
 * page shape must not fork per resolution.
 *
 * The «Крупные карты» preference (`layout: 'large'`) trades capacity for
 * couch readability: ONE row of at most four, everywhere — which on the
 * handheld coincides with its own baseline (no artificial difference just
 * to make the settings ring feel like it did something).
 */
export function albumSpecFor(profile: ConsoleLayoutProfile, layout: ConsoleAlbumLayout = 'adaptive'): AlbumSpec {
  if (layout === 'large' || profile === 'handheld') {
    return {cols: 4, rows: 1};
  }
  return {cols: 5, rows: 2};
}

/* ── layout constants (1080-logical px — × uiScale inside the planner) ────
   Iteration 2 («ещё крупнее на TV»): every reserve below is CONSTRAINT-DERIVED,
   not taste — the height budget is what binds the 5×2 page on TV, so each
   vertical px here is card size. Worst-case stack per boundary, measured:
   focus pop (scale 1.035 → ~6px logical toward each edge at TV card size)
   + the focus ring (3px logical) + the pick-band overhang on a top-row card
   (~11px logical above the card box, select modes only) + breathing air.
   The glow is additive light and MAY cross a gap — the hard ring may not. */

/** Column gap between slots — pop (≈4px lateral) + ring (3px) + air. */
export const ALBUM_GAP_X = 18;
/** Row gap — upper row's pop-down (≈6) + lower row's band overhang (≈11)
 *  never meet: 6 + 3(ring) + air on each side. */
export const ALBUM_GAP_Y = 19;
/**
 * DENSITY-AWARE column gap (single-row showcase pages). The base gap is
 * tuned for the STANDARD card; a showcase card is up to ~3× that, and a
 * constant gap then reads as «frames almost touching» while the halos
 * overlap (the reported 2×1 defect). The gap therefore grows with the
 * composition — but as a BOUNDED share of the card's own width, never
 * proportionally with it: air must serve the cards, not eat the stage.
 * Values are a fraction of the slot width, clamped in px below.
 */
export const SHOWCASE_GAP_FRAC: Readonly<Record<number, number>> = {
  5: 0.05,
  4: 0.06,
  3: 0.08,
  2: 0.11,
  1: 0,
};
/** Bounds of that fraction (1080-logical px — × uiScale inside). */
export const SHOWCASE_GAP_MIN = 18;
export const SHOWCASE_GAP_MAX = 64;
/** Lateral stage gutter (page inset inside the album box). */
export const ALBUM_GUTTER_X = 20;
/**
 * The PAGE-EDGE gutter: the side band the Album Edge Affordance lives in,
 * reserved on BOTH sides so the composition is symmetric whichever edges
 * are live (a card group must not shift when the last page drops its
 * next-edge). The cards' own focus ring/glow clearance is `ALBUM_GUTTER_X`
 * INSIDE this — the two never share room, which is what stops an edge
 * card from reading as «cut off by the boundary».
 */
export const ALBUM_EDGE_GUTTER = 34;
/** Top gutter — the top row's pick-band overhang (≈11) + pop (≈6) + ring. */
export const ALBUM_GUTTER_TOP = 26;
/** Bottom gutter — pop-down (≈6) + ring (3) + shadow air. */
export const ALBUM_GUTTER_BOTTOM = 11;
/**
 * Art-quality ceiling on the applied zoom (logical — × uiScale). The premium
 * face is rastered for ~1.6× its 320×460 design box before the art softens;
 * the tv profile doubles this through uiScale exactly like the old TV fill
 * pass did (3.2 applied at 4K).
 */
export const ALBUM_MAX_ZOOM = 1.7;
/** Degenerate floor — a starved band gets small honest cards, never zero. */
export const ALBUM_MIN_ZOOM = 0.3;
/** Extra stride beyond the album width between page origins — the outgoing
 *  and incoming pages never overlap mid-turn. */
export const PAGE_STRIDE_EXTRA = 60;

/* ── page-packet geometry (the parked pages beyond the stage edges) ─────── */

/** How far beyond the stage edge the nearest packet sits. */
export const PACKET_GAP = 46;
/** Additional offset per page of distance from the active one. */
export const PACKET_DEPTH_STEP = 14;
/** Micro-stagger per card within one packet (reads as a stack, not a card). */
export const PACKET_SEQ_STEP = 2.2;

export interface HandAlbumPlan {
  /** The page grid (profile-fixed). */
  cols: number;
  rows: number;
  perPage: number;
  /** ceil(count / perPage), min 1. */
  pageCount: number;
  /** Applied card scale (`--con-hand-zoom`) — count-independent. */
  cardZoom: number;
  /** One slot's px box at the applied zoom. */
  slotW: number;
  slotH: number;
  gapX: number;
  gapY: number;
  /** The full page block's px box (cols/rows of slots + gaps). */
  pageW: number;
  pageH: number;
  /** Horizontal distance between page origins on the strip. */
  stride: number;
  /** Page block offset inside the album box (centring + top headroom). */
  padX: number;
  padTop: number;
}

export interface HandAlbumInput {
  /** The measured album box (the region between header and status rail). */
  availW: number;
  availH: number;
  count: number;
  spec: AlbumSpec;
  /** conUiScale() — 1 on every non-tv profile. */
  uiScale?: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Solve the album page for a stage box. Pure: the zoom comes from the box,
 * the profile grid and the card aspect — never from the hand size.
 */
export function planHandAlbum(input: HandAlbumInput): HandAlbumPlan {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  const cols = Math.max(1, input.spec.cols);
  const rows = Math.max(1, input.spec.rows);
  const perPage = cols * rows;
  const count = Math.max(0, Math.floor(input.count));
  const pageCount = Math.max(1, Math.ceil(count / perPage));

  const gapX = ALBUM_GAP_X * s;
  const gapY = ALBUM_GAP_Y * s;
  // The card band excludes BOTH the edge-affordance gutters and the cards'
  // own clearance — solved against the room the cards actually get.
  const gutterX = (ALBUM_GUTTER_X + ALBUM_EDGE_GUTTER) * s;
  const gutterTop = ALBUM_GUTTER_TOP * s;
  const gutterBottom = ALBUM_GUTTER_BOTTOM * s;

  const availW = Math.max(1, input.availW);
  const availH = Math.max(1, input.availH);

  const widthZoom = (availW - 2 * gutterX - (cols - 1) * gapX) / (cols * CARD_NATURAL_W);
  const heightZoom = (availH - gutterTop - gutterBottom - (rows - 1) * gapY) / (rows * CARD_NATURAL_H);
  const zoom = clamp(ALBUM_MIN_ZOOM * s, ALBUM_MAX_ZOOM * s, Math.min(widthZoom, heightZoom));

  const slotW = CARD_NATURAL_W * zoom;
  const slotH = CARD_NATURAL_H * zoom;
  const pageW = cols * slotW + (cols - 1) * gapX;
  const pageH = rows * slotH + (rows - 1) * gapY;
  const stride = availW + PAGE_STRIDE_EXTRA * s;
  const padX = Math.max(gutterX, (availW - pageW) / 2);
  // Asymmetric centring that never gives up the top headroom: the page sits
  // visually centred in the leftover space, but at least `gutterTop` below
  // the box top (the pick band + focus pop need that clearance).
  const padTop = gutterTop + Math.max(0, (availH - gutterTop - gutterBottom - pageH) / 2);

  return {cols, rows, perPage, pageCount, cardZoom: zoom, slotW, slotH, gapX, gapY, pageW, pageH, stride, padX, padTop};
}

/* ── ADAPTIVE PAGE DENSITY (Showcase Pages) ─────────────────────────────
   The page CAPACITY is a pagination fact (profile + preference — stable, so
   pages and the pager never re-deal under a density change); the page
   COMPOSITION and card size are a fact of HOW MANY cards actually stand on
   that page. A thin page must not keep ten-card-sized cards over an empty
   stage — on a TV the card's readability IS the product. */

/**
 * The row composition of a page holding `n` cards.
 *  - single-row capacity (handheld / «Крупные карты»): always one row;
 *  - two-row capacity (5×2): 6..10 split into BALANCED rows
 *    (10→5+5, 9→5+4, 8→4+4, 7→4+3, 6→3+3 — a weak 5+1/5+2 is
 *    unexpressible by construction), 1..5 → ONE showcase row.
 */
export function pageRowsFor(n: number, spec: AlbumSpec): ReadonlyArray<number> {
  const count = Math.min(Math.max(0, Math.floor(n)), spec.cols * spec.rows);
  if (count === 0) {
    return [];
  }
  if (spec.rows <= 1 || count <= 5) {
    return [count];
  }
  const top = Math.ceil(count / 2);
  return [top, count - top];
}

/**
 * THE SIZING WIDTH of a single-row page: how many slots the CARD SIZE is
 * solved for — which is NOT always how many cards stand there. The two
 * compositions of the Album Framework answer it differently, and that is
 * the whole difference between them:
 *
 *  - A SINGLE-ROW CAPACITY («Крупные карты», and the handheld baseline that
 *    coincides with it) has ONE standard card — the one a FULL page of
 *    `spec.cols` renders — and every page keeps it. A page is a PAGE: the
 *    player turns the album, they do not walk into a different viewer. The
 *    last page of 1..3 therefore centres fewer cards of the SAME size over
 *    honest air; `n` decides how many cards are drawn and nothing else.
 *    (A thin page that grew its cards changed the scale of the whole stage
 *    on every turn and read as an accidental inspect view — and, because
 *    the height cap binds at n ≤ 2, 1 and 2 rendered IDENTICALLY anyway, so
 *    the «ladder» was not even a rule the player could learn.)
 *
 *  - A TWO-ROW CAPACITY (5×2 — the ADAPTIVE composition) is where the
 *    density ladder belongs: a page of 1..5 IS the showcase, and growing it
 *    is the point of the preference the player did not choose. Its sizing
 *    width stays the page's own count.
 *
 * One rule, keyed on the CAPACITY the mode declares — never on the layout
 * name, so no second geometry architecture exists to keep in sync.
 */
export function showcaseSizingCols(n: number, spec: AlbumSpec): number {
  const capacity = Math.max(1, Math.floor(spec.cols));
  return spec.rows <= 1 ? capacity : clamp(1, capacity, Math.floor(n));
}

/**
 * The SHOWCASE height budget: one-row pages centre vertically and may grow
 * far past the two-row card, but a hero must not stand wall-to-wall — a
 * fixed share of the stage stays air on each side (fraction of the box, so
 * the Deck is not over-taxed by a TV-tuned pixel constant). A single
 * SHARED budget for every showcase count keeps the size MONOTONE: fewer
 * cards can never render smaller than more (width shrinks with n, the
 * height cap is constant).
 */
export const SHOWCASE_AIR_FRAC = 0.045;

/**
 * OPTICAL LIFT of a single-row page: the share of the leftover vertical
 * space taken off the bottom half. Two heavy bands (status rail +
 * controller rail) sit under the album, so a mathematically centred row
 * reads low; a small share fixes the perception without moving the row far
 * enough to crowd the header (and it is the SAME share for every showcase
 * count — never a per-mode arbitrary offset).
 */
export const SHOWCASE_OPTICAL_LIFT_FRAC = 0.18;

/** One page's solved composition + geometry. */
export interface AlbumPagePlan {
  /** Cards per row, top to bottom (e.g. [5,4] / [3] / [1]). */
  rows: ReadonlyArray<number>;
  /** Applied card scale for THIS page (`--con-hand-zoom` on the page). */
  zoom: number;
  slotW: number;
  slotH: number;
  gapX: number;
  gapY: number;
  pageW: number;
  pageH: number;
  /** Page block offset inside the album box (centring + headroom). */
  padX: number;
  padTop: number;
}

/**
 * Solve ONE page's layout for the `n` cards standing on it.
 *  - a TWO-ROW page (6..capacity) keeps the STANDARD size (the base plan's
 *    5×2 solve — stable between pages, never «bigger because this page has
 *    six»), only its rows re-balance;
 *  - a SHOWCASE page (1..5 of a two-row capacity) solves its OWN zoom: the
 *    width fit for exactly `n` slots vs the one-row height budget (with the
 *    showcase air), capped by the art ceiling. Fewer cards ⇒ a wider
 *    per-card share ⇒ a genuinely larger CardFace, until the height (or
 *    art) cap — the first REAL constraint — binds;
 *  - a page of a SINGLE-ROW capacity («Крупные карты») solves that same
 *    geometry for the mode's FULL capacity whatever stands on it
 *    (`showcaseSizingCols`) — one standard card, one gap, one row height on
 *    every page; the page block then simply carries `n` of them and centres.
 *
 * The composition (`n`) and the size (the capacity) are deliberately two
 * different inputs: that is what makes a page turn a page turn.
 */
export function planAlbumPage(input: HandAlbumInput, n: number, base: HandAlbumPlan): AlbumPagePlan {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  const rows = pageRowsFor(n, input.spec);
  const gapY = ALBUM_GAP_Y * s;
  const gutterX = (ALBUM_GUTTER_X + ALBUM_EDGE_GUTTER) * s;
  const gutterTop = ALBUM_GUTTER_TOP * s;
  const gutterBottom = ALBUM_GUTTER_BOTTOM * s;
  const availW = Math.max(1, input.availW);
  const availH = Math.max(1, input.availH);

  let zoom = base.cardZoom;
  let gapX = ALBUM_GAP_X * s;
  const showcase = rows.length === 1 && rows[0] > 0;
  if (showcase) {
    // The SIZING width — the mode's capacity where the capacity IS one row,
    // the page's own count where a thin page is the showcase itself. Only
    // `pageW`/`padX` below read the real `n`, so a partial page renders the
    // standard card and centres it.
    const cols = showcaseSizingCols(rows[0], input.spec);
    // The gap is DENSITY-AWARE and solved TOGETHER with the zoom: the gap
    // is a bounded share of the card width, and the card width is what is
    // left after the gaps — so solve the fraction form directly instead of
    // iterating (cols·W·z + (cols−1)·f·W·z = band ⇒ z = band / (W·(cols + (cols−1)·f))).
    const frac = SHOWCASE_GAP_FRAC[cols] ?? 0.06;
    const band = availW - 2 * gutterX;
    const heightZoom =
      (availH - gutterTop - gutterBottom - 2 * availH * SHOWCASE_AIR_FRAC) / CARD_NATURAL_H;
    const zoomAt = (gap: number) =>
      clamp(ALBUM_MIN_ZOOM * s, ALBUM_MAX_ZOOM * s,
        Math.min((band - (cols - 1) * gap) / (cols * CARD_NATURAL_W), heightZoom));
    // Solve the fraction form (cols·W·z + (cols−1)·f·W·z = band), then BACK-
    // SOLVE against the gap that will actually render: the fraction is
    // BOUNDED, and a clamped gap the zoom never saw would either crowd the
    // row or overflow it (the same law the ws-stage fit pays — the gap you
    // solve must be the gap the browser lays out).
    const wish = band / (CARD_NATURAL_W * (cols + (cols - 1) * frac));
    gapX = clamp(SHOWCASE_GAP_MIN * s, SHOWCASE_GAP_MAX * s, CARD_NATURAL_W * Math.min(wish, heightZoom) * frac);
    zoom = zoomAt(gapX);
    // A showcase never renders SMALLER than the standard card (a width-bound
    // full single row IS the standard on that capacity).
    zoom = Math.max(zoom, base.cardZoom);
  }

  const slotW = CARD_NATURAL_W * zoom;
  const slotH = CARD_NATURAL_H * zoom;
  const widest = rows.length === 0 ? 0 : Math.max(...rows);
  const pageW = widest > 0 ? widest * slotW + (widest - 1) * gapX : 0;
  const pageH = rows.length > 0 ? rows.length * slotH + (rows.length - 1) * gapY : 0;
  const padX = Math.max(gutterX, (availW - pageW) / 2);
  // OPTICAL CENTRING. Below the album sit TWO visually heavy bands (the
  // status rail and the controller rail), so a mathematically centred
  // single row reads as sitting low. A showcase page therefore lifts by a
  // small share of its free space — bounded, never a jump, and never past
  // the top clearance the ring/band need.
  const free = Math.max(0, availH - gutterTop - gutterBottom - pageH);
  const lift = showcase ? Math.min(free / 2, free * SHOWCASE_OPTICAL_LIFT_FRAC) : 0;
  const padTop = gutterTop + Math.max(0, free / 2 - lift);
  return {rows, zoom, slotW, slotH, gapX, gapY, pageW, pageH, padX, padTop};
}

/** The page a flat hand index lives on. */
export function pageOfIndex(index: number, perPage: number): number {
  return Math.floor(Math.max(0, index) / Math.max(1, perPage));
}

/** The slot (0..perPage-1) a flat hand index occupies on its page. */
export function pageSlotOfIndex(index: number, perPage: number): number {
  return Math.max(0, index) % Math.max(1, perPage);
}

/**
 * Step the flat selection index across the album.
 *  - left/right: ±1 in hand order, clamped (crossing a page edge IS the page
 *    turn — the order continues, nothing wraps);
 *  - up/down: between the ACTIVE page's COMPOSED rows (`rows` — e.g. [5,4]
 *    or [4,3]), column preserved and clamped into a shorter row (nearest
 *    existing card); a single-row (showcase) page keeps them inert; the
 *    page's top/bottom edges stay put — vertical motion never turns a page.
 */
export function stepHandAlbum(
  index: number,
  dir: HandNavDir,
  count: number,
  plan: {perPage: number, rows: ReadonlyArray<number>},
): number {
  if (count <= 0) {
    return 0;
  }
  const i = clamp(0, count - 1, index);
  switch (dir) {
  case 'left':
    return Math.max(0, i - 1);
  case 'right':
    return Math.min(count - 1, i + 1);
  case 'up':
  case 'down': {
    const perPage = Math.max(1, plan.perPage);
    const rows = plan.rows;
    if (rows.length <= 1) {
      return i; // a showcase page — vertical motion has nowhere to go
    }
    const pageStart = Math.floor(i / perPage) * perPage;
    const s = i - pageStart;
    // Locate the row + column in the composed layout.
    let r = 0;
    let rowStart = 0;
    while (r < rows.length - 1 && s >= rowStart + rows[r]) {
      rowStart += rows[r];
      r++;
    }
    const col = s - rowStart;
    if (dir === 'up') {
      if (r === 0) {
        return i;
      }
      const prevStart = rowStart - rows[r - 1];
      return pageStart + prevStart + Math.min(col, rows[r - 1] - 1);
    }
    if (r >= rows.length - 1) {
      return i; // bottom row — the edge is felt
    }
    const nextStart = rowStart + rows[r];
    const target = pageStart + nextStart + Math.min(col, rows[r + 1] - 1);
    return Math.min(count - 1, target);
  }
  default:
    return i;
  }
}

/**
 * The explicit PAGE-TURN command (right-stick flick / wheel / edge click):
 * jump to the SAME relative slot on the neighbouring page (clamped into a
 * partial page). Returns the input index when there is no page that way.
 */
export function pageJumpIndex(index: number, dir: 1 | -1, count: number, perPage: number): number {
  if (count <= 0) {
    return 0;
  }
  const pp = Math.max(1, perPage);
  const i = clamp(0, count - 1, index);
  const page = Math.floor(i / pp);
  const pages = Math.max(1, Math.ceil(count / pp));
  const next = clamp(0, pages - 1, page + dir);
  if (next === page) {
    return i;
  }
  return Math.min(count - 1, next * pp + (i % pp));
}

/* ── page-packet flight anchors ─────────────────────────────────────────── */

export type PacketSide = 'left' | 'right';

export type PacketBox = {
  left: number,
  top: number,
  width: number,
  height: number,
};

/**
 * Where a card of a NON-ACTIVE page physically lives: a compact packet just
 * beyond the album's edge (fully outside the stage — the viewport clip is
 * what hides it). `depth` = how many pages away, `seq` = the card's slot on
 * its page — cards of one page converge on almost the same spot with a
 * micro-stagger, so a flight toward it reads as a packet assembling, never
 * as ten independent cards scattering.
 */
export function packetRect(
  side: PacketSide,
  depth: number,
  seq: number,
  box: PacketBox,
  slotW: number,
  slotH: number,
  uiScale?: number,
): PacketBox {
  const s = uiScale !== undefined && uiScale > 0 ? uiScale : 1;
  const d = Math.max(1, depth);
  const gap = PACKET_GAP * s + (d - 1) * PACKET_DEPTH_STEP * s + seq * PACKET_SEQ_STEP * s;
  const left = side === 'left' ?
    box.left - slotW - gap :
    box.left + box.width + gap;
  const top = box.top + (box.height - slotH) / 2 + (seq % 3 - 1) * 3 * s;
  return {left, top, width: slotW, height: slotH};
}
