/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the PURE half of the card-reaction
 * scene (Turmoil Redux TR80 Hartlan Heating, 2026-10-26; iteration 3 — «МЕСТО ·
 * ТЕМП · НЕПРЕРЫВНОСТЬ», the owner's field report of 2026-10-27; contract
 * `docs/claude/console/card-reaction.md`). No DOM, no GSAP — unit-tested under
 * the server runner like `intakeAssemblyPlan`.
 *
 * ── WHAT THE PLAYER SEES ───────────────────────────────────────────────────
 * The server says WHICH card's printed effect fired and WHAT it paid
 * (`GameModel.cardReactions` — one record per effect scope, in the order they
 * fired). The scene plays the record: the reacting card RISES — IN ITS PLACE
 * when its face stands anywhere on screen (the composer's hero, a target
 * miniature, the receiving stage, the start seat, the played table), else at
 * THE ONE STAGE: the centre of the central opening, at a protagonist's size —
 * its effect row lit for a READ beat, its tokens BORN on the printed icons of
 * that row, flying to where the resource lives, the counters TICKING on the
 * touchdown, the card RECEDING. One or two reactors play CALM; from three the
 * chain QUICKENS and overlaps on a row of slots under a wall-clock CEILING:
 * what cannot rise in time ticks at once and is named in ONE feed card.
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

/**
 * The rise primitive's numbers. TWO CLASSES (the owner, 2026-10-27 — «быстро» was meant for MANY effects; one reaction
 * must read calm and premium): CALM for one or two groups, QUICK from three — the assembly scene's numbers byte for
 * byte (ONE primitive, `cardReactionStage.riseReactor`).
 */
export type ReactionTempo = {
  /** The card rises (opacity 0 → 1, a lift from below, a hair of scale). */
  riseMs: number;
  /** …and stands a READ beat before its tokens are born — the effect row lit: the eye reads WHICH card and WHY. */
  holdMs: number;
  /** After its last token landed the card stands a beat more (the counter's delta lands under the eye). */
  settleMs: number;
  /** The card recedes after the settle. */
  recedeMs: number;
  /** The next group rises this long BEFORE the previous group's last landing. */
  overlapMs: number;
  /** Tokens of one group leave one after another by this much (a wave, never a burst). */
  staggerMs: number;
};

/** One or two reactors: calm — ≈ 2.2 s per card from the rise to the recede (the owner's choice, 2026-10-27). */
export const CALM_REACTION_TEMPO: Readonly<ReactionTempo> = {riseMs: 420, holdMs: 480, settleMs: 240, recedeMs: 320, overlapMs: 240, staggerMs: 90};
/** Three or more: quick, overlapping — the assembly scene's trigger numbers (`intakeAssemblyTimings`). */
export const QUICK_REACTION_TEMPO: Readonly<ReactionTempo> = {riseMs: 260, holdMs: 150, settleMs: 0, recedeMs: 220, overlapMs: 140, staggerMs: 60};
/** Reduced motion: a crossfade ≤ 160 ms, no tokens (the director ticks on the commit). */
export const REDUCED_REACTION_TEMPO: Readonly<ReactionTempo> = {riseMs: 140, holdMs: 60, settleMs: 0, recedeMs: 120, overlapMs: 60, staggerMs: 0};

/** From this many groups on the chain is QUICK and overlaps (the owner's decision 4; 2026-10-27: below it, calm). */
export const REACTION_MANY_GROUPS = 3;
export const REACTION_MANY_PACE = 1.35;

/** The tempo for a chain of `groups` reactors — calm for one or two, quick from `REACTION_MANY_GROUPS`. */
export function reactionTempo(groups = 1): ReactionTempo {
  return {...(groups >= REACTION_MANY_GROUPS ? QUICK_REACTION_TEMPO : CALM_REACTION_TEMPO)};
}

export function reducedReactionTempo(): ReactionTempo {
  return {...REDUCED_REACTION_TEMPO};
}

/**
 * A HURRY is a pace, never a cut (the owner, 2026-10-27): a press or a navigation while the chain plays makes what is
 * left play at this pace — every face still rises, every token still flies, the read beats shorten — and only a SECOND
 * hurry completes at once (the counters tick, the faces let go).
 */
export const REACTION_HURRY_PACE = 2.4;

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

export type ReactionFlightTempo = {
  /** A token's pop off its icon + its arc to the row (the transfer language's own numbers). */
  popMs: number;
  arcMs: number;
};

export type ReactionChainStep = {
  index: number;
  /** Which SLOT of the stage the group rises in (a row of slots from the second group on). */
  seat: number;
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
  /** How many slots of the stage the chain uses (≥ 1). */
  seats: number;
  totalMs: number;
};

export type ReactionChainOptions = {
  /** The slots the stage offers (its geometry — `reactionStageSlots`); default two from the second group on. */
  slots?: number;
  ceilingMs?: number;
};

/**
 * THE CHAIN — groups in the server's order, each rising `overlapMs` before the previous group's last landing on the
 * next free slot (two faces never share one box); from `REACTION_MANY_GROUPS` on the whole chain runs at
 * `REACTION_MANY_PACE`; a group whose rise would start past the ceiling is not risen at all (`summarized`). Pure — the
 * director plays the steps by EVENT (the previous group's last birth, the slot's recede), the plan's times are the
 * ceiling's arithmetic and the probe's reading.
 */
export function planReactionChain(
  groups: ReadonlyArray<{tokens: number}>,
  t: ReactionTempo,
  flight: ReactionFlightTempo,
  options?: number | ReactionChainOptions,
): ReactionChainPlan {
  const opts: ReactionChainOptions = typeof options === 'number' ? {ceilingMs: options} : (options ?? {});
  const ceilingMs = opts.ceilingMs ?? chainCeilingFor(groups.length);
  const many = groups.length >= REACTION_MANY_GROUPS;
  const pace = many ? REACTION_MANY_PACE : 1;
  // A second slot the moment there is a second group: the next card rises while the previous one is still landing,
  // and two faces never share one box. The PACE quickens only from MANY on.
  const seats = Math.max(1, Math.min(groups.length, opts.slots ?? (groups.length >= 2 ? 2 : 1)));
  const q = (ms: number) => Math.round(ms / pace);
  const steps: Array<ReactionChainStep> = [];
  const summarized: Array<number> = [];
  const seatFreeAt: Array<number> = new Array(seats).fill(0);
  let prevLandedMs = 0;
  groups.forEach((group, index) => {
    const seat = seats === 1 ? 0 : index % seats;
    const earliest = steps.length === 0 ? 0 : Math.max(0, prevLandedMs - t.overlapMs);
    const riseAtMs = Math.max(earliest, seatFreeAt[seat]);
    if (riseAtMs >= ceilingMs) {
      summarized.push(index);
      return;
    }
    const birthAtMs = riseAtMs + q(t.riseMs + t.holdMs);
    const tokens = Math.max(1, group.tokens);
    const landedAtMs = birthAtMs + q(flight.popMs + flight.arcMs + t.staggerMs * (tokens - 1));
    const recededAtMs = landedAtMs + q(t.settleMs + t.recedeMs);
    steps.push({index, seat, riseAtMs, birthAtMs, landedAtMs, recededAtMs});
    seatFreeAt[seat] = recededAtMs;
    prevLandedMs = landedAtMs;
  });
  return {steps, summarized, pace, seats, totalMs: steps.reduce((max, s) => Math.max(max, s.recededAtMs), 0)};
}

// ── THE ONE STAGE ──────────────────────────────────────────────────────────

/** The premium frame's aspect (320 × 460). */
export const REACTOR_ASPECT = 460 / 320;
/** A reactor at the stage stands at a protagonist's share of the opening's height (the receiving stage's PL-126 law). */
export const REACTION_STAGE_SHARE = 0.34;
/** …and never taller than the natural frame at the UI scale (a 4K opening would otherwise print a 700 px card). */
export const REACTOR_NATURAL_H = 460;
/** The row of slots at the stage is at most this wide. */
export const REACTION_STAGE_MAX_SLOTS = 3;
/** A RIVAL's reactor stands a step smaller than the viewer's own (its caption names the seat). */
export const REACTION_RIVAL_SCALE = 0.8;

export type ReactionStageOptions = {
  uiScale: number;
  /** The row's cap (the profile's — a handheld takes two). */
  maxSlots?: number;
  /** A face scale against the stage's own (a rival's `REACTION_RIVAL_SCALE`). */
  scale?: number;
  /**
   * THE RAIL'S EDGE (iteration 5 — the owner, 2026-10-27): the row STARTS at `left` (the free canvas's left edge — past
   * a hero column a workspace stands there; the director measures) and stands on the line `centreY` (the rail's
   * resource block — the director measures the rows). Either absent: the opening's own left edge / its vertical centre.
   */
  anchor?: {left?: number; centreY?: number};
};

/** The card's height at the stage: a share of the opening, capped at the natural frame × the UI scale. */
export function reactionStageHeight(opening: RectLike, opts: ReactionStageOptions): number {
  const h = Math.min(opening.height * REACTION_STAGE_SHARE, REACTOR_NATURAL_H * Math.max(0.5, opts.uiScale)) * (opts.scale ?? 1);
  return Math.max(80, Math.round(h));
}

/**
 * WHERE A REACTOR RISES when its own face is not on screen — AT THE RAIL'S EDGE (the owner, 2026-10-27, iteration 5:
 * every destination of a reaction stands on that side — the rail's rows, the score cell, the satellite, a rival's
 * chip in the strip — so the flight is short and the cause stands beside its effect; the centre of the opening, the
 * one place of iteration 3, put the card over the board where the tile had just landed and sent every token across
 * the planet). ONE place in every state: `n` groups take a ROW of up to `maxSlots` card-shaped slots growing
 * RIGHTWARDS from the free canvas's left edge (`anchor.left` — past a hero column a workspace stands at the band's
 * edge), on the rail's resource line (`anchor.centreY`), clamped inside the opening; the chain plays them left to
 * right. Pure, so the geometry is a tested fact; the director measures the opening, the rail and the edge.
 */
export function reactionStageSlots(opening: RectLike, n: number, opts: ReactionStageOptions): Array<RectLike> {
  const height = reactionStageHeight(opening, opts);
  const width = Math.round(height / REACTOR_ASPECT);
  const gap = Math.max(12, Math.round(height * 0.08));
  const pad = Math.max(8, opening.width * 0.012);
  const vpad = Math.max(8, opening.height * 0.012);
  const right = opening.left + opening.width - pad;
  const left0 = Math.max(opening.left + pad, Math.min(opts.anchor?.left ?? (opening.left + pad), right - width));
  const fit = Math.max(1, Math.floor((right - left0 + gap) / (width + gap)));
  const count = Math.max(1, Math.min(n, opts.maxSlots ?? REACTION_STAGE_MAX_SLOTS, fit));
  const centreY = opts.anchor?.centreY ?? (opening.top + opening.height / 2);
  const top = Math.max(opening.top + vpad, Math.min(centreY - height / 2, opening.top + opening.height - height - vpad));
  const out: Array<RectLike> = [];
  for (let i = 0; i < count; i++) {
    out.push({left: Math.round(left0 + i * (width + gap)), top: Math.round(top), width, height});
  }
  return out;
}
