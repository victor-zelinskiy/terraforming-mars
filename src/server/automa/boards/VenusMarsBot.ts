import {Tag} from '../../../common/cards/Tag';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * The Venus Next MarsBot board — a single VENUS track, positions 0–12.
 *
 * Rules source: TM-Automa-rulebook-C-11-14-2023 (Adding Expansions), p.2:
 * - "Whenever MarsBot resolves a project card with a Venus tag, advance its tracker on its
 *    Venus track. The Venus track and its actions behave identically to every other track."
 * - New actions: "Raise Venus 1 Step" (Failed Action if the Venus global parameter is maxed;
 *   +1 TR per normal rules) and "Gain Floater" (token onto the floater storage area).
 *
 * Layout source: transcription from the official component image
 * (TM-Automa-rulebook-A, p.2 "1 Venus Next MarsBot board", rendered at high resolution).
 * See docs/AUTOMA_DATA_AUDIT.md for the transcription notes.
 *
 * Positions: 0 (start, no action), 1 floater, 2 floater×2, 3 venus, 4 floater×2, 5 venus,
 * 6 empty, 7 floater×2, 8 venus, 9 advance-Bio-track (circular tag icon), 10 venus,
 * 11 floater×2, 12 gain 5 TR.
 *
 * Position 9 is a MICROBE tag icon → advance the Bio track — VERIFIED against the
 * physical Venus Next MarsBot board by the owner (2026-07-07); the alternative
 * Jovian/Energy reading is ruled out. Encoded as `tag_${VENUS_CELL9_TARGET_TRACK}` below.
 */

/** Track index (on THARSIS_MARSBOT_BOARD) that the circular tag icon on position 9 advances. */
export const VENUS_CELL9_TARGET_TRACK = 6; // Tharsis Bio track (Plant/Animal/Microbe)

/** Index the Venus track gets when appended after the 7 Tharsis tracks. */
export const VENUS_TRACK_INDEX = 7;

export const VENUS_TRACK: TrackDefinition = {
  tags: [Tag.VENUS],
  productions: [],
  maxPosition: 12,
  layout: [
    undefined, // 0 — start
    'floater', // 1
    'floater2', // 2
    'venus', // 3
    'floater2', // 4
    'venus', // 5
    undefined, // 6
    'floater2', // 7
    'venus', // 8
    `tag_${VENUS_CELL9_TARGET_TRACK}`, // 9 — microbe tag: advance the Bio track (verified vs the component)
    'venus', // 10
    'floater2', // 11
    'tr5', // 12 — end of track
  ],
};
