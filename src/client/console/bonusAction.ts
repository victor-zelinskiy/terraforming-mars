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
export function bonusActionOwed(view: PlayerViewModel): boolean {
  return bonusActionMeta(view) !== undefined;
}

/** The card that granted the bonuses (its name IS its i18n key). */
export function bonusActionSource(view: PlayerViewModel): CardName | undefined {
  return bonusActionMeta(view)?.source;
}

/** Bonus actions still owed, INCLUDING the one being asked for now. */
export function bonusActionRemaining(view: PlayerViewModel): number {
  return bonusActionMeta(view)?.remaining ?? 0;
}

/** How many the card granted in this batch (the `M` of `N / M`). */
export function bonusActionGranted(view: PlayerViewModel): number {
  return bonusActionMeta(view)?.granted ?? 0;
}

/**
 * The 1-based INDEX of the bonus action being taken now. Clamped, because a
 * second grant inside one window extends the batch (`granted` grows with
 * `remaining`) and a readout must never print «3 / 2».
 */
export function bonusActionIndex(view: PlayerViewModel): number {
  const meta = bonusActionMeta(view);
  if (meta === undefined) {
    return 0;
  }
  return Math.min(meta.granted, Math.max(1, meta.granted - meta.remaining + 1));
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
