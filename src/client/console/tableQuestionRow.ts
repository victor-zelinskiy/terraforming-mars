/*
 * THE ROW OF A TABLE QUESTION THAT MAY WAIT FOR A DRAW — the play composer's reading (the owner's decision 2026-10-15,
 * «Конференция на Олимпе» × «Марсианский университет»).
 *
 * The rule — may this question wait, and for whom — is `common/models/tableQuestionDeferral.ts`. This module turns its
 * verdict and the row's answer into what the ROW is: its state, whether it holds up the commit, whether the cursor is
 * offered to it, and the words of its two lines (i18n keys + params — the component translates). Pure: no Vue, no
 * translation, testable under the server runner.
 *
 *  · `locked`   — an earlier question whose answer may draw is unanswered: «Ждёт ответа: <карта>». Not a cursor stop
 *                 (there is nothing to do here yet), never «missing» (the question above it is what holds the commit).
 *  · `deferred` — a draw lands first and the player has not answered: «Спросят после добора», the badge «можно позже»,
 *                 the note naming who draws and that the new card may be the one to give up. Valid as it is — the
 *                 commit is open, nothing is posted, the server asks it live after the draw.
 *  · `early`    — the same question answered NOW (a card to discard, or the decline): the answer, and the note that it
 *                 was chosen before the draw.
 *  · `plain`    — an ordinary pre-select (nothing draws before it).
 */
import {CardName} from '@/common/cards/CardName';
import {DeferralDrawer, ReactionDeferral, drawnCardCount} from '@/common/models/tableQuestionDeferral';

export type TableQuestionRowState =
  | {kind: 'plain'}
  | {kind: 'locked', gates: ReadonlyArray<CardName>}
  | {kind: 'deferred', drawers: ReadonlyArray<DeferralDrawer>}
  | {kind: 'early', drawers: ReadonlyArray<DeferralDrawer>};

export function tableQuestionRowState(deferral: ReactionDeferral, answered: boolean): TableQuestionRowState {
  switch (deferral.state) {
  case 'locked': return {kind: 'locked', gates: deferral.gates};
  case 'deferrable': return answered ? {kind: 'early', drawers: deferral.drawers} : {kind: 'deferred', drawers: deferral.drawers};
  case 'none': return {kind: 'plain'};
  }
}

/** Does the row hold up the commit? Only an ordinary unanswered question does — a waiting or a deferrable one never. */
export function tableQuestionRowMissing(state: TableQuestionRowState, answered: boolean): boolean {
  return state.kind === 'plain' && !answered;
}

/** May the cursor stop here? A row that waits for the question above it has nothing to do yet. */
export function tableQuestionRowFocusable(state: TableQuestionRowState): boolean {
  return state.kind !== 'locked';
}

/**
 * Is the cursor OFFERED this row — sent to it on open / after the answer above it, as to the next question — although
 * it holds nothing up? A deferred row is the game asking «and this one — now, or after the draw?» ONCE: after the cursor
 * has left it (`seen`) the walk goes on to the commit.
 */
export function tableQuestionRowOffered(state: TableQuestionRowState, seen: boolean): boolean {
  return state.kind === 'deferred' && !seen;
}

/** A line's words: an i18n key with its params, plus the chip of the cards drawn first (`cards` — `undefined` = unstated). */
export type TableQuestionLine = {key: string, params: ReadonlyArray<string>};

/** The drawers' names as one parameter (« · »-joined, each in its own quotes — the caller's translator names them). */
function namesParam(cards: ReadonlyArray<CardName>, name: (c: CardName) => string): string {
  return cards.map((c) => `«${name(c)}»`).join(' · ');
}

/**
 * The row's VALUE line for the two states that have no answer to show. `locked` — «Ждёт ответа: «Конференция на
 * Олимпе»»; `deferred` — «Спросят после добора». `undefined` for a row whose value is its answer.
 */
export function tableQuestionValue(state: TableQuestionRowState, name: (c: CardName) => string): TableQuestionLine | undefined {
  switch (state.kind) {
  case 'locked': return {key: 'Waits for the answer: ${0}', params: [namesParam(state.gates, name)]};
  case 'deferred': return {key: 'Asked after the draw', params: []};
  default: return undefined;
  }
}

/**
 * The row's NOTE line — why it waits, or what waiting buys. `locked` — that answer decides whether a card arrives first;
 * `deferred` — «Сначала добор: «X»» + the drawn-cards chip + «сбросить можно будет и новую карту»; `early` — «Выбрано
 * сейчас, до добора: «X»»; `plain` of a row that COULD have waited (`gated` — the answer above it drew nothing) — «Новая
 * карта до вопроса не придёт», so the row keeps its three lines and says why it is owed now. The chip's count is `drawn`
 * (absent when a drawer's count is unstated — no invented number).
 */
export function tableQuestionNote(state: TableQuestionRowState, name: (c: CardName) => string, gated = false):
  {lead: TableQuestionLine, drawn?: number, tail?: TableQuestionLine} | undefined {
  switch (state.kind) {
  case 'locked':
    return {lead: {key: 'That answer decides whether a new card arrives before this question', params: []}};
  case 'deferred': {
    const n = drawnCardCount(state.drawers);
    return {
      lead: {key: 'First the draw: ${0}', params: [namesParam(state.drawers.map((d) => d.card), name)]},
      ...(n !== undefined ? {drawn: n} : {}),
      tail: {key: n === 1 ? 'the new card can be discarded too' : 'the new cards can be discarded too', params: []},
    };
  }
  case 'early':
    return {lead: {key: 'Chosen now, before the draw: ${0}', params: [namesParam(state.drawers.map((d) => d.card), name)]}};
  case 'plain':
    return gated ? {lead: {key: 'No card arrives before it', params: []}} : undefined;
  }
}

/** Could this question ever wait for a draw — does the server name a gate above it or a draw before it? */
export function tableQuestionCanWait(reaction: {afterDraw?: ReadonlyArray<string>, drawnBefore?: ReadonlyArray<unknown>} | undefined): boolean {
  return (reaction?.afterDraw?.length ?? 0) > 0 || (reaction?.drawnBefore?.length ?? 0) > 0;
}

/**
 * THE DEFER PLATE of the album opened from a deferrable row (R3 — «Решить после добора»): who draws first, and how many.
 * The album's question line repeats the button where the eye is; answering it clears an early answer and returns the row
 * to «Спросят после добора».
 */
export type DeferPlateModel = {label: string, drawers: ReadonlyArray<DeferralDrawer>, drawn?: number};

export function deferPlateOf(state: TableQuestionRowState): DeferPlateModel | undefined {
  if (state.kind !== 'deferred' && state.kind !== 'early') {
    return undefined;
  }
  const n = drawnCardCount(state.drawers);
  return {label: 'Decide after the draw', drawers: state.drawers, ...(n !== undefined ? {drawn: n} : {})};
}

/**
 * The hand cards another discard of the same composer already holds — refused in this pick's album with their reason
 * (two discards answered before the press must not name one card: the second would meet a hand without it). `own` —
 * the choice being opened (its own answer is no conflict).
 */
export function cardsHeldByOtherDiscards(
  answers: ReadonlyArray<{id: string, cards: ReadonlyArray<string>}>,
  own: string,
): Set<string> {
  const out = new Set<string>();
  for (const a of answers) {
    if (a.id !== own) {
      a.cards.forEach((c) => out.add(c));
    }
  }
  return out;
}
