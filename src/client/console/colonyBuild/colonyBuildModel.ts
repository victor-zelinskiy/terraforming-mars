/*
 * colonyBuildModel — PURE, DOM-free vocabulary + math of the console COLONY
 * BUILD hero scene: the player's cube physically settles into the colony's
 * build slot AFTER that slot's ONE-TIME build bonus has left it (resources fly
 * to the panel / a card lifts into the reveal space), so the cube and the
 * bonus NEVER occupy the same area — the cube simply takes the vacated place.
 *
 * Design contract (the "bonus frees the slot → cube takes it" sequence): the
 * cube — the SAME premium 3D `PlayerCube` token the main board uses — flies in
 * to a WAITING hover just above the slot at its FINAL size (never re-scaled in
 * flight); the build bonus lifts out and leaves the slot; only once it has
 * CLEARED the slot does the cube drop under gravity into the exact centre it
 * will keep as the permanent colony marker. The landing is a PHYSICAL contact
 * beat — a base-anchored micro-squash that recovers to exactly 1, the ground
 * shadow tightening through the fall and spreading at impact, the token glow
 * igniting on contact — never a size jump or an object swap: it is ONE cube
 * throughout, and the handoff onto the real committed cube is pixel-identical
 * (same component, size and centre) so there is no visible replacement.
 *
 * This module owns everything unit-testable: the phase vocabulary, the timing
 * constants, the build-bonus → transfer-spec extraction (stock/production
 * resources ONLY — cards keep their own cinematic, everything else rides the
 * ordinary commit), the card-bonus predicate, and the server-authoritative
 * build proof. GSAP lives in colonyBuildDirector; the lifecycle in
 * consoleColonyBuild.
 */

import {Color} from '@/common/Color';
import {Resource} from '@/common/Resource';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/**
 * The explicit, observable lifecycle of ONE colony-build transaction:
 *  - the cube NEVER moves before the server proved the viewer's cube landed;
 *  - the cube WAITS above the slot while the bonus leaves it;
 *  - it DESCENDS only after the bonus has cleared the slot;
 *  - the real filled-cell cube paints at commit (between `landed` and `done`),
 *    pixel-identical under the settled proxy — never beside/under it early.
 */
export type ColonyBuildPhase =
  | 'idle'
  | 'armed' // colony build submitted — nothing visual yet
  | 'waiting' // server success proven; the cube hovers above the slot
  | 'descending' // the bonus cleared the slot; the cube settles into it
  | 'landed' // touchdown done; real cube painted under the proxy at commit
  | 'done'
  | 'failed'; // refused build / stall — transaction unwound, zero trace

/** How far above the slot (× slot height) the cube waits while the bonus leaves. */
export const CUBE_WAIT_LIFT_FACTOR = 1.35;
/** Extra height (× slot height) the cube starts above its waiting pose so it
 *  visibly FLIES IN to the waiting position (never a pop-in). */
export const CUBE_APPROACH_EXTRA_FACTOR = 0.6;
/** Timings (ms @ motion scale 1). The whole build reads in ≈1 s. */
export const CUBE_APPROACH_MS = 240;
/** How long the bonus needs to clear the slot before the cube may descend
 *  (the descent + the bonus flight may overlap — but never in the SAME area). */
export const BONUS_CLEAR_MS = 240;
/** The drop: a small pick-up anticipation, then a gravity-accelerated fall
 *  from the waiting pose to contact at the slot centre. */
export const CUBE_DESCENT_MS = 380;
/** The contact beat after touchdown: base-anchored micro-squash → recover to
 *  exactly 1, shadow spread, glow ignition, impact ring — to FULL visual rest
 *  (the commit gate only opens once this has finished, so the one-frame
 *  handoff always lands on a motionless cube). */
export const CUBE_SETTLE_MS = 300;
/** Reduced motion: one short controlled transition (the console 160 ms cap
 *  convention), same commit semantics. Raw ms — never preset-scaled. */
export const REDUCED_MS = 160;
/** A submit the server never answers can't strand the scene (arm net). */
export const ARM_SAFETY_MS = 12000;

/**
 * The colony marker is the SAME premium 3D `PlayerCube` token the main board
 * uses for tile ownership — never a flat colour fill. Its footprint is SHARED
 * by the STATIC in-cell cube (`CUBE_STATIC_SIZE` logical px inside the 2.3rem
 * = 46 logical-px build cell, riding the `--con-ui-scale` zoom channel like
 * the sibling benefit glyph) and the build hero's FLYING proxy (measured
 * slot-rect height × `CUBE_SLOT_F`, already in real screen px) — the two
 * therefore render identical at any TV zoom / tile fit-scale and the
 * post-landing one-frame handoff is invisible. The cube deliberately does NOT
 * fill the cell: clear air around it keeps the seating slot's depth readable.
 */
export const CUBE_STATIC_SIZE = 32;
export const CUBE_SLOT_F = CUBE_STATIC_SIZE / 46;

export type BuildRect = {x: number, y: number, w: number, h: number};

/** How the slot's build bonus LEAVES the slot before the cube descends. */
export type BonusExitMode =
  /** A resource flies to the panel as a physical chip (stock / production). */
  | 'resource'
  /** A card lifts off the slot into the reveal space (Pluto DRAW_CARDS). */
  | 'card'
  /** No on-screen destination (TR / VP / add-to-card / a board follow-up) —
   *  the glyph is simply vacated as the cube takes the cell. */
  | 'none';

/**
 * The build bonus a player receives for building into slot `slotIndex`, as
 * Resource Transfer specs — but ONLY for the on-panel resource channels
 * (`stock` / `production`). Every other benefit type returns `[]` (see
 * `buildBonusMode`). `amount` = the slot's own quantity.
 */
export function buildRewardSpecs(metadata: ColonyMetadata, slotIndex: number): Array<ResourceTransferSpec> {
  const build = metadata.build;
  const amount = build.quantity[slotIndex] ?? 0;
  if (amount <= 0) {
    return [];
  }
  const resource = build.resource;
  if (resource === undefined) {
    return [];
  }
  const key = (resource as Resource).toString();
  if (build.type === ColonyBenefit.GAIN_RESOURCES) {
    return [{channel: 'stock', resource: key, amount}];
  }
  if (build.type === ColonyBenefit.GAIN_PRODUCTION) {
    return [{channel: 'production', resource: key, amount}];
  }
  return [];
}

/**
 * Does this colony's BUILD bonus grant a card that surfaces as a reveal the
 * board-card-bonus cover can lift off the cell? ONLY `DRAW_CARDS` (Pluto);
 * Terra's `DRAW_EARTH_CARD` draws WITHOUT a reveal source, so it is NOT
 * card-lift eligible.
 */
export function buildBonusIsCard(metadata: ColonyMetadata): boolean {
  return metadata.build.type === ColonyBenefit.DRAW_CARDS;
}

/** How the slot's bonus leaves — drives the run choreography. */
export function buildBonusMode(metadata: ColonyMetadata, slotIndex: number): BonusExitMode {
  if (buildBonusIsCard(metadata)) {
    return 'card';
  }
  return buildRewardSpecs(metadata, slotIndex).length > 0 ? 'resource' : 'none';
}

/**
 * The server-authoritative success proof: in this response the named colony
 * gained EXACTLY the viewer's cube as its newest settlement. Returns the slot
 * index the cube landed in, or undefined (a refused build / a different colony
 * / an opponent's build) → the scene unwinds with zero trace.
 */
export function verifyColonyBuild(
  prevColonies: ReadonlyArray<ColonyModel>,
  newColonies: ReadonlyArray<ColonyModel>,
  colonyName: string,
  viewerColor: Color,
): {slotIndex: number} | undefined {
  const prev = prevColonies.find((c) => c.name === colonyName);
  const next = newColonies.find((c) => c.name === colonyName);
  if (prev === undefined || next === undefined) {
    return undefined;
  }
  if (next.colonies.length !== prev.colonies.length + 1) {
    return undefined;
  }
  const slotIndex = prev.colonies.length;
  if (next.colonies[slotIndex] !== viewerColor) {
    return undefined;
  }
  return {slotIndex};
}
