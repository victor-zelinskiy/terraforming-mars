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
import {planHandGrid, HandGridPlan} from '@/client/components/console/consoleHandGrid';
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
/** The grow-to-fit art ceiling of the grid (applied zoom = this × uiScale). */
export const CAT_GRID_FILL_MAX = 1.18;
/** The single-card stage: how much of the box the lone card may take. */
export const CAT_SINGLE_W_SHARE = 0.9;
export const CAT_SINGLE_H_SHARE = 0.94;
/** Absolute single-card art ceiling (applied zoom) — near-fullscreen but the
 *  face never blows past readable art scale even on a 4K stage. */
export const CAT_SINGLE_MAX_ZOOM = 3.4;

export type CategoryViewLayout =
  | {kind: 'single', zoom: number, slotW: number, slotH: number}
  | {kind: 'grid', plan: HandGridPlan};

/**
 * Plan the category view for `count` cards in the modal's `availW × availH`
 * body box. ONE card → the near-fullscreen stage; else the adaptive grid.
 */
export function planCategoryView(input: {availW: number, availH: number, count: number, uiScale?: number}): CategoryViewLayout {
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
  const plan = planHandGrid({
    availW: input.availW,
    availH: input.availH,
    count: input.count,
    uiScale: s,
    minZoom: CAT_GRID_MIN_ZOOM,
    maxZoom: CAT_GRID_MAX_ZOOM,
    fillToBox: true,
    fillMaxZoom: CAT_GRID_FILL_MAX,
  });
  return {kind: 'grid', plan};
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
