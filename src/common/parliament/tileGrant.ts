/*
 * A TILE A LAW GRANTS THE SEATS, AS DATA (Turmoil Redux — Skyscrapers RX20,
 * Mars First Budget RX38).
 *
 * The winner's part (`winnerReward.ts`) goes to ONE seat; an influence-scaled
 * part (`influenceScaling.ts`) pays EVERY seat an amount. A tile grant is
 * neither: what each recipient gets is not an amount but ONE tile, and the
 * declaration answers TWO questions that are kept apart, because the cards
 * answer them independently:
 *
 *   WHO   (`recipients`) — a SET decided by a threshold («the player that won
 *         this resolution and players with at least 2 Influence», Skyscrapers)
 *         or EVERY participant («each player places a city tile — clockwise
 *         from the First Player», Mars First Budget);
 *   WHERE (`placement`)  — a TIER on a city the seat already owns on Mars
 *         (`own-city`) or a cell by the ordinary city rules (`any-legal`).
 *
 * The sentence lives in the catalog (`text.effect`); the DATA lives here, so
 * every surface that must say «do I get it, and where does it go» reads one
 * declaration and the same rule the engine pays by — never a per-card branch,
 * never a re-derived threshold. Every function below is an exhaustive
 * `switch`, so a third answer to either question fails the compile at every
 * reader at once. WHO is the shared rule of EVERY grant (`seatGrant.ts` —
 * Reds Budget's step of the Career asks the same predicate); WHERE is the
 * tile's own question.
 *
 * WHO INCLUDES MARSBOT (decision D11, 2026-10-20): a law never pays the bot
 * and never charges it, but the TILE it grants the seats the bot receives by
 * the same recipients rule and places by its own primitive (the aspect
 * `seat-grant`, `server/automa/BotTileGrant.ts`).
 *
 * Nothing here promises the CELL: which city, its greeneries, the stack it
 * becomes, the bonus it pays — that is the placement dossier's, once the seat
 * points at one.
 */

import {ResolutionCountId} from './resolutionCounts';
import {GRANT_NOT_ELIGIBLE_REASON, GrantEligibility, grantEligibility, grantInfluenceLine, GrantRecipients, grantRewardsWinner} from './seatGrant';

/**
 * WHO receives the tile — the shared recipients of every grant (`seatGrant.ts`):
 *  - `threshold` — the winner of the vote always, and every participant at or above the influence line;
 *  - `everyone`  — every participant, in generation order from the first player, whether they voted or not.
 */
export type TileGrantRecipients = GrantRecipients;

/**
 * WHERE it lands:
 *  - `own-city`  — on top of one of the seat's own cities on Mars (the cell's stack grows by one);
 *  - `any-legal` — on any cell the ordinary city rules allow (a new city; the cell pays its placement bonus).
 */
export type TileGrantPlacement = 'own-city' | 'any-legal';

/** The tile a law grants the seats: ONE city tile, WHO and WHERE declared apart. */
export type TileGrantDeclaration = {
  tile: 'city';
  placement: TileGrantPlacement;
  recipients: TileGrantRecipients;
};

/** WHY a seat receives the tile — or does not: the shared grant's own answer (`GrantEligibility`). */
export type TileGrantEligibility = GrantEligibility;

export function tileGrantEligibility(grant: TileGrantDeclaration, seat: {winner: boolean, influence: number}): TileGrantEligibility {
  return grantEligibility(grant.recipients, seat);
}

/** The influence line of a threshold grant — `undefined` for a grant to everyone (no line to read). */
export function tileGrantInfluenceLine(grant: TileGrantDeclaration): number | undefined {
  return grantInfluenceLine(grant.recipients);
}

/** Does the grant reward the WINNER as such (the star of a threshold grant)? A grant to everyone has no winner's part. */
export function tileGrantRewardsWinner(grant: TileGrantDeclaration): boolean {
  return grantRewardsWinner(grant.recipients);
}

/**
 * THE COUNT that explains WHERE the tile may go — the seat's legal
 * destinations as a board count the server model carries per seat
 * (`ParliamentPlayerModel.counts`), read by the same cell predicate the
 * stand uses. A grant onto the seat's own city counts their cities on Mars
 * (a cell once, whatever its stack; a zero is the honest «nothing lands»).
 * A grant by the ordinary rules counts NOTHING (`undefined`): the legal cells
 * of a city are almost always many, the number explains nothing, and an
 * empty board is the step's own named skip at the execution.
 */
export function tileGrantCountId(grant: TileGrantDeclaration): ResolutionCountId | undefined {
  switch (grant.placement) {
  case 'own-city': return 'marsCities';
  case 'any-legal': return undefined;
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
  case 'any-legal': return grant.tile;
  }
}

/** The skips' reasons — English keys the stage plate translates; the server records them, every reading prints them. */
export const TILE_GRANT_NOT_ELIGIBLE_REASON = GRANT_NOT_ELIGIBLE_REASON;
export const TILE_GRANT_NO_DESTINATION_REASON = 'No city on Mars to build on';
/** The ordinary city rules left no cell (the key the standard project already prints). */
export const TILE_GRANT_NO_SPACE_REASON = 'No space left for a city tile';

/** The named skip of a seat with nowhere for the tile to go — the placement's own words. */
export function tileGrantNoDestinationReason(grant: TileGrantDeclaration): string {
  switch (grant.placement) {
  case 'own-city': return TILE_GRANT_NO_DESTINATION_REASON;
  case 'any-legal': return TILE_GRANT_NO_SPACE_REASON;
  }
}
