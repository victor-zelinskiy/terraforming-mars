/*
 * aresAdjacencyFlights — the client half of the Ares adjacency PRESENTATION
 * MANIFEST (`AresAdjacencyGrantModel`, the `lastOceanBonus` pattern): the
 * server names WHICH neighbouring tile paid WHAT to WHOM; this module turns
 * one grant into the viewer's own transfer specs — each chip born at its
 * paying tile — and owns the once-only consumption ledger shared by the two
 * scenes that fly them (the own placement hero and the remote landing).
 *
 * Pure math + a bounded module ledger; no DOM, no Vue.
 */

import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {ResourceTransferSpec, cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

/** One chip of the adjacency beat: what flies, and off WHICH tile. */
export type AresAdjacencyFlight = {
  /** The paying neighbour's space — the chip's physical origin. */
  sourceSpaceId: SpaceId;
  spec: ResourceTransferSpec;
};

/** When the chip wave launches, relative to the beat's start: the source
 *  tile's wake has just reached the shared edge (there is no coin to form —
 *  the framework chip's own spawn IS the materialization). */
export const ARES_WAVE_LEAD_MS = 180;

/**
 * Everything THIS VIEWER physically receives from one grant, in manifest
 * order: the placer's own stock / single-target card resources (when the
 * viewer placed), plus the owner income of every paying tile the viewer
 * owns (their tile answers a NEIGHBOUR's placement — their own included).
 * Deferred prompts / draws / lost bonuses fly nothing here — each already
 * has its own honest surface.
 */
export function viewerAresAdjacencyFlights(
  grant: AresAdjacencyGrantModel,
  viewerColor: Color,
): Array<AresAdjacencyFlight> {
  const out: Array<AresAdjacencyFlight> = [];
  if (grant.placerColor === viewerColor) {
    for (const e of grant.grants) {
      if (e.delivery === 'stock' && e.resource !== undefined) {
        out.push({
          sourceSpaceId: e.sourceSpaceId,
          spec: {channel: 'stock', resource: e.resource, amount: 1},
        });
      } else if (e.delivery === 'card-resource' && e.cardResource !== undefined && e.targetCard !== undefined) {
        out.push({
          sourceSpaceId: e.sourceSpaceId,
          spec: {channel: 'card-resource', resource: cardResourceKey(e.cardResource), amount: 1, targetCard: e.targetCard},
        });
      }
    }
  }
  for (const p of grant.ownerPayouts) {
    if (p.ownerColor === viewerColor && p.megacredits > 0) {
      out.push({
        sourceSpaceId: p.sourceSpaceId,
        spec: {channel: 'stock', resource: 'megacredits', amount: p.megacredits},
      });
    }
  }
  return out;
}

/** The NEWEST grant caused by a placement on `spaceId` (an ocean cell can be
 *  paid twice in one game: the ocean itself, then the city covering it). */
export function latestAresGrantFor(
  grants: ReadonlyArray<AresAdjacencyGrantModel> | undefined,
  spaceId: string,
): AresAdjacencyGrantModel | undefined {
  if (grants === undefined) {
    return undefined;
  }
  let best: AresAdjacencyGrantModel | undefined;
  for (const g of grants) {
    if (g.spaceId === spaceId && (best === undefined || g.seq > best.seq)) {
      best = g;
    }
  }
  return best;
}

// ── the consumption ledger ──────────────────────────────────────────────────
// The manifest ring rides EVERY response, so a grant must fly at most once
// per client. Claimed at the scene that presents it (the own hero's detect /
// the remote staging); bounded so a long session can never leak.

const MAX_CLAIMS = 64;
const claimedSeqs = new Set<number>();

/** TRUE exactly once per grant — the caller that wins presents it. */
export function claimAresGrant(seq: number): boolean {
  if (claimedSeqs.has(seq)) {
    return false;
  }
  claimedSeqs.add(seq);
  if (claimedSeqs.size > MAX_CLAIMS) {
    const oldest = claimedSeqs.values().next().value;
    if (oldest !== undefined) {
      claimedSeqs.delete(oldest);
    }
  }
  return true;
}

/** Specs/unmount reset (module state is bundle-shared in mochapack). */
export function resetAresGrantClaims(): void {
  claimedSeqs.clear();
}
