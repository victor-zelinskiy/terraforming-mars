/*
 * AN OPTIONAL CHOICE — «choose one of these, or decline» — answered on ONE surface, the decline a BUTTON (the owner's
 * decisions, 2026-10-13).
 *
 * The server marks the refusal of an `or` STRUCTURALLY (`{kind: 'skip'}` — `optionMetadata.skip()`), and it used to
 * reach the screen as one more ROW. Mars University's question was a list «Выберите карту, чтобы сбросить › / Ничего
 * не делать» standing BEFORE the hand album — a whole extra step between the press and the pick — and a steal's «Не
 * красть» stood among the targets as if it were one of them. Now:
 *  · the decline LEAVES the rows: it is RT (the console's «finish this surface's choice» — «Забрать все», «Продать»,
 *    «Подтвердить выбранные»; finishing with nothing chosen IS the refusal) and a plate in the surface's question line
 *    that repeats the button and names what is forgone (Y is Information Mode on every surface, View the journal);
 *  · a choice whose ONE answer is itself a pick (Mars University: a discard from the hand) has no list at all — the
 *    surface opens that pick directly, the decline inside it;
 *  · a YES / NO — one leaf offer that is not an attack (Curiosity II, St Joseph, Neptunian Power Consultants, Pharmacy
 *    Union) — keeps its two equal cards: there is no pick to fold the refusal into (the owner's call).
 * B is never the decline (the bot-attack law, `botAttackModel`): B is one level back, a refusal is a deliberate press.
 * Nothing here reads a title — the marker, the option types and the server's own `choiceContext` decide.
 */
import {Message} from '@/common/logs/Message';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {OptionMetadata, OrOptionsModel, PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

export type DeclineModel = {
  /** The decline's own index in `OrOptions.options` — the answer is `{type: 'or', index, response: {type: 'option'}}`. */
  index: number;
  /** The refusal's words: the server's own title, or the shape's key («Не сбрасывать» for a discard). */
  label: string | Message;
  /** What the refusal FORGOES — the offer's own result (a discard's exchange: «+1 [card]»), drawn struck on the plate.
   *  Empty when the offer is several targets (the words say it) — never a guessed number (invariant 4: no silent loss,
   *  and no invented one either). */
  forgone: ReadonlyArray<ActionEffect>;
};

export type OptionalChoice = {
  decline: DeclineModel;
  /** The ANSWERS the surface shows — every option but the decline, in the server's order, by option index. */
  answers: ReadonlyArray<number>;
  /** THE ONE NESTED PICK that is the whole offer (Mars University's discard): the surface opens it directly. */
  pick?: number;
  /** A YES / NO: one leaf offer that targets nobody and is no attack — the two cards stay as they are. */
  binary: boolean;
};

/** The decline key of a DISCARD pick — the server says «Do nothing», the player is deciding not to throw a card away. */
export const DISCARD_DECLINE_KEY = 'Do not discard';

/** THE decline test — the server's structural skip marker on a leaf option, never a title. */
export function isDeclineOption(option: PlayerInputModel | undefined): boolean {
  return option?.type === 'option' && (option as {metadata?: OptionMetadata}).metadata?.kind === 'skip';
}

function targetsPlayer(option: PlayerInputModel): boolean {
  return (option as {metadata?: OptionMetadata}).metadata?.player?.color !== undefined;
}

/** What declining forgoes: a discard's own exchange (what it would have bought). */
function forgoneOf(pick: PlayerInputModel | undefined): ReadonlyArray<ActionEffect> {
  const exchange = pick?.type === 'card' ? (pick as SelectCardModel).discardPrompt?.exchange : undefined;
  if (exchange === undefined || exchange.amount <= 0) {
    return [];
  }
  return [{direction: 'gain', icon: exchange.icon, amount: exchange.amount}];
}

/**
 * Read an input as an OPTIONAL CHOICE: an `or` with exactly ONE skip-marked decline beside at least one answer.
 * `undefined` for anything else (a mandatory `or`, two declines — never guessed).
 */
export function optionalChoiceOf(input: PlayerInputModel | undefined): OptionalChoice | undefined {
  if (input?.type !== 'or') {
    return undefined;
  }
  const or = input as OrOptionsModel;
  const declines = or.options.map((o, i) => (isDeclineOption(o) ? i : -1)).filter((i) => i >= 0);
  if (declines.length !== 1) {
    return undefined;
  }
  const index = declines[0];
  const answers = or.options.map((_, i) => i).filter((i) => i !== index);
  if (answers.length === 0) {
    return undefined;
  }
  const single = answers.length === 1 ? or.options[answers[0]] : undefined;
  const pick = single !== undefined && single.type !== 'option' ? answers[0] : undefined;
  const binary = single !== undefined && single.type === 'option' && or.choiceContext?.mode !== 'attack' && !targetsPlayer(single);
  const pickInput = pick !== undefined ? or.options[pick] : undefined;
  const discard = pickInput?.type === 'card' && (pickInput as SelectCardModel).discardPrompt !== undefined;
  return {
    decline: {
      index,
      label: discard ? DISCARD_DECLINE_KEY : or.options[index].title,
      forgone: forgoneOf(pickInput),
    },
    answers,
    pick,
    binary,
  };
}

/** The decline's answer — byte-identical to the historical radio pick of that option. */
export function declineResponse(choice: OptionalChoice): {type: 'or', index: number, response: {type: 'option'}} {
  return {type: 'or', index: choice.decline.index, response: {type: 'option'}};
}

/** The decline moves to a button and a plate on every optional choice that is not a YES / NO. */
export function declineIsButton(choice: OptionalChoice | undefined): choice is OptionalChoice {
  return choice !== undefined && !choice.binary;
}
