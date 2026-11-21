/*
 * A QUESTION NOBODY CAN ANSWER (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * Every freeze the console's nets can see is a screen that does not SERVE the server's question. There is one they
 * cannot: a question that is served perfectly and has no answer — «pick one card» over an empty list, «choose a
 * player» with nobody to choose, an OR with no branch. The surface stands, the pad is taken, the arbiter reads a
 * working screen; no rebuild helps, because the next page is asked the same thing. The game is over for the table
 * and nothing says why.
 *
 * It is the engine's defect (a card that asks without checking), never the console's — but it is the console that
 * the player is looking at, and the only place the defect can be NAMED with the game's save beside it. This is the
 * judge: PURE, over the wire model the page already holds, and CONSERVATIVE — only the shapes that are unanswerable
 * by construction, whatever the surface (`undefined` = answerable, or not judged). A prompt the engine marks
 * `optional` is never judged: the page does not wait on it.
 */
import {PlayerInputModel} from '../models/PlayerInputModel';

/** Why the question has no answer (one phrase, for a diagnostic line) — or `undefined`. */
export function unanswerableReason(model: PlayerInputModel | undefined): string | undefined {
  if (model === undefined || model.optional === true) {
    return undefined;
  }
  switch (model.type) {
  case 'or': {
    if (model.options.length === 0) {
      return 'an OR with no branch';
    }
    // An OR is answered through ONE branch: it is dead only when every branch is.
    const dead = model.options.map((option) => unanswerableReason(option));
    return dead.every((why) => why !== undefined) ? `every branch of the OR is unanswerable (${dead[0]})` : undefined;
  }
  case 'and':
  case 'initialCards': {
    // An AND is answered through ALL its parts: one dead part kills it.
    for (const option of model.options) {
      const why = unanswerableReason(option);
      if (why !== undefined) {
        return `a part of the ${model.type === 'and' ? 'AND' : 'opening'} is unanswerable (${why})`;
      }
    }
    return undefined;
  }
  case 'card':
    return model.cards.length < model.min ? `${model.min} card(s) asked of ${model.cards.length}` : undefined;
  case 'projectCard':
    if (model.cards.length === 0) {
      return 'a card to play asked of an empty list';
    }
    // A list in which EVERY card is refused (the standard projects of a seat that can pay for none) is the same
    // dead question with rows on it — the engine fuzz, FREEZE ZERO stage 5 (seed 51456).
    return model.cards.every((card) => card.isDisabled === true) ? 'a card to play asked of a list with none enabled' : undefined;
  case 'space':
    // (A placement the player may cancel still has an answer — the cancel.)
    return model.spaces.length === 0 && model.placementContext?.cancellable !== true ? 'a cell asked with no legal cell' : undefined;
  case 'player':
    return model.players.length === 0 ? 'a player asked with nobody to choose' : undefined;
  case 'delegate':
    return model.players.length === 0 ? 'a delegate asked with nobody to choose' : undefined;
  case 'party':
    return model.parties.length === 0 ? 'a party asked with none to choose' : undefined;
  case 'amount':
    return model.max < model.min ? `an amount asked between ${model.min} and ${model.max}` : undefined;
  default:
    return undefined;
  }
}
