import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * The TERRA CIMMERIA MarsBot board — 7 tracks, positions 0–18.
 *
 * Transcribed CELL BY CELL from the official Terra Cimmeria MarsBot board
 * component («compatible with rules v1.16+», provided by the owner 2026-08-29);
 * see docs/AUTOMA_DATA_AUDIT.md §2d for the transcription notes and the
 * per-cell diff against Tharsis. `tests/automa/TerraCimmeriaMarsBotBoard.spec.ts`
 * pins every one of the 7 × 19 cells so a refactor can never silently move one.
 *
 * ⚠️ WHICH BOARD THIS IS. The fork ships two Terra Cimmerias, and the official
 * Automa one is `BoardName.TERRA_CIMMERIA_NOVA` — it is the one that prints the
 * MSL Curiosity colony hex and whose milestone/award row matches the B12
 * reference card (Electrician · Founder · Mogul · Zoologist · Forecaster).
 * `BoardName.TERRA_CIMMERIA` is an older, unrelated map with a different M&A
 * row and no colony hex; it is NOT automa-supported.
 *
 * ⚠️ THE TAG TOPOLOGY IS THIS BOARD'S ALONE — three pairings move at once:
 *   · CITY joins SCIENCE (everywhere else City rides Earth);
 *   · JOVIAN joins EARTH (Tharsis/Utopia pair it with Power, Hellas/Elysium
 *     with Science);
 *   · ENERGY stands completely alone.
 * Production regressions are untouched by any of it — they follow the printed
 * production badge on each track's space 0, which is what `productions` below
 * declares: energy still regresses the ENERGY row and heat still regresses the
 * JOVIAN/EARTH row (the canonical `earth` role).
 *
 * What is NOT taken from the printed sheet (its reminders predate the current
 * rulebook, and every one of them is already centralized): the integrated 8th
 * Venus row (`VenusMarsBot.VENUS_TRACK` is appended when Venus Next is in
 * play), the static «FAILED ACTIONS = 5» box (the difficulty decides: 3 M€ on
 * Easy, 5 otherwise), «REMOVE ANY RESOURCES» and the M€ scoring table
 * (`AutomaScoring`).
 */

/**
 * Row indexes on this board. The order is the printed one and matches every
 * other map, which is what lets the Venus track's cell-9 tag icon
 * (`tag_${VENUS_CELL9_TARGET_TRACK}`) keep pointing at the bio row on every
 * map — pinned by a spec. It is ALSO the official «topmost» tiebreak order the
 * B12 Mogul helper reads when several tracks are equally advanced.
 */
export const TERRA_CIMMERIA_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // City + Science
  POWER: 4, // Energy, alone
  EARTH: 5, // Jovian + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

/** The printed ENERGY-tag icon (building 4 and 13): «advance the energy track». */
const ADVANCE_ENERGY: TrackAction = `tag_${TERRA_CIMMERIA_TRACK.POWER}`;

/** The printed EVENT-tag icon (city/science 7): «advance the event track». */
const ADVANCE_EVENT: TrackAction = `tag_${TERRA_CIMMERIA_TRACK.EVENT}`;

const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, ADVANCE_ENERGY, undefined, 'temperature', 'milestone', 'greenery', 'award', 'city', undefined, 'ocean', ADVANCE_ENERGY, 'greenery', 'city', 'temperature', undefined, 'tr5'],
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
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/**
 * City + Science — this board's signature pairing. Its role stays `science`:
 * every rule that names this track by role («advance the science track», the
 * Architect milestone) means THIS one, on every board.
 */
const TRACK_CITY_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.CITY, Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', undefined, 'city', undefined, 'city', 'greenery', ADVANCE_EVENT, 'milestone', undefined, 'city', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/**
 * Energy ALONE — no Jovian here (it moved to the Earth row). ENERGY production
 * still regresses this track (the printed badge never moved), the Electrician
 * award reads its space and the B12 Electrician helper advances it.
 */
const TRACK_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', undefined, 'tr3', undefined, 'temperature', 'advance', 'award', undefined, 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

/**
 * Jovian + Earth — the other half of this board's pairing swap. HEAT production
 * regresses it (the printed badge), and the Planetologist milestone reads its
 * space alongside the Venus track's.
 */
const TRACK_JOVIAN_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.JOVIAN, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', 'floater', undefined, 'temperature', 'floater2', undefined, 'advance', undefined, 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'milestone', 'temperature', 'tr4', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const TERRA_CIMMERIA_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_CITY_SCIENCE, // City + Science
  TRACK_POWER, // Energy, alone
  TRACK_JOVIAN_EARTH, // Jovian + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
