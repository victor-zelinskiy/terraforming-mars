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
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyTradeRevealRole, ColonyTradeRevealSegment} from '@/common/models/CardDrawRevealModel';
import {ColonyTradeGrantModel, ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {ResourceTransferSpec, cardResourceKey, mergeTransferSpecs} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The optional pre-collected composer picks (card-resource destinations). */
export type ColonyTradeTargets = {
  /** The chosen host card of a card-resource trade INCOME (Titan / Enceladus / Miranda). */
  incomeTargetCard?: CardName;
  /**
   * That card's OWN resource type (an icon key) — the kind the chip flies as
   * when the grant spans SEVERAL kinds (the Redux Vesta): the unit that lands
   * is the card's, never the first of the tile's list. Read where the
   * destinations are read (`colonyTradeCardDestinations`), the one place that
   * knows the card.
   */
  incomeTargetResource?: string;
  /** The chosen host cards of the viewer's own card-resource colony bonuses, in pick order. */
  bonusTargetCards?: ReadonlyArray<CardName>;
  /** Their own resource types, index-aligned with `bonusTargetCards` (see `incomeTargetResource`). */
  bonusTargetResources?: ReadonlyArray<string | undefined>;
};

/**
 * One grant → one transfer spec, or undefined when the benefit has no chip
 * representation (it then rides the ordinary commit delta chips).
 *
 * A grant over SEVERAL kinds flies as the TARGET card's own kind
 * (`targetResource`) — and without a target there is no flight, exactly as
 * a one-kind grant with no chosen host stays out of the air today.
 */
export function benefitTransferSpec(grant: ColonyTradeGrantModel, targetCard?: CardName, targetResource?: string): ResourceTransferSpec | undefined {
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
  case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD: {
    if (grant.cardResource !== undefined) {
      return {channel: 'card-resource', resource: cardResourceKey(grant.cardResource), amount: grant.quantity, targetCard};
    }
    if (grant.cardResources !== undefined && grant.cardResources.length > 0) {
      return targetCard !== undefined && targetResource !== undefined ?
        {channel: 'card-resource', resource: cardResourceKey(targetResource), amount: grant.quantity, targetCard} :
        undefined;
    }
    return undefined;
  }
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
  const spec = benefitTransferSpec(manifest.tradeIncome, targets?.incomeTargetCard, targets?.incomeTargetResource);
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
    const spec = benefitTransferSpec(grant, targets?.bonusTargetCards?.[i], targets?.bonusTargetResources?.[i]);
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
  /** DEPARTURE delay (ms @ motion scale 1) — when the grow-flip-travel leg
   *  starts. Includes the wave's fan lead, so budgets stay one formula. */
  delayMs: number;
  /** When this cover's FAN leg starts (the stack spreads beside its cell). */
  fanDelayMs: number;
  /** This cover's position within its wave's fan (0-based) + the wave size —
   *  the director spaces the fan from these two numbers alone. */
  fanIndex: number;
  fanCount: number;
};

/** Per-cover stagger within one wave (income / bonus) — «по одной»: each
 *  card visibly separates from the SAME track cell before the next leaves. */
export const TRADE_COVER_STAGGER_MS = 170;
/**
 * The wave boundary's extra breath ON TOP of the deal cadence. The whole
 * payout is ONE CONTINUOUS DEAL — the bonus cover is its LAST card, departing
 * one stagger-plus-breath after the final income cover, its fan peeling out
 * beside the «БОНУС» cell while the income covers are still in the air. The
 * old shape (a full gap + the next wave's whole fan lead of dead air — ~940 ms
 * of nothing between the waves) read as two unrelated animations, and the
 * second one launched out of a stage that had already dissolved.
 */
export const TRADE_WAVE_GAP_MS = 170;
/**
 * THE FAN PRESENTATION — the launch's own first beat. The covers of one wave
 * are born STACKED on the printed card back (the cell shows ONE back — that
 * is the physical truth), immediately rise a little, grow a little and spread
 * into the REAL count side by side, face-down; only after a readable hold
 * does the first of them start its grow-flip-travel. This is what lets the
 * player COUNT what they are being paid before anything flies — two covers
 * departing straight from the same rect read as one card glitching.
 */
export const TRADE_FAN_MS = 320;
/** The covers peel into the fan one after another (a stack unstacking). */
export const TRADE_FAN_STAGGER_MS = 70;
/** The readable pause at full fan before the first departure. */
export const TRADE_FAN_HOLD_MS = 200;
/** How long a wave's fan owns the stage before its departures begin. */
export const TRADE_FAN_LEAD_MS = TRADE_FAN_MS + TRADE_FAN_HOLD_MS;
/**
 * THE SEPARATION LEG — the card lifts OFF its printed cell: rises straight
 * up while growing, the flip beginning WITH the growth (the board-bonus
 * lift grammar). Its own budget line because the whole feel of the launch
 * is this leg being unhurried.
 */
export const TRADE_COVER_LIFT_MS = 400;
/** One cover's WHOLE flight time (separation → travel → settle). */
export const TRADE_COVER_FLIGHT_MS = 1040;
/**
 * WHERE IN THE SEPARATION LEG the scene under the flight starts to evaporate,
 * as a fraction of {@link TRADE_COVER_LIFT_MS}.
 *
 * Early on purpose: the dissolve is not a state change that happens to follow
 * the launch, it is PART OF IT — the interface lets go while the cards rise
 * and turn, over the whole lift, and is gone by the time they are travelling.
 * Waiting until they were deep into the travel (the previous cue) put the
 * change after the eye had already left with the cards, which is what read as
 * «интерфейс исчезает слишком резко».
 */
export const TRADE_LIFTOFF_AT_F = 0.22;
/** The frame beat after the last cover lands (the modal materializes). */
export const TRADE_FRAME_MS = 240;

/**
 * The ordered launch plan of a merged trade batch: income covers first (from
 * the «ТОРГОВАТЬ» cell), then — after a readable wave gap — the bonus covers
 * (from the «БОНУС» cell). Cards match the batch's segments; a batch without
 * segments (a plain colony draw claimed defensively) reads all-income.
 *
 * Each wave FANS OUT first (`fanDelayMs` — its covers peel into a side-by-side
 * spread at the source), and only `TRADE_FAN_LEAD_MS` later does its first
 * departure fire — so `delayMs` already carries the fan lead and the budget
 * formula below stays untouched.
 */
export function tradeCoverPlan(cardCount: number, segments: ReadonlyArray<ColonyTradeRevealSegment> | undefined): Array<TradeCoverPlanEntry> {
  const segs = segments !== undefined && segments.length > 0 ? segments : [{role: 'income' as const, count: cardCount}];
  const out: Array<TradeCoverPlanEntry> = [];
  let index = 0;
  let waveStartMs = 0;
  for (const seg of segs) {
    const waveCount = Math.min(seg.count, Math.max(0, cardCount - index));
    let flown = 0;
    for (let i = 0; i < seg.count && index < cardCount; i++, index++, flown++) {
      out.push({
        index,
        role: seg.role,
        delayMs: waveStartMs + TRADE_FAN_LEAD_MS + i * TRADE_COVER_STAGGER_MS,
        fanDelayMs: waveStartMs + i * TRADE_FAN_STAGGER_MS,
        fanIndex: i,
        fanCount: waveCount,
      });
    }
    if (flown > 0) {
      // ONE deal cadence across the waves: the next wave's first DEPARTURE
      // lands exactly one stagger + the wave breath after this wave's last —
      // its fan therefore starts while this wave's covers are still flying
      // (departure = waveStart + FAN_LEAD, so the lead cancels out of the
      // increment). The bonus card is the deal's last card, not a second act.
      waveStartMs += flown * TRADE_COVER_STAGGER_MS + TRADE_WAVE_GAP_MS;
    }
  }
  return out;
}

/** The full launch plan's motion budget (for safety timers). */
export function tradeCoverPlanBudgetMs(plan: ReadonlyArray<TradeCoverPlanEntry>): number {
  const lastDelay = plan.length > 0 ? plan[plan.length - 1].delayMs : 0;
  return lastDelay + TRADE_COVER_FLIGHT_MS + TRADE_FRAME_MS;
}

/**
 * WHERE A BATCH CARD RENDERS — the wave, but answered against the surface
 * that will actually draw it.
 *
 * ⚠️ A BONUS CARD ONLY LEAVES THE STRIP WHEN SOMETHING ELSE WILL DRAW IT. The
 * «Бонус колонии» ZONE is Pluto's grammar: a per-colony sequence, one card on
 * the table at a time, closed by a discard — and it exists only while the
 * server's discard marker does. Splitting the bonus wave out unconditionally
 * meant a colony whose owner bonus is a PLAIN draw (Miranda: «возьмите
 * карту») rendered its card in neither place: out of the strip, no zone to
 * receive it — no slot, so the covers had no landing target and the take had
 * nowhere to fly from. Invisible card, dead «Взять».
 *
 * `zoned` is that one question, asked by the renderer that knows the answer.
 */
export function revealWaveForIndex(
  segments: ReadonlyArray<ColonyTradeRevealSegment> | undefined,
  index: number,
  zoned: boolean,
): ColonyTradeRevealRole {
  return zoned ? tradeRoleForIndex(segments, index) : 'income';
}

/**
 * Which trade wave a batch card at `index` belongs to (the segments are
 * contiguous same-role runs in card order). A batch without segments reads
 * all-income. The reveal modal groups the «Бонус колонии» cards by this.
 */
export function tradeRoleForIndex(segments: ReadonlyArray<ColonyTradeRevealSegment> | undefined, index: number): ColonyTradeRevealRole {
  if (segments === undefined) {
    return 'income';
  }
  let acc = 0;
  for (const seg of segments) {
    acc += seg.count;
    if (index < acc) {
      return seg.role;
    }
  }
  return 'income';
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

/** The per-cell beat of a glide of `steps` cells (the same rhythm both ways). */
function glideCellMs(steps: number): number {
  return Math.max(TRACK_CELL_MS_MIN, Math.min(TRACK_CELL_MS_MAX, Math.round(420 / steps)));
}

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
  return {from: pre, to: post, path, perCellMs: glideCellMs(path.length), settleMs: TRACK_SETTLE_MS};
}

/**
 * THE ADVANCE glide: the marker steps RIGHT before the trade is read.
 *
 * A trade-offset card («Торговая колония») moves the track FORWARD first, and
 * the reward is then read at the new cell — the server does it in
 * `Colony.trade` before it builds the manifest, so `to` is
 * `preTradeTrackPosition` (post-advance, server truth) and SEVERAL such cards
 * are one summed move by construction, never a client re-derivation.
 *
 * It is the same physical language as the reset, in the other direction: the
 * player watches the position they are about to be paid at being earned. Its
 * absence was the one silent step of the payout — the marker simply appeared
 * further along the moment the trade committed.
 */
export function trackAdvancePlan(from: number, to: number): TrackGlidePlan | undefined {
  if (to <= from) {
    return undefined;
  }
  const path: Array<number> = [];
  for (let p = from + 1; p <= to; p++) {
    path.push(p);
  }
  return {from, to, path, perCellMs: glideCellMs(path.length), settleMs: TRACK_SETTLE_MS};
}

// ── the WAVE: every track at once, one tile after another ─────────────────────

/**
 * THE WAVE (Unity Budget, RX29 — «advance each colony track 2 steps»): the
 * SAME glide as the advance leg, played for EVERY tile of the table in turn.
 *
 * The choreography the owner asked for, as data:
 *   · the scene BREATHES first — the table stands still for a beat, so the
 *     player sees where every marker starts;
 *   · a WAVE, not a volley — the tiles start one after another with a small
 *     stagger, top to bottom in the table's order: a programme rolling over
 *     every world, never a glitch of markers jumping at once;
 *   · each marker CHARGES, then steps, rests, steps, then settles — the two
 *     steps are countable («два»), not one slide;
 *   · a track at its END makes no step and is named — its leg has no cells;
 *   · after the last landing the scene is READ for a beat before it leaves.
 * Reduced motion (and the fx-lite preset) keeps the wave's ORDER and the
 * landings, and drops the impulses: the markers arrive, one after another,
 * in the short form.
 */
export type TrackWaveLeg = {
  colony: ColonyName;
  from: number;
  to: number;
  /** The cells the marker passes THROUGH, in glide order (empty for a track at its end). */
  path: ReadonlyArray<number>;
  /** When this tile's marker starts, from the wave's start (BASE ms — the breath included). */
  startAtMs: number;
  perCellMs: number;
  /** The rest between the two steps (BASE ms). */
  pauseMs: number;
};

export type TrackWavePlan = {
  legs: ReadonlyArray<TrackWaveLeg>;
  /** The wave's whole length (BASE ms): the breath, the last leg's start, its glide, the settle and the read. */
  totalMs: number;
  /** The read after the last landing (BASE ms) — the layer holds the scene this long before it ends. */
  readMs: number;
};

/**
 * THE RHYTHM of a track move — the one thing that differs between the two
 * shows the ONE mechanism plays:
 *  · `wave` — a LAW over every track (RX29 «advance each colony track 2
 *    steps»): a breath, a stagger, countable steps with a rest between;
 *  · `rail` — ONE chosen tile's marker set to its top (TR07 Colony
 *    Sponsors): a short breath (the marker visibly stands where it was), then
 *    the trade's own even rail rhythm (`glideCellMs` — the advance and the
 *    reset legs' beat) with NO rests: it is one move, not steps with rewards.
 */
export type TrackMoveRhythm = 'wave' | 'rail';

/** The scene breathes: the table stands still before the first marker moves. */
export const TRACK_WAVE_BREATH_MS = 760;
/** One tile after another. */
export const TRACK_WAVE_STAGGER_MS = 260;
/** One step of a marker — slower than the trade's rail rhythm: this is a reading, not a reset. */
export const TRACK_WAVE_CELL_MS = 220;
/** The rest between the two steps — «два», not one slide. */
export const TRACK_WAVE_PAUSE_MS = 150;
/** The charge before the first step, and the settle after the last (the director's own timings). */
const TRACK_WAVE_CHARGE_MS = 260;
const TRACK_WAVE_SETTLE_MS = 180;
/** After the last landing: the table is read before the scene leaves. */
export const TRACK_WAVE_READ_MS = 900;
/** The short form's breath and stagger (reduced motion / fx-lite) — the order stays legible, the wait does not. */
const TRACK_WAVE_REDUCED_BREATH_MS = 240;
const TRACK_WAVE_REDUCED_STAGGER_MS = 90;
/** The RAIL move's breath: the marker visibly stands on its cell after the answer before it moves (TR07). */
export const TRACK_RAIL_BREATH_MS = 320;
/** …and its read after the landing: the lock pulse and the flipped readout, before the scene hands back —
 *  the class of the stage's own read of a landed result (`CARDLAND_READ_MS`). */
export const TRACK_RAIL_READ_MS = 680;

/** ONE leg's own length (BASE ms): the charge, the steps with their rests, the settle. */
function legLengthMs(leg: TrackWaveLeg): number {
  const steps = leg.path.length;
  if (steps === 0) {
    return TRACK_WAVE_CHARGE_MS + TRACK_WAVE_SETTLE_MS;
  }
  return TRACK_WAVE_CHARGE_MS + steps * leg.perCellMs + (steps - 1) * leg.pauseMs + TRACK_WAVE_SETTLE_MS;
}

/**
 * The wave over `moves` (the server's list, in the table's order). A leg per
 * tile — a track at its end gets a leg with NO cells (the marker charges and
 * settles back, and the surface names it); the plan never invents motion.
 */
export function trackWavePlan(
  moves: ReadonlyArray<{colony: ColonyName, before: number, after: number}>,
  opts: {reduced: boolean, rhythm?: TrackMoveRhythm},
): TrackWavePlan {
  const rail = opts.rhythm === 'rail';
  const breath = opts.reduced ? TRACK_WAVE_REDUCED_BREATH_MS : (rail ? TRACK_RAIL_BREATH_MS : TRACK_WAVE_BREATH_MS);
  const stagger = opts.reduced ? TRACK_WAVE_REDUCED_STAGGER_MS : TRACK_WAVE_STAGGER_MS;
  const readMs = rail ? TRACK_RAIL_READ_MS : TRACK_WAVE_READ_MS;
  const legs: Array<TrackWaveLeg> = moves.map((move, index) => {
    const path: Array<number> = [];
    for (let p = move.before + 1; p <= move.after; p++) {
      path.push(p);
    }
    return {
      colony: move.colony, from: move.before, to: move.after, path,
      startAtMs: breath + index * stagger,
      // THE RAIL: the trade's own even beat, no rests — one move, never steps with rewards between them.
      perCellMs: rail ? glideCellMs(Math.max(1, path.length)) : TRACK_WAVE_CELL_MS,
      pauseMs: rail ? 0 : TRACK_WAVE_PAUSE_MS,
    };
  });
  const last = legs.reduce((max, leg) => Math.max(max, leg.startAtMs + legLengthMs(leg)), breath);
  return {legs, totalMs: last + readMs, readMs};
}
