/*
 * resourceTransferModel — PURE, DOM-free vocabulary + math of the console
 * RESOURCE TRANSFER framework: the ONE premium visual language of receiving
 * resources —
 *
 *   reward source → a physical resource chip carrying its amount → the exact
 *   destination zone in the left panel → the delta chip.
 *
 * Consumers today: the patent-sale payout (the M€ chip out of the trade
 * terminal) and the played-card reward beat (everything a card grants
 * immediately on play). The vocabulary is deliberately focused on the three
 * REAL destination channels of the left panel — a stock value, a production
 * zone, an additional-resource target — not a speculative any-event bus.
 *
 * This module owns everything unit-testable: the transfer spec + merging
 * rules, the wave staggering, the arc geometry + chip scale profile, the
 * in-card spawn spread, and the play-preview reward EXTRACTION (which of a
 * card's preview chips are immediate resource gains, and which pre-selected
 * target each additional resource goes to). GSAP lives in
 * resourceTransferDirector; the run lifecycle in consoleResourceTransfer.
 */

import {CardName} from '@/common/cards/CardName';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';

/**
 * The three destination channels of the left panel. `stock` lands on the
 * resource's CURRENT-amount zone, `production` on its brown production zone,
 * `card-resource` on the pre-selected host card (or the additional-resources
 * satellite when the card isn't on screen).
 */
export type TransferChannel = 'stock' | 'production' | 'card-resource';

export type ResourceTransferSpec = {
  channel: TransferChannel;
  /**
   * The resource key: a standard resource (`megacredits`/`steel`/…) for
   * stock/production, or the normalized card-resource icon key
   * (`microbe`/`animal`/`floater`/… — the `cardResourceIcon` form) for
   * `card-resource`.
   */
  resource: string;
  /** Units transferred (always positive — the framework moves GAINS only). */
  amount: number;
  /** `card-resource` only: the pre-selected host card the resource lands on. */
  targetCard?: CardName;
};

export type TransferPoint = {x: number, y: number};
export type TransferRect = {x: number, y: number, w: number, h: number};

/** Timings (ms @ motion scale 1). One flight reads in ~0.6 s; a wave of
 *  several rewards stays ≈1 s via the capped stagger. */
export const TRANSFER_POP_MS = 150;
export const TRANSFER_ARC_MS = 470;
export const TRANSFER_SETTLE_MS = 140;
/** The contact beat at the destination (halo + the chip being absorbed). */
export const TRANSFER_BEAT_MS = 320;
/** The quiet "read the landed card" beat BEFORE a play-reward wave starts. */
export const TRANSFER_READ_MS = 240;
/** The residual result pause AFTER a play-reward wave (the scene breathes,
 *  never snaps shut on the last delta chip). */
export const TRANSFER_RESIDUAL_PAUSE_MS = 220;

/** One full flight's motion budget (pop + arc + settle), for safety timers. */
export function transferFlightBudgetMs(): number {
  return TRANSFER_POP_MS + TRANSFER_ARC_MS + TRANSFER_SETTLE_MS;
}

const STANDARD_RESOURCES: ReadonlySet<string> =
  new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);

export function isStandardResource(key: string): boolean {
  return STANDARD_RESOURCES.has(key);
}

/** The normalized card-resource key (`CardResource` value → icon key) — the
 *  SAME lowercase-hyphen form the server's `cardResourceIcon` produces. */
export function cardResourceKey(value: string): string {
  return value.toLowerCase().replace(/ /g, '-');
}

/**
 * Merge specs that are the SAME game change — one channel, one resource, one
 * target — into a single chip with the summed amount (a wave never flies two
 * identical chips). DELIBERATELY kept apart: stock vs production of the same
 * resource (two different destinations), and the same card-resource going to
 * DIFFERENT chosen hosts. First-seen order is preserved (the card's own
 * reading order); non-positive amounts are dropped.
 */
export function mergeTransferSpecs(specs: ReadonlyArray<ResourceTransferSpec>): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (const spec of specs) {
    if (spec.amount <= 0) {
      continue;
    }
    const existing = out.find((s) =>
      s.channel === spec.channel && s.resource === spec.resource && s.targetCard === spec.targetCard);
    if (existing !== undefined) {
      existing.amount += spec.amount;
    } else {
      out.push({...spec});
    }
  }
  return out;
}

/**
 * Launch delay of flight `i` in a wave of `n` — a compact organized wave:
 * a readable stagger for a few rewards, COMPRESSING as the wave grows so a
 * rich card never stretches into a multi-second parade (the whole wave's
 * spread stays ≈½ s).
 */
export function transferWaveDelayMs(i: number, n: number): number {
  const stagger = n <= 4 ? 110 : Math.max(64, Math.round(440 / n));
  return i * stagger;
}

/** Per-flight apex-lift bias — parallel arcs in one wave separate vertically
 *  instead of stacking on one curve (deterministic, hair-sized). */
export function transferLiftBias(i: number): number {
  return ((i % 3) - 1) * 0.18;
}

export interface TransferArcPlan {
  /** Quadratic Bézier: P0 = source, C = control, P1 = destination. */
  p0: TransferPoint;
  c: TransferPoint;
  p1: TransferPoint;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Plan a transfer arc: a clean upward toss from the source to the panel
 * zone. The apex lift is proportional to the travel, clamped to a calm band
 * (`liftBias` spreads simultaneous arcs of one wave).
 */
export function transferArcPlan(from: TransferPoint, to: TransferPoint, liftBias = 0): TransferArcPlan {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = clamp(44, 160, dist * 0.30) * (1 + liftBias);
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

/** Point on the arc at t ∈ [0,1]. */
export function transferArcPoint(plan: TransferArcPlan, t: number): TransferPoint {
  const u = 1 - t;
  return {
    x: u * u * plan.p0.x + 2 * u * t * plan.c.x + t * t * plan.p1.x,
    y: u * u * plan.p0.y + 2 * u * t * plan.c.y + t * t * plan.p1.y,
  };
}

/**
 * Chip scale along the flight (relative to its natural CSS size): ejected
 * small from the source, blooms just past the pop so the amount is READ at
 * the apex, then settles slightly under natural for the touchdown —
 * approaching the panel, never inflating over it.
 */
export function transferChipScaleAt(t: number): number {
  const k = clamp(0, 1, t);
  if (k <= 0.22) {
    return 0.45 + (1.14 - 0.45) * easeOut(k / 0.22);
  }
  return 1.14 + (0.9 - 1.14) * easeInOut((k - 0.22) / 0.78);
}

/**
 * Spawn point of flight `i` (of `n`) inside the source card's box: the
 * rewards emerge from the card's LOWER (mechanics) band, spread across it so
 * simultaneous chips never hatch from one pixel — the visual truth stays
 * "the reward comes out of the played card".
 */
export function sourceSpawnPoint(rect: TransferRect, i: number, n: number): TransferPoint {
  const spread = n <= 1 ? 0 : (i - (n - 1) / 2) * Math.min(0.16, 0.6 / n);
  return {
    x: rect.x + rect.w * (0.5 + spread),
    y: rect.y + rect.h * 0.72,
  };
}

function easeOut(k: number): number {
  return 1 - (1 - k) * (1 - k);
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

// ── play-reward EXTRACTION (the played-card client) ─────────────────────────

export type ExtractPlayRewardsArgs = {
  /** The played card (the target of an `'on this card'` gain). */
  cardName: CardName;
  /** The SELECTED branch's preview chips (costs + gains). */
  effects: ReadonlyArray<ActionEffect>;
  /** The selected branch's steps (card-target picks carry `cardResource`). */
  steps: ReadonlyArray<ActionPreviewStep>;
  /** Captured step responses, keyed by step index (the composer's map). */
  stepResponses: Readonly<Record<number, unknown>>;
};

function pickedCardOf(response: unknown): CardName | undefined {
  const r = response as {type?: string, cards?: ReadonlyArray<string>} | undefined;
  if (r !== undefined && r.type === 'card' && Array.isArray(r.cards) && r.cards.length > 0) {
    return r.cards[0] as CardName;
  }
  return undefined;
}

/**
 * Which of a play preview's chips are IMMEDIATE resource gains the reward
 * beat should carry — and where each one lands. Reads the server-computed
 * `ActionEffect` vocabulary (the same chips the composer showed), so the
 * amounts are authoritative previews, never client re-derivations:
 *  - a plain standard-resource gain            → `stock`;
 *  - a standard-resource gain noted 'production' → `production`;
 *  - a card-resource gain noted 'on this card'  → the played card itself;
 *  - a card-resource gain noted 'to a card'     → the PRE-SELECTED host,
 *    matched to its card-target step (`step.cardResource === chip.icon`,
 *    steps claimed in order — the desktop `resolveCardTargetChips` rule)
 *    and read from that step's captured `{type:'card', cards:[X]}` response;
 *  - a copy-production pick (`copyProductionBox`) → the CHOSEN card's units
 *    as production specs (what Robotic Workforce actually copies).
 * Everything else — costs, TR, card draws, global parameters, untyped
 * "any resource" gains — is deliberately NOT a transfer (it rides the
 * ordinary commit feedback).
 */
export function extractPlayRewards(args: ExtractPlayRewardsArgs): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  const claimedSteps = new Set<number>();

  const claimTargetStep = (icon: string): CardName | undefined => {
    for (let i = 0; i < args.steps.length; i++) {
      const step = args.steps[i];
      if (claimedSteps.has(i) || step.kind !== 'input' || step.cardResource !== icon) {
        continue;
      }
      if ((step.amount ?? 0) <= 0) {
        continue; // a REMOVE pick — never a reward target
      }
      claimedSteps.add(i);
      return pickedCardOf(args.stepResponses[i]);
    }
    return undefined;
  };

  for (const e of args.effects) {
    if (e.direction !== 'gain' || e.amount <= 0) {
      continue;
    }
    if (e.note === 'production' && isStandardResource(e.icon)) {
      out.push({channel: 'production', resource: e.icon, amount: e.amount});
    } else if (e.note === undefined && e.unit === undefined && isStandardResource(e.icon)) {
      out.push({channel: 'stock', resource: e.icon, amount: e.amount});
    } else if (e.note === 'on this card' && e.icon !== 'resources') {
      out.push({channel: 'card-resource', resource: e.icon, amount: e.amount, targetCard: args.cardName});
    } else if (e.note === 'to a card' && e.icon !== 'resources') {
      out.push({channel: 'card-resource', resource: e.icon, amount: e.amount, targetCard: claimTargetStep(e.icon)});
    }
  }

  // Copy-production picks (Robotic Workforce / Cyberia Systems): the chosen
  // card's positive copied units are REAL immediate production gains.
  args.steps.forEach((step, i) => {
    if (step.kind !== 'input' || step.copyProductionBox === undefined) {
      return;
    }
    const chosen = pickedCardOf(args.stepResponses[i]);
    const units = chosen !== undefined ? step.copyProductionBox[chosen] : undefined;
    if (units === undefined) {
      return;
    }
    for (const key of ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const) {
      const n = units[key] ?? 0;
      if (n > 0) {
        out.push({channel: 'production', resource: key, amount: n});
      }
    }
  });

  return mergeTransferSpecs(out);
}
