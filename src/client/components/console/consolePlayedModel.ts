/*
 * consolePlayedModel — PURE, DOM-free data + layout + navigation math for the
 * console-native «Разыграно» (played cards) TABLE.
 *
 * THE TABLE IS A TABLE (TR65, 2026-10-17 — «СТОЛ — ЭТО СТОЛ»): it stands in
 * the central opening like every workspace screen, its faces are readable from
 * the couch (the hand album's density), its zones are SHELVES, the corporation
 * is the HERO. Two regions:
 *
 *  - the IDENTITY column (left, on every page): the corporation(s) as the hero
 *    face(s), the face-down EVENTS stack with its count beneath (per the
 *    printed rules events lie face down in one pile);
 *  - the SHELF ALBUM (right, paged): the project zones — preludes · CEO · active
 *    · automated — as runs of full faces on album pages. A shelf begins at a
 *    row's left edge; a short zone may share a row with the tail of the one
 *    before it when it fits whole; a long zone spans rows (and pages) — its
 *    continuations are named with their range. The pages are STRICT: the
 *    strip slides by transform, the active page is derived from the focused
 *    zone (a zone off the page turns the page), LT/RT turn it explicitly.
 *
 * Determinism / stability contract (load-bearing):
 *  - grouping is structural (manifest CardType), order inside a zone is the
 *    tableau order = PLAY ORDER (oldest → newest) — never a client re-sort;
 *  - the packing is APPEND-ONLY by construction: a card played appends to its
 *    zone's last run (or opens a new run / row / page) and never moves a card
 *    that already lies on a shelf — the landing's +1 layout is final before
 *    the card arrives (the hero scene measures it);
 *  - the card size is a BOX fact (the album box + the composition), never a
 *    fact of how many cards lie on the table — one card, ten and fifty are
 *    the same face; a growing table only ever adds pages. The ONE exception
 *    is a table that fits one short row (the showcase, bounded), which grows
 *    into its room instead of standing small over an empty stage.
 *
 * Navigation is SPATIAL (`pickSpatialTarget`): the shell feeds the live zone
 * rects (viewport px) and the cursor moves to the geometrically nearest
 * target in the pressed direction — matching what the player SEES.
 *
 * Px knobs are authored for the 1080p logical space and multiplied by the TV
 * `uiScale` (conUiScale()); 1 on every non-tv profile → byte-identical plans.
 */

import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {ALBUM_GAP_X, ALBUM_MAX_ZOOM, ALBUM_MIN_ZOOM, AlbumSpec, PAGE_STRIDE_EXTRA} from '@/client/components/console/consoleHandAlbum';

/** Natural PREMIUM card-face box (`.pcard`, 320×460 @ zoom 1). */
export const PLAYED_CARD_NATURAL_W = 320;
export const PLAYED_CARD_NATURAL_H = 460;
/**
 * The natural peek band (px @ zoom 1): the `.pcard` title plate (pad-top 15 +
 * plate 46) plus the divider row (gap 6 + divider 2 + gap 6), so a peeked
 * card still reads cost + tags + name + type colour + the top of its
 * requirements cassette. Exactly 75 — the art row starts at 75, so no art
 * sliver ever peeks out of a strip. (The TABLE no longer stacks peeks — the
 * receiving stage's compact piles and the start deployment shelf still do.)
 */
export const PLAYED_PEEK_NATURAL = 75;

/** The face-up zone families, in the fixed visual order of the tableau. */
export type PlayedFamily = 'corporation' | 'prelude' | 'ceo' | 'active' | 'automated';

export type PlayedZones = {
  corporations: ReadonlyArray<CardModel>,
  preludes: ReadonlyArray<CardModel>,
  ceos: ReadonlyArray<CardModel>,
  active: ReadonlyArray<CardModel>,
  automated: ReadonlyArray<CardModel>,
  /** Played events — rendered FACE DOWN as one pile on the main screen. */
  events: ReadonlyArray<CardModel>,
};

/**
 * Structural grouping of a player's tableau into the printed-game zones.
 * Preserves tableau order (= play order); a card whose manifest entry is
 * missing is dropped (nothing renderable to show — mirrors the desktop
 * grouping's behaviour).
 */
export function buildPlayedZones(tableau: ReadonlyArray<CardModel>): PlayedZones {
  const corporations: Array<CardModel> = [];
  const preludes: Array<CardModel> = [];
  const ceos: Array<CardModel> = [];
  const active: Array<CardModel> = [];
  const automated: Array<CardModel> = [];
  const events: Array<CardModel> = [];
  for (const card of tableau) {
    switch (getCard(card.name)?.type) {
    case CardType.CORPORATION: corporations.push(card); break;
    case CardType.PRELUDE: preludes.push(card); break;
    case CardType.CEO: ceos.push(card); break;
    case CardType.ACTIVE: active.push(card); break;
    case CardType.AUTOMATED: automated.push(card); break;
    case CardType.EVENT: events.push(card); break;
    default: break;
    }
  }
  return {corporations, preludes, ceos, active, automated, events};
}

/** Every face-up card in the fixed visual order (identity first) — the
 *  fullscreen browser pages over exactly this list. */
export function flatFaceUp(zones: PlayedZones): ReadonlyArray<CardModel> {
  return [...zones.corporations, ...zones.preludes, ...zones.ceos, ...zones.active, ...zones.automated];
}

// ── THE SHELVES — zone runs packed onto album rows and pages ───────────────

/** The zones that lie on the SHELF ALBUM (the identity column holds the rest). */
export type PlayedShelfZone = 'prelude' | 'ceo' | 'active' | 'automated';
export const PLAYED_SHELF_ORDER: ReadonlyArray<PlayedShelfZone> = ['prelude', 'ceo', 'active', 'automated'];

/** One RUN of a zone on one row: `count` faces from the zone's `start`, at column `col`. */
export type PlayedRun = {
  zone: PlayedShelfZone,
  /** The run's first card's index within its zone (the zone's own order = play order). */
  start: number,
  count: number,
  /** The run's first column on its row. */
  col: number,
  /** The zone's FIRST run (its caption carries the zone's total); a continuation names its range. */
  first: boolean,
};
export type PlayedRow = {runs: ReadonlyArray<PlayedRun>, count: number};
export type PlayedPage = {index: number, rows: ReadonlyArray<PlayedRow>};

/**
 * PACK the zones onto rows of `cols` slots, in table order. A zone's first run
 * starts a NEW row — unless the whole zone fits in the free slots of the row
 * being filled (a short zone tucks in after the tail of the one before it,
 * which is how a table of 20 stays on two pages instead of three). A zone
 * longer than a row splits into row-sized runs, each named as a continuation.
 * APPEND-ONLY: adding a card to a zone's end extends its last run or opens the
 * next; nothing before it moves.
 */
export function packShelves(counts: Readonly<Record<PlayedShelfZone, number>>, cols: number): Array<PlayedRow> {
  const width = Math.max(1, Math.floor(cols));
  const rows: Array<PlayedRow> = [];
  let runs: Array<PlayedRun> = [];
  let used = 0;
  const flush = () => {
    if (used > 0) {
      rows.push({runs, count: used});
    }
    runs = [];
    used = 0;
  };
  for (const zone of PLAYED_SHELF_ORDER) {
    let remaining = Math.max(0, Math.floor(counts[zone] ?? 0));
    if (remaining === 0) {
      continue;
    }
    if (used > 0 && remaining > width - used) {
      flush();
    }
    let start = 0;
    let first = true;
    while (remaining > 0) {
      const take = Math.min(width - used, remaining);
      runs.push({zone, start, count: take, col: used, first});
      used += take;
      remaining -= take;
      start += take;
      first = false;
      if (remaining > 0) {
        flush();
      }
    }
  }
  flush();
  return rows;
}

/** Cut the rows into strict pages of `rowsPerPage`. An empty table is one empty page. */
export function pageShelves(rows: ReadonlyArray<PlayedRow>, rowsPerPage: number): Array<PlayedPage> {
  const per = Math.max(1, Math.floor(rowsPerPage));
  const pages: Array<PlayedPage> = [];
  for (let i = 0; i < rows.length; i += per) {
    pages.push({index: pages.length, rows: rows.slice(i, i + per)});
  }
  return pages.length > 0 ? pages : [{index: 0, rows: []}];
}

/** The page a card of `zone` at `index` (within the zone) lies on. */
export function pageOfShelfCard(pages: ReadonlyArray<PlayedPage>, zone: PlayedShelfZone, index: number): number | undefined {
  for (const page of pages) {
    for (const row of page.rows) {
      for (const run of row.runs) {
        if (run.zone === zone && index >= run.start && index < run.start + run.count) {
          return page.index;
        }
      }
    }
  }
  return undefined;
}

/** The pages a zone has a run on, ascending (empty for a zone with no cards). */
export function zonePages(pages: ReadonlyArray<PlayedPage>, zone: PlayedShelfZone): Array<number> {
  const out: Array<number> = [];
  for (const page of pages) {
    if (page.rows.some((row) => row.runs.some((run) => run.zone === zone))) {
      out.push(page.index);
    }
  }
  return out;
}

/** The zones with a run on the page, in reading order (first row first, left to right), each once. */
export function zonesOnPage(page: PlayedPage | undefined): Array<PlayedShelfZone> {
  const out: Array<PlayedShelfZone> = [];
  for (const row of page?.rows ?? []) {
    for (const run of row.runs) {
      if (!out.includes(run.zone)) {
        out.push(run.zone);
      }
    }
  }
  return out;
}

// ── THE TABLE PLAN — the identity column + the shelf album ─────────────────
// (1080-logical px — × uiScale inside the planner)

/** The identity column's share of the table width, and its floor. */
export const TABLE_IDENTITY_SHARE = 0.2;
export const TABLE_IDENTITY_MIN = 240;
/** The seam between the identity column and the album. */
export const TABLE_COL_GAP = 28;
/** The identity column's inner pad (the hero's ring + the plate's edge). */
export const TABLE_PAD = 10;
/** A zone caption's lane above its shelf (the TV caption + its air). */
export const TABLE_CAPTION_H = 30;
/** The page-edge lane (the chevrons) and the ring clearance inside it. */
export const TABLE_EDGE_GUTTER = 16;
export const TABLE_GUTTER_X = 20;
export const TABLE_GUTTER_TOP = 8;
export const TABLE_GUTTER_BOTTOM = 12;
/** Between two shelf rows. */
export const TABLE_ROW_GAP = 10;
/** The hero face relative to a shelf face (capped by the column's room). */
export const TABLE_HERO_GAIN = 1.35;
/** The events stack relative to a shelf face (a back with a count needs less). */
export const TABLE_EVENTS_GAIN = 0.8;
/** A one-row table may grow this much past the standard face (bounded — a face larger reads as an inspect). */
export const TABLE_SHOWCASE_GAIN = 1.5;

/**
 * The table's page is never one row (the owner's decision 2026-10-17, PL-622): the handheld album keeps the hand's
 * one-row density, the TABLE stands on two — on the Deck 191 px faces, 20 cards in 4 pages (one row: 208 px, 7 pages,
 * the lower half of the body empty).
 */
export const TABLE_MIN_ROWS = 2;

/** The album composition of the TABLE: the profile's page minus the column the identity takes. */
export function tableAlbumSpec(spec: AlbumSpec): AlbumSpec {
  return {cols: Math.max(2, spec.cols - 1), rows: Math.max(TABLE_MIN_ROWS, spec.rows)};
}

export interface PlayedTableInput {
  /** The measured table body box (screen px). */
  availW: number;
  availH: number;
  /** Cards per shelf zone. */
  counts: Readonly<Record<PlayedShelfZone, number>>;
  /** Corporations on the table (the bot's corporation counts as one; 0 → a prepared place). */
  corporations: number;
  /** The profile's album page (the table composes `cols − 1` of it beside the identity column). */
  spec: AlbumSpec;
  /** conUiScale() — 1 on every non-tv profile. */
  uiScale?: number;
}

export interface PlayedTablePlan {
  /** The identity column's width (screen px); it starts at x = 0 of the body. */
  identityW: number;
  /** The corporation hero face(s). */
  hero: {zoom: number, slotW: number, slotH: number, count: number};
  /** The face-down events stack (its box is reserved whether or not an event lies there). */
  events: {zoom: number, slotW: number, slotH: number};
  /** The shelf album box and its solved composition. */
  album: {
    x: number, w: number, h: number,
    cols: number, rowsPerPage: number,
    zoom: number, slotW: number, slotH: number,
    gapX: number, rowGap: number, captionH: number,
    padX: number, padTop: number, stride: number,
    /** The one-row table grown into its room. */
    showcase: boolean,
  };
  rows: ReadonlyArray<PlayedRow>;
  pages: ReadonlyArray<PlayedPage>;
  pageCount: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Solve the whole table for a body box. Pure: the shelf face comes from the
 * album box and the composition (never from the card count — the one bounded
 * exception being a one-row table), the hero and the events stack from the
 * identity column's room.
 */
export function planPlayedTable(input: PlayedTableInput): PlayedTablePlan {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  const availW = Math.max(1, input.availW);
  const availH = Math.max(1, input.availH);
  const spec = tableAlbumSpec(input.spec);
  const cols = spec.cols;

  const captionH = TABLE_CAPTION_H * s;
  const gapX = ALBUM_GAP_X * s;
  const rowGap = TABLE_ROW_GAP * s;
  const padX = (TABLE_EDGE_GUTTER + TABLE_GUTTER_X) * s;
  const padTop = TABLE_GUTTER_TOP * s;
  const padBottom = TABLE_GUTTER_BOTTOM * s;

  const identityW = Math.round(Math.max(TABLE_IDENTITY_MIN * s, availW * TABLE_IDENTITY_SHARE));
  const albumX = identityW + TABLE_COL_GAP * s;
  const albumW = Math.max(1, availW - albumX);
  const albumH = availH;

  const rows = packShelves(input.counts, cols);

  // THE STANDARD FACE — the box and the composition, never the count.
  const widthZoom = (albumW - 2 * padX - (cols - 1) * gapX) / (cols * PLAYED_CARD_NATURAL_W);
  const heightZoomFor = (r: number) => (albumH - padTop - padBottom - r * captionH - (r - 1) * rowGap) / (r * PLAYED_CARD_NATURAL_H);
  // THE ROWS ARE THE PROFILE'S (PL-622): a page has exactly the album's rows. A rule that added a row whenever it cost
  // under a tenth of the face sat on a knife's edge on the Deck (its body measures 1000–1045 px wide — one row there,
  // two rows here), so a provenance line or a satellite lane re-laid every face between two seats of one table.
  const rowsPerPage = spec.rows;
  const pages = pageShelves(rows, rowsPerPage);
  const heightZoom = heightZoomFor(rowsPerPage);
  const standard = clamp(ALBUM_MIN_ZOOM * s, ALBUM_MAX_ZOOM * s, Math.min(widthZoom, heightZoom));
  // THE SHOWCASE — a table that is ONE short row grows into its room, bounded: the width its few slots get, the
  // one-row height, the gain cap (a face past it stops reading as a table).
  let zoom = standard;
  let showcase = false;
  if (rows.length === 1 && rows[0].count < cols) {
    const n = Math.max(1, rows[0].count);
    const wZ = (albumW - 2 * padX - (n - 1) * gapX) / (n * PLAYED_CARD_NATURAL_W);
    const hZ = (albumH - padTop - padBottom - captionH) / PLAYED_CARD_NATURAL_H;
    const grown = clamp(ALBUM_MIN_ZOOM * s, ALBUM_MAX_ZOOM * s, Math.min(wZ, hZ, standard * TABLE_SHOWCASE_GAIN));
    if (grown > standard) {
      zoom = grown;
      showcase = true;
    }
  }
  const slotW = PLAYED_CARD_NATURAL_W * zoom;
  const slotH = PLAYED_CARD_NATURAL_H * zoom;

  // THE IDENTITY COLUMN — the events stack reserves its box always (the first event's landing never re-lays the
  // hero out); the hero takes what is left, larger than a shelf face when the column allows it.
  const innerW = Math.max(1, identityW - 2 * TABLE_PAD * s);
  const eventsZoom = clamp(ALBUM_MIN_ZOOM * s, innerW / PLAYED_CARD_NATURAL_W, standard * TABLE_EVENTS_GAIN);
  const eventsH = PLAYED_CARD_NATURAL_H * eventsZoom;
  const heroCount = Math.max(1, Math.floor(input.corporations));
  const heroBudgetH = Math.max(1, availH - padTop - padBottom - 2 * captionH - eventsH - rowGap - (heroCount - 1) * rowGap);
  const heroZoom = clamp(ALBUM_MIN_ZOOM * s, ALBUM_MAX_ZOOM * s, Math.min(
    innerW / PLAYED_CARD_NATURAL_W,
    heroBudgetH / (heroCount * PLAYED_CARD_NATURAL_H),
    standard * TABLE_HERO_GAIN,
  ));

  return {
    identityW,
    hero: {zoom: heroZoom, slotW: PLAYED_CARD_NATURAL_W * heroZoom, slotH: PLAYED_CARD_NATURAL_H * heroZoom, count: heroCount},
    events: {zoom: eventsZoom, slotW: PLAYED_CARD_NATURAL_W * eventsZoom, slotH: eventsH},
    album: {
      x: albumX, w: albumW, h: albumH,
      cols, rowsPerPage,
      zoom, slotW, slotH,
      gapX, rowGap, captionH,
      padX, padTop, stride: albumW + PAGE_STRIDE_EXTRA * s,
      showcase,
    },
    rows,
    pages,
    pageCount: pages.length,
  };
}

// ── spatial navigation ──────────────────────────────────────────────────────
// (The tableau navigates by ZONE; `pickSpatialTarget` walks the live
// zone-block rects — the identity blocks and the runs of the active page.)

export type NavRect = {
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
};

/** One rect per key — the UNION of a zone's runs on the page (a zone split over two rows is one target). */
export function unionNavRects(rects: ReadonlyArray<NavRect>): Array<NavRect> {
  const byKey = new Map<string, NavRect>();
  for (const r of rects) {
    const cur = byKey.get(r.key);
    if (cur === undefined) {
      byKey.set(r.key, {...r});
      continue;
    }
    const x = Math.min(cur.x, r.x);
    const y = Math.min(cur.y, r.y);
    const right = Math.max(cur.x + cur.w, r.x + r.w);
    const bottom = Math.max(cur.y + cur.h, r.y + r.h);
    byKey.set(r.key, {key: r.key, x, y, w: right - x, h: bottom - y});
  }
  return Array.from(byKey.values());
}

/** Orthogonal drift is penalized so the cursor prefers the visually aligned
 *  neighbour over a nearer-but-diagonal one. */
const ORTHO_WEIGHT = 2.4;

/**
 * Pick the nearest target in the pressed direction, judged by the LIVE slot
 * rects (what the player actually sees). Returns undefined at an edge — the
 * cursor stays put, the edge is felt (no wrap). Deterministic: ties keep the
 * first candidate in `rects` order (DOM order).
 */
export function pickSpatialTarget(
  fromKey: string,
  rects: ReadonlyArray<NavRect>,
  dir: NavDirection,
): string | undefined {
  const from = rects.find((r) => r.key === fromKey);
  if (from === undefined) {
    return rects[0]?.key;
  }
  const fcx = from.x + from.w / 2;
  const fcy = from.y + from.h / 2;
  let best: string | undefined = undefined;
  let bestScore = Infinity;
  for (const r of rects) {
    if (r.key === fromKey) {
      continue;
    }
    const dx = (r.x + r.w / 2) - fcx;
    const dy = (r.y + r.h / 2) - fcy;
    let axial: number;
    let ortho: number;
    switch (dir) {
    case 'left':
      if (dx >= -1) {
        continue;
      }
      axial = -dx; ortho = Math.abs(dy);
      break;
    case 'right':
      if (dx <= 1) {
        continue;
      }
      axial = dx; ortho = Math.abs(dy);
      break;
    case 'up':
      if (dy >= -1) {
        continue;
      }
      axial = -dy; ortho = Math.abs(dx);
      break;
    case 'down':
      if (dy <= 1) {
        continue;
      }
      axial = dy; ortho = Math.abs(dx);
      break;
    default:
      continue;
    }
    const score = axial + ortho * ORTHO_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = r.key;
    }
  }
  return best;
}
