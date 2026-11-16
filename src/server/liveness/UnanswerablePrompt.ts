/*
 * A QUESTION NOBODY CAN ANSWER IS NEVER ASKED (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * The engine could ask a seat a question that has no answer — «pick one card» over an empty list, «choose a player»
 * with nobody to choose. The seat's page serves it perfectly and can do nothing; no net of the console sees a
 * freeze, no rebuild helps (the next page is asked the same), and the table is over with nothing said.
 *
 * THE ENGINE'S OWN PRECEDENT is `SelectSpace`: built with no legal cell it THROWS («No available spaces») — the
 * action that would have asked it fails, in the request that tried, and the seat keeps the question it had
 * (`Player.process` puts it back). This module extends that law to every kind of question, at the ONE point every
 * question passes: `Player.setWaitingFor` REFUSES an input that is unanswerable by construction
 * (`refuseUnanswerableInput`). What follows is what already follows an engine error:
 *
 *   · inside a seat's own request — HTTP 400 with the reason, the seat's prompt restored, the game goes on;
 *   · inside MarsBot's turn (a bot's attack that asks its victim for a card they do not have) — the turn's own
 *     containment: the effect is skipped, said in the journal, the turn ends (`AutomaController`).
 *
 * NOT AN INVENTED ANSWER: nothing is picked for the seat and no rule is written here — the question simply is not
 * asked, and the failure is the action's (reported with its stack: each one is a card's defect to fix in the card).
 *
 * TWO JUDGES, ONE LAW. `unanswerableInput` reads the engine's own objects (cheap, structural, CONSERVATIVE — only
 * what cannot be answered whatever the surface); `noteUnanswerablePrompt` reads the wire model with the page's own
 * judge (`common/inputs/promptAnswerable.ts`) where that model is built anyway — for whatever shape the structural
 * read does not know: said once per question, never a throw (the view must still be served).
 */
import {unanswerableReason} from '../../common/inputs/promptAnswerable';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {reportServerError} from '../diagnostics/serverDiagnostics';

/** The question was refused: it could not have been answered. An ENGINE error (never a rule's refusal). */
export class UnanswerableInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnanswerableInputError';
  }
}

type Shape = {
  type: string,
  optional?: boolean,
  options?: ReadonlyArray<PlayerInput>,
  cards?: ReadonlyArray<unknown>,
  config?: {min?: number},
  players?: ReadonlyArray<unknown>,
  parties?: ReadonlyArray<unknown>,
  min?: number,
  max?: number,
};

/**
 * WHY an input of the engine has no answer — or `undefined` (answerable, or a kind this read does not judge).
 * Mirrors `promptAnswerable.unanswerableReason` over the engine's own objects; an OPTIONAL input is never judged.
 */
export function unanswerableInput(input: PlayerInput | undefined): string | undefined {
  const shape = input as unknown as Shape | undefined;
  if (shape === undefined || shape.optional === true) {
    return undefined;
  }
  switch (shape.type) {
  case 'or': {
    const options = shape.options ?? [];
    if (options.length === 0) {
      return 'an OR with no branch';
    }
    // An OR is answered through ONE branch: it is dead only when every branch is.
    const dead = options.map((option) => unanswerableInput(option));
    return dead.every((why) => why !== undefined) ? `every branch of the OR is unanswerable (${dead[0]})` : undefined;
  }
  case 'and': {
    // An AND is answered through ALL its parts: one dead part kills it.
    for (const option of shape.options ?? []) {
      const why = unanswerableInput(option);
      if (why !== undefined) {
        return `a part of the AND is unanswerable (${why})`;
      }
    }
    return undefined;
  }
  case 'card': {
    const min = shape.config?.min ?? 1;
    const have = shape.cards?.length ?? 0;
    return have < min ? `${min} card(s) asked of ${have}` : undefined;
  }
  case 'projectCard':
    return (shape.cards?.length ?? 0) === 0 ? 'a card to play asked of an empty list' : undefined;
  case 'player':
    return (shape.players?.length ?? 0) === 0 ? 'a player asked with nobody to choose' : undefined;
  case 'delegate':
    return (shape.players?.length ?? 0) === 0 ? 'a delegate asked with nobody to choose' : undefined;
  case 'party':
    return (shape.parties?.length ?? 0) === 0 ? 'a party asked with none to choose' : undefined;
  case 'amount':
    return typeof shape.min === 'number' && typeof shape.max === 'number' && shape.max < shape.min ?
      `an amount asked between ${shape.min} and ${shape.max}` : undefined;
  default:
    // (`space` refuses itself at its construction; every other kind is not judged here.)
    return undefined;
  }
}

function titleOf(title: PlayerInput['title'] | PlayerInputModel['title']): string {
  return typeof title === 'string' ? title : title.message;
}

/**
 * THE REFUSAL — called by `Player.setWaitingFor` before anything of the seat is touched. Says it (a server error with
 * what was asked; no id of the game or of a seat) and THROWS: the action that would have asked fails where it runs.
 */
export function refuseUnanswerableInput(player: IPlayer, input: PlayerInput): void {
  const why = unanswerableInput(input);
  if (why === undefined) {
    return;
  }
  const what = `${input.type} «${titleOf(input.title)}»: ${why} — phase ${player.game.phase}, generation ${player.game.generation}`;
  const error = new UnanswerableInputError(`A question nobody can answer was not asked — ${what}`);
  console.error(`UnanswerablePrompt: refused — ${what}`);
  reportServerError('an unanswerable question (refused)', error);
  throw error;
}

/** The question each seat was last reported for (its serial) — one report per question. */
const said = new WeakMap<IPlayer, number>();

/** Called where the top-level prompt's model is built — the page's own judge over the wire model. Never throws. */
export function noteUnanswerablePrompt(player: IPlayer, model: PlayerInputModel): string | undefined {
  let why: string | undefined;
  try {
    why = unanswerableReason(model);
  } catch {
    return undefined;
  }
  if (why === undefined || said.get(player) === player.waitingForSerial) {
    return why;
  }
  said.set(player, player.waitingForSerial);
  const what = `${model.type} «${titleOf(model.title)}»: ${why} — phase ${player.game.phase}, generation ${player.game.generation}`;
  console.error(`UnanswerablePrompt: a seat is asked a question nobody can answer — ${what}`);
  reportServerError('an unanswerable question', new Error(what));
  return why;
}
