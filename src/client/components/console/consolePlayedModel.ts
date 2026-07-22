/*
 * consolePlayedModel — PURE, DOM-free data + layout + navigation math for the
 * console-native «Разыграно» (played cards) overlay.
 *
 * The overlay reads like a PHYSICAL player tableau, not a card catalog:
 *  - cards are grouped into the semantic zones of the printed game
 *    (corporation / preludes / CEO / active / automated / events);
 *  - face-up cards lie in vertical PEEK PILES — every card shows its title
 *    band (cost + tags + name), the newest card of a pile lies fully open at
 *    the bottom, exactly like a seasoned player's table;
 *  - events lie FACE DOWN in one pile (per the printed rules) and open into
 *    a dedicated nested list.
 *
 * Determinism / stability contract (load-bearing):
 *  - grouping is structural (manifest CardType), order inside a zone is the
 *    tableau order = PLAY ORDER (oldest → newest) — never a client re-sort;
 *  - pile splitting is APPEND-ONLY (`splitPiles` fills each pile to the cap
 *    before opening the next), so playing one more card only ever appends to
 *    the last pile of its family or opens a new pile — existing piles never
 *    reshuffle;
 *  - the zoom ladder / pile cap depend only on the card COUNT and the height
 *    budget, so the same tableau always produces the same layout.
 *
 * Navigation is SPATIAL (`pickSpatialTarget`): the shell feeds the live slot
 * rects (viewport px) and the cursor moves to the geometrically nearest
 * target in the pressed direction — matching what the player SEES, not an
 * array index. Pure and unit-testable on plain rect fixtures.
 *
 * Mirrors the sibling pure planners (consoleHandGrid / consoleColoniesModel):
 * px knobs are authored for the 1080p logical space and multiplied by the TV
 * `uiScale` (conUiScale()); 1 on every non-tv profile → byte-identical plans.
 */

import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';

/** Natural PREMIUM card-face box (`.pcard`, 320×460 @ zoom 1). */
export const PLAYED_CARD_NATURAL_W = 320;
export const PLAYED_CARD_NATURAL_H = 460;
/**
 * The natural peek band (px @ zoom 1): the `.pcard` title plate (pad-top 15 +
 * plate 46) plus a sliver of the theme body, so a peeked card still reads
 * cost + tags + name + type colour.
 */
export const PLAYED_PEEK_NATURAL = 78;
/** Pile-cap bounds — a pile is never a lone peek band nor an endless column. */
export const MIN_PILE_CAP = 2;
export const MAX_PILE_CAP = 9;

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

export type PilePlan = {start: number, size: number};

/**
 * APPEND-ONLY pile split: fill each pile to `cap` before opening the next.
 * Deliberately NOT re-balanced — playing one more card appends to the last
 * pile (or opens a new one) and never moves an already-lying card, which is
 * the physical-table behaviour and the layout-stability guarantee.
 */
export function splitPiles(count: number, cap: number): ReadonlyArray<PilePlan> {
  const c = Math.max(1, Math.floor(cap));
  const out: Array<PilePlan> = [];
  for (let start = 0; start < count; start += c) {
    out.push({start, size: Math.min(c, count - start)});
  }
  return out;
}

export interface PlayedPlanInput {
  /** ALL face-up cards (identity + active + automated). */
  faceUpCount: number;
  /** Height budget (screen px) for the tallest pile inside the overlay body. */
  maxPileH: number;
  /** conUiScale() — 1 on non-tv profiles (see module header). */
  uiScale?: number;
}

export interface PlayedPlan {
  /** CSS `zoom` applied to every card face. */
  zoom: number;
  /** One pile slot's width (px at the applied zoom). */
  slotW: number;
  /** Full card height (px at the applied zoom). */
  cardH: number;
  /** Peek band height (px at the applied zoom). */
  peekH: number;
  /** Max cards per pile (derived from the height budget). */
  cap: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Table-density zoom ladder: a young tableau lies large and readable, a late
 * game compacts (which also deepens the piles the height budget allows).
 */
export function playedBaseZoom(n: number): number {
  if (n <= 6) {
    return 0.58;
  }
  if (n <= 12) {
    return 0.53;
  }
  if (n <= 20) {
    return 0.49;
  }
  if (n <= 32) {
    return 0.45;
  }
  return 0.42;
}

/**
 * Plan the tableau presentation: card zoom + pile cap. The cap is the
 * SMART-DISTRIBUTION knob — it is derived from the height budget so a column
 * can never run past the screen; overflow opens the next pile BESIDE it
 * (flex-wrap), which is how the free width gets used.
 */
export function planPlayedLayout(input: PlayedPlanInput): PlayedPlan {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  const zoom = playedBaseZoom(Math.max(0, input.faceUpCount)) * s;
  const cardH = PLAYED_CARD_NATURAL_H * zoom;
  const peekH = PLAYED_PEEK_NATURAL * zoom;
  const budget = Math.max(input.maxPileH, cardH + peekH);
  const cap = clamp(MIN_PILE_CAP, MAX_PILE_CAP, 1 + Math.floor((budget - cardH) / peekH));
  return {zoom, slotW: PLAYED_CARD_NATURAL_W * zoom, cardH, peekH, cap};
}

// ── spatial navigation ──────────────────────────────────────────────────────
// (The per-card focus-target API is RETIRED — the tableau navigates by
// CATEGORY; see consolePlayedCategoryModel. `pickSpatialTarget` below now
// walks the live ZONE-block rects.)

export type NavRect = {
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
};

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
