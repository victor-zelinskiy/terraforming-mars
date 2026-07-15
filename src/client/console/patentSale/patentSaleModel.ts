/*
 * patentSaleModel — PURE, DOM-free math + vocabulary for the console PATENT
 * SALE hero scene (the "trade terminal" moment of sell patents).
 *
 * Design contract (the premium direction, in one paragraph): the moment the
 * player confirms the sale, the picked cards physically leave the hand — they
 * lift, flip to their backs mid-flight and converge into one NEAT stack over
 * a slim trade terminal that slides open at the table edge; the stack sinks
 * through the terminal's slit, the mechanism works (a restrained scanline —
 * this beat absorbs the server round-trip), and on the server's confirmation
 * the terminal dispenses ONE megacredit chip that arcs onto the resource
 * rail's M€ row. The commit (new M€ value + the standard delta chip) lands
 * exactly at the chip's touchdown — payment felt, never narrated.
 *
 * This module owns everything unit-testable: the phase vocabulary, the neat
 * stack micro-offsets, the chip arc geometry + scale profile, the live sale
 * summary math, and the timing constants. GSAP work lives in
 * patentSaleDirector; the transaction lifecycle in consolePatentSale.
 */

import {sellPatentsPayout} from '@/client/components/handCards/sellPatentsState';

/**
 * The explicit, observable lifecycle of ONE sale transaction. The commit
 * ordering rules ride these phases:
 *  - the client leg (gather → insert → processing) starts at ARM — the
 *    terminal absorbs the server round-trip inside `processing`;
 *  - the sale UI closes only at `inserting` (the hand has physically given
 *    the cards away — never before the stack reaches the terminal);
 *  - the payout chip flies ONLY after the server proved the sale
 *    (`paying`), and the playerView commit happens at its touchdown;
 *  - `settling` is the post-commit half (chip absorbed, terminal retracts).
 */
export type PatentSalePhase =
  | 'idle'
  | 'gathering' // cards lift, flip to backs and converge into the stack
  | 'inserting' // the stack sinks through the terminal slit
  | 'processing' // the mechanism works; the server round-trip hides here
  | 'paying' // server success proven — the M€ chip arcs to the rail
  | 'settling' // post-commit: chip absorbed into the row, terminal retracts
  | 'done'
  | 'failed'; // server error / stall — transaction unwound, zero trace

/** Timings (ms @ motion scale 1). The whole scene stays ≈1.8–2.1 s. */
export const SALE_LIFT_MS = 130;
export const SALE_GATHER_MS = 430;
export const SALE_GATHER_STAGGER_MS = 55;
/** The terminal slides open while the cards are still converging. */
export const SALE_TERMINAL_REVEAL_MS = 260;
export const SALE_INSERT_MS = 320;
/** The mechanism is SEEN working even when the server answers instantly. */
export const SALE_PROCESS_MIN_MS = 280;
export const SALE_PAYOUT_MS = 620;
export const SALE_SETTLE_MS = 340;
/** Reduced motion: one short controlled beat (the console 160 ms cap
 *  convention), same commit semantics. Raw ms — reduced motion is its own
 *  axis, never speed-preset-scaled. */
export const SALE_REDUCED_MS = 160;
/** A submit the server never answers can't strand the scene (arm net). */
export const SALE_ARM_SAFETY_MS = 12000;

/** Max card proxies that physically fly (a 20-card sale reads as a pile
 *  either way — beyond this the extra cards are already "in the stack"). */
export const SALE_FLIGHT_CAP = 7;

/** Stack card width (px @ uiScale 1) — the gather target scale derives
 *  from it (proxies are natural-width objects, 320 px). */
export const SALE_STACK_W = 170;

export type SalePoint = {x: number, y: number};

/**
 * Micro-offsets of card `i` inside the NEAT stack (px @ uiScale 1, deg).
 * Deterministic hair-width jitter — a tidy pile of physical cards, never a
 * printed grid and never a loose fan: offsets alternate sides and DON'T
 * grow with the pile; each later card sits a touch higher (on top).
 */
export function saleStackSlot(i: number): {dx: number, dy: number, rot: number} {
  const side = i % 2 === 0 ? 1 : -1;
  const wave = ((i * 5) % 3) - 1; // -1 | 0 | 1, repeating — never random
  return {
    dx: side * (1.6 + wave * 0.9),
    dy: -i * 2.2,
    rot: side * (0.9 + ((i * 7) % 4) * 0.45),
  };
}

/**
 * The live sale summary the hand header shows: how many cards are picked,
 * the M€ they pay out, and the before → after wallet. Mirrors the server's
 * flat rate through the ONE shared constant (sellPatentsPayout).
 */
export function saleSummary(count: number, megacredits: number): {count: number, payout: number, before: number, after: number} {
  const payout = sellPatentsPayout(count);
  return {count, payout, before: megacredits, after: megacredits + payout};
}

export interface SaleChipPlan {
  /** Quadratic Bézier: P0 = slit mouth, C = control, P1 = the M€ row icon. */
  p0: SalePoint;
  c: SalePoint;
  p1: SalePoint;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Plan the payout chip's arc: a clean upward parabola from the terminal slit
 * to the resource rail's M€ icon. The apex lift is proportional to the
 * travel, clamped to a calm band — the chip is tossed, never launched.
 */
export function saleChipPlan(from: SalePoint, to: SalePoint): SaleChipPlan {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = clamp(50, 170, dist * 0.32);
  const apex = {
    x: (from.x + to.x) / 2,
    y: Math.min(from.y, to.y) - lift,
  };
  // Quadratic control point so the curve PASSES through the apex at t=0.5.
  return {
    p0: from,
    c: {
      x: 2 * apex.x - (from.x + to.x) / 2,
      y: 2 * apex.y - (from.y + to.y) / 2,
    },
    p1: to,
  };
}

/** Point on the chip arc at t ∈ [0,1]. */
export function saleChipPoint(plan: SaleChipPlan, t: number): SalePoint {
  const u = 1 - t;
  return {
    x: u * u * plan.p0.x + 2 * u * t * plan.c.x + t * t * plan.p1.x,
    y: u * u * plan.p0.y + 2 * u * t * plan.c.y + t * t * plan.p1.y,
  };
}

/**
 * Chip scale along the arc (relative to its natural CSS size): ejected
 * small from the slit, blooms just past the pop so the value is READ at the
 * apex, then settles slightly under natural for the touchdown — approaching
 * the rail, not inflating over it. Monotone within each segment.
 */
export function saleChipScaleAt(t: number): number {
  const k = clamp(0, 1, t);
  if (k <= 0.22) {
    return 0.45 + (1.14 - 0.45) * easeOut(k / 0.22);
  }
  return 1.14 + (0.9 - 1.14) * easeInOut((k - 0.22) / 0.78);
}

function easeOut(k: number): number {
  return 1 - (1 - k) * (1 - k);
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}
