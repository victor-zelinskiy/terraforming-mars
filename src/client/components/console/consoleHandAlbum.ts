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

export type HandNavDir = 'left' | 'right' | 'up' | 'down';

/** The page grid of a layout profile (columns × rows). */
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
 */
export function albumSpecFor(profile: ConsoleLayoutProfile): AlbumSpec {
  return profile === 'handheld' ? {cols: 4, rows: 1} : {cols: 5, rows: 2};
}

/* ── layout constants (1080-logical px — × uiScale inside the planner) ──── */

/** Column gap between slots — slightly airier than the old scroll grid. */
export const ALBUM_GAP_X = 20;
/** Row gap — clears the focus ring of the row above. */
export const ALBUM_GAP_Y = 26;
/** Lateral stage gutter (page inset inside the album box). */
export const ALBUM_GUTTER_X = 24;
/** Top gutter — reserves the pick-band overhang + the focus pop headroom. */
export const ALBUM_GUTTER_TOP = 34;
/** Bottom gutter — focus pop + shadow clearance. */
export const ALBUM_GUTTER_BOTTOM = 16;
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
  const gutterX = ALBUM_GUTTER_X * s;
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
 *  - up/down: ±cols WITHIN the page, column preserved, clamped into a
 *    partial last row (nearest existing card); the page's top/bottom edges
 *    stay put — vertical motion never turns a page.
 */
export function stepHandAlbum(index: number, dir: HandNavDir, count: number, plan: {cols: number, perPage: number}): number {
  if (count <= 0) {
    return 0;
  }
  const i = clamp(0, count - 1, index);
  const cols = Math.max(1, plan.cols);
  const perPage = Math.max(1, plan.perPage);
  const slot = i % perPage;
  const page = Math.floor(i / perPage);
  switch (dir) {
  case 'left':
    return Math.max(0, i - 1);
  case 'right':
    return Math.min(count - 1, i + 1);
  case 'up':
    return slot >= cols ? i - cols : i;
  case 'down': {
    if (slot >= perPage - cols) {
      return i; // bottom row of the page — the edge is felt
    }
    const target = i + cols;
    // A partial last row clamps to its final card; never off this page.
    const pageLast = Math.min(count - 1, (page + 1) * perPage - 1);
    return Math.min(pageLast, target);
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
