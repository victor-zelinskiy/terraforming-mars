/*
 * receivingStageModel — PURE, DOM-free composition math for the PLAYED TABLEAU
 * RECEIVING & EFFECT RESOLUTION STAGE: the specialized final scene of the Card
 * Play Workspace (iteration 2 of the workspace landing).
 *
 * WHY A SPECIALIZED SCENE AND NOT THE EMBEDDED OVERVIEW. The full «Разыграно»
 * layout answers «what has this player played?» — five equal columns, real
 * piles, scroll. The landing needs to answer a different question: «where does
 * THIS card physically go, and where does its effect then arrive?». So the
 * stage composes around exactly that:
 *
 *   - the DESTINATION STACK is the protagonist: large, centred, top-anchored,
 *     with a normalized overlap (a capped strip column + the open top card)
 *     and a RESERVED FRONT ANCHOR the new card lands into;
 *   - every other family is a COMPACT MINI: caption + count + a couple of
 *     title strips — peripheral tabletop context, never content columns;
 *   - the TOP CARD HANDOFF is geometric, not animated re-layout: the final
 *     stack silhouette (strips + the previous top's future strip + the front
 *     card) is laid out from the first frame; before the dock the previous
 *     top simply OVERFLOWS its strip downward (it is still the open card),
 *     and the arriving card covers it back to a strip — nothing ever moves;
 *   - effect targets (a card in this stack, a mini family, another player's
 *     card) are located by the same strip identity, emerge from it and
 *     return into it.
 *
 * All px knobs are authored for the 1080p logical space and multiplied by
 * `uiScale` (conUiScale()), mirroring the sibling planners.
 */

import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayedZones, PLAYED_CARD_NATURAL_W, PLAYED_CARD_NATURAL_H, PLAYED_PEEK_NATURAL} from '@/client/components/console/consolePlayedModel';
import {PlayedCategoryKey} from '@/client/components/console/consolePlayedCategoryModel';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

export {PLAYED_CARD_NATURAL_W, PLAYED_CARD_NATURAL_H, PLAYED_PEEK_NATURAL};

/**
 * The DESTINATION family of a card being played — resolved from its manifest
 * TYPE, never from tableau membership: before the commit the card is not in
 * the tableau at all, and the destination must be known from the arm.
 */
export function familyForCardType(type: CardType | undefined): PlayedCategoryKey | undefined {
  switch (type) {
  case CardType.CORPORATION: return 'corporation';
  case CardType.PRELUDE: return 'prelude';
  case CardType.CEO: return 'ceo';
  case CardType.ACTIVE: return 'active';
  case CardType.AUTOMATED: return 'automated';
  case CardType.EVENT: return 'events';
  default: return undefined;
  }
}

/** The zone a tableau card belongs to (structural, via the built zones). */
export function receivingFamilyOf(zones: PlayedZones, name: string): PlayedCategoryKey | undefined {
  if (zones.events.some((c) => c.name === name)) {
    return 'events';
  }
  if (zones.corporations.some((c) => c.name === name)) {
    return 'corporation';
  }
  if (zones.preludes.some((c) => c.name === name)) {
    return 'prelude';
  }
  if (zones.ceos.some((c) => c.name === name)) {
    return 'ceo';
  }
  if (zones.active.some((c) => c.name === name)) {
    return 'active';
  }
  if (zones.automated.some((c) => c.name === name)) {
    return 'automated';
  }
  return undefined;
}

export function zoneCards(zones: PlayedZones, key: PlayedCategoryKey): ReadonlyArray<CardModel> {
  switch (key) {
  case 'corporation': return zones.corporations;
  case 'prelude': return zones.preludes;
  case 'ceo': return zones.ceos;
  case 'active': return zones.active;
  case 'automated': return zones.automated;
  case 'events': return zones.events;
  }
}

// ── the destination stack view ──────────────────────────────────────────────

/**
 * The stack as the scene renders it. STABLE ACROSS THE COMMIT by
 * construction: the incoming card is excluded from the lying cards whether or
 * not the authoritative tableau already carries it, so the strips and the
 * previous top never change identity mid-scene — the only thing that happens
 * at the reveal is the front anchor gaining its occupant.
 */
export type ReceivingStackView = {
  /** Cards older than the visible strips — drawn as thin depth slivers. */
  hiddenCount: number;
  /** Visible title strips, oldest → newest (the previous top NOT included). */
  strips: ReadonlyArray<CardName>;
  /** The card lying OPEN on top before the dock (undefined — empty stack).
   *  Its future strip position is part of the final silhouette; until the
   *  reveal it overflows that strip downward as the full open card. */
  prevTop?: CardName;
};

export function receivingStackView(
  cards: ReadonlyArray<CardModel>,
  incoming: CardName,
  maxStrips: number,
): ReceivingStackView {
  const lying = cards.filter((c) => c.name !== incoming);
  const prevTop = lying.length > 0 ? (lying[lying.length - 1].name as CardName) : undefined;
  const rest = lying.slice(0, Math.max(0, lying.length - 1));
  const strips = rest.slice(Math.max(0, rest.length - maxStrips)).map((c) => c.name as CardName);
  return {
    hiddenCount: rest.length - strips.length,
    strips,
    prevTop,
  };
}

// ── the layout plan ─────────────────────────────────────────────────────────

/** Depth sliver height (px @ uiScale 1) for cards beyond the strip cap. */
export const RECEIVING_DEPTH_SLIVER = 5;
/** Chrome above the stack (caption row), logical px. */
const STACK_CAPTION_H = 40;
/** The mini row's reserve at the stage bottom (caption + strips), logical px. */
const MINI_ROW_H = 128;
/** Breathing room around the stack column, logical px. */
const STACK_AIR = 26;
/** The destination zoom ladder — largest that fits wins. */
const ZOOM_LADDER = [0.68, 0.63, 0.58, 0.53, 0.48];
/** Visible strip cap — enough history to read the stack, never a column. */
export const RECEIVING_MAX_STRIPS = 5;
/** The mini strips' fixed zoom (title bands only — no art ever loads). */
const MINI_ZOOM = 0.30;

export interface ReceivingPlanInput {
  /** Stage box (screen px). */
  availW: number;
  availH: number;
  /** Cards lying in the destination BEFORE the play (excl. incoming). */
  stackCount: number;
  /** conUiScale() — 1 on non-tv profiles. */
  uiScale?: number;
}

export interface ReceivingPlan {
  /** Destination card zoom (CSS `zoom` on the faces). */
  zoom: number;
  slotW: number;
  cardH: number;
  stripH: number;
  /** How many strips (above the previous top) may show. */
  maxStrips: number;
  /** Depth sliver height (screen px). */
  sliverH: number;
  /** Mini families: face zoom + box metrics (screen px). */
  miniZoom: number;
  miniW: number;
  miniStripH: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Plan the stage. The stack column is TOP-ANCHORED and must fit whole
 * (caption + slivers + strips + the previous top's strip + the open card)
 * inside the box above the mini row — the fit knob is first the strip count,
 * then the zoom ladder. Deterministic; unit-guarded for monotonicity.
 */
export function planReceivingStage(input: ReceivingPlanInput): ReceivingPlan {
  const s = input.uiScale !== undefined && input.uiScale > 0 ? input.uiScale : 1;
  const budget = Math.max(220 * s, input.availH - (MINI_ROW_H + STACK_CAPTION_H + STACK_AIR) * s);
  const wantStrips = clamp(0, RECEIVING_MAX_STRIPS, input.stackCount - 1);
  const sliverH = Math.round(RECEIVING_DEPTH_SLIVER * s);
  const slivers = input.stackCount - 1 > wantStrips ? 2 * sliverH : 0;

  let zoom = ZOOM_LADDER[ZOOM_LADDER.length - 1] * s;
  let maxStrips = 0;
  for (const step of ZOOM_LADDER) {
    const z = step * s;
    const cardH = PLAYED_CARD_NATURAL_H * z;
    const stripH = PLAYED_PEEK_NATURAL * z;
    // prev top occupies ONE strip slot; the front card the full height.
    const prevStrip = input.stackCount > 0 ? stripH : 0;
    const fit = Math.floor((budget - cardH - prevStrip - slivers) / stripH);
    if (fit >= wantStrips) {
      zoom = z;
      maxStrips = wantStrips;
      break;
    }
    // The largest zoom that still shows at least a couple of strips wins over
    // a smaller zoom with full history — the stack is a scene, not a browser.
    const partial = clamp(0, wantStrips, fit);
    if (partial >= 2 || wantStrips < 2) {
      zoom = z;
      maxStrips = partial;
      break;
    }
    zoom = z;
    maxStrips = clamp(0, wantStrips, Math.max(0, fit));
  }
  return {
    zoom,
    slotW: PLAYED_CARD_NATURAL_W * zoom,
    cardH: PLAYED_CARD_NATURAL_H * zoom,
    stripH: PLAYED_PEEK_NATURAL * zoom,
    maxStrips,
    sliverH,
    miniZoom: MINI_ZOOM * s,
    miniW: Math.round(PLAYED_CARD_NATURAL_W * MINI_ZOOM * s),
    miniStripH: Math.round(PLAYED_PEEK_NATURAL * MINI_ZOOM * s),
  };
}

// ── the compact helper minis ────────────────────────────────────────────────

export type ReceivingMini = {
  /** DOM key — family, or family + owner colour for a foreign tableau. */
  id: string;
  family: PlayedCategoryKey;
  count: number;
  /** Newest-last title strips to draw (≤ 2; empty for events). */
  topNames: ReadonlyArray<CardName>;
  isEvents: boolean;
  /** Present on a FOREIGN owner's mini (an effect target's tableau). */
  ownerColor?: Color;
  ownerName?: string;
};

const FAMILY_ORDER: ReadonlyArray<PlayedCategoryKey> =
  ['corporation', 'prelude', 'ceo', 'active', 'automated', 'events'];

/** The viewer's peripheral families — every non-empty family EXCEPT the
 *  destination, in canonical table order. */
export function receivingMinis(zones: PlayedZones, destination: PlayedCategoryKey): ReadonlyArray<ReceivingMini> {
  const out: Array<ReceivingMini> = [];
  for (const key of FAMILY_ORDER) {
    if (key === destination) {
      continue;
    }
    const cards = zoneCards(zones, key);
    if (cards.length === 0) {
      continue;
    }
    out.push({
      id: key,
      family: key,
      count: cards.length,
      topNames: key === 'events' ? [] : cards.slice(-2).map((c) => c.name as CardName),
      isEvents: key === 'events',
    });
  }
  return out;
}

/**
 * Minis for FOREIGN effect targets: one per (owner, family) that holds a
 * target card — the other player's tableau enters the scene as the same
 * compact primitive, named and colour-marked. Prepared at prewarm (targets
 * are known at arm), so a foreign delivery never mounts UI mid-flight.
 */
export function foreignTargetMinis(
  players: ReadonlyArray<PublicPlayerModel>,
  viewerColor: Color,
  targets: ReadonlyArray<CardName>,
  zonesOf: (tableau: ReadonlyArray<CardModel>) => PlayedZones,
): ReadonlyArray<ReceivingMini> {
  const out: Array<ReceivingMini> = [];
  for (const p of players) {
    if (p.color === viewerColor) {
      continue;
    }
    const owned = targets.filter((t) => p.tableau.some((c) => c.name === t));
    if (owned.length === 0) {
      continue;
    }
    const zones = zonesOf(p.tableau);
    const families = new Set<PlayedCategoryKey>();
    for (const t of owned) {
      const fam = receivingFamilyOf(zones, t);
      if (fam !== undefined) {
        families.add(fam);
      }
    }
    for (const fam of FAMILY_ORDER) {
      if (!families.has(fam)) {
        continue;
      }
      const cards = zoneCards(zones, fam);
      out.push({
        id: `${fam}:${p.color}`,
        family: fam,
        count: cards.length,
        topNames: fam === 'events' ? [] : cards.slice(-2).map((c) => c.name as CardName),
        isEvents: fam === 'events',
        ownerColor: p.color,
        ownerName: p.name,
      });
    }
  }
  return out;
}

// ── effect delivery grouping ────────────────────────────────────────────────

export type CardTargetGroup = {
  target: CardName;
  specs: ReadonlyArray<ResourceTransferSpec>;
  /** The target IS the newly played card (no emergence — it is the front). */
  self: boolean;
};

/** Split a play's reward wave into the RAIL half (stock / production — the
 *  left panel) and the CARD half (resources landing on physical cards). */
export function splitPlayRewards(specs: ReadonlyArray<ResourceTransferSpec>): {
  railSpecs: ReadonlyArray<ResourceTransferSpec>,
  cardSpecs: ReadonlyArray<ResourceTransferSpec>,
} {
  const railSpecs = specs.filter((s) => s.channel !== 'card-resource');
  const cardSpecs = specs.filter((s) => s.channel === 'card-resource' && s.targetCard !== undefined);
  return {railSpecs, cardSpecs};
}

/** Group the card half by physical target, SELF first (the front card is
 *  already the protagonist — its own gain is the natural opening beat),
 *  then the other targets in first-seen order. */
export function cardTargetGroups(
  cardSpecs: ReadonlyArray<ResourceTransferSpec>,
  playedCard: CardName,
): ReadonlyArray<CardTargetGroup> {
  const order: Array<CardName> = [];
  const byTarget = new Map<CardName, Array<ResourceTransferSpec>>();
  for (const spec of cardSpecs) {
    const target = spec.targetCard;
    if (target === undefined) {
      continue;
    }
    if (!byTarget.has(target)) {
      byTarget.set(target, []);
      order.push(target);
    }
    byTarget.get(target)?.push(spec);
  }
  order.sort((a, b) => Number(b === playedCard) - Number(a === playedCard));
  return order.map((target) => ({
    target,
    specs: byTarget.get(target) ?? [],
    self: target === playedCard,
  }));
}
