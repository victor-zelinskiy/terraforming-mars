/*
 * PURE response builders for console tasks — CTS T1 (§CTS-3.3: submission
 * BYTE-PARITY). Every builder produces exactly the payload the desktop
 * premium input would POST for the same choice; guarded by
 * tests/client/components/console/taskResponses.spec.ts.
 */

import {Units} from '@/common/Units';
import {Color} from '@/common/Color';

export function emptyUnits(): Units {
  return {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
}

export const STANDARD_UNITS: ReadonlyArray<keyof Units> =
  ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/** A leaf SelectOption confirm. */
export function optionConfirmResponse(): {type: 'option'} {
  return {type: 'option'};
}

/** Pick option `index` of a top-level OrOptions (leaf confirm inside). */
export function orOptionResponse(index: number): unknown {
  return {type: 'or' as const, index, response: {type: 'option' as const}};
}

/** Wrap ANY inner response as option `index` of a top-level OrOptions. */
export function orWrappedResponse(index: number, inner: unknown): unknown {
  return {type: 'or' as const, index, response: inner};
}

export function playerResponse(player: Color | 'NEUTRAL'): {type: 'player', player: Color | 'NEUTRAL'} {
  return {type: 'player', player};
}

export function amountResponse(amount: number): {type: 'amount', amount: number} {
  return {type: 'amount', amount};
}

/** The Hydronetwork stepper variant of the amount family. */
export function deltaProjectResponse(amount: number): {type: 'deltaProject', amount: number} {
  return {type: 'deltaProject', amount};
}

export function resourceResponse(resource: keyof Units): {type: 'resource', resource: keyof Units} {
  return {type: 'resource', resource};
}

/** Full-Units payload from a (possibly partial) lane map. */
export function unitsFrom(partial: Partial<Record<keyof Units, number>>): Units {
  const units = emptyUnits();
  for (const key of STANDARD_UNITS) {
    units[key] = partial[key] ?? 0;
  }
  return units;
}

export function resourcesResponse(partial: Partial<Record<keyof Units, number>>): {type: 'resources', units: Units} {
  return {type: 'resources', units: unitsFrom(partial)};
}

export function productionToLoseResponse(partial: Partial<Record<keyof Units, number>>): {type: 'productionToLose', units: Units} {
  return {type: 'productionToLose', units: unitsFrom(partial)};
}
