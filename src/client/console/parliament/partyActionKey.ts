/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PARTY ACTION'S KEY (Turmoil Redux) — the ONE string a party stands
 * under wherever the action machinery expects a CARD NAME: the action
 * centre's tile / group key, the workspace descent draft, the outcome
 * claim's `sourceCard`, the frame subject.
 *
 * A tiny module of its own (no imports beyond a type) on purpose: the claim
 * predicate (`consoleWorkspaceOutcome`) and the action model
 * (`consoleCardActions`) both read it, and neither may import the other.
 */
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';

export const PARTY_TILE_PREFIX = 'PARTY_';
/** …and the ENACTED RESOLUTION'S action stands under its own prefix (Open IP Trade — the party action's twin). */
export const RESOLUTION_TILE_PREFIX = 'RESOLUTION_';

/** The tile / claim KEY of a party (a DOM address + focus id; never a CardName lookup). */
export function partyTileKey(party: ReduxParty | PartyName): string {
  return PARTY_TILE_PREFIX + party;
}

/** The party behind a key, or undefined for a card's. */
export function partyOfTileKey(key: string): ReduxParty | undefined {
  return key.startsWith(PARTY_TILE_PREFIX) ? key.substring(PARTY_TILE_PREFIX.length) as ReduxParty : undefined;
}

/** The tile / claim KEY of the enacted resolution's ACTION (a DOM address + focus id; never a manifest lookup). */
export function resolutionTileKey(resolution: ResolutionId): string {
  return RESOLUTION_TILE_PREFIX + resolution;
}

/** The resolution behind a key, or undefined for a card's / a party's. */
export function resolutionOfTileKey(key: string): ResolutionId | undefined {
  return key.startsWith(RESOLUTION_TILE_PREFIX) ? key.substring(RESOLUTION_TILE_PREFIX.length) : undefined;
}
