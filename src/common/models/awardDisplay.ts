import {Color} from '../Color';
import {AwardScore} from './FundedAwardModel';

/** One current award leader — a player and their (top) score. */
export type AwardLeader = {color: Color, score: number};

/**
 * The current award LEADER(S) — the single shared derivation used by EVERY
 * award surface (console-native list, desktop plaque marker, tooltips) so they
 * can never disagree.
 *
 * Rules (mirroring the endgame scoring in calculateVictoryPoints.giveAwards):
 *  - the leader(s) are the player(s) tied at the TOP score;
 *  - a top score of 0 (or no scores) is "no meaningful leader yet" → [];
 *  - a multi-way tie for the top returns EVERY tied player (the server awards
 *    them all the 1st-place VP), never just one.
 *
 * The result preserves the input order of the tied players (the model already
 * sends them in a stable player order).
 */
export function awardLeaders(scores: ReadonlyArray<AwardScore>): Array<AwardLeader> {
  let top = 0;
  for (const s of scores) {
    if (s.score > top) {
      top = s.score;
    }
  }
  if (top <= 0) {
    return [];
  }
  return scores.filter((s) => s.score === top).map((s) => ({color: s.color, score: s.score}));
}
