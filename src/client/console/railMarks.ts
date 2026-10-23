/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE RATING CELL'S MARKS — a corporation's STATE on the rail is a mark in the
 * rating cell's own slot grammar, read off a SERVER FIELD, never derived from
 * the log or a rating delta (invariants 1–2; `docs/claude/console/hud-frame.md`
 * § «Печати на ячейке РТ»).
 *
 * Two marks stand on the rating icon's wrap today, each in its own place:
 *   · the RX42 UNMI VETO — the Reds' ring + strike over the whole icon
 *     (`ConsoleShell.railTrVeto`, off `parliament.enacted.trVeto`);
 *   · PRISTAR (R07) — a small preservation token in the lower-right corner:
 *     «waiting» while the seat's rating has not risen this generation (the
 *     production phase will pay +1 preservation and 6 M€), «spent» once it has
 *     (the same token, struck and dimmed — the card face's own «cancelled»).
 * Both may stand at once (a Pristar seat first by rating under the veto): two
 * places, never one over the other, and the hint names both.
 */
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/** Pristar's state for one seat: the payout still stands this generation, or a rise has already cancelled it. */
export type PristarMark = 'waiting' | 'spent';

/**
 * The seat's Pristar mark — undefined for every seat that does not own the corporation (and for the MarsBot,
 * whose C36 twin is its own mechanic on its own rail). Pure: the corporation on the public tableau and the
 * server's `ratingRaisedThisGeneration`.
 */
export function pristarMarkOf(seat: Pick<PublicPlayerModel, 'tableau' | 'ratingRaisedThisGeneration' | 'isMarsBot'>): PristarMark | undefined {
  if (seat.isMarsBot === true || !seat.tableau.some((card) => card.name === CardName.PRISTAR)) {
    return undefined;
  }
  return seat.ratingRaisedThisGeneration ? 'spent' : 'waiting';
}

/** The mark's hint, one sentence per state (the TV has no hover — the e2e reads it); the name is the card's own. */
export const PRISTAR_MARK_HINT: Readonly<Record<PristarMark, string>> = {
  waiting: '${0}: no TR gained this generation — +1 preservation and 6 M€ at production',
  spent: '${0}: TR gained this generation — the effect will not trigger',
};
