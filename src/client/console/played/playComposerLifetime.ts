/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLAY COMPOSER ANSWERS ONE PROMPT — the one it was opened on, named by the
 * server's own serial (`PlayerInputModel.promptId`, stamped per `setWaitingFor`
 * and KEPT across a refused submit — `Player.process`).
 *
 * The field report (2026-10-23, «Корпоративный шпионаж» pushing MarsBot back):
 * «Сбой системы · Unknown card name Corporate Espionage» right after the
 * Hydronetwork had played the move. The play had landed; then the SAME batch
 * was posted a second time against the next action menu, which no longer
 * offered the card. Three facts lined up:
 *
 *  1. Once every other seat has passed (and in every solo game) the action
 *     counter is never reset, so EVERY menu reads «Take your next action» —
 *     `promptIdentityKey` (type | title) cannot tell the menu the play answered
 *     from the one that followed it, and the shell's «the prompt moved on»
 *     reset never fired: the composer outlived its own accepted play.
 *  2. The composer re-armed its commit on EVERY fresh view.
 *  3. The espionage play arms no landing scene (the Hydronetwork owns its whole
 *     presentation), so nothing else held the pad — the next A on the track's
 *     result went to the composer hidden under it, and it posted again.
 *
 * Two pure answers close the class for every card, not only that one:
 *
 *  · `composerReArms` — a fresh view may re-arm the commit only while the
 *    prompt the composer ANSWERED still stands (a view that is not the answer —
 *    a WS frame mid-flight). A moved serial is the server's word that the answer
 *    was TAKEN: the composer never fires again. A refusal re-arms explicitly
 *    (`resetSubmitting`), never through this.
 *  · `playComposerOutlived` — the shell releases a composer whose prompt the
 *    server no longer holds, unless something still owns its lifetime: the
 *    landing scene (its phases clear it) or the play's own outcome being handed
 *    off in the play's host (the tableau stands until the outcome presents).
 */

/** The facts `composerReArms` reads. */
export type ComposerAnswerState = {
  /** The serial of the prompt the composer's commit ANSWERED (undefined: not answered yet). */
  answeredFor: number | undefined;
  /** The serial of the prompt the server holds now (undefined: no prompt). */
  live: number | undefined;
};

/**
 * May a fresh view re-arm the composer's commit? Only when nothing was answered
 * yet, or when the answered prompt still stands — a moved serial means the play
 * was taken, and a taken play is never posted twice.
 */
export function composerReArms(s: ComposerAnswerState): boolean {
  return s.answeredFor === undefined || s.answeredFor === s.live;
}

/** The facts `playComposerOutlived` reads. */
export type ComposerLifetimeState = {
  /** The serial of the prompt the composer was OPENED on (undefined: unknown — never released by this rule). */
  composedFor: number | undefined;
  /** The serial of the prompt the server holds now (undefined: no prompt). */
  live: number | undefined;
  /** The landing scene holds the composer — its own phases end it. */
  heroOwns: boolean;
  /** The play's own outcome is still claimed in the play's host — the handoff ends it. */
  outcomeOwns: boolean;
};

/**
 * Has the composer outlived the prompt it was opened on? True when the server
 * holds another prompt (or none) and no scene or outcome owns the composer's
 * lifetime — the play was made (or the question is gone), and a composer left
 * standing would only re-render as a band with a live commit for a card that
 * is no longer in the hand.
 */
export function playComposerOutlived(s: ComposerLifetimeState): boolean {
  if (s.composedFor === undefined || s.heroOwns || s.outcomeOwns) {
    return false;
  }
  return s.live !== s.composedFor;
}
