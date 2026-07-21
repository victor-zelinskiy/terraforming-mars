/*
 * COLONY TRADE — the PURE model of the premium trade-reward transaction
 * (no DOM / Vue / GSAP — unit-tested under the server runner).
 *
 * Everything here derives from the SERVER's authoritative
 * `ColonyTradeManifestModel` (the atomic reward manifest built in
 * `Colony.handleTrade`) — the client never re-computes amounts from its own
 * rules tables or the DOM. The model's job is translation only:
 *
 *   · a manifest grant → the `ResourceTransferSpec`s the shared console
 *     resource-transfer framework flies (stock / production / card-resource);
 *   · the viewer's own share of the per-cube colony bonuses;
 *   · the panel REWARD-HOLD seed list (income + own bonuses — the amounts the
 *     resource panel must keep hidden until each chip's touchdown);
 *   · the card-cover launch plan of a merged trade reveal batch (which cover
 *     flies from the «ТОРГОВАТЬ» cell and which from the «БОНУС» cell);
 *   · the white-marker track-reset glide plan (pre → post, stepping left).
 *
 * A benefit the premium language can't express as a chip or a card cover
 * (TR, Venus scale, delegates, …) maps to NO spec — it commits through the
 * standard delta-chip path, which is the honest degrade, never a lie.
 */

import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyTradeRevealRole, ColonyTradeRevealSegment} from '@/common/models/CardDrawRevealModel';
import {ColonyTradeGrantModel, ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {ResourceTransferSpec, cardResourceKey, mergeTransferSpecs} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The optional pre-collected composer picks (card-resource destinations). */
export type ColonyTradeTargets = {
  /** The chosen host card of a card-resource trade INCOME (Titan / Enceladus / Miranda). */
  incomeTargetCard?: CardName;
  /** The chosen host cards of the viewer's own card-resource colony bonuses, in pick order. */
  bonusTargetCards?: ReadonlyArray<CardName>;
};

/**
 * One grant → one transfer spec, or undefined when the benefit has no chip
 * representation (it then rides the ordinary commit delta chips).
 */
export function benefitTransferSpec(grant: ColonyTradeGrantModel, targetCard?: CardName): ResourceTransferSpec | undefined {
  if (grant.quantity <= 0) {
    return undefined;
  }
  switch (grant.benefit) {
  case ColonyBenefit.GAIN_RESOURCES:
    return grant.resource !== undefined ?
      {channel: 'stock', resource: grant.resource, amount: grant.quantity} : undefined;
  case ColonyBenefit.GAIN_PRODUCTION:
    return grant.resource !== undefined ?
      {channel: 'production', resource: grant.resource, amount: grant.quantity} : undefined;
  case ColonyBenefit.ADD_RESOURCES_TO_CARD:
  case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD:
    return grant.cardResource !== undefined ?
      {channel: 'card-resource', resource: cardResourceKey(grant.cardResource), amount: grant.quantity, targetCard} :
      undefined;
  default:
    return undefined;
  }
}

/** Cards the grant draws (the PLAN — actual counts ride the reveal batch). */
export function benefitCardCount(grant: ColonyTradeGrantModel): number {
  switch (grant.benefit) {
  case ColonyBenefit.DRAW_CARDS:
    return Math.max(0, grant.quantity);
  case ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE:
    return 1;
  default:
    return 0;
  }
}

/** How many colony-bonus cubes of this trade belong to the viewer. */
export function viewerBonusCubes(manifest: ColonyTradeManifestModel, viewer: Color): number {
  return manifest.bonusRecipients.find((r) => r.color === viewer)?.cubes ?? 0;
}

/** The trade-income chip specs (usually 0 or 1 chip). */
export function incomeTransferSpecs(manifest: ColonyTradeManifestModel, targets?: ColonyTradeTargets): Array<ResourceTransferSpec> {
  const spec = benefitTransferSpec(manifest.tradeIncome, targets?.incomeTargetCard);
  return spec !== undefined ? [spec] : [];
}

/**
 * The viewer's own colony-bonus chip specs — ONE spec PER CUBE, deliberately
 * NOT merged: two cubes on Triton are two separate +1 titanium flights with a
 * stagger, so the player can count their bonuses.
 */
export function ownBonusTransferSpecs(manifest: ColonyTradeManifestModel, viewer: Color, targets?: ColonyTradeTargets): Array<ResourceTransferSpec> {
  const grant = manifest.colonyBonus;
  if (grant === undefined) {
    return [];
  }
  const cubes = viewerBonusCubes(manifest, viewer);
  const out: Array<ResourceTransferSpec> = [];
  for (let i = 0; i < cubes; i++) {
    const spec = benefitTransferSpec(grant, targets?.bonusTargetCards?.[i]);
    if (spec !== undefined) {
      out.push(spec);
    }
  }
  return out;
}

/**
 * The panel REWARD-HOLD seed: every metric amount of the viewer's own trade
 * rewards (income + own colony bonuses), MERGED per metric — the panel must
 * hide the whole pending amount from the moment the view commits until the
 * chips physically land.
 */
export function colonyTradeHeldSpecs(manifest: ColonyTradeManifestModel, viewer: Color, targets?: ColonyTradeTargets): Array<ResourceTransferSpec> {
  return mergeTransferSpecs([
    ...(manifest.trader === viewer ? incomeTransferSpecs(manifest, targets) : []),
    ...ownBonusTransferSpecs(manifest, viewer, targets),
  ]);
}

// ── the card-cover launch plan (a merged trade reveal batch) ────────────────

/** One card cover to launch: which tile area it lifts from + its reveal slot. */
export type TradeCoverPlanEntry = {
  /** Index into the batch's `cards` (== the reveal slot `name#index`). */
  index: number;
  role: ColonyTradeRevealRole;
  /** Flight start delay (ms @ motion scale 1) — waves read separately. */
  delayMs: number;
};

/** Per-cover stagger within one wave (income / bonus). */
export const TRADE_COVER_STAGGER_MS = 95;
/** The readable pause between the income wave and the bonus wave. */
export const TRADE_WAVE_GAP_MS = 420;
/** One cover's flight time (launch → flip → land). */
export const TRADE_COVER_FLIGHT_MS = 620;
/** The frame beat after the last cover lands (the modal materializes). */
export const TRADE_FRAME_MS = 240;

/**
 * The ordered launch plan of a merged trade batch: income covers first (from
 * the «ТОРГОВАТЬ» cell), then — after a readable wave gap — the bonus covers
 * (from the «БОНУС» cell). Cards match the batch's segments; a batch without
 * segments (a plain colony draw claimed defensively) reads all-income.
 */
export function tradeCoverPlan(cardCount: number, segments: ReadonlyArray<ColonyTradeRevealSegment> | undefined): Array<TradeCoverPlanEntry> {
  const segs = segments !== undefined && segments.length > 0 ? segments : [{role: 'income' as const, count: cardCount}];
  const out: Array<TradeCoverPlanEntry> = [];
  let index = 0;
  let waveStartMs = 0;
  for (const seg of segs) {
    let flown = 0;
    for (let i = 0; i < seg.count && index < cardCount; i++, index++, flown++) {
      out.push({index, role: seg.role, delayMs: waveStartMs + i * TRADE_COVER_STAGGER_MS});
    }
    if (flown > 0) {
      waveStartMs += (flown - 1) * TRADE_COVER_STAGGER_MS + TRADE_WAVE_GAP_MS;
    }
  }
  return out;
}

/** The full launch plan's motion budget (for safety timers). */
export function tradeCoverPlanBudgetMs(plan: ReadonlyArray<TradeCoverPlanEntry>): number {
  const lastDelay = plan.length > 0 ? plan[plan.length - 1].delayMs : 0;
  return lastDelay + TRADE_COVER_FLIGHT_MS + TRADE_FRAME_MS;
}

// ── the white-marker track reset ────────────────────────────────────────────

export type TrackGlidePlan = {
  from: number;
  to: number;
  /** The cells the marker passes THROUGH, in glide order (from-1 … to). */
  path: ReadonlyArray<number>;
  perCellMs: number;
  settleMs: number;
};

/** Per-cell glide beat (ms @ motion scale 1), clamped so a 1-cell hop still
 *  reads and a 6-cell sweep never drags. */
const TRACK_CELL_MS_MIN = 95;
const TRACK_CELL_MS_MAX = 170;
export const TRACK_SETTLE_MS = 260;

/**
 * The reset glide: pre → post stepping LEFT. `undefined` when the marker
 * doesn't move (post >= pre) — the caller plays the honest confirm pulse
 * instead of inventing motion.
 */
export function trackGlidePlan(pre: number, post: number): TrackGlidePlan | undefined {
  if (post >= pre) {
    return undefined;
  }
  const path: Array<number> = [];
  for (let p = pre - 1; p >= post; p--) {
    path.push(p);
  }
  const perCellMs = Math.max(TRACK_CELL_MS_MIN, Math.min(TRACK_CELL_MS_MAX, Math.round(420 / path.length)));
  return {from: pre, to: post, path, perCellMs, settleMs: TRACK_SETTLE_MS};
}
