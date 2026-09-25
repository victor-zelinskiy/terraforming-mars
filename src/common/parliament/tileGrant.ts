/*
 * A TILE GRANTED BY THRESHOLD, AS DATA (Turmoil Redux — Skyscrapers, RX20).
 *
 * The winner's part (`winnerReward.ts`) goes to ONE seat; an influence-scaled
 * part (`influenceScaling.ts`) pays EVERY seat an amount. Skyscrapers is
 * neither: «the player that won this resolution and players with at least 2
 * Influence each gain a city tile that they MUST place on their existing city
 * on Mars». The recipients are a SET decided by a threshold — the winner
 * always, any other seat at or above the influence line — and what each of
 * them gets is not an amount but ONE tile with ONE legal destination: a tier
 * on top of a city they already own. The sentence lives in the catalog
 * (`text.effect`); the DATA lives here, so every surface that must say «do I
 * get it, and where does it go» reads one declaration and the same rule the
 * engine pays by — never a per-card branch, never a re-derived threshold.
 *
 * Nothing here promises the CELL: which city, its greeneries, the stack it
 * becomes — that is the placement dossier's, once the seat points at one.
 */

import {ResolutionCountId} from './resolutionCounts';

/** WHO receives the tile: the winner of the vote always, and every participant at or above the influence line. */
export type TileGrantRecipients = {
  winner: true;
  influenceAtLeast: number;
};

/** The tile granted by threshold: ONE city tile, placed as a TIER on the seat's own existing city on Mars. */
export type TileGrantDeclaration = {
  tile: 'city';
  /** WHERE it lands: on top of one of the seat's own cities on Mars — the cell's stack grows by one. */
  placement: 'own-city';
  recipients: TileGrantRecipients;
};

/**
 * WHY a seat receives the tile — or does not. `winner` outranks `influence`
 * (a winner below the line still receives it: the star is unconditional);
 * `none` is the seat the law passes over, and every reading names it as a
 * fact of the rule, never as «no influence».
 */
export type TileGrantEligibility = 'winner' | 'influence' | 'none';

export function tileGrantEligibility(grant: TileGrantDeclaration, seat: {winner: boolean, influence: number}): TileGrantEligibility {
  if (seat.winner) {
    return 'winner';
  }
  return seat.influence >= grant.recipients.influenceAtLeast ? 'influence' : 'none';
}

/**
 * THE COUNT that explains WHERE the tile may go — the seat's legal
 * destinations as a board count the server model carries per seat
 * (`ParliamentPlayerModel.counts`), read by the same cell predicate the
 * stand uses. A grant onto the seat's own city counts their cities on Mars;
 * the number is the destinations (a cell once, whatever its stack), and a
 * zero is the honest «nothing lands».
 */
export function tileGrantCountId(grant: TileGrantDeclaration): ResolutionCountId {
  switch (grant.placement) {
  case 'own-city': return 'marsCities';
  }
}

/**
 * THE STEP KEY the grant's record is filed under — derived from the
 * declaration, so the server's step and every client reading of «the viewer's
 * record of the grant» name the same thing without a per-card table.
 */
export function tileGrantStepKey(grant: TileGrantDeclaration): string {
  switch (grant.placement) {
  case 'own-city': return `${grant.tile}-tier`;
  }
}

/** The skips' reasons — English keys the stage plate translates; the server records them, every reading prints them. */
export const TILE_GRANT_NOT_ELIGIBLE_REASON = 'Below 2 influence and not the winner of the vote';
export const TILE_GRANT_NO_DESTINATION_REASON = 'No city on Mars to build on';
