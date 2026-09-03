// Campaign mode — SERVER-authoritative mission standings.
//
// Ordering is the shared comparator (src/common/game/scoreComparator.ts) —
// the exact ranking the client endgame renders, so a tie can never resolve
// differently on the two sides. Full ties share the better place
// (competition ranking: the next place is skipped); no further tie-break
// exists by design.

import {compareFinalScores} from '../../common/game/scoreComparator';
import {MissionStanding} from '../../common/campaign/CampaignTypes';
import {isICorporationCard} from '../cards/corporation/ICorporationCard';
import {IGame} from '../IGame';

export function computeMissionStandings(game: IGame): Array<MissionStanding> {
  const rows = game.players.map((p) => {
    if (p.campaignSeat === undefined) {
      throw new Error(`campaignSeat is not set for ${p.id} in campaign mission ${game.id}`);
    }
    return {
      seat: p.campaignSeat,
      total: p.getVictoryPoints().total,
      megaCredits: p.megaCredits,
      corporations: p.playedCards.filter(isICorporationCard).map((c) => c.name),
    };
  });
  rows.sort((a, b) => compareFinalScores(a, b));

  const standings: Array<MissionStanding> = [];
  let place = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && compareFinalScores(rows[i - 1], rows[i]) !== 0) {
      // Competition ranking: after a shared place the next one is skipped.
      place = i + 1;
    }
    standings.push({
      seat: rows[i].seat,
      place,
      score: rows[i].total,
      megaCredits: rows[i].megaCredits,
      corporations: rows[i].corporations,
      tiedWith: [],
    });
  }
  // Fill the shared-place cross references.
  for (const s of standings) {
    (s as {tiedWith: ReadonlyArray<number>}).tiedWith =
      standings.filter((o) => o.place === s.place && o.seat !== s.seat).map((o) => o.seat);
  }
  return standings;
}
