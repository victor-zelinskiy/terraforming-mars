/*
 * colonyBuildModel — PURE, DOM-free vocabulary + math of the console COLONY
 * BUILD hero scene: the player's cube physically drops into the colony's
 * build slot while that slot's ONE-TIME build bonus floats up out of the cell
 * (resources materialize into chips and pay out on the left panel; a card
 * lifts into the reveal space) and the cube takes the bonus's place.
 *
 * Design contract (mirrors the tile-placement hero, one paragraph): after the
 * SERVER confirms the build (the viewer's cube appears in the colony's next
 * slot), the cube proxy descends into the live slot; slightly BEFORE it seats,
 * the slot's benefit glyph is DISPLACED upward (the "bonus is lifted out"
 * beat), hovers, and — post-commit — hands off to the shared Resource Transfer
 * chips that fly onto the panel (delta chip at each touchdown). A card bonus
 * (Pluto) instead lifts a card cover off the same cell via the board-card-bonus
 * cinematic. A bonus with no on-panel resource (TR / VP / a deferred pick / a
 * board follow-up) gets the same cube drop and NOT ONE extra millisecond.
 *
 * This module owns everything unit-testable: the phase vocabulary, the timing
 * constants, the build-bonus → transfer-spec extraction (stock/production
 * resources ONLY — cards keep their own cinematic, everything else rides the
 * ordinary commit), the card-bonus predicate, and the server-authoritative
 * build proof. GSAP lives in colonyBuildDirector; the transaction lifecycle in
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
 *  - the cube drop NEVER starts before the server proved the viewer's cube
 *    landed in the armed colony (`dropping` implies server success);
 *  - the real filled-cell cube paints only at commit (between `landed` and
 *    `rewarding`), under the settled proxy — never beside it;
 *  - the playerView commit happens under the panel reward hold, so the
 *    build bonus's delta chips fire only when their chips physically arrive;
 *  - a chip-less build goes `landed` → `done` with no reward beat.
 */
export type ColonyBuildPhase =
  | 'idle'
  | 'armed' // colony build submitted — nothing visual yet
  | 'dropping' // server success proven; the cube descends into the slot
  | 'landed' // touchdown + settle done; real cube painted under the proxy
  | 'rewarding' // post-commit: the build bonus materializes + pays out
  | 'done'
  | 'failed'; // refused build / stall — transaction unwound, zero trace

/** Timings (ms @ motion scale 1). The drop reads in ≈0.5 s; a resource
 *  build bonus adds a compact ≈0.8 s reward beat, a bare build adds NOTHING. */
export const CUBE_DROP_MS = 420;
export const CUBE_SETTLE_MS = 150;
/**
 * The benefit glyph is DISPLACED UPWARD as the cube descends — the "bonus is
 * lifted out of the cell" beat: the glyph proxy rises off the slot WHILE the
 * cube falls into it (they pass each other — the cube takes the vacated
 * place), hovers over the seated cube through the commit, and hands off to
 * its chips. The rise starts slightly BEFORE the cube seats (req: resources
 * rise a hair before the cube settles).
 */
export const GLYPH_PRELIFT_START_T = 0.42;
/** The rise duration (finishes ≈ at the cube's touchdown). */
export const GLYPH_RISE_MS = 240;
/** The hover height over the seated cube (px @ uiScale 1). */
export const GLYPH_HOVER_PX = 22;
/** The breath between the commit and the chip wave — the player reads the
 *  hovering bonus over the placed cube for one calm beat. */
export const HANDOFF_BREATH_MS = 90;
/** Reduced motion: one short controlled transition (the console 160 ms cap
 *  convention), same commit semantics. Raw ms — never preset-scaled. */
export const REDUCED_MS = 160;
/** A submit the server never answers can't strand the scene (arm net). */
export const ARM_SAFETY_MS = 12000;

export type BuildRect = {x: number, y: number, w: number, h: number};

/**
 * The build bonus a player receives for building into slot `slotIndex` of
 * this colony, expressed as Resource Transfer specs — but ONLY for the
 * on-panel resource channels (`stock` / `production`). Every other benefit
 * type (draw cards, TR, VP, add-to-card, tile placement, influence, …) has
 * NO panel chip and returns `[]` (the cube drops, nothing flies): cards keep
 * their own board-card-bonus cinematic, and the rest rides the ordinary
 * commit feedback / its own follow-up prompt.
 *
 * `amount` = the slot's own quantity (`build.quantity[slotIndex]`); this
 * mirrors the tile-placement hero which holds the PRINTED bonus amount, not
 * a post-tax delta (colony build resource bonuses are not taxed).
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
 * board-card-bonus cover can lift off the cell? ONLY `DRAW_CARDS` (Pluto):
 * its `DrawCards.keepAll(..., {source:{type:'colony',colonyName}})` tags the
 * reveal with a colony source the `colony-cell` scene matches. Terra's
 * `DRAW_EARTH_CARD` draws WITHOUT a reveal source, so it is deliberately NOT
 * card-lift eligible (cube-only).
 */
export function buildBonusIsCard(metadata: ColonyMetadata): boolean {
  return metadata.build.type === ColonyBenefit.DRAW_CARDS;
}

/**
 * The server-authoritative success proof: in this response the named colony
 * gained EXACTLY the viewer's cube as its newest settlement — i.e. it grew by
 * one and the added owner is the viewer. Returns the slot index the cube
 * landed in (the real, committed one), or undefined (a refused build / a
 * different colony / an opponent's build) → the scene unwinds with zero trace.
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
