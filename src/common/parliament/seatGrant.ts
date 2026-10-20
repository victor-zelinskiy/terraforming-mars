/*
 * WHAT A LAW GRANTS THE SEATS — the shared WHO of every grant (Turmoil Redux:
 * Skyscrapers RX20 and Mars First Budget RX38 grant a TILE, Reds Budget RX39 a
 * STEP OF THE CAREER).
 *
 * A grant is neither the winner's part (`winnerReward.ts` — ONE seat) nor an
 * influence-scaled amount (`influenceScaling.ts` — every seat a number): what
 * each recipient receives is ONE DEED the law hands the seat — a tile it
 * places, a marker it moves. Every grant answers «who receives it» by the
 * SAME rule, so the rule lives here once and each declaration (`tileGrant.ts`,
 * `agendaGrant.ts`) states only what the deed is:
 *
 *   threshold — the winner of the vote always, and every participant at or
 *               above the influence line («the player that won this
 *               resolution and players with at least 2 Influence»);
 *   everyone  — every participant, in generation order from the first player,
 *               whether they voted or not («each player places a city tile»,
 *               «each player advances their Agenda marker 1 step»).
 *
 * WHO INCLUDES MARSBOT (decision D11, 2026-10-20): a law never pays the bot
 * and never charges it, but the DEED it grants the seats the bot performs
 * itself, by the same recipients rule, with its own primitive (the aspect
 * `seat-grant`). Pure — no engine, no i18n calls (the reasons are English keys).
 */

/** WHO receives a grant — a set decided by a threshold, or every participant. */
export type GrantRecipients =
  | {kind: 'threshold'; winner: true; influenceAtLeast: number}
  | {kind: 'everyone'};

/**
 * WHY a seat receives the grant — or does not. `winner` outranks `influence`
 * (a winner below the line still receives it: the star is unconditional);
 * `everyone` is the seat a grant to every player reaches by being seated;
 * `none` is the seat the rule passes over, and every reading names it as a
 * fact of the rule, never as «no influence».
 */
export type GrantEligibility = 'winner' | 'influence' | 'everyone' | 'none';

/** The ONE predicate of WHO — the server's step, the bot's executor and every client reading ask it. */
export function grantEligibility(recipients: GrantRecipients, seat: {winner: boolean, influence: number}): GrantEligibility {
  switch (recipients.kind) {
  case 'everyone':
    return 'everyone';
  case 'threshold':
    if (seat.winner) {
      return 'winner';
    }
    return seat.influence >= recipients.influenceAtLeast ? 'influence' : 'none';
  }
}

/** The influence line of a threshold grant — `undefined` for a grant to everyone (no line to read). */
export function grantInfluenceLine(recipients: GrantRecipients): number | undefined {
  switch (recipients.kind) {
  case 'threshold': return recipients.influenceAtLeast;
  case 'everyone': return undefined;
  }
}

/** Does the grant reward the WINNER as such (the star of a threshold grant)? A grant to everyone has no winner's part. */
export function grantRewardsWinner(recipients: GrantRecipients): boolean {
  switch (recipients.kind) {
  case 'threshold': return recipients.winner;
  case 'everyone': return false;
  }
}

/** The skip of a seat a threshold grant passes over — the rule's own words (an English key the stage plate translates). */
export const GRANT_NOT_ELIGIBLE_REASON = 'Below 2 influence and not the winner of the vote';
