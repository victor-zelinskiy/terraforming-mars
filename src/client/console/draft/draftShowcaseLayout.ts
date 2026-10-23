/*
 * THE PACKET SHOWCASE'S PLANNER (T10 · CE) — how the draft workspace's body
 * is shared between the PACKET (the cards on stage), the SHELF («ОТОБРАННЫЕ»,
 * the drafted cards as real faces) and the READING row, solved from the
 * MEASURED body (the TR69 class: geometry from the box, never from a count).
 *
 * The 4K frame «before» (2026-10-22): the four cards stood in the top 55 % of
 * the opening, the shelf was four empty 155 × 215 px boxes and ≈ 40 % of the
 * opening was dark. The packet is WIDTH-bound (four cards across the whole
 * width), so the cards cannot grow — the dark is what the planner hands to the
 * shelf: the packet first takes its largest size (width-bound, or the height
 * left over a shelf at its FLOOR), then the shelf takes what remains, up to a
 * ceiling (half a card — a thumbnail never competes with the packet).
 *
 * Two compositions (the owner's batch, decision 4): `stack` — the shelf a
 * band under (or over) the packet; `side` — the shelf a column beside it.
 * The WAIT has no packet: the shelf IS the stage, its faces as large as the
 * body allows. The base profile (the Deck, a window under 1900 px) keeps the
 * shelf at its floor — the base contract is «fits without a scroll», and it
 * does not grow.
 *
 * Pure: px in, px out. The component measures and publishes the result as CSS
 * custom properties; the card row itself stays the shared stage solver's
 * (`wsStageLayout`) over the stage box this plan leaves.
 */

export type DraftShowcaseComposition = 'stack' | 'side';
export type DraftShowcaseStage = 'pick' | 'wait' | 'buy' | 'inspect' | 'done';

export type DraftShowcaseInput = {
  /** The workspace body's box (px). */
  bodyW: number,
  bodyH: number,
  /** The reading row's reserved height (px) — under the stage in every stage. */
  readingH: number,
  stage: DraftShowcaseStage,
  /** Cards on the stage (the packet / the buy row / the inspected row). */
  cards: number,
  /** The shelf's seats (the draft's known pick total; 0 = no shelf — the buy, a draft-less research). */
  seats: number,
  /** One card's UNZOOMED box (px at zoom 1). */
  slotW: number,
  slotH: number,
  /** The card row's own paddings (px) — measured, the focus headroom on all four sides. */
  rowPadX: number,
  rowPadY: number,
  /** `conUiScale()`. */
  ui: number,
  /** The grown profile (the TV / a window ≥ 1900 px); false = the base (the Deck). */
  grown: boolean,
  composition: DraftShowcaseComposition,
};

export type DraftShowcasePlan = {
  /** One shelf seat (px) — a real face scaled to it. */
  seatW: number,
  seatH: number,
  /** The face's zoom inside a seat (seatH / slotH). */
  seatZoom: number,
  /** The space the shelf takes off the stage: a band's height (`stack`) or a column's width (`side`), chrome included. */
  shelfBlock: number,
  /** The packet's card height this plan leaves room for (px; 0 when no cards). */
  cardH: number,
  /** THE WAIT: the shelf comes forward — the transform scale of the SAME rack (1 = in place). */
  waitScale: number,
};

/** The seat's floor: today's rack (5.5 rem tall) — the base profile's whole shelf. */
export const SHELF_SEAT_FLOOR_REM = 5.5;
/** A seat never grows past this share of the packet's card: a thumbnail never competes with the protagonist. */
export const SHELF_CEILING_OF_CARD = 0.5;
/** The WAIT's faces: at most this share of the body's height (the shelf IS the stage then). */
export const WAIT_SEAT_SHARE = 0.56;
/** The shelf band's chrome around its seats (the head line + paddings), in rem. */
export const SHELF_CHROME_REM = 2.6;
/** The gap between two seats, in rem. */
export const SEAT_GAP_REM = 1;
/** The card row's column gap the plan assumes (rem) — the solver's own focus-safe gap is close to it. */
const CARD_GAP_REM = 1.2;
/** The stage solver's zoom ceiling (`wsStageLayout`'s MAX_ZOOM) — a card never grows past it × ui. */
const CARD_ZOOM_MAX = 1.9;

const REM_PX = 20;

/** The shelf seat for a draft (constant for the whole draft — the rack never resizes under the stage). */
function shelfSeatH(o: DraftShowcaseInput, rem: number, aspect: number): number {
  const floorH = SHELF_SEAT_FLOOR_REM * rem;
  const seats = Math.max(1, o.seats);
  if (!o.grown) {
    return floorH;
  }
  const chrome = SHELF_CHROME_REM * rem;
  const seatGap = SEAT_GAP_REM * rem;
  const stageH = o.bodyH - o.readingH;
  // The REFERENCE packet is the draft's widest (its first: as many cards as the draft takes) — a later, shorter
  // packet grows its own cards into the same stage box, it never moves the shelf.
  const nRef = Math.max(seats, o.cards, 1);
  if (o.composition === 'side') {
    const across = seats > 2 ? 2 : 1;
    const down = Math.ceil(seats / across);
    // The column's width and the packet's card depend on each other: settle them in a few rounds from the floor.
    const byH = (stageH - chrome - (down - 1) * seatGap) / down;
    let h = floorH;
    for (let i = 0; i < 4; i++) {
      const col = across * h / aspect + (across - 1) * seatGap + chrome;
      const cardH = packetCardH(o, rem, nRef, o.bodyW - col, stageH);
      h = Math.max(floorH, Math.min(byH, cardH * SHELF_CEILING_OF_CARD));
    }
    // One last check against the packet the settled column leaves.
    const col = across * h / aspect + (across - 1) * seatGap + chrome;
    return Math.max(floorH, Math.min(h, packetCardH(o, rem, nRef, o.bodyW - col, stageH) * SHELF_CEILING_OF_CARD));
  }
  const cardH = packetCardH(o, rem, nRef, o.bodyW, stageH - floorH - chrome);
  const left = stageH - cardH - o.rowPadY - chrome;
  const byW = (o.bodyW * 0.9 - (seats - 1) * seatGap) / seats * aspect;
  return Math.max(floorH, Math.min(left, cardH * SHELF_CEILING_OF_CARD, byW));
}

/** The largest card a row of `n` takes in a `w × h` box: width-bound across one line, height-bound, the zoom cap. */
function packetCardH(o: DraftShowcaseInput, rem: number, n: number, w: number, h: number): number {
  const zW = (w - o.rowPadX - (n - 1) * CARD_GAP_REM * rem) / (n * o.slotW);
  const zH = (h - o.rowPadY) / o.slotH;
  return Math.max(0, Math.min(zW, zH, CARD_ZOOM_MAX * o.ui)) * o.slotH;
}

export function planDraftShowcase(o: DraftShowcaseInput): DraftShowcasePlan {
  const rem = REM_PX * o.ui;
  const aspect = o.slotH / o.slotW;
  const chrome = SHELF_CHROME_REM * rem;
  const seatGap = SEAT_GAP_REM * rem;
  const seats = Math.max(0, o.seats);
  const stageH = o.bodyH - o.readingH;
  const n = Math.max(1, o.cards);

  // NO SHELF (the buy past the rise, a draft-less research, the terminal beat): the cards take the whole stage.
  if (seats === 0 || o.stage === 'buy' || o.stage === 'done') {
    const cardH = o.cards === 0 ? 0 : packetCardH(o, rem, n, o.bodyW, stageH);
    return {seatW: 0, seatH: 0, seatZoom: 0, shelfBlock: 0, cardH, waitScale: 1};
  }

  const seatH = Math.floor(shelfSeatH(o, rem, aspect));
  const seatW = Math.floor(seatH / aspect);
  const across = o.composition === 'side' ? (seats > 2 ? 2 : 1) : seats;
  const down = Math.ceil(seats / across);
  const shelfBlock = o.composition === 'side' ?
    across * seatW + (across - 1) * seatGap + chrome :
    seatH + chrome;
  const cardH = o.stage === 'wait' ? 0 : o.composition === 'side' ?
    packetCardH(o, rem, n, o.bodyW - shelfBlock, stageH) :
    packetCardH(o, rem, n, o.bodyW, stageH - shelfBlock);

  // THE WAIT: no packet — the shelf comes forward as the stage itself: the SAME seats, scaled by a transform (a
  // flight measured on a seat stays true), as large as the body allows on the grown profile.
  let waitScale = 1;
  if (o.grown) {
    const rowW = across * seatW + (across - 1) * seatGap;
    const colH = down * seatH + (down - 1) * seatGap;
    const byH = (stageH - chrome) * WAIT_SEAT_SHARE / colH;
    const byW = o.bodyW * 0.9 / rowW;
    waitScale = Math.max(1, Math.min(byH, byW));
  }
  return {seatW, seatH, seatZoom: seatH / o.slotH, shelfBlock, cardH, waitScale};
}
