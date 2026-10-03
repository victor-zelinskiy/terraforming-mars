import {ColonyName} from './ColonyName';

/**
 * THE COLONY ROSTER — which colony TILES are in the game, and in which slot.
 *
 * A tile enters the game (Aridor's first action, MarsBot's C30 setup), leaves
 * it (the solo setup trim) or is REPLACED in its slot (Turmoil Redux TR10
 * Fringe Colony). All three are one fact with one writer on the server
 * (`ColoniesHandler.seatColonyTile` / `retireColonyTile` / `replaceColonyTile`)
 * and one typed event (`colony-roster-changed`), so the journal, a rival's
 * notification and the console's roster ceremony read the SAME change and
 * never infer it from a diff of two lists.
 */

/**
 * WHAT CHANGED (`colony-roster-changed`, `impact.colonyRoster`):
 *  · `add`     — `added` entered the game and stands at index `slot` of the
 *                table (the engine keeps an added tile sorted by name);
 *  · `remove`  — `removed` left the game from index `slot` (the tiles after it
 *                closed the gap);
 *  · `replace` — `removed` left and `added` took ITS slot (`slot` is the same
 *                index before and after; no other tile moved).
 */
export type ColonyRosterChange = {
  kind: 'add' | 'remove' | 'replace';
  removed?: ColonyName;
  added?: ColonyName;
  slot: number;
};

/** One tile in play as a candidate to LEAVE — `reason` (an English i18n key) when it cannot. */
export type ColonyRosterOutgoing = {
  colony: ColonyName;
  reason?: string;
};

/**
 * WHAT A COLONY THE EFFECT BUILDS ON THE INCOMING TILE WOULD DO: it lands in
 * `slot` (0-based — the tile is fresh, so always its first berth), or it is
 * `skipped` with the ONE reason the build's own rule gives (the tile enters
 * inactive; the TR of its build bonus cannot be afforded).
 */
export type ColonyRosterBuild = {slot: number} | {skipped: string};

/** One reserve tile as a candidate to ENTER — the server's projection of what entering would mean. */
export type ColonyRosterIncoming = {
  colony: ColonyName;
  /**
   * Would the tile be ACTIVE the moment it entered (`ColoniesHandler.colonyTileWillEnterActive`)?
   * NEVER the catalog model's `isActive`: a tile shown as a bare tile
   * (`showTileOnly`) is serialized inactive whatever it is.
   */
  entersActive: boolean;
  /** Present only when the effect ALSO builds a colony on the entering tile (TR10). */
  build?: ColonyRosterBuild;
};

/**
 * STRUCTURAL «this colony pick CHANGES THE ROSTER» (`SelectColonyModel.rosterChange`).
 *
 * The client decides nothing here: who may leave (and why not), whether an
 * entering tile wakes up active, whether the colony lands — all of it is the
 * server's projection, read by the grid, the catalog and the stage alike.
 *
 *  · `add`     — `incoming` only (the catalog of the reserve): Aridor & co.;
 *  · `remove`  — `outgoing` only (every tile in play): the solo setup trim;
 *  · `replace` — both. The prompt's selectable `coloniesModel` is the RESERVE
 *                (the incoming candidates); the tiles in play that may leave
 *                live in `outgoing`, and the answer names both
 *                (`{colonyName, replaces}` — ONE question, ONE answer).
 */
export type ColonyRosterPrompt = {
  kind: 'add' | 'remove' | 'replace';
  /** `remove` / `replace`: EVERY tile in play, in the table's order. */
  outgoing?: ReadonlyArray<ColonyRosterOutgoing>;
  /** `add` / `replace`: one entry per candidate of `coloniesModel`, in its order. */
  incoming?: ReadonlyArray<ColonyRosterIncoming>;
};

/**
 * THE CHANGE IN WORDS — «− Ceres · + Io» (the leaving tile first, as the table
 * reads it): the journal row, a rival's notification and the stage's receipt
 * all say it through this one function; `name` is the caller's translation.
 */
export function colonyRosterChangeText(change: ColonyRosterChange, name: (colony: ColonyName) => string): string {
  const parts: Array<string> = [];
  if (change.removed !== undefined) {
    parts.push(`− ${name(change.removed)}`);
  }
  if (change.added !== undefined) {
    parts.push(`+ ${name(change.added)}`);
  }
  return parts.join(' · ');
}

/** Is `build` a colony that LANDS (as opposed to a named skip)? */
export function rosterBuildLands(build: ColonyRosterBuild | undefined): build is {slot: number} {
  return build !== undefined && 'slot' in build;
}
