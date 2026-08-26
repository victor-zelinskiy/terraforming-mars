import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * The HELLAS MarsBot board — 7 tracks, positions 0–18.
 *
 * Transcribed CELL BY CELL from the official Hellas MarsBot board component
 * (late PnP / low-ink sheet, «compatible with rules v1.16+»); see
 * docs/AUTOMA_DATA_AUDIT.md §4 for the transcription notes and the per-cell
 * diff against Tharsis. `tests/automa/HellasMarsBotBoard.spec.ts` pins every
 * one of the 7 × 19 cells so a refactor can never silently move one.
 *
 * The one TAG difference from Tharsis is official and printed in the rulebook
 * (Adding Expansions p.8): «Hellas and Elysium: the [Jovian] tag is paired with
 * [Science], not with [Power] (as it is on the Tharsis board)». Production
 * regressions are UNCHANGED by that move — they follow the printed production
 * badge on each track's space 0, which is what `productions` below declares.
 *
 * The Venus-badged cells (a blue «V») are the Venus Next actions; the ones that
 * additionally carry the Colonies triangle (the floater cells) also apply with
 * Colonies alone — «Gain Floater: if playing without Venus Next, place a
 * resource token in the Titan storage area» (Adding Expansions p.4). With
 * NEITHER expansion they are icons of an unused expansion and are ignored
 * (rulebook p.7), which `AutomaResolver.performTrackAction` enforces.
 */

const TRACK_BUILDING: TrackDefinition = {
  role: 'building',
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, 'ocean', undefined, undefined, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', undefined, 'ocean', undefined, 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

const TRACK_SPACE: TrackDefinition = {
  role: 'space',
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, 'advance', undefined, 'temperature', undefined, 'ocean', 'city', 'venus', 'milestone', 'temperature', undefined, 'tr3', 'ocean', undefined, 'temperature', undefined, 'tr4', undefined, 'tr6'],
};

const TRACK_EVENT: TrackDefinition = {
  role: 'event',
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'advance', undefined, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

/**
 * The Jovian/Science track — Hellas' signature pairing (Adding Expansions p.8).
 * Its role stays `science`: every rule that names this track by role («advance
 * the science track», the Scientist/Researcher award reference) means THIS one,
 * on Tharsis and on Hellas alike. It carries no production badge, so no
 * production decrease can regress it — on either board.
 */
const TRACK_JOVIAN_SCIENCE: TrackDefinition = {
  role: 'science',
  tags: [Tag.JOVIAN, Tag.SCIENCE],
  productions: [],
  layout: [undefined, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', undefined, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

/** Power alone — the Jovian tag sits on the science track on this board. */
const TRACK_POWER: TrackDefinition = {
  role: 'power',
  tags: [Tag.POWER],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', 'advance', 'tr3', undefined, 'temperature', 'advance', 'milestone', undefined, 'temperature', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

const TRACK_CITY_EARTH: TrackDefinition = {
  role: 'earth',
  tags: [Tag.CITY, Tag.EARTH],
  productions: [Resource.HEAT],
  layout: [undefined, 'city', undefined, undefined, 'tr3', 'city', undefined, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

const TRACK_BIO: TrackDefinition = {
  role: 'bio',
  tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT],
  productions: [Resource.PLANTS],
  layout: [undefined, undefined, undefined, 'greenery', undefined, 'greenery', 'greenery', 'advance', undefined, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};

export const HELLAS_MARSBOT_BOARD: ReadonlyArray<TrackDefinition> = [
  TRACK_BUILDING,
  TRACK_SPACE,
  TRACK_EVENT,
  TRACK_JOVIAN_SCIENCE, // Jovian + Science
  TRACK_POWER,
  TRACK_CITY_EARTH, // City + Earth
  TRACK_BIO, // Microbe + Animal + Plant
];
