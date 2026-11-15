/*
 * A QUESTION NOBODY CAN ANSWER, SAID AT ITS SOURCE (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * The engine may ask a seat a question that has no answer — «pick one card» over an empty list, «choose a player»
 * with nobody to choose (only `SelectSpace` refuses to be built that way). The seat's page serves it perfectly and
 * can do nothing; no net of the console sees a freeze, and no rebuild helps. The page names it (`[question]
 * unanswerable` — the supervisor), but a page is not always there to speak, and it is the SERVER's defect: this is
 * where it is said by the process that made it — once per question, when the question's wire model is built (the
 * model every view carries anyway: no extra pass over the game), by THE SAME judge the page uses
 * (`common/inputs/promptAnswerable.ts`).
 *
 * SAID, never «fixed»: the engine's question has no generic answer (which card would a seat have picked?), and an
 * answer invented here would be a rule nobody wrote. Each report is one card's defect, with the game's save beside it.
 */
import {unanswerableReason} from '../../common/inputs/promptAnswerable';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {IPlayer} from '../IPlayer';
import {reportServerError} from '../diagnostics/serverDiagnostics';

/** The question each seat was last reported for (its serial) — one report per question. */
const said = new WeakMap<IPlayer, number>();

/** Called where the top-level prompt's model is built. Never throws. */
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
  const title = typeof model.title === 'string' ? model.title : model.title.message;
  const what = `${model.type} «${title}»: ${why} — phase ${player.game.phase}, generation ${player.game.generation}`;
  console.error(`UnanswerablePrompt: a seat is asked a question nobody can answer — ${what}`);
  reportServerError('an unanswerable question', new Error(what));
  return why;
}
