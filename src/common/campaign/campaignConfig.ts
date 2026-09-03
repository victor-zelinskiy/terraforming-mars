// Campaign mode — the ONE table-driven source of truth for titles, Title
// Points and next-mission bonus M€ (docs/CAMPAIGN_MODE_ARCHITECTURE.md §7.2,
// approved values). Pure data + tiny pure helpers; no UI, no engine knowledge.
//
// Commit-time COPIES these values into MissionResult snapshots, so later
// tuning never rewrites an existing campaign's history.

import {TitleName} from './CampaignTypes';

/**
 * Chevron count is the VISUAL rank of the emblem (assets/titles/*.png), not
 * the Title Points value — deliberately distinct (approved D1).
 */
export const TITLE_TABLE: Record<TitleName, {titlePoints: number, chevrons: 1 | 2 | 3}> = {
  governor: {titlePoints: 15, chevrons: 3},
  administrator: {titlePoints: 10, chevrons: 2},
  prefect: {titlePoints: 5, chevrons: 1},
};

/**
 * place (1-based) → title, by seat count. The MarsBot counts as a full seat.
 * `null` / absent ⇒ no title for that place.
 */
export const PLACE_TITLES: Record<number, ReadonlyArray<TitleName | null>> = {
  2: ['governor', 'administrator'],
  3: ['governor', 'administrator', 'prefect'],
  4: ['governor', 'administrator', 'prefect', null],
  5: ['governor', 'administrator', 'prefect', null, null],
};

/**
 * place (1-based) → bonus M€ granted at the start of the NEXT mission.
 * Same ladder for every seat count; places beyond the table take the last row.
 */
export const PLACE_BONUS_MC: ReadonlyArray<number> = [0, 5, 10, 15, 15];

/** Approved D2: the final mission awards no new titles/TP/bonus — it crowns the champion. */
export const FINAL_MISSION_AWARDS_TITLES = false;

export function titleForPlace(place: number, seatCount: number): TitleName | undefined {
  const row = PLACE_TITLES[seatCount] ?? PLACE_TITLES[5];
  return row[place - 1] ?? undefined;
}

export function bonusForPlace(place: number): number {
  return PLACE_BONUS_MC[Math.min(place, PLACE_BONUS_MC.length) - 1];
}
