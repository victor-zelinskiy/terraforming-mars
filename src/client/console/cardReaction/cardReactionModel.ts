/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the PURE half of the card-reaction
 * scene (Turmoil Redux TR80 Hartlan Heating, 2026-10-26; contract
 * `docs/claude/console/card-reaction.md`). No DOM, no GSAP — unit-tested under
 * the server runner like `intakeAssemblyPlan`.
 *
 * ── WHAT THE PLAYER SEES ───────────────────────────────────────────────────
 * The server says WHICH card's printed effect fired and WHAT it paid
 * (`GameModel.cardReactions` — one record per effect scope, in the order they
 * fired). The scene plays the record: the reacting card RISES — out of its
 * own place when that place is on screen, else surfacing at a SEAT beside the
 * receiver — its tokens are BORN on the printed icons of its effect row, fly
 * to where the resource lives, the counters TICK on touchdown, the card
 * RECEDES; the next group rises a beat before the previous one's last landing.
 * Fast, in groups, under a wall-clock CEILING: what cannot rise in time ticks
 * at once and is named (never a stall of the play's own scene).
 *
 * ── THE RECORD → THE GROUP ─────────────────────────────────────────────────
 * A record is a group. Its impacts split by WHERE they can be shown: the
 * viewer's own RAIL rows (stock / production / the rating) — the scene's
 * tokens; the viewer's own CARDS (a card resource onto a holder) — the
 * holder's own capsule; everything else (a draw — the deck layer's own scene;
 * a scale step — the marker's; a rival's gain — their chip) is named as
 * `elsewhere` and never flown from here.
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardReactionImpact, CardReactionRecord} from '@/common/models/CardReactionModel';
import {RATING_RAIL_KEY, ResourceTransferSpec, cardResourceKey, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {RectLike} from '@/client/console/cardIntake/intakeAssemblyPlan';

export type CardReactionGroup = {
  record: CardReactionRecord;
  /** The reacting card is the VIEWER's. */
  own: boolean;
  /** The reacting card's name — the face the scene shows. */
  card: CardName;
  /** The viewer's own RAIL rows the group moves — the scene's tokens, in the record's order. */
  rail: Array<ResourceTransferSpec>;
  /** The viewer's own CARDS the group pays onto (`targetCard`) — the holder's capsule, in the record's order. */
  cards: Array<ResourceTransferSpec>;
  /** Impacts this scene does not fly — named, never lost (their counters tick with the commit / their own scene). */
  elsewhere: Array<CardReactionImpact>;
};

/**
 * The records NEW in this response — the ring is consumed once by `seq`
 * (the `freshScaleStepRewards` law): nothing on the first view of a seat (a
 * reload is not a reaction), nothing already known, in the order they fired.
 */
export function freshCardReactions(
  before: ReadonlyArray<CardReactionRecord> | undefined,
  after: ReadonlyArray<CardReactionRecord> | undefined,
  hadBefore: boolean,
): Array<CardReactionRecord> {
  if (!hadBefore || after === undefined || after.length === 0) {
    return [];
  }
  const known = new Set((before ?? []).map((r) => r.seq));
  return after.filter((r) => !known.has(r.seq) && r.impacts.length > 0).sort((a, b) => a.seq - b.seq);
}

/** ONE impact as a transfer spec of the viewer's own counters — `undefined` for an impact the scene does not fly. */
export function reactionImpactSpec(impact: CardReactionImpact): ResourceTransferSpec | undefined {
  switch (impact.kind) {
  case 'stock':
    return {channel: 'stock', resource: impact.resource, amount: Math.abs(impact.amount), ...(impact.amount < 0 ? {direction: 'loss' as const} : {})};
  case 'production':
    return {channel: 'production', resource: impact.resource, amount: Math.abs(impact.amount), ...(impact.amount < 0 ? {direction: 'loss' as const} : {})};
  case 'tr':
    return {channel: 'stock', resource: RATING_RAIL_KEY, amount: Math.abs(impact.amount), ...(impact.amount < 0 ? {direction: 'loss' as const} : {})};
  case 'card-resource':
    return {channel: 'card-resource', resource: cardResourceKey(impact.resource), amount: Math.abs(impact.amount), targetCard: impact.target, ...(impact.amount < 0 ? {direction: 'loss' as const} : {})};
  default:
    // A draw is the deck layer's scene; a scale step the marker's.
    return undefined;
  }
}

/** The group of one record, read for `viewer`. */
export function reactionGroupOf(record: CardReactionRecord, viewer: Color | undefined): CardReactionGroup {
  const own = viewer !== undefined && record.owner === viewer;
  const rail: Array<ResourceTransferSpec> = [];
  const cards: Array<ResourceTransferSpec> = [];
  const elsewhere: Array<CardReactionImpact> = [];
  for (const impact of record.impacts) {
    const spec = viewer !== undefined && impact.to === viewer ? reactionImpactSpec(impact) : undefined;
    if (spec === undefined) {
      elsewhere.push(impact);
    } else if (spec.channel === 'card-resource') {
      cards.push(spec);
    } else {
      rail.push(spec);
    }
  }
  return {record, own, card: record.card, rail, cards, elsewhere};
}

/**
 * ONE PLAY, ONE RISE (the owner's decision 4, TR81): records of the SAME card of the SAME owner under the SAME root are
 * ONE group — Lotus Innovations answers a card with a printed TR and a degree (two calls of the rating funnel → two
 * effect scopes → two records) with ONE rise and one wave, never two rises in a row. The merged group keeps the FIRST
 * record (its `seq` is the group's place in the chain, its `printedEffect` the birth row) with every impact appended
 * in the server's order. A record with no root never merges (nothing says it is the same press).
 */
export function mergeCardReactions(records: ReadonlyArray<CardReactionRecord>): Array<CardReactionRecord> {
  const out: Array<CardReactionRecord> = [];
  const byKey = new Map<string, CardReactionRecord>();
  for (const record of [...records].sort((a, b) => a.seq - b.seq)) {
    const key = record.root.actionId === undefined ? undefined : `${record.root.actionId}|${record.owner}|${record.card}`;
    const host = key === undefined ? undefined : byKey.get(key);
    if (host !== undefined) {
      host.impacts.push(...record.impacts);
      continue;
    }
    const copy: CardReactionRecord = {...record, impacts: [...record.impacts]};
    out.push(copy);
    if (key !== undefined) {
      byKey.set(key, copy);
    }
  }
  return out;
}

/** Every fresh record as a group, in `seq` order — the records of one card under one root merged into ONE group. */
export function groupCardReactions(records: ReadonlyArray<CardReactionRecord>, viewer: Color | undefined): Array<CardReactionGroup> {
  return mergeCardReactions(records).map((record) => reactionGroupOf(record, viewer));
}

/**
 * THE TOKENS of a group's half: a stock gain is counted — ONE TOKEN PER
 * UNIT up to `waveCap` (Hartlan's «6 [heat]» is a wave of six, each born on
 * the printed heat icon), a larger gain rides as fewer, heavier tokens; a
 * card resource the reactor lays on a card is counted the same way (Lotus
 * Innovations' «+2 [data]» — two tokens off its printed data, the capsule
 * ticking on each touchdown); a production step and a rating step are one
 * token each, and so is a loss.
 */
export const REACTION_WAVE_CAP = 6;
export function reactionTokensOf(spec: ResourceTransferSpec, waveCap = REACTION_WAVE_CAP): Array<ResourceTransferSpec> {
  const counted = (spec.channel === 'stock' && spec.resource !== RATING_RAIL_KEY) || (spec.channel === 'card-resource' && spec.direction !== 'loss');
  if (!counted || spec.amount <= 1) {
    return [spec];
  }
  const count = Math.min(waveCap, spec.amount);
  const base = Math.floor(spec.amount / count);
  let rest = spec.amount - base * count;
  const out: Array<ResourceTransferSpec> = [];
  for (let i = 0; i < count; i++) {
    const amount = base + (rest > 0 ? 1 : 0);
    rest = Math.max(0, rest - 1);
    out.push({...spec, amount});
  }
  return out;
}

/** The rail rows a group touches (the host's join key: a held answer on one of these rows is this group's). */
export function reactionRowsOf(group: Pick<CardReactionGroup, 'rail'>): Array<string> {
  return [...new Set(group.rail.map((spec) => railRowKey(spec)))];
}

// ── the tempo ──────────────────────────────────────────────────────────────

/** The rise primitive's numbers — the assembly scene's, byte for byte (ONE primitive, `cardReactionStage.riseReactor`). */
export type ReactionTempo = {
  /** The card rises (alpha 0 → .94, y +14 → 0). */
  riseMs: number;
  /** …and stands a beat before its tokens are born (the eye reads WHICH card). */
  holdMs: number;
  /** The card recedes after its last token landed. */
  recedeMs: number;
  /** The next group rises this long BEFORE the previous group's last landing. */
  overlapMs: number;
  /** Tokens of one group leave one after another by this much (a wave, never a burst). */
  staggerMs: number;
};

export function reactionTempo(): ReactionTempo {
  return {riseMs: 260, holdMs: 150, recedeMs: 220, overlapMs: 140, staggerMs: 60};
}

/** Reduced motion: a crossfade ≤ 160 ms, no tokens (the director ticks on the commit). */
export function reducedReactionTempo(): ReactionTempo {
  return {riseMs: 140, holdMs: 60, recedeMs: 120, overlapMs: 60, staggerMs: 0};
}

/** The chain's wall-clock ceiling (the owner's decision 4): what has not risen by then ticks at once, named. */
export const REACTION_CHAIN_CEILING_MS = 1800;
/** From FOUR groups the ceiling widens (the owner, 2026-10-26 — PL-1059: with four reactors off one play the fourth in the
 *  server's order was the one the forecast PROMISED, and it ticked without a face): every rise still starts under it. */
export const REACTION_CHAIN_CEILING_MANY_MS = 2400;
export const REACTION_MANY_CEILING_GROUPS = 4;

/** The chain's wall-clock ceiling for `n` groups — 1.8 s, 2.4 s from four. */
export function chainCeilingFor(n: number): number {
  return n >= REACTION_MANY_CEILING_GROUPS ? REACTION_CHAIN_CEILING_MANY_MS : REACTION_CHAIN_CEILING_MS;
}
/** From this many groups on, the chain quickens and takes TWO seats (the owner's decision 4). */
export const REACTION_MANY_GROUPS = 3;
export const REACTION_MANY_PACE = 1.35;

export type ReactionFlightTempo = {
  /** A token's pop off its icon + its arc to the row (the transfer language's own numbers). */
  popMs: number;
  arcMs: number;
};

export type ReactionChainStep = {
  index: number;
  /** Which seat the group rises at (a second seat only when the chain is MANY). */
  seat: 0 | 1;
  riseAtMs: number;
  /** The first token is born. */
  birthAtMs: number;
  /** The last token has touched down. */
  landedAtMs: number;
  /** The card has receded. */
  recededAtMs: number;
};

export type ReactionChainPlan = {
  steps: ReadonlyArray<ReactionChainStep>;
  /** The groups past the ceiling — never risen: their counters tick at once, their names go into ONE summary. */
  summarized: ReadonlyArray<number>;
  pace: number;
  seats: 1 | 2;
  totalMs: number;
};

/**
 * THE CHAIN — groups in the server's order, each rising `overlapMs` before the previous group's last landing; from
 * `REACTION_MANY_GROUPS` on the whole chain runs at `REACTION_MANY_PACE` and alternates two seats so a rising card never
 * waits for a receding one; a group whose rise would start past the ceiling is not risen at all (`summarized`). Pure.
 */
export function planReactionChain(
  groups: ReadonlyArray<{tokens: number}>,
  t: ReactionTempo,
  flight: ReactionFlightTempo,
  ceilingOverride?: number,
): ReactionChainPlan {
  const ceilingMs = ceilingOverride ?? chainCeilingFor(groups.length);
  const many = groups.length >= REACTION_MANY_GROUPS;
  const pace = many ? REACTION_MANY_PACE : 1;
  // A second seat the moment there is a second group: the next card rises while the previous one is still landing,
  // and two faces never share one box. The PACE quickens only from MANY on.
  const seats: 1 | 2 = groups.length >= 2 ? 2 : 1;
  const q = (ms: number) => Math.round(ms / pace);
  const steps: Array<ReactionChainStep> = [];
  const summarized: Array<number> = [];
  const seatFreeAt: [number, number] = [0, 0];
  let prevLandedMs = 0;
  groups.forEach((group, index) => {
    const seat: 0 | 1 = seats === 2 ? ((index % 2) as 0 | 1) : 0;
    const earliest = steps.length === 0 ? 0 : Math.max(0, prevLandedMs - t.overlapMs);
    const riseAtMs = Math.max(earliest, seatFreeAt[seat]);
    if (riseAtMs >= ceilingMs) {
      summarized.push(index);
      return;
    }
    const birthAtMs = riseAtMs + q(t.riseMs + t.holdMs);
    const tokens = Math.max(1, group.tokens);
    const landedAtMs = birthAtMs + q(flight.popMs + flight.arcMs + t.staggerMs * (tokens - 1));
    const recededAtMs = landedAtMs + q(t.recedeMs);
    steps.push({index, seat, riseAtMs, birthAtMs, landedAtMs, recededAtMs});
    seatFreeAt[seat] = recededAtMs;
    prevLandedMs = landedAtMs;
  });
  return {steps, summarized, pace, seats, totalMs: steps.reduce((max, s) => Math.max(max, s.recededAtMs), 0)};
}

// ── the seat ───────────────────────────────────────────────────────────────

/**
 * WHERE A REACTOR SURFACES when its own place is not on screen (the owner's
 * decision 7): beside the RECEIVER — the rail's row on the stage side (the rail
 * is the left hull member, so the seat stands just right of it, centred on the
 * receiving row) — never over the hero, the composer's focus or a slot
 * (`avoid`): a seat that would cover one slides down, then up, past it; with
 * no clear place the stage's top-right corner takes it at a reduced size. The
 * second seat (`slot` 1) stands below the first. A card-shaped box of
 * `height` (the host's choice — a reading size, never the hero's). Pure, so
 * the order of degradation is a tested fact.
 */
export function reactionSeatRect(
  stage: RectLike,
  receiver: RectLike,
  avoid: ReadonlyArray<RectLike>,
  height: number,
  slot: 0 | 1 = 0,
  aspect = 460 / 320,
): RectLike {
  const pad = Math.max(8, stage.width * 0.012);
  const gap = Math.max(10, height * 0.08);
  const width = height / aspect;
  const left = Math.min(receiver.left + receiver.width + gap, stage.left + stage.width - pad - width);
  const centre = receiver.top + receiver.height / 2;
  const baseTop = centre - height / 2 + slot * (height + gap);
  const minTop = stage.top + pad;
  const maxTop = stage.top + stage.height - pad - height;
  const fits = (r: RectLike) => r.top >= minTop && r.top <= maxTop && !avoid.some((a) => intersects(r, a));
  const candidates: Array<RectLike> = [{left, top: clamp(baseTop, minTop, maxTop), width, height}];
  for (let step = 1; step <= 6; step++) {
    candidates.push({left, top: baseTop + step * (height * 0.5), width, height});
    candidates.push({left, top: baseTop - step * (height * 0.5), width, height});
  }
  const seat = candidates.find(fits);
  if (seat !== undefined) {
    return seat;
  }
  const smallH = Math.min(height, stage.height * 0.3);
  const smallW = smallH / aspect;
  return {left: stage.left + stage.width - pad - smallW, top: stage.top + pad + slot * (smallH + gap), width: smallW, height: smallH};
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function intersects(a: RectLike, b: RectLike): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}
