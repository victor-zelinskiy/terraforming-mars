import {PlayerViewModel} from '@/common/models/PlayerModel';

/**
 * ONE source of the "why can't I take this top-level action right now" turn
 * reason, shared by every console surface (the turn menu, the LT basic-actions
 * wheel, the Standard-Projects screen, milestones/awards, colony trade, the
 * hand block, …) so none can drift.
 *
 * The trap this fixes: a surface computed `myTurn` as "the free ACTION MENU is
 * live" (`hasTurn` — the server currently offers play-card / std-project / …).
 * The moment the viewer is mid a MANDATORY sub-decision (a corp first action, a
 * forced off-turn reaction, a tile placement, any deferred prompt), that menu
 * is NOT offered, so `myTurn` is false — and every such surface then read
 * «Сейчас не ваш ход», which is simply FALSE (the chip still shows «ДЕЙСТВИЕ
 * 1/2» — it very much IS the viewer's turn, they just have to FINISH the
 * current decision first).
 *
 * The honest discriminator is the viewer's OWN pending input: `view.waitingFor`
 * is defined iff the server is waiting on THIS player for something — the action
 * menu OR a mandatory sub-prompt. So:
 *   - waitingFor defined + menu not live → "Finish your current action first".
 *   - waitingFor undefined              → genuinely "Not your turn".
 * (This mirrors the hydro screen's `turnState`, the original reference.)
 */

/** English i18n keys (the text IS the key). */
export const NOT_YOUR_TURN = 'Not your turn to take any actions';
export const FINISH_CURRENT_ACTION = 'Finish your current action first';

/**
 * The server is waiting on the VIEWER for input — it is their turn, whether the
 * free action menu is live or a specific mandatory decision is mid-flight.
 * `view.waitingFor` is the viewer's own prompt; it is undefined only on a
 * genuine opponent turn (setup simultaneous phases aside, which use dedicated
 * surfaces).
 */
export function awaitingViewerInput(view: PlayerViewModel): boolean {
  return view.waitingFor !== undefined;
}

/**
 * The off-turn reason keyed on {@link awaitingViewerInput}: a pending decision
 * the viewer must finish first (still their turn) vs a genuine opponent turn.
 * Callers that only hold the boolean (a PURE model built from a context object)
 * pass it directly; callers holding the view use
 * `offTurnReason(awaitingViewerInput(view))`.
 */
export function offTurnReason(awaitingInput: boolean): string {
  return awaitingInput ? FINISH_CURRENT_ACTION : NOT_YOUR_TURN;
}

/**
 * Is the hand's PLAY WINDOW closed — i.e. does the turn note (the reason
 * above) join a hand card's own reasons (the hand verdict bar AND the
 * fullscreen panel read this one flag)?
 *
 * Closed when a decision is already owed (`actionBlocked` — the shell's one
 * `actionBlockedReason`), or when the server offers no play AND the viewer is
 * not standing at the action menu (an opponent's turn, a mandatory
 * sub-prompt). The trap: `Player.getActions` simply OMITS «Play project card»
 * when nothing in hand is playable, so «no play offer» alone read as «the
 * window is closed» on the viewer's own free turn — and every card stood with
 * its true rules reason PLUS «Сначала завершите текущее действие», with
 * nothing to finish. The ACTION MENU standing IS the open window.
 */
export function handPlayWindowClosed(input: {playOffered: boolean, atActionMenu: boolean, actionBlocked: boolean}): boolean {
  if (input.actionBlocked) {
    return true;
  }
  return !input.playOffered && !input.atActionMenu;
}
