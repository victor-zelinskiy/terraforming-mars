import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * ARABIA TERRA's MarsBot board — `BoardName.ARABIA_TERRA` ('arabia terra'), the FOURTH fan map with a HOME-MADE board
 * (the owner's decisions of 2026-11-05; docs/AUTOMA_DATA_AUDIT.md §2i / §21,
 * docs/claude/marsbot-fan-map-checklist.md). 7 tracks, positions 0–18.
 *
 * THE MAP: coves (a cell that takes an ocean OR a land tile), data / science / energy-production cell bonuses, four
 * volcanic cells; the row Economizer · Pioneer · Land Specialist · Martian · Terran / Cosmic Settler · Botanist ·
 * Promoter · Zoologist · A. Manufacturer. Seven of the ten names already carry a bot rule from another map (Pioneer,
 * Land Specialist, Botanist — Utopia Planitia's official ones; Terran — Amazonis; Promoter; Zoologist by the A&M list).
 *
 * THE TOPOLOGY — the law of pairs (checklist §A), with one conflict settled by the owner:
 *   · Economizer («5 heat production») and Terran («6 Earth tags») both point at the earth row (the heat badge and the
 *     Earth tag live there on every board) — and two criteria of one map never share a track. Terran keeps the row
 *     (its rule is the Amazonis one, by name); Economizer reads the POWER track, the association the official
 *     Thermalist prints (heat ↔ the energy track, B08) — so POWER STANDS ALONE, exactly as on Hellas (Energizer) and
 *     Elysium (Industrialist), and Jovian rides Science;
 *   · City rides Earth (the default, and Terran's own calibration); Botanist and Zoologist both read the bio row by
 *     their OFFICIAL rules (bio − 2, bio + 5), so it keeps all three tags.
 *
 * HOW IT IS BUILT — the Hellas board (the Power-alone board with a milestone on the power track), with two rows swapped:
 *   · SPACE is Utopia Planitia's — the official board of the very Pioneer this map carries («3 colonies»), with its
 *     free «place a colony» cell on space 5 (inert without Colonies);
 *   · POWER is Elysium's — Hellas' row minus the second «advance» (space 2), which brings the board into the official
 *     bands.
 *
 * Σ TR 81 · 37 empty (with the seven start cells) · 15 advance · 10 oceans · 13 + 1 temperatures · 15 greeneries ·
 * 10 cities · 4 + 4 milestone / award cells · one colony cell — inside every invariant of §A, pinned by
 * `tests/automa/ArabiaTerraMarsBotBoard.spec.ts`.
 */

/** Row indexes — the shared order of every map (the Venus cell-9 icon and «topmost on a tie» rely on it). */
export const ARABIA_TERRA_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // Jovian + Science
  POWER: 4, // Power, alone
  EARTH: 5, // City + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

/** Building — the Hellas row. */
const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, undefined, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', undefined, 'ocean', undefined, 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

/** Space — Utopia Planitia's row: the free colony cell on space 5 is the official Pioneer's. */
const TRACK_SPACE: TrackDefinition = {
  role: 'space',
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, undefined, undefined, 'temperature', 'advance', 'colony', 'city', 'venus', 'milestone', 'temperature', 'ocean', 'tr2', 'ocean', undefined, 'temperature', undefined, 'tr4', undefined, 'tr6'],
};

/** Event — the Hellas row. Promoter reads it (official). */
const TRACK_EVENT: TrackDefinition = {
  role: 'event',
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/** Jovian + Science — the Hellas row (Power stands alone, so Jovian rides here). */
const TRACK_JOVIAN_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.JOVIAN, Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', undefined, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/** Power ALONE — the Elysium row. Economizer reads it (space 5 — the Thermalist association, N ↔ N like Energizer). */
const TRACK_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', undefined, 'tr3', undefined, 'temperature', 'advance', 'milestone', undefined, 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

/** City + Earth — the Hellas row. HEAT production regresses it; Terran reads it (space 6). */
const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.CITY, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, 'tr3', 'city', undefined, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

/** Microbe + Animal + Plant — the Hellas row. Botanist (− 2) and Zoologist (+ 5) read it, both official. */
const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const ARABIA_TERRA_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_JOVIAN_SCIENCE, // Jovian + Science
  TRACK_POWER, // Power, alone
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
