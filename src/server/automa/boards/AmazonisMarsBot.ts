import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * The AMAZONIS PLANITIA (fan map) MarsBot board — 7 tracks, positions 0–18.
 *
 * ⚠️ A HOME-MADE BOARD — the second fan map of the pattern. `BoardName.AMAZONIS`
 * is the fork's fan-made Amazonis Planitia (Community server, upstream 2022):
 * the Colonizer · Forester · Minimalist · Terran · Tropicalist / Curator ·
 * A. Engineer · Promoter · Tourist · A. Zoologist row, a RESTRICTED cell in the
 * centre of the map, four volcanoes, microbe and animal cell bonuses. No
 * official Automa component exists for it; this board was DESIGNED (2026-11-02,
 * the owner's decision) by the law of the six official boards AND by the
 * «Awards & Milestones expansion» section of the rulebook (Adding Expansions
 * pp.13–15), where four of this row's names stand (Forester, Terran, Promoter,
 * Zoologist) and the fifth — Colonizer — is the list's Pioneer at 4 colonies.
 * See docs/AUTOMA_DATA_AUDIT.md §2g for every cell's reason, §18 for the bot's
 * rules on this map; `tests/automa/AmazonisMarsBotBoard.spec.ts` pins every
 * one of the 7 × 19 cells and the §A invariants.
 *
 * THE TAG TOPOLOGY IS THARSIS' / UTOPIA'S, derived from the row:
 *   · TERRAN (Earth tags) reads the Earth track — and the official calibration
 *     «Terran — space 5 on the Earth track» was made on the Tharsis board, where
 *     Earth is paired with CITY: City + Earth here too;
 *   · FORESTER (plant production) and A. ZOOLOGIST (animals + microbes) read the
 *     bio row — the official «Forester — space 6 on the bio track» and
 *     «Zoologist — bio +5» are calibrated on Tharsis' triple: Microbe + Animal +
 *     Plant stays whole;
 *   · COLONIZER is the list's Pioneer at 4 colonies, whose official cubes stand
 *     on the SPACE track (#7, #10) and the POWER / Jovian track (#8) of the
 *     Tharsis board — so Jovian rides POWER and Science stands alone, as on
 *     Tharsis and Utopia; no criterion of this row names Jovian, City or Science.
 * Roles do not move; the second trade fleet unlocks on POWER space 9; the Venus
 * row is the SHARED one (its cell-9 microbe advances the bio row). Production
 * regressions follow the printed badge on each track's space 0.
 *
 * THE THREE «COLONY FOR 5 M€» CELLS (`colony5`) are the official Pioneer-at-4
 * rule in the printed form the Utopia board gave the colony action: «Place a
 * cube on [Space] track #7 and #10 and [Power] #8. When any of these cubes are
 * reached, MarsBot loses 5 MC and resolves a "Build a Colony" action … Remove
 * that cube» (Adding Expansions p.14). Reached, the cell builds a colony through
 * the ordinary bot pipeline and THEN charges the 5 M€ (MSL Curiosity's order —
 * the bot never pays for a colony it did not get); no eligible colony tile is
 * the printed icon with nothing to do (a Failed Action, as Utopia's cell);
 * without Colonies it is an icon of an unused expansion and is ignored. The
 * Venus icon that Tharsis prints on space 7 moved to space 4 (an empty cell).
 *
 * WHERE THE CELLS COME FROM (each a precedent of an official board):
 *   · building: Hellas' row (no cross-track icon — nothing in this row asks for one);
 *   · space: Tharsis' row, the venus icon 7 → 4, `colony5` on 7 and 10;
 *   · event: Hellas' / Utopia's row (the v1.16 floater2 on 6);
 *   · science: Tharsis' row with Nova's move — space 3 emptied;
 *   · power: Utopia's Jovian/Energy row, `colony5` on 8;
 *   · earth: ELYSIUM's City/Earth row cell by cell (space 4 empty);
 *   · bio: the Tharsis row unchanged.
 * Totals (the §A invariants, asserted by the spec): 10 oceans · 13 temperature
 * + 1 double · 15 greeneries · 10 cities · 4 milestones · 4 awards · 37 empty ·
 * 14 advance · Σ TR 79 · ends tr5 / tr6 / tr5 / tr7 / tr8 / tr7 / tr6.
 */

/**
 * Row indexes on this board — the printed order every map shares, which is
 * what lets the shared Venus row's cell-9 tag icon keep pointing at the bio row,
 * and the «topmost» tiebreak order a helper reads.
 */
export const AMAZONIS_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3, // Science, alone
  POWER: 4, // Power + Jovian
  EARTH: 5, // City + Earth
  BIO: 6, // Microbe + Animal + Plant
} as const;

const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, undefined, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', undefined, 'ocean', undefined, 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

/** Space — and two of the three «colony for 5 M€» cells, on the official cube positions #7 and #10. */
const TRACK_SPACE: TrackDefinition = {
  role: 'space',
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, 'advance', undefined, 'temperature', 'venus', 'ocean', 'city', 'colony5', 'milestone', 'temperature', 'colony5', 'tr3', 'ocean', undefined, 'temperature', undefined, 'tr4', undefined, 'tr6'],
};

const TRACK_EVENT: TrackDefinition = {
  role: 'event',
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/** Science ALONE — the Tharsis / Utopia pairing. */
const TRACK_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', undefined, undefined, 'city', undefined, 'greenery', undefined, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/**
 * Power + Jovian — the Tharsis pairing, Utopia's v1.16 cells; the third colony
 * cell on space 8 (the official cube). ENERGY production regresses it; space 9
 * is where the second trade fleet unlocks.
 */
const TRACK_JOVIAN_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER, Tag.JOVIAN],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', 'floater', 'tr3', 'floater2', 'temperature', 'advance', 'milestone', 'colony5', 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

/** City + Earth — Elysium's row. HEAT production regresses it; Terran reads it (space 6). */
const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.CITY, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, undefined, 'city', undefined, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

/** Microbe + Animal + Plant — the Tharsis row unchanged. Forester (space 6) and A. Zoologist (+5) read it. */
const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const AMAZONIS_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_SCIENCE, // Science, alone
  TRACK_JOVIAN_POWER, // Power + Jovian
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
