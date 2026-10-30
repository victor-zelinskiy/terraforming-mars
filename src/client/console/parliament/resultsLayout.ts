/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE RESULTS CARD IS SOLVED, NEVER SQUEEZED (P71 · ledger CY — the owner's two frames of 2026-10-28: the seats'
 * plates spilled over each other and out of the card, the crown lay over a name, «НОВЫЕ РЕЗОЛЮЦИИ —» held a third of
 * the card for nothing). The card is three zones by ROLE — ПРИНЯТА · ВЫПЛАТЫ · СЛЕДУЮЩЕЕ ГОЛОСОВАНИЕ — and their
 * widths, the faces' sizes and the ledger's type tier are DECIDED here, from what the card has to say and the box it
 * has, once per pose:
 *
 *  · ПРИНЯТА — the enacted face is sized by the column's HEIGHT (the face's aspect), never a constant zoom;
 *  · СЛЕДУЮЩЕЕ ГОЛОСОВАНИЕ — exists only when it has something to say; the fresh faces take a size whose caption
 *    reads (a floor per profile), three that do not fit in a row go 2 + 1; with no fresh resolutions the column is
 *    as narrow as the support seals;
 *  · ВЫПЛАТЫ — takes everything else; ONE ROW PER SEAT, rows of equal height; the TIER of its tokens is the largest
 *    whose estimate fits every seat's row (`hero` → `regular` → `compact`); a seat that does not fit even at
 *    `compact` (a theoretical edge) folds its tail into «+N» behind the X door — named, never silent (invariant 4).
 *
 * Everything is in REM (the console's type scales with `--con-ui-scale`, so one rem budget holds on every profile);
 * the estimates are deliberately generous (a token is wider here than on screen), because the contract is
 * «nothing leaves its row» and the e2e guard `expectResultsContained` reads the real boxes on three profiles.
 * Pure: no DOM, no Vue. Spec: `tests/console/resultsLayout.spec.ts`.
 */

export type ResultsTier = 'hero' | 'regular' | 'compact';
export type ResultsProfile = 'fhd' | 'tv' | 'deck';

/** ONE seat's row as the solver weighs it. */
export type ResultsLayoutSeat = {
  /** The number tokens (a unit total, a discard) — each «+12 [icon]». */
  numbers: ReadonlyArray<number>;
  /** The objects (a tile, a parameter's step, a walk) — each a record drawn whole. */
  objects: number;
  /** The skips — each one line of the row. */
  skips: number;
  /** A marks row under the tokens (planets ×k, a seal, the crown). */
  marks: boolean;
  /** The seat's name, as printed. */
  name: string;
  winner: boolean;
};

export type ResultsLayoutInput = {
  seats: ReadonlyArray<ResultsLayoutSeat>;
  /** Fresh resolutions dealt for the next vote. */
  fresh: number;
  /** The support row (the seals out of power) stands. */
  support: boolean;
  /** The «without a free delegate» exception stands. */
  noDelegate: boolean;
  /** The world's lines under the ledger (ПЛАНЕТА · КОЛОНИИ · the veto line). */
  worldLines: number;
  /** The «still in the sitting» foot line stands. */
  inSitting: boolean;
};

/**
 * The card's box in REM (the measured `.con-sit__results`, divided by the live rem) — and a premium face's size in the
 * same rem: the face's zoom is `z × --con-ui-scale` over a 320 × 460 px face, and the rem is the profile's own, so
 * «16 × 23 rem» holds only where one rem is 20 px × the scale (the Deck's is not — its faces stacked out of the card).
 */
export type ResultsBox = {width: number, height: number, face?: {width: number, height: number}};

export type ResultsLayout = {
  tier: ResultsTier;
  /** The token tier's numbers (rem) — written as CSS variables by the card, the one source of both. */
  totalSize: number;
  rowPad: number;
  /** The enacted face's zoom factor (× `--con-ui-scale`) — by the column's height. */
  enactedZoom: number;
  /** The enacted column's width (rem). */
  enactedWidth: number;
  /** The next-vote column's width (rem) — 0 when the column has nothing to say. */
  nextWidth: number;
  /** The fresh faces' zoom factor, and how many stand in one row (3 → 2 + 1 when they do not fit). */
  freshZoom: number;
  freshPerRow: number;
  /** The ledger's width (rem). */
  payoutsWidth: number;
  /** Per seat: how many tokens are shown — the rest fold into «+N» (undefined = everything is shown). */
  fold: ReadonlyArray<number | undefined>;
};

/** A premium face at zoom 1 is 320 × 460 px = 16 × 23 rem (one rem = 20 px × `--con-ui-scale`). */
export const FACE_REM = {width: 16, height: 23};

/** A face at zoom 1, in px × the ui scale (`premium-card-face`). */
export const FACE_PX = {width: 320, height: 460};

/** The token tiers: the amount's type size (rem) and the row's own padding. `compact` is above the TV floor (.8). */
export const RESULTS_TIERS: Readonly<Record<ResultsTier, {total: number, pad: number}>> = {
  hero: {total: 2.0, pad: .7},
  regular: {total: 1.5, pad: .55},
  compact: {total: 1.1, pad: .4},
};

const TIER_ORDER: ReadonlyArray<ResultsTier> = ['hero', 'regular', 'compact'];

/** The floors of a face's size, per profile — below them a fresh face's caption stops reading. */
const FRESH_ZOOM_FLOOR: Readonly<Record<ResultsProfile, number>> = {fhd: .44, tv: .44, deck: .3};
const FRESH_ZOOM_MAX = .56;
const ENACTED_ZOOM = {min: .42, max: .86};

/** The card's own chrome (rem): padding, the column kickers, the gaps between the zones. */
/**
 * The card's own chrome per profile (rem) — the sheet's ladder: the Deck pays its way from the plate's chrome (.6 / .5 rem
 * padding, .7 gaps), and its token tiers stand at 0.8 of the TV's (the Deck's type is the sheet's smallest; measured
 * on the box — a TV-sized budget folded every token of a three-seat table on the Deck).
 */
type CardChrome = {padX: number, padY: number, kicker: number, gap: number, rule: number, line: number, rowGap: number, marks: number, tierScale: number};
const CHROME: Readonly<Record<ResultsProfile, CardChrome>> = {
  fhd: {padX: 2.4, padY: 1.9, kicker: 1.9, gap: 1.4, rule: 1.2, line: 1.9, rowGap: .6, marks: 1.25, tierScale: 1},
  tv: {padX: 2.4, padY: 1.9, kicker: 1.9, gap: 1.4, rule: 1.2, line: 1.9, rowGap: .6, marks: 1.25, tierScale: 1},
  deck: {padX: 1.2, padY: .95, kicker: 1.6, gap: .7, rule: .6, line: 1.3, rowGap: .35, marks: 1.05, tierScale: .8},
};
/** The handover line under the enacted face (two short lines). */
const RULER_H = 2.9;
/** One world line, the foot line. */
/** The support seals' row (five seals), and its caption. */
const SUPPORT = {width: 14, height: 4.4};
const NO_DELEGATE_H = 1.8;
/** The ledger's row gap, and the who column's type (rem). */
/** The who column's type per profile (the sheet's own ladder: the Deck prints the name at .72 rem and the role at .56). */
const WHO_TYPE: Readonly<Record<ResultsProfile, {name: number, role: number, sides: number}>> = {
  fhd: {name: 1.05, role: .62, sides: 3.6},
  tv: {name: 1.15, role: .8, sides: 3.6},
  deck: {name: .72, role: .56, sides: 1.8},
};
/** «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ» in tracked caps ≈ 22 glyphs. */
const ROLE_GLYPHS = 26;
/** The narrowest ledger that still reads (rem): below it the faces give way. */
const PAYOUTS_MIN = 26;

/** A glyph's advance, generously (bold digits / tracked caps of the console's faces ≈ .58–.62 em). */
const GLYPH_EM = .64;

/** The width (rem) one number token takes at type `t`: the signed digits, the icon, the gap after it. */
function numberWidth(amount: number, t: number): number {
  const digits = String(Math.abs(amount)).length + 1;
  return digits * GLYPH_EM * t + 1.15 * t + .55 * t;
}

/** An object (a parameter's «−26 → −22 °C · РТ +2», a tile, a walk) — a record drawn whole, ≈ 9 em of the tier. */
function objectWidth(t: number): number {
  return 9.5 * t * .62;
}

/** The lines `widths` take when packed into `room` (greedy — the row's own flex-wrap). */
function linesFor(widths: ReadonlyArray<number>, room: number): number {
  let lines = widths.length === 0 ? 0 : 1;
  let used = 0;
  for (const w of widths) {
    if (used > 0 && used + w > room) {
      lines += 1;
      used = 0;
    }
    used += w;
  }
  return lines;
}

/** The who column (rem): the longest name (never cut), the winner's role line where a winner stands. */
export function whoWidth(seats: ReadonlyArray<ResultsLayoutSeat>, profile: ResultsProfile = 'tv'): number {
  const type = WHO_TYPE[profile];
  const name = Math.max(0, ...seats.map((s) => s.name.length)) * GLYPH_EM * type.name + 1.4;
  const role = seats.some((s) => s.winner) ? ROLE_GLYPHS * GLYPH_EM * type.role + 1.3 : 0;
  return Math.max(name, role, profile === 'deck' ? 4 : 6);
}

/** The height (rem) one seat's row needs at tier `t` in a totals cell `room` wide. */
function rowNeed(seat: ResultsLayoutSeat, t: number, pad: number, room: number, marksH = 1.25): number {
  const widths = [...seat.numbers.map((n) => numberWidth(n, t)), ...Array.from({length: seat.objects}, () => objectWidth(t))];
  const tokenLines = linesFor(widths, room);
  const tokens = tokenLines * t * 1.4 + Math.max(0, tokenLines - 1) * .35 * t;
  const skips = seat.skips * 1.45;
  const marks = seat.marks ? marksH : 0;
  const who = 1.15 * 1.25 + (seat.winner ? .8 * 1.5 : 0);
  return Math.max(who, tokens + skips + marks) + 2 * pad;
}

/**
 * How many of a seat's tokens fit `lines` rows of `room` (the last slot kept for «+N»).
 */
function foldFor(seat: ResultsLayoutSeat, t: number, room: number, lines: number): number {
  const widths = [...seat.numbers.map((n) => numberWidth(n, t)), ...Array.from({length: seat.objects}, () => objectWidth(t))];
  const fold = numberWidth(99, t);
  let line = 1;
  let used = 0;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    if (used > 0 && used + w > room) {
      line += 1;
      used = 0;
    }
    if (line > lines || (line === lines && used + w + fold > room && i < widths.length - 1)) {
      return Math.max(0, i);
    }
    used += w;
  }
  return widths.length;
}

/** The column the faces and the support take, and the faces' size. */
function nextColumn(input: ResultsLayoutInput, colH: number, profile: ResultsProfile, budget: number, face: {width: number, height: number}): {width: number, zoom: number, perRow: number} {
  const support = input.support ? SUPPORT.height : 0;
  const tail = (input.noDelegate ? NO_DELEGATE_H : 0);
  if (input.fresh === 0) {
    const width = input.support || input.noDelegate ? SUPPORT.width : 0;
    return {width, zoom: 0, perRow: 0};
  }
  const floor = FRESH_ZOOM_FLOOR[profile];
  for (const perRow of [Math.min(3, input.fresh), 2, 1]) {
    if (perRow > input.fresh) {
      continue;
    }
    const rows = Math.ceil(input.fresh / perRow);
    const roomH = colH - support - tail - .9 * (rows - 1) - .9;
    let zoom = Math.min(FRESH_ZOOM_MAX, roomH / (rows * face.height));
    const widthAt = (z: number) => perRow * face.width * z + (perRow - 1) * .7;
    if (widthAt(zoom) > budget) {
      zoom = Math.min(zoom, (budget - (perRow - 1) * .7) / (perRow * face.width));
    }
    if (zoom >= floor) {
      return {width: Math.max(widthAt(zoom), input.support ? SUPPORT.width : 0), zoom, perRow};
    }
  }
  // Nothing reads above the floor (a starved box): ONE row at the size that FITS — a face a little small is the honest
  // degrade, a stack of faces out of the card is the defect (the Deck's first frame).
  const perRow = Math.min(3, input.fresh);
  const roomH = colH - support - tail - .9;
  const zoom = Math.max(.1, Math.min(roomH / face.height, (budget - (perRow - 1) * .7) / (perRow * face.width)));
  return {width: Math.max(perRow * face.width * zoom + (perRow - 1) * .7, input.support ? SUPPORT.width : 0), zoom, perRow};
}

/** THE SOLVER. */
export function resultsLayoutOf(input: ResultsLayoutInput, box: ResultsBox, profile: ResultsProfile): ResultsLayout {
  const face = box.face ?? FACE_REM;
  const CARD = CHROME[profile];
  const tierOf = (tier: ResultsTier) => ({total: RESULTS_TIERS[tier].total * CARD.tierScale, pad: RESULTS_TIERS[tier].pad * CARD.tierScale});
  const colH = Math.max(8, box.height - CARD.padY - CARD.kicker - (input.inSitting ? CARD.line : 0));
  // ПРИНЯТА — the face by the column's height.
  const enactedZoom = clamp((colH - RULER_H) / face.height, ENACTED_ZOOM.min, ENACTED_ZOOM.max);
  let enactedWidth = Math.max(face.width * enactedZoom, 9) + CARD.rule;
  // СЛЕДУЮЩЕЕ ГОЛОСОВАНИЕ — at most 42 % of what is left after the law (three faces in a row on every profile).
  const inner = box.width - CARD.padX;
  const nextBudget = Math.max(SUPPORT.width, (inner - enactedWidth) * .42);
  const next = nextColumn(input, colH, profile, nextBudget, face);
  const gaps = (next.width > 0 ? 2 : 1) * CARD.gap + (next.width > 0 ? CARD.rule : 0);
  let payoutsWidth = inner - enactedWidth - next.width - gaps;
  let enacted = enactedZoom;
  if (payoutsWidth < PAYOUTS_MIN) {
    // The law's face gives back what the ledger lacks (down to its floor) — the ledger is the card's subject.
    const give = Math.min(PAYOUTS_MIN - payoutsWidth, (enacted - ENACTED_ZOOM.min) * face.width);
    enacted -= give / face.width;
    enactedWidth -= give;
    payoutsWidth += give;
  }
  const ledgerH = colH - input.worldLines * CARD.line;
  const n = Math.max(1, input.seats.length);
  const rowH = (ledgerH - (n - 1) * CARD.rowGap) / n;
  // The totals cell: the ledger less the who column, the row's own side padding (2 × 1.1) and the column gap (1.4), and a tenth spare —
  // the 4K bot table measured the role line wider than its estimate and its tokens wrapped into a line nobody budgeted.
  const room = Math.max(4, (payoutsWidth - whoWidth(input.seats, profile) - WHO_TYPE[profile].sides) * .9);
  for (const tier of TIER_ORDER) {
    const {total, pad} = tierOf(tier);
    if (input.seats.every((seat) => rowNeed(seat, total, pad, room, CARD.marks) <= rowH)) {
      return {
        tier, totalSize: total, rowPad: pad, enactedZoom: round(enacted), enactedWidth: round(enactedWidth),
        nextWidth: round(next.width), freshZoom: round(next.zoom), freshPerRow: next.perRow, payoutsWidth: round(payoutsWidth),
        fold: input.seats.map(() => undefined),
      };
    }
  }
  // The theoretical edge: even `compact` does not hold a seat — its tail folds into «+N» (the X door shows it all).
  const {total, pad} = tierOf('compact');
  const lineH = total * 1.75;
  const fold = input.seats.map((seat) => {
    if (rowNeed(seat, total, pad, room, CARD.marks) <= rowH) {
      return undefined;
    }
    const lines = Math.max(1, Math.floor((rowH - 2 * pad - (seat.marks ? CARD.marks : 0) - seat.skips * 1.45) / lineH));
    return foldFor(seat, total, room, lines);
  });
  return {
    tier: 'compact', totalSize: total, rowPad: pad, enactedZoom: round(enacted), enactedWidth: round(enactedWidth),
    nextWidth: round(next.width), freshZoom: round(next.zoom), freshPerRow: next.perRow, payoutsWidth: round(payoutsWidth), fold,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
