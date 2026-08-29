import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {VENUS_TRACK_INDEX} from './VenusMarsBot';

/**
 * The UTOPIA PLANITIA MarsBot board — 7 tracks, positions 0–18.
 *
 * Transcribed CELL BY CELL from the official Utopia Planitia MarsBot board
 * component («compatible with rules v1.16+»), cross-verified against the retail
 * component (2026-08-29); see docs/AUTOMA_DATA_AUDIT.md §4b for the
 * transcription notes and the per-cell diff against Tharsis.
 * `tests/automa/UtopiaMarsBotBoard.spec.ts` pins every one of the 7 × 19 cells
 * so a refactor can never silently move one.
 *
 * THE TAG PAIRING IS THARSIS', NOT HELLAS'/ELYSIUM'S: «Hellas and Elysium: the
 * [Jovian] tag is paired with [Science]» (Adding Expansions p.8) names exactly
 * two boards, and Utopia is not one of them — here Jovian rides the POWER
 * track and Science stands alone. Production regressions are unaffected either
 * way: they follow the printed production badge on each track's space 0, which
 * is what `productions` below declares.
 *
 * TWO PRINTED ICONS ARE NEW ON THIS BOARD:
 *  · space 5 «Place a Colony» — the colony tile symbol, resolved through the
 *    ordinary MarsBot colony pipeline (`AutomaColonies.botBuildColony`);
 *  · building 11 carries the VENUS tag icon — «a circular tag icon = advance
 *    the track that tag belongs to», so it advances the separate Venus board.
 *    Without Venus Next that track does not exist and the cell is an icon of
 *    an unused expansion: ignored, no Failed Action (rulebook p.7).
 * Both are icons of an EXPANSION, so both are inert without their module — the
 * same rule the `venus` / `floater` cells already ride.
 *
 * What is NOT taken from the printed sheet (its reminders predate the current
 * rulebook, and every one of them is already centralized): the integrated 8th
 * Venus row (`VenusMarsBot.VENUS_TRACK` is appended when Venus Next is in
 * play), the static «FAILED ACTIONS = 5» box (the difficulty decides: 3 M€ on
 * Easy, 5 otherwise), «REMOVE ANY RESOURCES» and the M€ scoring table
 * (`AutomaScoring`). The player aid's milestone panel is stale too — it prints
 * Metallurgist at a combined 5, while the current rulebook says 7 (the number
 * implemented; source priority: rulebook over board reminder).
 */

/**
 * Row indexes on this board. The order is the printed one and matches Tharsis,
 * Hellas and Elysium, which is what lets the Venus track's cell-9 tag icon
 * (`tag_${VENUS_CELL9_TARGET_TRACK}`) keep pointing at the bio row on every
 * map — pinned by a spec.
 */
export const UTOPIA_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3,
  POWER: 4, // Jovian + Energy
  EARTH: 5, // City + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

/**
 * The printed VENUS-tag icon on building 11 — «advance the track that tag
 * belongs to», i.e. the Venus board appended after this map's 7 rows.
 * Deliberately the SAME index constant the Venus module publishes, so the two
 * can never drift; the resolver ignores it when that track is not in play.
 */
const ADVANCE_VENUS: TrackAction = `tag_${VENUS_TRACK_INDEX}`;

const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, undefined, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', ADVANCE_VENUS, 'ocean', undefined, 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

/** Space — and the board's one «Place a Colony» cell, at space 5. */
const TRACK_SPACE: TrackDefinition = {
  role: 'space',
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, undefined, undefined, 'temperature', 'advance', 'colony', 'city', 'venus', 'milestone', 'temperature', 'ocean', 'tr2', 'ocean', undefined, 'temperature', undefined, 'tr4', undefined, 'tr6'],
};

const TRACK_EVENT: TrackDefinition = {
  role: 'event',
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/** Science ALONE — Utopia keeps the Tharsis pairing, so Jovian is not here. */
const TRACK_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', undefined, undefined, 'city', 'greenery', 'milestone', undefined, 'tr2', 'advance', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/**
 * Jovian + Energy — the Tharsis pairing. ENERGY production regresses THIS
 * track (the printed badge), the Trader milestone reads it and the Corporate
 * Competition Investor/Botanist helpers never touch it.
 */
const TRACK_JOVIAN_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER, Tag.JOVIAN],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', 'floater', 'tr3', 'floater2', 'temperature', 'advance', 'milestone', undefined, 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.EARTH, Tag.CITY],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, 'tr3', 'city', undefined, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.PLANT, Tag.ANIMAL, Tag.MICROBE],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', undefined, undefined, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const UTOPIA_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_SCIENCE,
  TRACK_JOVIAN_POWER, // Jovian + Energy
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
