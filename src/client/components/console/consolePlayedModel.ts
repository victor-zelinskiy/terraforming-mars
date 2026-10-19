/*
 * consolePlayedModel — PURE, DOM-free data + layout + navigation math for the
 * console-native «Разыграно» (played cards) TABLE.
 *
 * THE TABLE IS ONE PAGE OF STACKS (the owner, 2026-10-19 — «разыграно всегда
 * одна страница»; TR65's chassis — the central opening, the workspace head —
 * stays): every zone lies as a physical TABLE STACK of the printed game — the
 * corporation, the preludes, the CEO, the active and the automated cards as
 * CASCADES (each covered card shows its title band, the newest lies whole in
 * front), the events as ONE face-down pile with its count. The whole table
 * stands on one screen; how COMPACT it is (the face, the band, the lanes a
 * long zone splits into) is solved from the measured body and the counts
 * (`planPlayedStacks`). A zone is READ in its category view (A), which is
 * where pages are allowed.
 *
 * Determinism / stability contract (load-bearing):
 *  - grouping is structural (manifest CardType), order inside a zone is the
 *    tableau order = PLAY ORDER (oldest → newest) — never a client re-sort;
 *  - the newest card of a zone is the FRONT of its last lane (lanes hold
 *    contiguous runs of the play order) — the landing's target is always a
 *    whole face;
 *  - the plan is a function of the box and the counts: the landing renders
 *    the +1 table BEFORE the card arrives (the hero scene measures that
 *    final layout), so nothing moves under the flight.
 *
 * Navigation is SPATIAL (`pickSpatialTarget`): the shell feeds the live stack
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

/** Natural PREMIUM card-face box (`.pcard`, 320×460 @ zoom 1). */
export const PLAYED_CARD_NATURAL_W = 320;
export const PLAYED_CARD_NATURAL_H = 460;
/**
 * The natural peek band (px @ zoom 1): the `.pcard` title plate (pad-top 15 +
 * plate 46) plus the divider row (gap 6 + divider 2 + gap 6), so a peeked
 * card still reads cost + tags + name + type colour + the top of its
 * requirements cassette. Exactly 75 — the art row starts at 75, so no art
 * sliver ever peeks out of a strip. The TABLE's stacks show it at their
 * COMFORT density and tighten it as a zone grows (`STACK_PEEK_*`); the
 * receiving stage's compact piles and the start deployment shelf peek too.
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

// ── THE STACKS — every zone a TABLE STACK, the whole table on ONE page ─────
//
// «РАЗЫГРАНО — ВСЕГДА ОДНА СТРАНИЦА» (the owner, 2026-10-19): the overview is never paged. Every zone lies as a
// physical STACK of the printed game — the corporation, the preludes, the CEO, the active and the automated cards as
// CASCADES (each card shows its title band, the newest lies whole in front), the events as one face-down pile — and
// the whole table stands on one screen. The COMPACTNESS is the solver's: the face's size, how much of each title band
// shows and how many LANES a long zone splits into are solved together from the measured body and the zones' counts
// (a few cards — large faces with generous bands; a late-game table — smaller faces, tighter bands, a long zone in two
// or three lanes; past the readable floor the bands become a pile's edges). Reading a zone in detail is the CATEGORY
// VIEW's job (A on the stack) — that is where pages are allowed.

/** The table's stacks, in the fixed visual order of the printed tableau. */
export type PlayedStackKey = 'corporation' | 'prelude' | 'ceo' | 'active' | 'automated' | 'events';
export const PLAYED_STACK_ORDER: ReadonlyArray<PlayedStackKey> = ['corporation', 'prelude', 'ceo', 'active', 'automated', 'events'];
/** The project stacks — drawn only when they hold a card. */
export const PLAYED_PROJECT_STACKS: ReadonlyArray<PlayedStackKey> = ['prelude', 'ceo', 'active', 'automated'];

/* 1080-logical px — × uiScale inside the planner. */
/** Between two stacks. */
export const STACK_GAP = 28;
/** …and the most a short table may spread them (the spare width is shared out up to this, the rest centres). */
export const STACK_GAP_MAX = 64;
/** Between two lanes of one stack (a lane is the zone's continuation, so it stands closer than the next zone). */
export const STACK_LANE_GAP = 10;
/** A stack's caption lane above its cards. */
export const STACK_CAPTION_H = 30;
/** The body's inner pad: the focused stack's ring and lift never meet the body's edge. */
export const STACK_PAD_X = 14;
export const STACK_PAD_TOP = 14;
export const STACK_PAD_BOTTOM = 12;
/** The title band a covered card shows (natural px): COMFORT = the whole plate and the divider (the natural peek);
 *  TIGHT = the name still reads (the plate's lower kant goes); PILE = an edge per card, the last resort of one page. */
export const STACK_PEEK_COMFORT = PLAYED_PEEK_NATURAL;
export const STACK_PEEK_TIGHT = 52;
export const STACK_PEEK_PILE = 12;
/** The face's bounds (1080-logical zoom): a few cards read large (the 4K screen is not left dark), a starved box gets small honest faces. */
export const STACK_MAX_ZOOM = 1.0;
/** A short stack the height can hold WHOLE lays its cards out whole, this far apart — never a band that bares a sliver
 *  of art (a band between the natural peek and the whole card shows half a picture). */
export const STACK_SPREAD_GAP = 12;
export const STACK_MIN_ZOOM = 0.3;
/** The zoom search's step (multiplicative). */
const STACK_ZOOM_STEP = 0.975;

export type PlayedStackDensity = 'comfort' | 'tight' | 'pile';

/** One lane of a stack: `count` cards of the zone from its `start` (the zone's own order = play order). */
export type PlayedStackLane = {start: number, count: number};

export type PlayedStackPlan = {
  key: PlayedStackKey;
  /** Cards in the zone (0 → a PREPARED place: the corporation before the choice, the events before the first). */
  count: number;
  /** The face-down pile (the events) — one card box, never a cascade. */
  faceDown: boolean;
  lanes: ReadonlyArray<PlayedStackLane>;
  /** The stack's left edge inside the body, and its width (lanes × face + lane gaps). */
  x: number;
  w: number;
  /** The tallest lane's card height (the caption lane not included). */
  h: number;
  /** This stack's step between two cards of a lane: the table's band, or — a short stack the height holds whole — the
   *  whole face and a gap (`spread`). */
  peek: number;
  spread: boolean;
};

export interface PlayedStacksInput {
  /** The measured table body box (screen px). */
  availW: number;
  availH: number;
  /** Cards per stack (the bot's corporation counts as one). */
  counts: Readonly<Record<PlayedStackKey, number>>;
  /** conUiScale() — 1 on every non-tv profile. */
  uiScale?: number;
}

export interface PlayedStacksPlan {
  /** The face (css zoom) and its box — the same for every stack. */
  zoom: number;
  slotW: number;
  slotH: number;
  /** The title band a covered card shows (screen px), and what it reads as. */
  peek: number;
  density: PlayedStackDensity;
  captionH: number;
  laneGap: number;
  gap: number;
  padTop: number;
  stacks: ReadonlyArray<PlayedStackPlan>;
  /** The drawn content's box (the stacks' row, the caption lane included). */
  contentW: number;
  contentH: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The stacks the table draws: the corporation and the events always (a prepared place when empty), a project zone when it holds a card. */
export function drawnStacks(counts: Readonly<Record<PlayedStackKey, number>>): Array<PlayedStackKey> {
  return PLAYED_STACK_ORDER.filter((key) => key === 'corporation' || key === 'events' || (counts[key] ?? 0) > 0);
}

/** Split `count` cards into `lanes` BALANCED contiguous lanes (the earlier lanes take the remainder: 15 / 2 → 8 + 7). */
export function splitLanes(count: number, lanes: number): Array<PlayedStackLane> {
  const n = Math.max(0, Math.floor(count));
  const l = Math.max(1, Math.min(Math.max(1, n), Math.floor(lanes)));
  const base = Math.floor(n / l);
  const extra = n % l;
  const out: Array<PlayedStackLane> = [];
  let start = 0;
  for (let i = 0; i < l; i++) {
    const c = base + (i < extra ? 1 : 0);
    out.push({start, count: c});
    start += c;
  }
  return out;
}

/** The tallest lane of a cascade of `count` cards in `lanes` lanes. */
function cardsPerLane(count: number, lanes: number): number {
  return Math.max(1, Math.ceil(Math.max(1, count) / Math.max(1, lanes)));
}

type StackSolve = {zoom: number, peek: number, lanes: Array<number>};

/**
 * One zoom's best composition: lanes are handed out one at a time to the stack whose tallest lane is the tallest
 * (while the width allows), until every cascade fits at the COMFORT band; the band then is the largest every stack
 * affords. Returns the band (screen px) the height leaves and the lanes, or undefined when not even one lane per
 * stack fits the width.
 */
function solveAtZoom(
  keys: ReadonlyArray<PlayedStackKey>, counts: Readonly<Record<PlayedStackKey, number>>,
  zoom: number, availW: number, roomH: number, s: number,
): StackSolve | undefined {
  const w = PLAYED_CARD_NATURAL_W * zoom;
  const h = PLAYED_CARD_NATURAL_H * zoom;
  if (h > roomH) {
    return undefined;
  }
  const laneGap = STACK_LANE_GAP * s;
  const widthOf = (lanes: ReadonlyArray<number>) =>
    2 * STACK_PAD_X * s + (keys.length - 1) * STACK_GAP * s + lanes.reduce((sum, l) => sum + l * w + (l - 1) * laneGap, 0);
  const lanes = keys.map(() => 1);
  if (widthOf(lanes) > availW) {
    return undefined;
  }
  const comfort = STACK_PEEK_COMFORT * zoom;
  const cascade = (i: number) => keys[i] !== 'events' && (counts[keys[i]] ?? 0) > 1;
  const bandFor = (i: number) => {
    const k = cardsPerLane(counts[keys[i]] ?? 0, lanes[i]);
    return k <= 1 ? comfort : (roomH - h) / (k - 1);
  };
  for (;;) {
    let worst = -1;
    let worstBand = comfort;
    for (let i = 0; i < keys.length; i++) {
      if (!cascade(i)) {
        continue;
      }
      const band = bandFor(i);
      if (band < worstBand) {
        worstBand = band;
        worst = i;
      }
    }
    if (worst < 0) {
      break; // every cascade fits at the comfort band
    }
    // Another lane only where it shortens the tallest lane, and only while the width allows it.
    const count = counts[keys[worst]] ?? 0;
    if (cardsPerLane(count, lanes[worst] + 1) >= cardsPerLane(count, lanes[worst])) {
      break;
    }
    lanes[worst]++;
    if (widthOf(lanes) > availW) {
      lanes[worst]--;
      break;
    }
  }
  let peek = comfort;
  for (let i = 0; i < keys.length; i++) {
    if (cascade(i)) {
      peek = Math.min(peek, bandFor(i));
    }
  }
  return {zoom, peek: Math.max(0, peek), lanes};
}

/**
 * Solve the ONE-PAGE table for a body box. Pure: the largest face at which every stack fits with a readable title band
 * (≥ TIGHT); when no face down to the floor affords it, the floor face with the band the height leaves (a pile's edges
 * — the category view is where such a zone is read). The stacks share one face; the spare width spreads them (bounded)
 * and the rest centres.
 */
export function planPlayedStacks(input: PlayedStacksInput): PlayedStacksPlan {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  const availW = Math.max(1, input.availW);
  const availH = Math.max(1, input.availH);
  const counts = input.counts;
  const keys = drawnStacks(counts);
  const captionH = STACK_CAPTION_H * s;
  const padTop = STACK_PAD_TOP * s;
  const roomH = Math.max(1, availH - padTop - STACK_PAD_BOTTOM * s - captionH);

  const zMax = STACK_MAX_ZOOM * s;
  const zMin = STACK_MIN_ZOOM * s;
  let chosen: StackSolve | undefined;
  let floorSolve: StackSolve | undefined;
  for (let z = Math.min(zMax, roomH / PLAYED_CARD_NATURAL_H); z >= zMin * 0.999; z *= STACK_ZOOM_STEP) {
    const solve = solveAtZoom(keys, counts, z, availW, roomH, s);
    if (solve === undefined) {
      continue;
    }
    floorSolve = solve;
    if (solve.peek >= STACK_PEEK_TIGHT * z - 0.01) {
      chosen = solve;
      break;
    }
  }
  if (chosen === undefined) {
    // No readable band at any face: the smallest face that stands, its band whatever the height leaves (a pile).
    chosen = floorSolve ?? {zoom: zMin, peek: STACK_PEEK_PILE * zMin, lanes: keys.map(() => 1)};
  }
  const solved: StackSolve = chosen;
  const zoom = solved.zoom;
  const slotW = PLAYED_CARD_NATURAL_W * zoom;
  const slotH = PLAYED_CARD_NATURAL_H * zoom;
  const peek = Math.min(STACK_PEEK_COMFORT * zoom, solved.peek);
  const density: PlayedStackDensity = peek >= STACK_PEEK_COMFORT * zoom - 0.5 ? 'comfort' : peek >= STACK_PEEK_TIGHT * zoom - 0.5 ? 'tight' : 'pile';
  const laneGap = STACK_LANE_GAP * s;

  const spreadStep = slotH + STACK_SPREAD_GAP * s;
  const shapes = keys.map((key, i) => {
    const count = Math.max(0, Math.floor(counts[key] ?? 0));
    const faceDown = key === 'events';
    const lanes = faceDown || count <= 1 ? [{start: 0, count}] : splitLanes(count, solved.lanes[i]);
    const w = lanes.length * slotW + (lanes.length - 1) * laneGap;
    const tallest = faceDown ? 1 : Math.max(1, ...lanes.map((l) => l.count));
    // A short stack the height holds WHOLE shows every card whole (the space is the table's, never left dark).
    const spread = tallest > 1 && slotH + (tallest - 1) * spreadStep <= roomH + 0.5;
    const step = spread ? spreadStep : peek;
    const h = slotH + (tallest - 1) * step;
    return {key, count, faceDown, lanes, w, h, peek: step, spread};
  });
  const stacksW = shapes.reduce((sum, st) => sum + st.w, 0);
  const inner = availW - 2 * STACK_PAD_X * s;
  // An identity-only table (no project stack yet) keeps its stacks at the left edge: the room right of them is where
  // the projects will lie, and it says so (the overlay's «no played projects yet» line) — never two stacks adrift.
  const projects = keys.some((key) => PLAYED_PROJECT_STACKS.includes(key));
  const gap = projects && shapes.length > 1 ?
    clamp(STACK_GAP * s, STACK_GAP_MAX * s, (inner - stacksW) / (shapes.length - 1)) :
    STACK_GAP * s;
  const contentW = stacksW + (shapes.length - 1) * gap;
  let x = STACK_PAD_X * s + (projects ? Math.max(0, (inner - contentW) / 2) : 0);
  const stacks: Array<PlayedStackPlan> = shapes.map((st) => {
    const plan = {...st, x};
    x += st.w + gap;
    return plan;
  });
  const contentH = captionH + Math.max(slotH, ...stacks.map((st) => st.h));
  return {zoom, slotW, slotH, peek, density, captionH, laneGap, gap, padTop, stacks, contentW, contentH};
}

/** Where a card of a stack lies: its lane and its position in the lane (undefined when the zone has no such card). */
export function stackSlotOf(plan: PlayedStacksPlan, key: PlayedStackKey, index: number): {lane: number, depth: number} | undefined {
  const stack = plan.stacks.find((st) => st.key === key);
  if (stack === undefined) {
    return undefined;
  }
  for (let lane = 0; lane < stack.lanes.length; lane++) {
    const l = stack.lanes[lane];
    if (index >= l.start && index < l.start + l.count) {
      return {lane, depth: index - l.start};
    }
  }
  return undefined;
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
