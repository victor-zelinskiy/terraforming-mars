/*
 * CONSOLE FINAL SCORING — THE PODIUM PLANNER (TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ»).
 *
 * The finale used to be a table of five 60 px bars over an empty horizon (5 % of a 4K screen inked, the winner 8 % of
 * its height). It is now a PODIUM: every player is a SEAT standing on the horizon — the corporation's face, the name,
 * the score in the score cell's language, the counting bar under it, the category medallions — and the winner, once
 * crowned, is the HERO: the tallest seat with the largest face, the others a ranked row of smaller faces beside it.
 *
 * This module is the seats' GEOMETRY, solved from the MEASURED stage box and the live rem — never from the player
 * count alone and never from a guess at the screen. Pure: no DOM, no Vue (spec'd under the server runner).
 *
 * Two layouts of ONE seat (`PodiumMode`):
 *  · `stack` (3–5 seats) — a portrait seat: the face over the reading block (name · score · bar · medallions);
 *  · `side`  (1–2 seats — the DUEL) — a landscape seat: the face beside the reading block, so two heroes fill the
 *    opening instead of standing as two pillars in an empty field.
 *
 * WIDTH is the row's: every seat takes an equal share of the box (up to the mode's ceiling) and keeps it
 * through the whole act — the crowning moves no seat sideways. HEIGHT is the drama:
 *  · while the count runs every seat is EQUAL (the ranking is untold — no seat may look like the winner), its face at
 *    `EQUAL_HEADROOM` of the hero's, so the crowning has room to RISE;
 *  · once crowned, the winner(s) stand at the full height with the largest face and the rest step down to
 *    `placeRatio` of it — the podium. Every face also fits its seat's width.
 */

/** The premium face's own aspect (`--pcard-w` / `--pcard-h`: 320 × 460). */
export const FACE_ASPECT = 320 / 460;
/** The premium face's own height in CSS px at zoom 1 — the face zoom is `faceH / FACE_PX_H`. */
export const FACE_PX_H = 460;

/** While the count runs every seat's face stands at this share of the hero's — the crowning's rise. */
export const EQUAL_HEADROOM = 0.86;

export type PodiumMode = 'stack' | 'side';

/** One seat's geometry, in CSS px. */
export type SeatGeo = {
  /** The corporation face's height (its width is `faceH × FACE_ASPECT`). */
  faceH: number;
  seatW: number;
  seatH: number;
};

export type PodiumPlan = {
  mode: PodiumMode;
  /** The gap between two seats, px. */
  gap: number;
  /** The reading block's height (stack) in px — the seat's fixed part under the face. */
  readH: number;
  /** The crowned hero's reading block (its larger name and total). */
  heroReadH: number;
  /** Every seat while the count runs (no winner yet). */
  equal: SeatGeo;
  /** A crowned winner's seat (a shared victory crowns every winner equally). */
  hero: SeatGeo;
  /** The other seats once crowned. */
  place: SeatGeo;
};

export type PodiumInput = {
  /** Players at the table (1 for a solo game). */
  seats: number;
  /** The measured stage box the seats stand in, px. */
  boxW: number;
  boxH: number;
  /** The live rem, px (the TV profile's 40 px at 4K, 20 px at 1080). */
  rem: number;
};

/**
 * The seat's fixed parts, in rem — the type stays at its rem size whatever the face does (the TV floor is a floor of
 * TYPE; the face is the object that scales).
 */
export type SeatSpec = {
  /** The reading block's height: UNDER the face (stack — the CSS reads the same number, `--eg-read-h`) or the
   *  reading column's floor BESIDE it (side — the seat is never shorter than its name, total, bar and medallions). */
  readRem: number;
  /** The crowned hero's reading block. */
  heroReadRem: number;
  /** Horizontal padding inside a seat (both sides together). */
  padXRem: number;
  /** Vertical padding inside a seat (both sides together). */
  padYRem: number;
  /** side mode: the reading column beside the face. */
  infoWRem: number;
  /** The seat's width ceiling (its share of the row never stretches past it). */
  maxWRem: number;
  /** The gap between two seats. */
  gapRem: number;
  /** The crowned places' face as a share of the hero's. */
  placeRatio: number;
};

export const SEAT_SPEC: Readonly<Record<PodiumMode, SeatSpec>> = {
  stack: {readRem: 13.6, heroReadRem: 16.4, padXRem: 1.6, padYRem: 1.4, infoWRem: 0, maxWRem: 30, gapRem: 1.4, placeRatio: 0.76},
  side: {readRem: 21, heroReadRem: 23.5, padXRem: 3.2, padYRem: 1.6, infoWRem: 19, maxWRem: 48, gapRem: 3.2, placeRatio: 0.88},
};

/** The layout of a table: the duel (and a solo game) stand side by side, three and more stack. */
export function podiumModeFor(seats: number): PodiumMode {
  return seats <= 2 ? 'side' : 'stack';
}

/**
 * THE PLAN — the equal seats of the count and the crowned podium, both inside the box. Faces never go below zero;
 * a starved box yields small honest seats, never an overflow.
 */
export function planPodium(input: PodiumInput): PodiumPlan {
  const seats = Math.max(1, input.seats);
  const mode = podiumModeFor(seats);
  const spec = SEAT_SPEC[mode];
  const rem = input.rem;
  const gap = spec.gapRem * rem;
  const share = (input.boxW - gap * (seats - 1)) / seats;
  // An equal share of the row, never past the mode's ceiling (a solo seat does not stretch across the screen).
  const seatW = Math.max(0, Math.min(share, spec.maxWRem * rem));
  const padX = spec.padXRem * rem;
  const padY = spec.padYRem * rem;
  const readH = spec.readRem * rem;
  const heroReadH = spec.heroReadRem * rem;

  // The widest a face may be inside the seat (side: beside the reading column).
  const faceWMax = Math.max(0, seatW - padX - (mode === 'side' ? spec.infoWRem * rem : 0));
  const widthCap = faceWMax / FACE_ASPECT;
  // The tallest a face may be inside the box (stack: under it stands the reading block).
  const heightCap = (read: number) => Math.max(0, input.boxH - padY - (mode === 'stack' ? read : 0));

  const heroFace = Math.min(widthCap, heightCap(heroReadH));
  const placeFace = heroFace * spec.placeRatio;
  const equalFace = Math.min(widthCap, heightCap(readH), heroFace * EQUAL_HEADROOM);

  const seat = (faceH: number, read: number): SeatGeo => ({
    faceH,
    seatW,
    // Side: the face and the reading column stand BESIDE each other — the seat is the taller of the two (a Deck's
    // width-capped face once left the medallions hanging under the seat, over the actions), never past the box.
    seatH: mode === 'stack' ? faceH + padY + read : Math.min(input.boxH, Math.max(faceH, read) + padY),
  });
  return {
    mode,
    gap,
    readH,
    heroReadH,
    equal: seat(equalFace, readH),
    hero: seat(heroFace, heroReadH),
    place: seat(placeFace, readH),
  };
}

/**
 * THE PODIUM ORDER — where each player stands once ranked: the winner on the crest of the horizon (the middle), the
 * runner-up at its left, the third at its right, and so on outwards — the order every podium is read in. `ranked` is
 * the final standings (winner first); the result lists the colours left to right.
 */
export function podiumOrder<T>(ranked: ReadonlyArray<T>): Array<T> {
  const out: Array<T> = [];
  ranked.forEach((item, i) => {
    if (i === 0) {
      out.push(item);
    } else if (i % 2 === 1) {
      out.unshift(item);
    } else {
      out.push(item);
    }
  });
  return out;
}

/** The horizon's radius for a scene `sceneW` px wide — a planet's gentle curve, never a dome. */
export function horizonRadius(sceneW: number): number {
  return sceneW * 2.4;
}

/**
 * How far below the crest the horizon runs at a horizontal offset `x` px from the scene's middle — where a seat
 * standing there puts its foot (the seats stand ON the planet's curve, the outer ones lower).
 */
export function horizonDrop(x: number, radius: number): number {
  if (radius <= 0) {
    return 0;
  }
  const dx = Math.min(Math.abs(x), radius);
  return radius - Math.sqrt(radius * radius - dx * dx);
}

/** The horizontal offset of slot `i` (of `n`, every seat `seatW` wide, `gap` apart) from the row's middle. */
export function slotOffset(i: number, n: number, seatW: number, gap: number): number {
  return (i - (n - 1) / 2) * (seatW + gap);
}

/** The face zoom for a face of height `faceH` px (the premium face is authored at `FACE_PX_H`). */
export function faceZoom(faceH: number): number {
  return faceH / FACE_PX_H;
}
