/*
 * consolePlayedCategoryModel — PURE, DOM-free model of the «Разыграно»
 * CATEGORY VIEW (the rework of the per-card tableau navigation).
 *
 * The main «Разыграно» screen is a READ-ONLY physical tableau: the player
 * navigates CATEGORIES (corporation / preludes / CEO / active / automated /
 * events), never individual cards. Opening a category physically lifts its
 * cards off their table slots into a dedicated view modal; this module owns
 * every decision that does not need a DOM:
 *
 *  - the ordered category list (only non-empty ones are focusable);
 *  - the category view LAYOUT: a near-fullscreen single-card stage for one
 *    card, else an adaptive grid planned by the SAME engine as the hand
 *    (`planHandGrid` — the fork's card-grid quality bar: few cards large,
 *    many cards a balanced grid, scroll only when a readable layout can't
 *    fit; windowing fields for virtualization ride the same plan);
 *  - the PRE-COMPUTED flight target geometry: every proxy's landing rect is
 *    derived from the plan (content origin + col/row strides), so opening a
 *    category costs ONE container measure — never a per-card DOM read.
 *
 * Px knobs are authored for the 1080p logical space and multiplied by the TV
 * `uiScale` (conUiScale()); 1 on every non-tv profile.
 *
 * PICK-MODE SEAM (phase 2 — tableau-pick): the category grid is the future
 * pick surface. This model stays selection-agnostic — eligibility filtering /
 * disabled reasons / min-max bounds arrive as a typed context on the VIEW
 * state (playedCategoryView.ts) and only tint the same layout; nothing here
 * needs to change for it.
 */

import {CardModel} from '@/common/models/CardModel';
import {planHandGrid, HandGridPlan, MAX_COLS, ROW_SLACK} from '@/client/components/console/consoleHandGrid';
import {PlayedZones, PLAYED_CARD_NATURAL_W, PLAYED_CARD_NATURAL_H} from '@/client/components/console/consolePlayedModel';

/** The tableau families, in the fixed visual order of the table. */
export type PlayedCategoryKey = 'corporation' | 'prelude' | 'ceo' | 'active' | 'automated' | 'events';

export const PLAYED_CATEGORY_ORDER: ReadonlyArray<PlayedCategoryKey> =
  ['corporation', 'prelude', 'ceo', 'active', 'automated', 'events'];

/** The category caption (an existing i18n key — the zone captions reuse it). */
export const PLAYED_CATEGORY_LABEL: Record<PlayedCategoryKey, string> = {
  corporation: 'Corporation',
  prelude: 'Preludes',
  ceo: 'CEO',
  active: 'Active',
  automated: 'Automated',
  events: 'Events',
};

export type PlayedCategory = {
  key: PlayedCategoryKey,
  count: number,
  /** The category lies FACE DOWN on the table (events) — its cards flip open. */
  faceDown: boolean,
};

/** The cards of one category, in tableau (= play) order. */
export function categoryCards(zones: PlayedZones, key: PlayedCategoryKey): ReadonlyArray<CardModel> {
  switch (key) {
  case 'corporation': return zones.corporations;
  case 'prelude': return zones.preludes;
  case 'ceo': return zones.ceos;
  case 'active': return zones.active;
  case 'automated': return zones.automated;
  case 'events': return zones.events;
  default: return [];
  }
}

/** The focusable categories of a tableau — only non-empty ones, table order. */
export function playedCategories(zones: PlayedZones): ReadonlyArray<PlayedCategory> {
  return PLAYED_CATEGORY_ORDER
    .map((key) => ({key, count: categoryCards(zones, key).length, faceDown: key === 'events'}))
    .filter((c) => c.count > 0);
}

// ── the category view layout ───────────────────────────────────────────────

/** Grid zoom window (1080-logical; × uiScale inside the engine). A category
 *  is a spacious modal, so its floor matches the hand and its ceiling sits
 *  higher — few cards read LARGE. */
export const CAT_GRID_MIN_ZOOM = 0.5;
export const CAT_GRID_MAX_ZOOM = 0.9;
/** The grow-to-fit art ceiling of the grid (1080-logical; × uiScale) — a
 *  small fitting set grows until the BOX binds (usually the height), matching
 *  the hand's TV art ceiling at the applied scale. */
export const CAT_GRID_FILL_MAX = 1.6;
/** The single-card stage: how much of the box the lone card may take. */
export const CAT_SINGLE_W_SHARE = 0.9;
export const CAT_SINGLE_H_SHARE = 0.94;
/** Absolute single-card art ceiling (applied zoom) — near-fullscreen but the
 *  face never blows past readable art scale even on a 4K stage. */
export const CAT_SINGLE_MAX_ZOOM = 3.4;

/**
 * BREATHING ROOM by count (the physical-table feel): a couple of cards get
 * generous air (margins + wide gaps), a full late-game category packs tight.
 * `air` is the share of EACH box dimension reserved as margin; `gap` is the
 * 1080-logical grid gap handed to the engine (× uiScale inside).
 */
export function categoryAir(count: number): {air: number, gap: number} {
  if (count <= 4) {
    return {air: 0.05, gap: 40};
  }
  if (count <= 9) {
    return {air: 0.025, gap: 26};
  }
  return {air: 0.01, gap: 16};
}

export type CategoryViewLayout =
  | {kind: 'single', zoom: number, slotW: number, slotH: number}
  | {kind: 'grid', plan: HandGridPlan};

/**
 * Plan the category view for `count` cards in the modal's `availW × availH`
 * body box. ONE card → the near-fullscreen stage; else the adaptive grid.
 *
 * `faceFloorZoom` (APPLIED zoom — the table's shelf face, PL-619): a category
 * LIFTS its cards off the shelf, so the grid never lays a face out SMALLER
 * than the shelf it came from while the zone can stand on one screen at that
 * face — the generous AIR of a small set yields first (on the Deck it alone
 * shrank four cards under the shelf). A zone that cannot stand on one screen
 * at the shelf's face shrinks just enough to (single-screen, no scroll — the
 * project's first goal); only a zone too big even for that scrolls.
 */
export function planCategoryView(input: {availW: number, availH: number, count: number, uiScale?: number, faceFloorZoom?: number}): CategoryViewLayout {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  if (input.count <= 1) {
    const w = Math.max(1, input.availW);
    const h = Math.max(1, input.availH);
    const zoom = Math.max(0.4, Math.min(
      (w * CAT_SINGLE_W_SHARE) / PLAYED_CARD_NATURAL_W,
      (h * CAT_SINGLE_H_SHARE) / PLAYED_CARD_NATURAL_H,
      CAT_SINGLE_MAX_ZOOM * Math.max(1, s * 0.85),
    ));
    return {kind: 'single', zoom, slotW: PLAYED_CARD_NATURAL_W * zoom, slotH: PLAYED_CARD_NATURAL_H * zoom};
  }
  // The engine works in 1080-logical zoom (× uiScale inside): the applied floor divides back.
  const floor = input.faceFloorZoom !== undefined && input.faceFloorZoom > 0 ? input.faceFloorZoom / s : 0;
  const planWith = (room: {air: number, gap: number}, minZoom: number, maxZoom?: number): HandGridPlan => planHandGrid({
    availW: input.availW * (1 - room.air * 2),
    availH: input.availH * (1 - room.air * 2),
    count: input.count,
    uiScale: s,
    minZoom,
    maxZoom: maxZoom ?? Math.max(CAT_GRID_MAX_ZOOM, minZoom),
    gapX: room.gap,
    gapY: room.gap,
    fillToBox: true,
    fillMaxZoom: CAT_GRID_FILL_MAX,
  });
  if (floor <= CAT_GRID_MIN_ZOOM) {
    return {kind: 'grid', plan: planWith(categoryAir(input.count), CAT_GRID_MIN_ZOOM)};
  }
  // The largest face at which the WHOLE zone stands on one screen (1080-logical) — every balanced column count the
  // engine allows, the engine's own arithmetic. Computed here rather than read off the engine: its search keeps a
  // SCROLLING base plan whose face is larger than every fitting one (fourteen cards at 1080 — 5 × 3 scrolled at 0.58
  // while 5 × 3 fitted at 0.55), and «one screen» is this view's whole point.
  const oneScreenZoom = (room: {air: number, gap: number}): number => {
    const w = input.availW * (1 - room.air * 2);
    const h = input.availH * (1 - room.air * 2);
    const gap = room.gap * s;
    const maxCols = Math.max(1, Math.min(Math.round(MAX_COLS * s), input.count));
    let best = 0;
    for (let c = 1; c <= maxCols; c++) {
      const r = Math.ceil(input.count / c);
      if (Math.ceil(input.count / r) !== c) {
        continue; // the balanced counts only (the engine's anti-orphan rule)
      }
      const z = Math.min(
        (w - ROW_SLACK * s - (c - 1) * gap) / (c * PLAYED_CARD_NATURAL_W),
        (h - (r - 1) * gap) / (r * PLAYED_CARD_NATURAL_H),
        CAT_GRID_FILL_MAX * s,
      );
      best = Math.max(best, z);
    }
    return best / s;
  };
  // (Handed to the engine as [z − ε, z]: its own column cap divides the room by a slot of exactly that face, and on
  // the exact value the floor of the quotient sits on a knife's edge — c or c − 1 by the last bit.)
  const own = categoryAir(input.count);
  const tight = categoryAir(Number.POSITIVE_INFINITY);
  // A LIFT NEVER SHRINKS A FACE (PL-619) — the shelf's face is the floor, and the AIR yields before the face does: a
  // set that stands on one screen at the shelf's face keeps its generous air if it can, else packs tight; it still
  // GROWS into the box past the floor.
  for (const room of [own, tight]) {
    const z = oneScreenZoom(room);
    if (z >= floor) {
      return {kind: 'grid', plan: planWith(room, z * (1 - 1e-6), z)};
    }
  }
  // …UNLESS the face is what keeps the zone on ONE screen (the project's first goal — single screen, no scroll): the
  // whole zone shrinks just enough to stand together, packed tight. Only a zone too big even for that scrolls.
  const fit = oneScreenZoom(tight);
  if (fit >= CAT_GRID_MIN_ZOOM) {
    return {kind: 'grid', plan: planWith(tight, fit * (1 - 1e-6), fit)};
  }
  // A zone that scrolls anyway keeps the shelf's face — never both a smaller face AND a scroll (the Deck's fourteen
  // active cards: one screen would need 132 px faces, under the readable floor; the engine's own scrolling pick
  // shrank them to 182 px under the 191 px shelf all the same).
  return {kind: 'grid', plan: planWith(own, Math.max(CAT_GRID_MIN_ZOOM, floor))};
}

// ── the flight budget (bounded proxies) ────────────────────────────────────

/** Rows kept in the flight window beyond the visible ones (mirrors the grid's
 *  render overscan, so every card the player will see land flies for real). */
export const FLIGHT_OVERSCAN_ROWS = 2;
/** Off-window sweep tail: a few extra cards fly-and-fade into the scroll so
 *  the bounded set never reads as a hard cutoff. */
export const FLIGHT_TAIL_MAX = 10;
/** Bounding must EARN its grounded-dissolve: when it would spare fewer than
 *  this many proxies, everything flies (the historical full choreography). */
const FLIGHT_BOUND_MIN_GAIN = 8;

/**
 * The card indices that FLY in one category episode (open: window at
 * scrollTop 0; close: window at the current scroll). Everything else is
 * GROUNDED — it dissolves in place on the table instead of flying. Pure and
 * deterministic: the visible grid rows + overscan, plus a short sweep tail
 * past the window's end. A non-scrolling grid (every card visible) and any
 * category where bounding would save almost nothing fly whole.
 */
export function plannedFlightIndices(
  layout: CategoryViewLayout,
  count: number,
  viewH: number,
  scrollTop: number,
): Array<number> {
  const all = () => Array.from({length: count}, (_, i) => i);
  if (layout.kind === 'single' || count <= 1) {
    return all();
  }
  const p = layout.plan;
  if (!p.scrolls || p.rowStride <= 0) {
    return all();
  }
  const firstRow = Math.max(0, Math.floor(scrollTop / p.rowStride) - FLIGHT_OVERSCAN_ROWS);
  const lastRow = Math.min(p.rows - 1, Math.ceil((scrollTop + Math.max(0, viewH)) / p.rowStride) + FLIGHT_OVERSCAN_ROWS);
  const first = firstRow * p.cols;
  const afterLast = Math.min(count, (lastRow + 1) * p.cols);
  const out: Array<number> = [];
  for (let i = first; i < afterLast; i++) {
    out.push(i);
  }
  // The sweep tail rides past the window's end (open lands it into the
  // scroll, close raises it out of the scroll — both fade by the existing
  // off-window language).
  for (let i = afterLast; i < Math.min(count, afterLast + FLIGHT_TAIL_MAX); i++) {
    out.push(i);
  }
  // A window that does not start at 0 (a scrolled close) keeps a short tail
  // on the leading side too.
  for (let i = Math.max(0, first - FLIGHT_TAIL_MAX); i < first; i++) {
    out.push(i);
  }
  if (out.length >= count - FLIGHT_BOUND_MIN_GAIN) {
    return all();
  }
  return out.sort((a, b) => a - b);
}

// ── pre-computed flight geometry ───────────────────────────────────────────

export type FlightRect = {x: number, y: number, w: number, h: number};

/**
 * The landing rect of card `index` in the category view, derived PURELY from
 * the layout + the measured content-box origin (one container read for the
 * whole flight — never a per-card DOM measure). For a scrolling grid the
 * rects are in the UNSCROLLED content space (scrollTop 0 — the view always
 * opens at the top); the caller marks rects below the viewport clip as
 * not-visible so their proxies fade into the scroll.
 */
export function categoryTargetRect(
  layout: CategoryViewLayout,
  index: number,
  count: number,
  origin: {x: number, y: number, w: number, h?: number},
): FlightRect {
  if (layout.kind === 'single') {
    // The lone card centres in BOTH axes of its stage (the flex box mirror).
    const boxH = origin.h ?? layout.slotH;
    return {
      x: origin.x + Math.max(0, (origin.w - layout.slotW) / 2),
      y: origin.y + Math.max(0, (boxH - layout.slotH) / 2),
      w: layout.slotW,
      h: layout.slotH,
    };
  }
  const p = layout.plan;
  const col = index % p.cols;
  const row = Math.floor(index / p.cols);
  // Every row centres within the content width — the (possibly partial) LAST
  // row centres on its own card count. The CSS grid rows mirror this exactly
  // (flex rows, justify-content: center), so the proxies land pixel-true.
  const isLastRow = row === Math.max(1, p.rows) - 1;
  const inRow = isLastRow ? Math.max(1, count - (p.rows - 1) * p.cols) : p.cols;
  const rowW = inRow * p.slotW + (inRow - 1) * p.gapX;
  const rowX = origin.x + Math.max(0, (origin.w - rowW) / 2);
  return {
    x: rowX + col * (p.slotW + p.gapX),
    y: origin.y + row * p.rowStride,
    w: p.slotW,
    h: p.slotH,
  };
}
