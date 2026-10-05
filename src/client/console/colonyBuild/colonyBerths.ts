import {Color} from '@/common/Color';
import {ColonyModel} from '@/common/models/ColonyModel';
import {buildBenefitAt, ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyBuildSite} from '@/common/colonies/ColonyBuildSite';
import {berthCount, berthIsOverLimit, printedBerths} from '@/common/colonies/colonyBerths';

/*
 * THE BERTHS OF A COLONY TILE, AS EVERY CONSOLE SURFACE DRAWS THEM — one pure
 * model, three hosts (the grid tile, the trade-track instrument of the stage
 * and the dossier, the legacy chip popover).
 *
 * A tile prints three berths, and for years every surface drew exactly three
 * (`v-for="idx in [0, 1, 2]"`) and aimed a build at `Math.min(cubes, 2)`. A
 * colony placed BEYOND THE PRINTED LIMIT (Turmoil Redux TR25 Exclusive Colony)
 * stands on the track's fourth cell — so a surface that hard-codes three
 * neither draws the fourth cube nor publishes the seat its build flies to.
 *
 * So the number of places is ARITHMETIC over the cubes and the door's
 * projection (`common/colonies/colonyBerths.ts` — the server's own functions),
 * and the berth a build lands in is the SERVER's (`ColonyBuildSite.slot`, the
 * `buildSites` marker of the pick), never a clamp. A surface that needs a
 * berth asks here; a literal list or a clamp in a colony surface fails the
 * guard (`tests/console/colonyBerths.spec.ts`).
 *
 * docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md § the places.
 */

export type ColonyBerthState =
  /** Nothing stands here and nothing is projected: the seat shows the build bonus it would pay. */
  | 'empty'
  /** A colony's cube stands here. */
  | 'taken'
  /** A build door projects its cube here (the ghost — nothing is built yet). */
  | 'projected';

export type ColonyBerth = {
  /** 0-based — berth `i` stands under track cell `i`. */
  index: number,
  /** Whose cube stands here (`taken` only). */
  owner?: Color,
  state: ColonyBerthState,
  /** The berth lies beyond the printed ones — it exists only where a cube stands or is projected there. */
  overLimit: boolean,
};

/** Where a build door projects its cube (the pick's `ColonyBuildSite`, or a roster build's berth). */
export type ColonyBerthProjection = {slot: number};

/**
 * The tile's berths, left to right: the printed ones, every cube that stands,
 * and the berth a door projects a cube into. An ordinary tile reads exactly
 * the three it always did.
 */
export function colonyBerthsOf(colony: Pick<ColonyModel, 'colonies'>, projection?: ColonyBerthProjection): Array<ColonyBerth> {
  const count = berthCount(colony.colonies.length, projection?.slot);
  const berths: Array<ColonyBerth> = [];
  for (let index = 0; index < count; index++) {
    const owner = colony.colonies[index];
    const berth: ColonyBerth = {
      index,
      state: owner !== undefined ? 'taken' : (projection?.slot === index ? 'projected' : 'empty'),
      overLimit: berthIsOverLimit(index),
    };
    if (owner !== undefined) {
      berth.owner = owner;
    }
    berths.push(berth);
  }
  return berths;
}

/**
 * THE BERTH A BUILD LANDS IN — the server's projection when a build door
 * stands (`site`), else the number of cubes (the next berth, wherever that
 * is). Never clamped: a tile at its printed limit answers the fourth berth,
 * which is exactly where its next cube would stand.
 */
export function nextBuildSlot(colony: Pick<ColonyModel, 'colonies'>, site?: Pick<ColonyBuildSite, 'slot'>): number {
  return site?.slot ?? colony.colonies.length;
}

/** How many PRINTED berths are still free — the grid rail's «Свободно мест» (never negative on a tile built on beyond the limit). */
export function freeBerths(colony: Pick<ColonyModel, 'colonies'>): number {
  return Math.max(0, printedBerths() - colony.colonies.length);
}

/** The marker's entry for one tile — `undefined` when no build door stands, or the tile is not its candidate. */
export function buildSiteOf(sites: ReadonlyArray<ColonyBuildSite> | undefined, colony: string): ColonyBuildSite | undefined {
  return sites?.find((site) => site.colony === colony);
}

/** A benefit in the shape `BenefitGlyph` draws (`quantity` is a list it indexes). */
export type BerthBenefit = {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown};

/**
 * THE BUILD BONUS OF ONE BERTH, RESOLVED — what a glyph in that berth draws.
 * The quantity is a list of ONE (read it with `idx: 0`): the glyph is never
 * handed the tile's whole row and an index that may lie past its end.
 */
export function berthBuildBenefit(metadata: Pick<ColonyMetadata, 'build'>, slot: number): BerthBenefit {
  const bonus = buildBenefitAt(metadata, slot);
  return {type: bonus.type, quantity: [bonus.quantity], resource: bonus.resource};
}
