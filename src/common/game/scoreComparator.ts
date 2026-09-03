// The ONE final-score ordering of the whole project: higher VP total wins,
// then higher M€. Extracted so the server-side campaign standings
// (src/server/campaign/missionStandings.ts) and the client endgame ranking
// (src/client/components/endgame/endgameModel.ts) can never disagree about a
// tie. A full tie (both metrics equal) returns 0 — callers implement
// shared-place / co-winner semantics on top; no further tie-break exists by
// design (never seat order, never random).

export type FinalScoreLike = {
  total: number;
  megaCredits: number;
};

export function compareFinalScores(a: FinalScoreLike, b: FinalScoreLike): number {
  if (a.total !== b.total) {
    return b.total - a.total;
  }
  return b.megaCredits - a.megaCredits;
}
