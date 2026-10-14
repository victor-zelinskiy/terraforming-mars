import {CardName} from '../cards/CardName';

/**
 * A DISCARD FROM THE HAND BEHIND A DRAW — ANSWER NOW, OR AFTER THE DRAW (the owner's decision 2026-10-15, his photo of
 * «Конференция на Олимпе» × «Марсианский университет»).
 *
 * A play wakes two table questions in one queue: Olympus Conference asks first («remove a science to draw a card, or
 * add one»), Mars University after it («discard a card to draw one»). When Olympus' answer DRAWS, the card it brings is
 * in the hand by the time the university asks — and it may be the very card worth giving up. Until 2026-10-15 the
 * composer then handed the university's question on as a «ДАЛЕЕ» line with no way to answer it before the press; the
 * owner wanted the opposite: the game asks Olympus FIRST (the university waits for that answer), then OFFERS the
 * university's question — answerable now over the hand the player sees, or SKIPPED, the screen saying so, to be asked
 * once the drawn card is in the hand.
 *
 * ONE rule for every reader: the composer (`ConsolePlayCardConfirm` — the row's state, its focus, its batch) and the
 * replay guard (`cardPlayReplayCoverage` — the deferred walk) ask THIS function, so «may this wait» cannot be answered
 * twice. Pure: models in, a verdict out.
 *
 *  · `none` — an ordinary pre-select: nothing draws before it, the answer is required.
 *  · `locked` — an EARLIER question whose answer may draw is still unanswered (`reaction.afterDraw`): this one waits
 *    for it (the owner: «сначала требовала выбрать … для конференции и затем позволяла выбрать … для университета»).
 *  · `deferrable` — a draw lands before it (the card's own draw, an exact reaction, a question asked after the press —
 *    `reaction.drawnBefore`; or an earlier question ANSWERED with a draw): an unanswered row posts nothing and the
 *    server asks it live after the draw; an answer given now lands by its address once the draw is done.
 */

/** The `reaction` a table question's step carries (`ActionPreviewStep.reaction`). */
export type DeferralReaction = {
  card: CardName,
  fact: string,
  afterDraw?: ReadonlyArray<string>,
  drawnBefore?: ReadonlyArray<{card: CardName, cards?: number}>,
};

/** A table question as the rule reads it — the composer's pre-step choice and the guard's preview step alike. */
export type DeferralQuestion = {
  reaction?: DeferralReaction,
  input: unknown,
};

/** Who draws before a question, and how many cards when the server knows it. */
export type DeferralDrawer = {card: CardName, cards?: number};

export type ReactionDeferral =
  | {state: 'none'}
  | {state: 'locked', gates: ReadonlyArray<CardName>}
  | {state: 'deferrable', drawers: ReadonlyArray<DeferralDrawer>};

type OptionShape = {
  metadata?: {effects?: ReadonlyArray<{direction?: string, icon?: string, amount?: number}>},
  discardPrompt?: {exchange?: {icon?: string, amount?: number}},
  options?: ReadonlyArray<unknown>,
};

/**
 * Does an option DRAW a card when chosen — its own server chips (`metadata.effects` — a cards gain) or a discard that
 * buys cards (`discardPrompt.exchange`)?
 */
export function optionDraws(option: unknown): boolean {
  const o = option as OptionShape;
  if ((o.metadata?.effects ?? []).some((e) => e.direction === 'gain' && e.icon === 'cards')) {
    return true;
  }
  if (o.discardPrompt?.exchange?.icon === 'cards') {
    return true;
  }
  return (o.options ?? []).some((inner) => optionDraws(inner));
}

/** How many cards an option draws, when its chips say so (`undefined` = it draws, the count is not stated). */
export function optionDrawCount(option: unknown): number | undefined {
  const o = option as OptionShape;
  const chip = (o.metadata?.effects ?? []).find((e) => e.direction === 'gain' && e.icon === 'cards');
  if (chip !== undefined) {
    return chip.amount;
  }
  if (o.discardPrompt?.exchange?.icon === 'cards') {
    return o.discardPrompt.exchange.amount;
  }
  for (const inner of o.options ?? []) {
    if (optionDraws(inner)) {
      return optionDrawCount(inner);
    }
  }
  return undefined;
}

/** The option an `{type: 'or', index}` answer chose, if it is one. */
export function chosenOrOption(input: unknown, answer: unknown): unknown | undefined {
  const a = answer as {type?: string, index?: number} | undefined;
  if (a?.type !== 'or' || a.index === undefined) {
    return undefined;
  }
  return (input as {options?: ReadonlyArray<unknown>}).options?.[a.index];
}

/**
 * The verdict for one question. `questions` — every table question of the play (a gate is found by its fact);
 * `answerOf` — the answer collected for a question so far (`undefined` = none yet).
 */
export function reactionDeferral(
  question: DeferralQuestion,
  questions: ReadonlyArray<DeferralQuestion>,
  answerOf: (q: DeferralQuestion) => unknown,
): ReactionDeferral {
  const r = question.reaction;
  if (r === undefined) {
    return {state: 'none'};
  }
  const drawers: Array<DeferralDrawer> = [...(r.drawnBefore ?? [])];
  const pending: Array<CardName> = [];
  for (const fact of r.afterDraw ?? []) {
    const gate = questions.find((q) => q.reaction?.fact === fact);
    if (gate?.reaction === undefined) {
      continue;
    }
    const answer = answerOf(gate);
    if (answer === undefined) {
      pending.push(gate.reaction.card);
      continue;
    }
    const chosen = chosenOrOption(gate.input, answer);
    if (chosen !== undefined && optionDraws(chosen)) {
      drawers.push({card: gate.reaction.card, cards: optionDrawCount(chosen)});
    }
  }
  if (drawers.length > 0) {
    return {state: 'deferrable', drawers: mergeDrawers(drawers)};
  }
  if (pending.length > 0) {
    return {state: 'locked', gates: [...new Set(pending)]};
  }
  return {state: 'none'};
}

/** One entry per drawing card (two Olympus questions are one name); the counts add up while every one is known. */
function mergeDrawers(drawers: ReadonlyArray<DeferralDrawer>): Array<DeferralDrawer> {
  const out: Array<DeferralDrawer> = [];
  for (const d of drawers) {
    const seen = out.find((o) => o.card === d.card);
    if (seen === undefined) {
      out.push({...d});
    } else {
      seen.cards = seen.cards !== undefined && d.cards !== undefined ? seen.cards + d.cards : undefined;
    }
  }
  return out;
}

/** The cards drawn before a question in all — `undefined` when any drawer's count is not stated. */
export function drawnCardCount(drawers: ReadonlyArray<DeferralDrawer>): number | undefined {
  let total = 0;
  for (const d of drawers) {
    if (d.cards === undefined) {
      return undefined;
    }
    total += d.cards;
  }
  return total;
}
