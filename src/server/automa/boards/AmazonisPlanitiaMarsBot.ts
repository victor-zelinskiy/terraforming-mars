import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {MARSBOT_EXTENDED_TRACK_POSITION, TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {THARSIS_MARSBOT_BOARD} from './TharsisMarsBot';
import {VENUS_CELL9_TARGET_TRACK, venusTrackFor} from './VenusMarsBot';

/**
 * AMAZONIS PLANITIA (`BoardName.AMAZONIS_PLANITIA`, the official eleven-row map) — MarsBot's EXTENDED board
 * (docs/claude/amazonis-planitia-marsbot.md, docs/AUTOMA_DATA_AUDIT.md §2k / §24; HOME-MADE, the owner's direction of
 * 2026-11-07: «redesign the whole bot board and the bot's balance to cope with the extended terraforming tracks — the
 * late bonuses especially strong, to keep the bot in tone late»).
 *
 * THE MAP'S PROBLEM. Its global parameters are longer — 11 oceans, +14 °C (22 steps), 18 % oxygen, Venus 33 % — 51
 * Martian steps against the standard map's 42, so a game runs about a quarter longer (the standard solo game gets its
 * extra generation from the rulebook). A 19-cell track is built for the standard game: under the bench's card flow
 * (3 project cards a generation) 17 % of the bot's tracks stand at their end by the 20th generation and 44 % by the
 * 24th, and the Failed Actions of the last six generations are SIX TIMES the mid-game's — every tag on a finished
 * track pays 5 M€ instead of terraforming. The human's engine accelerates late; the bot's pace is linear and then
 * stalls. That is where it would fall behind on this map.
 *
 * THE DESIGN — ONE FORMAT: 25-cell tracks (0–24).
 *  · THE BODY (cells 0–18) is the Tharsis board, cell for cell: the base the Awards & Milestones module itself hands
 *    any map it does not know (RB-C p.12), the law of the six official boards (10 oceans · 13 + 1 temperature · 15
 *    greeneries · 10 cities · 4 + 4 milestone / award cells · ΣTR 82 · the ends), and the topology this row wants by
 *    the law of pairs: Physicist reads science + space tags, so the science row carries NO Jovian (it rides Power);
 *    Terran counts Earth tags on the Earth / City row; Manufacturer reads the steel and energy badges; Collector and
 *    Merchant read every track. The first two thirds of a game therefore pace EXACTLY as on the official boards —
 *    the pace that was calibrated by hand and by the owner's field games; a hotter body would have made the early
 *    bot stronger, which is the one complaint the balance work of October answered. Nothing of the map's character
 *    is lost by that: it lives in the extension. ONE touch of the row on the body: Constructor («cities and colonies
 *    owned», RB-C p.14) is backed, as the module backs Pioneer / Constructor on its own Tharsis board, by its THREE
 *    colony cubes — printed as `colony5` cells («MarsBot loses 5 MC and builds a colony», Adding Expansions p.14) on
 *    the body's empty cells nearest the module's places (space #7 / #10, power #8): space 4, space 10, power 8 —
 *    the very cells the random-set generator would repair them onto (so the fixed row re-assembles with no repair).
 *    Inert without the Colonies expansion, like every expansion icon.
 *  · THE EXTENSION (cells 19–24, «the late reserve») carries what the longer game needs and the bot's late tone: no
 *    cell is empty. Cell 19 is an «advance» on every row — a track that crosses its old end is PUSHED into the
 *    reserve on the spot; cell 21 a mid-reserve TR (3–4); cell 24 the new end TR (6–8, the pattern of the body's
 *    ends); the three cells between them the terraforming the map asks for beyond the standard game's — 4 more
 *    oceans (14 printed for 11), 6 more greeneries (21 for 18 % oxygen), 7 single and 2 double temperature steps
 *    (26 steps for 22), 2 more cities. Σ TR of the reserve = 73 — the body's 82 again, in six cells a row: reached
 *    rarely, late, and only by a track the bot has driven all game, which is exactly the «strong late bonus» asked
 *    for. The bench (§24.4): the reserve turns the 20th–24th generations' Failed Actions back into terraforming and
 *    lifts the bot's late TR to the human's longer tracks' proportion, with the first-claim and criterion windows
 *    unchanged (the milestone / award cells are the body's).
 *  · THE VENUS ROW is 16 cells (0–15): the printed row with its last three cells re-cut for a Venus that runs to 33 %
 *    (18 steps, 15 on the standard board) — two more Venus steps, one more «advance», the end TR at 15.
 *
 * What the engine already knows: a track's length is `maxPosition` (the Venus row has used it since the start), the
 * resolver, the regress, the corporation cubes, the client's mat and the random-set generator read it — the
 * generator cuts the body by the law and hands the reserve back (`matLaw.matBody` / `matTail`).
 */

/** The first cell of the late reserve — the body is the law's 19 cells (0–18). */
export const AMAZONIS_PLANITIA_TAIL_START = 19;

const BUILDING_TAIL: ReadonlyArray<TrackAction> = ['advance', 'city', 'tr3', 'temperature', 'greenery', 'tr6'];
const SPACE_TAIL: ReadonlyArray<TrackAction> = ['advance', 'temperature2', 'tr3', 'ocean', 'temperature', 'tr7'];
const EVENT_TAIL: ReadonlyArray<TrackAction> = ['advance', 'greenery', 'tr3', 'temperature', 'ocean', 'tr6'];
const SCIENCE_TAIL: ReadonlyArray<TrackAction> = ['advance', 'temperature', 'tr4', 'ocean', 'temperature2', 'tr8'];
const POWER_TAIL: ReadonlyArray<TrackAction> = ['advance', 'greenery', 'tr4', 'city', 'temperature', 'tr8'];
const EARTH_TAIL: ReadonlyArray<TrackAction> = ['advance', 'temperature', 'tr3', 'greenery', 'ocean', 'tr8'];
const BIO_TAIL: ReadonlyArray<TrackAction> = ['advance', 'greenery', 'tr3', 'greenery', 'temperature', 'tr7'];

/** The late reserve of each row, in the shared role order. */
export const AMAZONIS_PLANITIA_TAILS: ReadonlyArray<ReadonlyArray<TrackAction>> = [
  BUILDING_TAIL, SPACE_TAIL, EVENT_TAIL, SCIENCE_TAIL, POWER_TAIL, EARTH_TAIL, BIO_TAIL,
];

/** The module's colony cubes for Constructor (RB-C p.14), on the body's cells nearest the module's own places. */
export const AMAZONIS_PLANITIA_COLONY_CELLS: ReadonlyArray<{readonly track: number, readonly at: number}> = [
  {track: 1, at: 4}, {track: 1, at: 10}, {track: 4, at: 8},
];

function extended(body: TrackDefinition, index: number, tail: ReadonlyArray<TrackAction>): TrackDefinition {
  const layout: Array<TrackAction | undefined> = [...body.layout];
  for (const cell of AMAZONIS_PLANITIA_COLONY_CELLS) {
    if (cell.track === index) {
      layout[cell.at] = 'colony5';
    }
  }
  return {
    ...body,
    maxPosition: MARSBOT_EXTENDED_TRACK_POSITION,
    layout: [...layout, ...tail],
  };
}

/** The seven Martian rows: the Tharsis body (the law of the six boards, + Constructor's colony cubes) + the map's late reserve. */
export const AMAZONIS_PLANITIA_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> =
  THARSIS_MARSBOT_BOARD.map((body, i) => extended(body, i, AMAZONIS_PLANITIA_TAILS[i]));

/** Track indexes on the Amazonis Planitia MarsBot board (the shared role order). */
export const AMAZONIS_PLANITIA_TRACK = {
  BUILDING: 0,
  SPACE: 1,
  EVENT: 2,
  SCIENCE: 3,
  POWER: 4, // Power + Jovian
  EARTH: 5, // Earth + City
  BIO: 6, // Plant + Animal + Microbe
} as const;

/** The Venus row's last cell on this map. */
export const AMAZONIS_PLANITIA_VENUS_END = 15;

/**
 * The Venus row for a Venus that runs to 33 %: the printed 13-cell row (`venusTrackFor` — its cell-9 microbe icon
 * pointing at the row the Microbe tag rides on THIS mat) with its end re-cut — cell 12's «+5 TR» moves to 15, and
 * the three new cells are a Venus step, an «advance» and a DOUBLE Venus step: 7 Venus steps on the row for 18 on the
 * scale (the standard row: 4 for 15).
 */
export function amazonisPlanitiaVenusTrackFor(microbeTrackIndex: number): TrackDefinition {
  const printed = venusTrackFor(microbeTrackIndex);
  return {
    ...printed,
    maxPosition: AMAZONIS_PLANITIA_VENUS_END,
    layout: [
      ...printed.layout.slice(0, 12),
      'venus', // 12 — was the end's «+5 TR»
      'advance', // 13
      'venus2', // 14
      'tr5', // 15 — the end
    ],
  };
}

export const AMAZONIS_PLANITIA_VENUS_TRACK: TrackDefinition = amazonisPlanitiaVenusTrackFor(VENUS_CELL9_TARGET_TRACK);

// The exported tags / productions exist for the specs' «where each row came from» reading.
export const AMAZONIS_PLANITIA_ROW_TAGS: ReadonlyArray<ReadonlyArray<Tag>> = AMAZONIS_PLANITIA_MARSBOT_BOARD.map((t) => t.tags);
export const AMAZONIS_PLANITIA_ROW_PRODUCTIONS: ReadonlyArray<ReadonlyArray<Resource>> = AMAZONIS_PLANITIA_MARSBOT_BOARD.map((t) => t.productions);
