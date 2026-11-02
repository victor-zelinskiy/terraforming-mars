import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * The VASTITAS BOREALIS (fan map) MarsBot board — 7 tracks, positions 0–18.
 *
 * ⚠️ A HOME-MADE BOARD. `BoardName.VASTITAS_BOREALIS` is the fork's OLDER,
 * fan-made Vastitas Borealis (upstream 2022, waichuan) — the one with the
 * V. Electrician · Smith · Tradesman · Irrigator · Capitalist / Forecaster ·
 * Edgedancer · Visionary · Naturalist · Voyager row, the North Pole in the
 * centre of the map and four volcanoes in the north-west, no Viking sites. No
 * official Automa component exists for it; this board was DESIGNED (2026-11-02,
 * the owner's decision) by the law the six official boards follow — see
 * docs/claude/marsbot-fan-map-checklist.md §A and docs/AUTOMA_DATA_AUDIT.md
 * §2f for every cell's reason, §17 for the bot's rules on this map. The
 * official Vastitas Borealis (Viking 1/2, B13) is `VastitasBorealisMarsBot.ts`
 * for `BoardName.VASTITAS_BOREALIS_NOVA` — a different map, a different row.
 * `tests/automa/VastitasBorealisFanMarsBotBoard.spec.ts` pins every one of the
 * 7 × 19 cells and the §A invariants.
 *
 * THE TAG TOPOLOGY IS HELLAS' / ELYSIUM'S, derived from the map's own
 * milestone / award row (the official law: a criterion that counts TAGS lies
 * on the track carrying exactly those tags, one that counts PRODUCTION on the
 * track with that printed badge, and two criteria of one map never share a
 * track):
 *   · POWER stands ALONE — V. Electrician counts power tags, and any pairing
 *     (Jovian / City) would inflate it (Hellas' Energizer, Terra Cimmeria's
 *     Electrician: the same reason, the same row);
 *   · JOVIAN joins SCIENCE — Voyager counts Jovian tags, and the one official
 *     calibration of «Jovian on the Jovian/Science row» is Hellas' Rim Settler
 *     (3 Jovian tags ↔ space 6);
 *   · CITY joins EARTH — no criterion of this map counts city tags, so City
 *     rides the Earth row as on four official boards; the row carries the HEAT
 *     badge, which is Naturalist's (plants + heat production) second half;
 *   · the bio row keeps Microbe + Animal + Plant — Naturalist's first half.
 * Roles do not move; the second trade fleet unlocks on POWER space 9; the
 * Venus row is the SHARED one (its cell-9 microbe advances the bio row).
 * Production regressions follow the printed badge on each track's space 0.
 *
 * WHERE THE CELLS COME FROM (the per-row provenance, each a precedent of an
 * official board — never a free invention):
 *   · building: Elysium's / Terra Cimmeria's row — the cross-track ENERGY icon
 *     on spaces 4 and 13 («construction powers the electricians»: a map whose
 *     milestone is V. Electrician gets the two pushes Elysium and Terra Cimmeria
 *     print beside Industrialist / Electrician), no tr2 on 5 beside it;
 *   · space, event: Elysium's rows (tr4 / tr5 on space 11 / 16, tr5 on event
 *     12 — the compensation for the rating moved off the earth row);
 *   · science: HELLAS' Jovian/Science row cell by cell (the same pairing);
 *   · power: Elysium's standalone row, with Vastitas Borealis Nova's move —
 *     spaces 5 and 9 CITY instead of temperature;
 *   · earth: the Tharsis City/Earth row with Nova's move — spaces 4 and 8
 *     TEMPERATURE (the heat-badged row carries the temperature raises on a map
 *     with a North Pole and a heat-strewn ocean bed), space 5 emptied so the
 *     board keeps ten cities;
 *   · bio: the Tharsis row unchanged.
 * Totals (the §A invariants, asserted by the spec): 10 oceans · 13 temperature
 * + 1 double · 15 greeneries · 10 cities · 4 milestones · 4 awards · 38 empty
 * (the official band is 37–39) · 15 advance · Σ TR 80 · ends tr5 / tr6 / tr5 /
 * tr7 / tr8 / tr7 / tr6.
 */

/**
 * Row indexes on this board. The order is the printed one and matches every
 * other map — the role order the profiles share — so the shared Venus row's
 * cell-9 tag icon (`tag_${VENUS_CELL9_TARGET_TRACK}`) keeps pointing at the
 * bio row. It is ALSO the «topmost» tiebreak order a helper reads when
 * several tracks are equally advanced.
 */
export const VASTITAS_FAN_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // Jovian + Science
  POWER: 4, // Power, alone
  EARTH: 5, // City + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

/** The cross-track ENERGY icon on building 4 and 13: «advance the power track» (Elysium / Terra Cimmeria). */
const ADVANCE_POWER: TrackAction = `tag_${VASTITAS_FAN_TRACK.POWER}`;

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
 * Jovian + Science — Hellas' row, cell by cell. Its role stays `science`:
 * Voyager (`floor(space / 2)`) and the Voyager helper read THIS track; it
 * carries no production badge, so no production decrease can regress it.
 */
const TRACK_JOVIAN_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.JOVIAN, Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', undefined, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/**
 * Power ALONE — V. Electrician reads «space 4 or higher» here, the building
 * row's two energy icons push it, and ENERGY production regresses it. Spaces 5
 * and 9 are CITIES (Nova's move; the temperature went to the heat row); space 9
 * is where the second trade fleet unlocks.
 */
const TRACK_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', undefined, 'tr3', undefined, 'city', 'advance', 'milestone', undefined, 'city', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

/**
 * City + Earth — the HEAT-badged row: spaces 4 and 8 raise the temperature
 * (Nova's move), space 5 is empty so the board keeps exactly ten cities.
 * Naturalist reads it beside the bio row; Tradesman's «earth» role is this one.
 */
const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.CITY, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, 'temperature', undefined, undefined, 'advance', 'temperature', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

/** Microbe + Animal + Plant — the Tharsis row unchanged. PLANT production regresses it. */
const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const VASTITAS_FAN_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_JOVIAN_SCIENCE, // Jovian + Science
  TRACK_POWER, // Power, alone
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
