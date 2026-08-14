/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHO PRESENTS A DRAWN BATCH — the surface, or the fullscreen viewer?
 *
 * A one-card draw has a HEADLESS presentation: the modal renders nothing and
 * the received card IS the fullscreen viewer (mandatory, no close but a take).
 * It exists because a lone received card has no context worth framing — the
 * board-cell cover lift is the reference case.
 *
 * Inside a WORKSPACE the opposite is true: the card's whole meaning is that
 * THIS action produced it, and that context is standing on screen around it.
 * Throwing the player into a full-bleed viewer would be exactly the «suddenly
 * a different interface» break the embedding removes.
 *
 * ⚠️ OWNERSHIP IS DECIDED ONCE PER BATCH, AND ONLY EVER HARDENS. The claim is
 * LIVE, and it ends at the TAKE: the last card's intake stages its proxies,
 * the workspace folds, and the claim is released — one tick before the batch
 * is dismissed. Re-deriving the presentation inside that window flipped a
 * one-card embedded reveal to headless, and headless means exactly one thing:
 * open the viewer. Pressing «A Взять карту» threw the player fullscreen over
 * the very card that was flying into their hand. So the host passes BOTH the
 * live answer and the latched one, and either is enough.
 *
 * PURE: no DOM, no reactive reads. The host passes what it knows.
 */

export type DrawnRevealPresentationCtx = {
  /**
   * Cards in the batch — the TOTAL, never the untaken remainder. Stable by
   * design: a multi-card batch taken down to one still presents as multi, so
   * the mode can never flip under the player mid-session.
   */
  cardCount: number,
  /** Cards still to take. 0 = finished, but the batch is still on screen. */
  untakenCount: number,
  /** A workspace owns this batch RIGHT NOW (embedded, or a live claim). */
  ownedNow: boolean,
  /** A workspace owned it at ANY point in this batch's life (the latch). */
  ownedEver: boolean,
  /**
   * The payout owes a MANDATORY closing step hosted inside the modal (Pluto's
   * «draw N, discard N»). The headless fullscreen has nowhere to put it, so
   * even a one-card payout keeps the real modal.
   */
  hasClosingStep: boolean,
};

/** Is this batch presented HEADLESS — the fullscreen viewer IS the reveal? */
export function drawnRevealHeadless(ctx: DrawnRevealPresentationCtx): boolean {
  if (ctx.hasClosingStep || ctx.ownedNow || ctx.ownedEver) {
    return false;
  }
  return ctx.cardCount === 1;
}

/**
 * May the headless viewer be (re-)opened right now?
 *
 * Headless, AND there is still something to take. The viewer is opened
 * `mandatory: true` around a take bridge, so a batch whose cards have all gone
 * has no business in it — the only way out would be a take that no-ops. And a
 * batch outlives its last take by a tick or more (the intake's staged commit,
 * then the follow-up hold), so that window really renders.
 */
export function drawnRevealViewerOpens(ctx: DrawnRevealPresentationCtx): boolean {
  return drawnRevealHeadless(ctx) && ctx.untakenCount > 0;
}

/**
 * THE SURFACE IS FINISHED — render nothing at all.
 *
 * A batch a workspace owned, whose host has now LET GO, with nothing left to
 * take. That is the closing tick of every embedded take: the intake's proxies
 * already stand over the cards, `result-detached` folds the workspace, and the
 * batch is dismissed a tick later. What renders in between is a reveal that has
 * lost its zone — so it re-dresses as the STANDALONE band and briefly presents
 * (and animates out) over the board, outside the workspace it belonged to. The
 * artifact of a workspace never presents standalone; when its host is gone and
 * its content is in flight, it presents NOWHERE.
 *
 * Deliberately narrow. `untakenCount === 0` is what makes it safe: a claim
 * dropped for any OTHER reason (an orphaned claim `reconcileWorkspaceOutcome`
 * releases so the standalone presenter can take over, a workspace the player
 * collapsed) leaves cards still to take, and those must keep their surface —
 * blanking them would strand the prompt. And a payout still owing its closing
 * step is not finished at all, however many cards are left.
 */
export function drawnRevealDetached(ctx: DrawnRevealPresentationCtx): boolean {
  return ctx.ownedEver && !ctx.ownedNow && !ctx.hasClosingStep && ctx.untakenCount === 0;
}

// ── The DECK-CHECK RESULT (`lastReveal`) — the same question, other artifact ──

export type ResultRevealPresentationCtx = {
  /** The server is reporting a verdict at all (`lastReveal` exists). */
  present: boolean,
  /** The player has already acknowledged THIS verdict (the dismissed key). */
  acknowledged: boolean,
  /** A workspace holds a `deck-check` CLAIM on this verdict's acting card. */
  workspaceOwns: boolean,
  /** The claiming workspace's stage is mounted right now (the composer's own
   *  mirror). Kept only as a second, weaker witness — see below. */
  stageMounted: boolean,
};

/**
 * DOES THE STANDALONE RESULT OVERLAY PRESENT THIS VERDICT?
 *
 * Only when nobody else owns it. A deck-check the player started inside
 * «ДЕЙСТВИЯ КАРТ» is presented by that workspace's own «Результат вскрытия»
 * stage, and the full-bleed overlay must neither double-mount over it nor rise
 * BESIDE it.
 *
 * ⚠️ THE CLAIM IS THE ANSWER, NOT THE MOUNTED STAGE. `consoleActionComposerUi.
 * revealClaim` is a component-lifetime mirror: it is cleared by the composer's
 * own unmount, and a PARK performs exactly that unmount while the workspace
 * still owns the flow (`resetConsoleActionComposerUi` in `parkWorkspaceStack`).
 * So «свернуть» on the verdict cleared the mirror, `lastReveal` was still
 * server state (it lives until the player's next input), and the legacy
 * full-bleed modal rose over the board carrying the very verdict the player had
 * just minimized — the same information twice, in the shape the embedded flow
 * exists to retire. The CLAIM survives the park (module state, released by the
 * ack / the workspace's genuine end), which is what makes it the honest
 * witness; the mirror stays only as a second one, for the frames before a
 * repeat-reveal claim is raised.
 *
 * PURE: the shell passes what it knows.
 */
export function resultRevealPresents(ctx: ResultRevealPresentationCtx): boolean {
  return ctx.present && !ctx.acknowledged && !ctx.workspaceOwns && !ctx.stageMounted;
}
