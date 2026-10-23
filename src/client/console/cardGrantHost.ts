/*
 * A CARD'S LIVE DELEGATE GRANT IS A STEP OF THE PLAY THAT RAISED IT (T03 Cultural Metropolis, ledger CF).
 *
 * A play may have TWO doors: the city's staged cell — the one reversible door, committed on the board — and THEN
 * «add 2 delegates to one resolution», the live grant the commit's answer raises (`PlaceDelegatesOnResolution`,
 * `votePrompt.source === 'grant'`, `choiceContext.source = {kind: 'card', card}`). The staged commit used to end the
 * flow on the board (the yielded hand dropped), so the grant met no host and rose as a standalone «ПАРЛАМЕНТ ›
 * ГОЛОСОВАНИЕ» — the card's name gone from the crumb, a second place for one press.
 *
 * The rule, stated once (the colony's twin is `colonyGrantStepLive`): a live grant whose giver is a CARD whose flow
 * stands aside for the board is OWED to that flow — the flow is kept, it comes back over the quiet board, and the
 * Parliament's vote mode is pushed as a step inside it («КАРТЫ В РУКЕ › КУЛЬТУРНЫЙ МЕТРОПОЛИС › ГОЛОСОВАНИЕ»). A
 * grant with no such flow (a reload, a play outside the console's own door) keeps the standalone Parliament.
 */
import type {PlayerInputModel} from '@/common/models/PlayerInputModel';

/** The card a standing prompt's delegate GRANT is given by — or `undefined` (not a grant, or not a card's). */
export function cardGrantCardOf(wf: PlayerInputModel | undefined): string | undefined {
  if (wf === undefined || wf.type !== 'party' || wf.votePrompt?.source !== 'grant') {
    return undefined;
  }
  const source = wf.choiceContext?.source;
  return source?.kind === 'card' && typeof source.card === 'string' ? source.card : undefined;
}

/**
 * Does the standing grant belong to the flow carrying `card`? `carried` is the set of cards the yielded flow carries
 * (its frames' subjects / source cards) — the module reads the stack, this function only decides.
 */
export function cardGrantOwedTo(wf: PlayerInputModel | undefined, carried: ReadonlyArray<string>): boolean {
  const card = cardGrantCardOf(wf);
  return card !== undefined && carried.includes(card);
}
