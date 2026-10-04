/*
 * «ГОРОДА ПЛАТЯТ» — the pure half of the scene of a card reward THE CELL
 * DECIDES (Turmoil Redux TR21 Arboretum: «1 data on the chosen card for each
 * city beside the greenery»; docs/TURMOIL_REDUX_ARBORETUM.md).
 *
 * THE GRAMMAR (TILE_PLAY_STAGED_COMMIT.md §8-bis, extended): the tile and its
 * oxygen are the FIELD's (the ordinary landing beats); the data is the CARD's
 * — but its CAUSE is the neighbourhood, so each unit is BORN AT ITS OWN CITY
 * (as a coin is born at its own ocean) and is RECEIVED by the card the player
 * chose. One unit is one physical token: a stack of two tiers sends two.
 * Only what is touched reacts: a city answers once per token it sends; the
 * neighbours that pay nothing never move.
 *
 * Everything here is pure (no DOM, no Vue): the record the scene plays (the
 * SERVER's — `GameModel.cardAdjacencyPayouts`, consumed once by `seq`), the
 * order of the tokens, the timings, and where the receiving card stands.
 */
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {TOUCHDOWN_TICK_GAP_MS, touchdownTickAt} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The receiving card rises out of its satellite cell and stands by the field. */
export const CITY_PAYOUT_RISE_MS = 320;
/** The read after the last touchdown — the `CARDLAND_READ_MS` class: «2 → 5» stands. */
export const CITY_PAYOUT_READ_MS = 680;
/** The card goes home to its satellite cell, whose counter ticks on the landing. */
export const CITY_PAYOUT_RETURN_MS = 260;
/** One breath between the landing beats and the cities' answer (the law wave's breath). */
export const CITY_PAYOUT_BREATH_MS = 200;
/**
 * The capsule's TICK CADENCE — the shared touchdown rule
 * (`resourceTransferModel.touchdownTickAt`): never «4 → 6» in one render,
 * never a tick ahead of its touchdown.
 */
export const CITY_PAYOUT_TICK_GAP_MS = TOUCHDOWN_TICK_GAP_MS;
/** When a touchdown at `now` may tick, given the previous tick at `last`. */
export const cityPayoutTickAt = touchdownTickAt;
/** The receiving card's width on the field (rem, the thumb tier — a face that still reads at 1080). */
export const CITY_PAYOUT_CARD_W_REM = 8.4;
/** Its height/width ratio — the premium face's own. */
export const CITY_PAYOUT_CARD_RATIO = 1.4;

/**
 * The SERVER's record of THIS placement's payout — the newest one naming the
 * placed cell and the paid seat. Nothing else is accepted: a stale record (an
 * earlier play) or another seat's never plays here.
 */
export function cityPayoutFor(
  records: ReadonlyArray<CardAdjacencyPayoutModel> | undefined,
  spaceId: SpaceId | string,
  color: Color | undefined,
): CardAdjacencyPayoutModel | undefined {
  if (records === undefined) {
    return undefined;
  }
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.spaceId === spaceId && (color === undefined || r.color === color) && r.amount > 0) {
      return r;
    }
  }
  return undefined;
}

/** Records this client has played (or is playing) — each is played ONCE, by the hero or by the remote stage. */
const claimed = new Set<number>();

/** Claim a record; false when it was already played. */
export function claimCityPayout(seq: number): boolean {
  if (claimed.has(seq)) {
    return false;
  }
  claimed.add(seq);
  return true;
}

/** Specs only: forget every claim. */
export function resetCityPayoutClaims(): void {
  claimed.clear();
}

/**
 * THE TOKENS, in the order they are sent: city by city in the server's
 * (board) order, each city's units in turn — a stack of two is two tokens of
 * ONE city, sent back to back. `unit` / `units` place the token across the
 * shared edge (a stack's two sit side by side, never on top of each other).
 */
export type CityToken = {id: number, city: number, spaceId: SpaceId, unit: number, units: number};

export function cityTokenPlan(payout: CardAdjacencyPayoutModel): Array<CityToken> {
  const out: Array<CityToken> = [];
  payout.neighbours.forEach((n, city) => {
    for (let unit = 0; unit < n.units; unit++) {
      out.push({id: out.length, city, spaceId: n.spaceId, unit, units: n.units});
    }
  });
  return out;
}

/** The sideways offset of a token among its city's units, in units of the spread (0 for a single token). */
export function tokenSpread(unit: number, units: number): number {
  return units <= 1 ? 0 : unit - (units - 1) / 2;
}

export type Rect = {x: number, y: number, w: number, h: number};

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * WHERE THE RECEIVING CARD STANDS: beside the placed tile, at the side where
 * it covers neither the tile nor a paying city, inside the visible board.
 * The six directions around the hex are tried right · left · then the four
 * diagonals; the first that clears everything wins, otherwise the one that
 * covers the least. Pure geometry over measured rects — never a per-cell
 * table.
 */
export function cityPayoutPlate(
  tile: Rect,
  cities: ReadonlyArray<Rect>,
  plate: {w: number, h: number},
  bounds: Rect,
  gap: number,
): Rect {
  const cx = tile.x + tile.w / 2;
  const cy = tile.y + tile.h / 2;
  const dirs: ReadonlyArray<[number, number]> = [[1, 0], [-1, 0], [1, -0.85], [-1, -0.85], [1, 0.85], [-1, 0.85]];
  let best: {rect: Rect, cost: number} = {rect: {x: cx - plate.w / 2, y: cy - plate.h / 2, w: plate.w, h: plate.h}, cost: Infinity};
  for (const [dx, dy] of dirs) {
    const px = cx + dx * (tile.w / 2 + gap + plate.w / 2);
    const py = cy + dy * (tile.h / 2 + gap + plate.h / 2) * (dx === 0 ? 1 : 0.62);
    let rect: Rect = {x: px - plate.w / 2, y: py - plate.h / 2, w: plate.w, h: plate.h};
    // Keep the whole card inside the board's visible box (it slides along the edge, never off it).
    rect = {
      ...rect,
      x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.w - rect.w),
      y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.h - rect.h),
    };
    const cost = overlap(rect, tile) * 4 + cities.reduce((sum, c) => sum + overlap(rect, c), 0);
    if (cost === 0) {
      return rect;
    }
    if (cost < best.cost) {
      best = {rect, cost};
    }
  }
  return best.rect;
}
