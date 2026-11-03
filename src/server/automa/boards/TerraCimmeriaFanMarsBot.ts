import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * THE OLD (fan) TERRA CIMMERIA's MarsBot board — `BoardName.TERRA_CIMMERIA` ('t. cimmeria'), the THIRD map with a
 * HOME-MADE board (the owner's decision of 2026-11-03; docs/AUTOMA_DATA_AUDIT.md §2h / §19,
 * docs/claude/marsbot-fan-map-checklist.md). 7 tracks, positions 0–18.
 *
 * ⚠️ THE SAME GEOGRAPHY AS THE OFFICIAL ONE. This map and `TERRA_CIMMERIA_NOVA` share every cell's TYPE — oceans and
 * volcanoes on the same hexes; 34 of 61 cells are identical and 27 differ in their printed bonus only (this one is
 * rich in plants and prints ENERGY on 8 cells; Nova prints more steel / titanium and the MSL Curiosity colony hex).
 * What differs is the milestone / award row: T. Collector · Firestarter · Terra Pioneer · T. Spacefarer · Gambler /
 * Biologist · Incorporator · T. Politician · Urbanist · Warmonger.
 *
 * HOW IT IS BUILT — the «hybrid» the owner accepted:
 *   · the THREE SINGLE rows (building, space, event) are the official Terra Cimmeria board's — the map family's own
 *     rows, which change only cell by cell between maps; the building row's two ENERGY-tag icons (spaces 4 and 13 —
 *     «advance the power track») are the family's mark, apt for a map that prints energy on its cells;
 *   · the FOUR PAIRED rows follow THE LAW OF PAIRS (checklist §A): T. Spacefarer counts SPACE tags (the single space
 *     row), Biologist MICROBE + PLANT + ANIMAL tags (the bio row exactly), Firestarter heat (the heat-badged earth
 *     row); no criterion names Science, Jovian, City or Energy, so they keep the default pairing — Tharsis / Utopia:
 *     Science alone, Power + Jovian, City + Earth. The four rows are Tharsis's, with the power row's old Venus pair
 *     re-printed as the modern expansion set (one `venus` — space 7 —, one `floater`, two `floater2`), as Amazonis did.
 *
 * Σ TR 82 · 37 empty (with the seven start cells) · 15 advance · 10 oceans · 13 + 1 temperatures · 15 greeneries ·
 * 10 cities · 4 + 4 milestone / award cells — inside every invariant of §A, pinned by
 * `tests/automa/TerraCimmeriaFanMarsBotBoard.spec.ts`.
 */

/** Row indexes — the shared order of every map (the Venus cell-9 icon and «topmost on a tie» rely on it). */
export const TERRA_CIMMERIA_FAN_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // Science, alone
  POWER: 4, // Power + Jovian
  EARTH: 5, // City + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

/** The printed ENERGY-tag icon (building 4 and 13): «advance the power track» — the Terra Cimmeria family's. */
const ADVANCE_POWER: TrackAction = `tag_${TERRA_CIMMERIA_FAN_TRACK.POWER}`;

/** Building — the official Terra Cimmeria row (its two energy icons included). */
const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, ADVANCE_POWER, undefined, 'temperature', 'milestone', 'greenery', 'award', 'city', undefined, 'ocean', ADVANCE_POWER, 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

/** Space — the official Terra Cimmeria row. T. Spacefarer reads it (space 6 — the N ↔ N law of a single tag). */
const TRACK_SPACE: TrackDefinition = {
  role: 'space',
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, 'advance', undefined, 'temperature', undefined, 'ocean', 'city', 'venus', 'milestone', 'temperature', undefined, 'tr4', 'ocean', undefined, 'temperature', undefined, 'tr5', undefined, 'tr6'],
};

/** Event — the official Terra Cimmeria row. */
const TRACK_EVENT: TrackDefinition = {
  role: 'event',
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/** Science ALONE — the Tharsis row (no criterion of this map pairs it). */
const TRACK_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', undefined, 'advance', 'city', undefined, 'greenery', undefined, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/** Power + Jovian — the Tharsis row, its Venus pair re-printed as the modern expansion set (floater, floater2). */
const TRACK_JOVIAN_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER, Tag.JOVIAN],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', 'floater', 'tr3', 'floater2', 'temperature', 'advance', 'milestone', undefined, 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

/** City + Earth — the Tharsis row. HEAT production regresses it; Firestarter reads it (space 8). */
const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.CITY, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, 'tr3', 'city', undefined, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

/** Microbe + Animal + Plant — the Tharsis row. Biologist reads it (+5, official). */
const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const TERRA_CIMMERIA_FAN_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_SCIENCE, // Science, alone
  TRACK_JOVIAN_POWER, // Power + Jovian
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
