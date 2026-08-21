/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * BONUS ACTION MODEL — the pure derivations behind a card-granted action taken
 * OUTSIDE the turn's own two («Фора» / Head Start: «immediately take 2
 * actions», during the PRELUDES phase).
 *
 * Everything here reads ONE server artifact: the `bonusActionPrompt` marker the
 * action menu carries (`Player.takeAction` → `ServerModel.getWaitingFor`).
 * Deliberately NOT the prompt's title, and deliberately not a phase check:
 *
 *  - the menu carries the ORDINARY action-menu title on purpose, so that every
 *    surface which classifies an action menu (the task router, the RT/LT quick
 *    wheels, the status label) keeps classifying it as one. A title check could
 *    therefore never tell the two apart even before i18n rewrote it;
 *  - `game.phase` is PRELUDES for the whole prelude phase, bonus action or not.
 *
 * The marker is the only honest discriminator, and it carries the readout with
 * it (`remaining` of `granted`), so no surface has to count anything itself.
 *
 * Unit-tested under the server runner:
 * tests/client/components/console/bonusAction.spec.ts
 */
import {CardName} from '@/common/cards/CardName';
import {BonusActionPromptMeta} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/** The live bonus-action marker, or undefined when this is a normal prompt. */
export function bonusActionMeta(view: PlayerViewModel): BonusActionPromptMeta | undefined {
  return view.waitingFor?.bonusActionPrompt;
}

/**
 * The viewer OWES a card-granted bonus action right now — the server is
 * standing on a marked action menu.
 *
 * This is the existence condition of the start workspace's bonus stage, the
 * reason the workspace may not settle, and the reason the board excursion may
 * not release. All three read this one function so they cannot disagree about
 * whether the player is still spending bonuses.
 */
export function bonusActionsOwed(view: PlayerViewModel): number {
  return view.thisPlayer.bonusActions ?? 0;
}

/**
 * THE WINDOW IS OPEN — a card-granted action is still owed.
 *
 * Read from the LEDGER (`Player.bonusActions`, public on every seat's model),
 * NOT from the prompt marker. The marker identifies ONE prompt — the free
 * action menu — and a bonus action is a whole TURN: the player plays a card and
 * the next three prompts are a payment, a placement and whatever the card
 * triggered, none of them marked. Keying the window on the marker made the
 * start workspace try to come back in the MIDDLE of the player's own card play;
 * the ledger cannot do that, because it only drops when the action is fully
 * resolved.
 *
 * Same shape as `firstActionOwed` reading `pendingInitialActions`.
 */
export function bonusActionOwed(view: PlayerViewModel): boolean {
  return bonusActionsOwed(view) > 0;
}

/**
 * The bonus action is served as the FREE ACTION MENU — the one that needs the
 * WHOLE BOARD, and therefore the one the start workspace hands the screen over
 * for.
 *
 * A bonus can also be spent on a prompt the START WORKSPACE serves ITSELF: a
 * corporation's mandatory first action IS, by its own wording, the player's
 * first action, so `Player.takeAction` offers it in place of a bonus menu and
 * spends a bonus on it. That prompt carries its own `startGamePrompt` marker
 * and has a stage of its own inside the workspace — announcing a board trip
 * for it would hand the screen away from the very surface that is serving it.
 *
 * So the two questions are deliberately separate: `bonusActionOwed` answers
 * «is a bonus outstanding» (the status chip, the withheld turn-control verbs),
 * this one answers «does the player have to go to the board for it» (the
 * stage, the excursion barrier).
 */
export function bonusActionOnBoard(view: PlayerViewModel): boolean {
  return bonusActionOwed(view) && view.waitingFor?.startGamePrompt === undefined;
}

/**
 * The bonus belongs to the GAME START, so the Game Start Workspace is its home
 * — it must SERVE the bonus (own the pad, own the frame, be the thing the
 * player is handed back to) even after a reload has wiped every client latch.
 *
 * Generation 1 IS the start of the game: the same honest domain discriminator
 * `corpFirstActionInStartFlow` uses, and for the same reason — no client latch
 * and it survives a reload. A future card granting bonus actions in a LATER
 * generation is served by the board alone, with no workspace to return to,
 * which is correct: resurrecting the start workspace mid-game would be a lie
 * about where the player is.
 */
export function bonusActionInStartFlow(view: PlayerViewModel): boolean {
  return view.game.generation === 1 && bonusActionOnBoard(view);
}

/** The card that granted the bonuses (its name IS its i18n key). */
export function bonusActionSource(view: PlayerViewModel): CardName | undefined {
  return bonusActionMeta(view)?.source ?? view.thisPlayer.bonusActionSource;
}

/** Bonus actions still owed, INCLUDING the one being asked for now. */
export function bonusActionRemaining(view: PlayerViewModel): number {
  return bonusActionMeta(view)?.remaining ?? bonusActionsOwed(view);
}

/** How many the card granted in this batch (the `M` of `N / M`). */
export function bonusActionGranted(view: PlayerViewModel): number {
  return bonusActionMeta(view)?.granted ?? view.thisPlayer.bonusActionsGranted ?? 0;
}

/**
 * The 1-based INDEX of the bonus action being taken now. Clamped, because a
 * second grant inside one window extends the batch (`granted` grows with
 * `remaining`) and a readout must never print «3 / 2».
 */
export function bonusActionIndex(view: PlayerViewModel): number {
  const granted = bonusActionGranted(view);
  const remaining = bonusActionRemaining(view);
  if (granted <= 0 || remaining <= 0) {
    return 0;
  }
  return Math.min(granted, Math.max(1, granted - remaining + 1));
}

/**
 * WHY «Пропустить ход» and «Пас» are withheld while a bonus action stands.
 *
 * A blocked control ALWAYS names ONE concrete blocker (the console's
 * blocked-reason contract), and here the honest one is not «сейчас недоступно»:
 * the menu is live, the player's turn is very much on, and every OTHER verb in
 * the wheel works. What cannot happen is conceding a generation that has not
 * started or ending a turn slot the bonus action does not occupy — which is
 * also exactly why the server does not offer them (issue #5852: passing here
 * used to strand the player's second prelude and cost them all of generation 1).
 *
 * '' when no bonus action stands — the caller keeps its ordinary reason.
 */
export const BONUS_ACTION_TURN_CONTROL_REASON = 'Bonus actions must be spent — you cannot pass or end your turn during them';

export function bonusActionTurnControlReason(view: PlayerViewModel): string {
  return bonusActionOwed(view) ? BONUS_ACTION_TURN_CONTROL_REASON : '';
}
