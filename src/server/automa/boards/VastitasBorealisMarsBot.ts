import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {VENUS_TRACK_INDEX, venusTrackFor} from './VenusMarsBot';

/**
 * The VASTITAS BOREALIS MarsBot board — 7 tracks, positions 0–18.
 *
 * Transcribed CELL BY CELL from the official Vastitas Borealis MarsBot board
 * component («compatible with rules v1.16+», provided by the owner 2026-10-31);
 * see docs/AUTOMA_DATA_AUDIT.md §2e for the transcription notes and the
 * per-cell diff against Tharsis. `tests/automa/VastitasBorealisMarsBotBoard.spec.ts`
 * pins every one of the 7 × 19 cells so a refactor can never silently move one.
 *
 * ⚠️ WHICH BOARD THIS IS. The official map is the fork's
 * `BoardName.VASTITAS_BOREALIS_NOVA` (Viking 1/2, the North Pole −4 M€
 * temperature hex, the Agronomist… / Traveller… row of the B13 reference
 * card). `BoardName.VASTITAS_BOREALIS` is an older fan map with a different
 * M&A row and a HOME-MADE board of its own (`VastitasBorealisFanMarsBot.ts`).
 *
 * ⚠️ THE TAG TOPOLOGY MOVES MORE THAN ON ANY OTHER BOARD — three pairings at
 * once (Adding Expansions p.8):
 *   · MICROBE joins SCIENCE (everywhere else it rides the bio row);
 *   · CITY joins ENERGY (Tharsis pairs it with Earth, Terra Cimmeria with Science);
 *   · JOVIAN joins EARTH (Tharsis/Utopia pair it with Energy).
 * The bio row keeps Animal + Plant. Roles do not move: «advance the science
 * track» is still row 3, the second trade fleet still unlocks on the POWER
 * row's space 9 (RB-C p.4 prints the City/Energy icon for this map, and the
 * board prints the fleet reminder on that very cell). Production regressions
 * follow the printed badge on each track's space 0, which is what
 * `productions` below declares.
 *
 * ⚠️ AND THE VENUS ROW FOLLOWS THE MICROBE. The Venus track's cell 9 prints a
 * MICROBE tag — «advance the track that tag belongs to», which on this board is
 * the Microbe/Science row, not bio. So this map brings its own Venus row
 * (`VASTITAS_VENUS_TRACK`) instead of the shared one.
 *
 * What is NOT taken from the printed sheet (its reminders predate the current
 * rulebook, and every one of them is already centralized): the static «FAILED
 * ACTIONS = 5» box (the difficulty decides: 3 M€ on Easy, 5 otherwise),
 * «REMOVE ANY RESOURCES» and the M€ scoring table (`AutomaScoring`). The
 * player aid's milestone panel prints Geologist at 4 tiles; the rulebook says
 * «Unchanged», so the bot meets the threshold the map actually prints (3).
 */

/**
 * Row indexes on this board. The order is the printed one and matches every
 * other map — the role order the profiles share. It is ALSO the official
 * «topmost» tiebreak order a helper reads when several tracks are equally
 * advanced.
 */
export const VASTITAS_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // Microbe + Science
  POWER: 4, // City + Energy
  EARTH: 5, // Jovian + Earth
  BIO: 6, // Animal + Plant
} as const;

/**
 * The printed VENUS-tag icon on building 11 — the Venus board appended after
 * this map's 7 rows (Utopia prints the same cell). Ignored without Venus Next.
 */
const ADVANCE_VENUS: TrackAction = `tag_${VENUS_TRACK_INDEX}`;

/** The printed ANIMAL-tag icon on Microbe/Science 16: «advance the animal track» — the bio row. */
const ADVANCE_ANIMAL: TrackAction = `tag_${VASTITAS_TRACK.BIO}`;

const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, 'advance', 'ocean', undefined, undefined, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', ADVANCE_VENUS, 'ocean', undefined, 'greenery', 'city', 'temperature', undefined, 'tr5'],
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
 * Microbe + Science. Its role stays `science`: every rule that names this track
 * by role means THIS one. Microbe is listed FIRST — the printed icon order, and
 * the tag a `tag_3` cell (the Venus row's cell 9) shows.
 */
const TRACK_MICROBE_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.MICROBE, Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', undefined, undefined, 'city', undefined, 'greenery', undefined, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', ADVANCE_ANIMAL, 'temperature', 'tr5'],
};

/**
 * City + Energy. ENERGY production regresses it (the printed badge), and its
 * space 9 is where the second trade fleet unlocks (the city cell there carries
 * the Colonies fleet reminder).
 */
const TRACK_CITY_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.CITY, Tag.POWER],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', undefined, 'tr3', undefined, 'city', 'advance', 'milestone', undefined, 'city', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

/** Jovian + Earth — HEAT production regresses it (the printed badge). */
const TRACK_JOVIAN_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.JOVIAN, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', 'floater', undefined, 'temperature', 'floater2', undefined, 'advance', 'temperature', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

/** Animal + Plant — no Microbe here (it moved to Science). PLANT production regresses it. */
const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, 'greenery', undefined, 'greenery', undefined, 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr4', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr8'],
};

export const VASTITAS_BOREALIS_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_MICROBE_SCIENCE, // Microbe + Science
  TRACK_CITY_POWER, // City + Energy
  TRACK_JOVIAN_EARTH, // Jovian + Earth
  TRACK_BIO, // Animal + Plant
];

/** This map's Venus row: the printed microbe on cell 9 advances the Microbe/Science row. */
export const VASTITAS_VENUS_TRACK: TrackDefinition = venusTrackFor(VASTITAS_TRACK.SCIENCE);
