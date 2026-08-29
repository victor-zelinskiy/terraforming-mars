import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * The ELYSIUM MarsBot board — 7 tracks, positions 0–18.
 *
 * Transcribed CELL BY CELL from the official Elysium MarsBot board component
 * («compatible with rules v1.16+»), verified against the retail component by
 * the owner (2026-08-29); see docs/AUTOMA_DATA_AUDIT.md §4a for the
 * transcription notes and the per-cell diff against Hellas.
 * `tests/automa/ElysiumMarsBotBoard.spec.ts` pins every one of the 7 × 19
 * cells so a refactor can never silently move one.
 *
 * The TAG pairing matches Hellas, not Tharsis, and is printed in the rulebook
 * (Adding Expansions p.8): «Hellas and Elysium: the [Jovian] tag is paired with
 * [Science], not with [Power] (as it is on the Tharsis board)». Production
 * regressions are UNCHANGED by that move — they follow the printed production
 * badge on each track's space 0, which is what `productions` below declares.
 *
 * What is NOT taken from the printed sheet (the reminders it prints are older
 * than the current rulebook, and every one of them is already centralized):
 * the integrated 8th Venus row (`VenusMarsBot.VENUS_TRACK` is appended when
 * Venus Next is in play), the static «FAILED ACTIONS = 5» box (the difficulty
 * decides: 3 M€ on Easy, 5 otherwise), «REMOVE ANY RESOURCES» and the M€
 * scoring table (`AutomaScoring`).
 */

/**
 * Row indexes on this board. The order is the printed one and matches Tharsis
 * and Hellas, which is what lets the Venus track's cell-9 tag icon
 * (`tag_${VENUS_CELL9_TARGET_TRACK}`) keep pointing at the bio row on every
 * map — pinned by a spec.
 */
export const ELYSIUM_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // Jovian + Science
  POWER: 4,
  EARTH: 5, // City + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

/**
 * The printed POWER-tag icon that Elysium puts inside three cells (building 4
 * and 13, science 7): «a circular tag icon = advance the track that tag belongs
 * to» — the same notation as the Tharsis board's space-tag cell (building 11)
 * and the Venus board's microbe cell. Elysium prints no OTHER cross-track tag.
 */
const ADVANCE_POWER: TrackAction = `tag_${ELYSIUM_TRACK.POWER}`;

const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, ADVANCE_POWER, undefined, 'temperature', 'milestone', 'greenery', 'award', 'city', undefined, 'ocean', ADVANCE_POWER, 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

const TRACK_SPACE: TrackDefinition = {
  role: 'space',
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, 'advance', undefined, 'temperature', undefined, 'ocean', 'city', 'venus', 'milestone', 'temperature', undefined, 'tr4', 'ocean', undefined, 'temperature', undefined, 'tr5', undefined, 'tr6'],
};

const TRACK_EVENT: TrackDefinition = {
  role: 'event',
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr5', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/**
 * The Jovian/Science track — Elysium's pairing, shared with Hellas (Adding
 * Expansions p.8). Its role stays `science`: every rule that names this track
 * by role («advance the science track», the Scientist award reference) means
 * THIS one, on every board. It carries no production badge, so no production
 * decrease can regress it — the Jovian pairing moved a TAG, never a badge.
 */
const TRACK_JOVIAN_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.JOVIAN, Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', ADVANCE_POWER, 'tr3', 'milestone', 'temperature', 'ocean', 'tr4', 'temperature', 'tr5', 'advance', undefined, 'temperature', 'tr7'],
};

/**
 * Power alone — the Jovian tag sits on the science track on this board, so
 * ENERGY production still regresses THIS track (the badge never moved) and the
 * Industrialist award still reads THIS track's space (+5).
 */
const TRACK_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', undefined, 'tr3', undefined, 'temperature', 'advance', 'milestone', undefined, 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.CITY, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, undefined, 'city', undefined, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr4', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const ELYSIUM_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_JOVIAN_SCIENCE, // Jovian + Science
  TRACK_POWER,
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
